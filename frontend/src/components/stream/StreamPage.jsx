import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStream } from './StreamContext';
import VideoOverlay from './VideoOverlay';

// Format elapsed seconds as HH:MM:SS or MM:SS
function formatDuration(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function StreamPage() {
    const navigate = useNavigate();
    const { webrtcRef, sessionInfo, setSessionInfo } = useStream();

    const videoRef = useRef(null);

    // Audio state
    const [micMuted, setMicMuted] = useState(false);
    const [speakerMuted, setSpeakerMuted] = useState(false);

    // Controls auto-hide
    const [controlsVisible, setControlsVisible] = useState(true);
    const hideTimer = useRef(null);

    // Stream state
    const [connected, setConnected] = useState(false);
    const [streamStopped, setStreamStopped] = useState(false); // remote called stop

    // Live duration timer
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef(null);

    // ---- Guard: redirect if no session ----
    useEffect(() => {
        if (!sessionInfo) {
            navigate(-1);
        }
    }, []);// eslint-disable-line

    // ---- Attach stream and listen to WebRTC events ----
    useEffect(() => {
        if (!sessionInfo) return;

        const webrtc = webrtcRef.current;
        if (!webrtc) return;

        const mode = sessionInfo.mode;

        // Attach elapsed timer from session start time
        const startTime = sessionInfo.streamStartTime || new Date();
        const updateElapsed = () => {
            setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
        };
        updateElapsed();
        timerRef.current = setInterval(updateElapsed, 1000);

        if (mode === 'transmitter') {
            // Local camera preview
            const localStream = webrtc.localStream;
            if (localStream && videoRef.current) {
                videoRef.current.srcObject = localStream;
                videoRef.current.muted = true; // always mute self-view
                videoRef.current.play().catch(() => { });
                setConnected(true);
            }
        } else {
            // Monitor: set onStream callback and also check if already arrived
            webrtc.onStream((stream) => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.muted = false;
                    videoRef.current.play().catch(() => { });
                    setConnected(true);
                }
            });

            if (webrtc.remoteStream && videoRef.current) {
                videoRef.current.srcObject = webrtc.remoteStream;
                videoRef.current.muted = false;
                videoRef.current.play().catch(() => { });
                setConnected(true);
            }
        }

        // Listen for stream-stopped from remote (transmitter stopped → monitor gets notified)
        const origHandleMessage = webrtc._onStreamStopped;
        webrtc._onStreamStopped = () => {
            setStreamStopped(true);
            setConnected(false);
        };

        // Patch the signaling message handler to catch stream-stopped
        const origHandler = webrtc.handleSignalingMessage.bind(webrtc);
        webrtc.handleSignalingMessage = async (data, resolve, reject) => {
            if (data.type === 'stream-stopped' || data.type === 'peer-disconnected') {
                setStreamStopped(true);
                setConnected(false);
            }
            return origHandler(data, resolve, reject);
        };

        // Request fullscreen on mobile
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        if (isMobile && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => { });
        }

        return () => {
            clearInterval(timerRef.current);
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        };
    }, [sessionInfo]);// eslint-disable-line

    // ---- Auto-hide controls ----
    const resetHideTimer = useCallback(() => {
        setControlsVisible(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setControlsVisible(false), 3500);
    }, []);

    useEffect(() => {
        resetHideTimer();
        return () => clearTimeout(hideTimer.current);
    }, [resetHideTimer]);

    // ---- Mic toggle (transmitter) ----
    const toggleMic = useCallback(() => {
        const webrtc = webrtcRef.current;
        if (!webrtc?.localStream) return;
        const next = !micMuted;
        webrtc.localStream.getAudioTracks().forEach(t => { t.enabled = !next; });
        setMicMuted(next);
    }, [micMuted, webrtcRef]);

    // ---- Speaker toggle (monitor) ----
    const toggleSpeaker = useCallback(() => {
        const next = !speakerMuted;
        if (videoRef.current) videoRef.current.muted = next;
        setSpeakerMuted(next);
    }, [speakerMuted]);

    // ---- Screenshot (monitor) ----
    const takeScreenshot = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        const canvas = document.createElement('canvas');
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        canvas.getContext('2d').drawImage(v, 0, 0);
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `screenshot-${Date.now()}.png`; a.click();
            URL.revokeObjectURL(url);
        });
    }, []);

    // ---- Stop / disconnect ----
    const handleStop = useCallback(async () => {
        clearInterval(timerRef.current);
        const info = sessionInfo;
        setSessionInfo(null);

        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });

        // Tell signaling server we stopped (so monitor gets stream-stopped event)
        const webrtc = webrtcRef.current;
        if (webrtc?.socket && webrtc.authenticated && webrtc.socket.readyState === 1) {
            webrtc.socket.send(JSON.stringify({ type: 'stop-stream' }));
        }

        if (info?.onStop) await info.onStop();
        navigate(info?.mode === 'transmitter' ? '/transmitter' : '/monitor');
    }, [sessionInfo, setSessionInfo, navigate, webrtcRef]);

    if (!sessionInfo) return null;

    const isTransmitter = sessionInfo.mode === 'transmitter';
    const device = sessionInfo.device;

    // ---- Render ----
    return (
        <div
            style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, overflow: 'hidden' }}
            onPointerMove={resetHideTimer}
            onTouchStart={resetHideTimer}
        >
            {/* Video */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isTransmitter || speakerMuted}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: isTransmitter ? 'scaleX(-1)' : 'none',
                    display: 'block',
                }}
            />

            {/* HUD overlay */}
            {device && connected && (
                <VideoOverlay deviceName={device.deviceName} status="streaming" elapsed={elapsed} />
            )}

            {/* Connecting overlay */}
            {!connected && !streamStopped && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
                    background: 'rgba(0,0,0,0.9)',
                }}>
                    <svg style={{ width: '40px', height: '40px', color: '#22d3ee', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                        {isTransmitter ? 'Starting camera...' : 'Connecting to stream...'}
                    </p>
                </div>
            )}

            {/* Stream stopped banner (for monitor) */}
            {streamStopped && (
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
                    background: 'rgba(0,0,0,0.92)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                    </div>
                    <p style={{ color: '#fff', fontSize: '18px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>Stream ended</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>The transmitter stopped broadcasting</p>
                    <button
                        onClick={handleStop}
                        style={{
                            marginTop: '8px', padding: '12px 32px', borderRadius: '12px', border: 'none',
                            background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', fontWeight: 600,
                            fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                        }}
                    >
                        Go back
                    </button>
                </div>
            )}

            {/* ---- Bottom control bar ---- */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
                paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
                transition: 'opacity 0.3s, transform 0.3s',
                opacity: controlsVisible ? 1 : 0,
                pointerEvents: controlsVisible ? 'auto' : 'none',
                transform: controlsVisible ? 'translateY(0)' : 'translateY(20px)',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 20px', borderRadius: '24px',
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    {/* Live timer */}
                    {!streamStopped && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 4px', minWidth: '52px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    background: connected ? '#ef4444' : '#6b7280',
                                    animation: connected ? 'rec-blink 1.5s ease-in-out infinite' : 'none',
                                }} />
                                <span style={{ color: connected ? '#ef4444' : '#6b7280', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'monospace' }}>LIVE</span>
                            </div>
                            <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.05em', marginTop: '2px' }}>
                                {formatDuration(elapsed)}
                            </span>
                        </div>
                    )}

                    <Divider />

                    {/* Mic button — transmitter */}
                    {isTransmitter && (
                        <CircleBtn
                            onClick={toggleMic}
                            active={micMuted}
                            title={micMuted ? 'Unmute mic' : 'Mute mic'}
                        >
                            {micMuted ? <MicOffIcon /> : <MicIcon />}
                        </CircleBtn>
                    )}

                    {/* Speaker button — monitor */}
                    {!isTransmitter && (
                        <CircleBtn
                            onClick={toggleSpeaker}
                            active={speakerMuted}
                            title={speakerMuted ? 'Unmute audio' : 'Mute audio'}
                        >
                            {speakerMuted ? <VolumeXIcon /> : <VolumeIcon />}
                        </CircleBtn>
                    )}

                    {/* Screenshot — monitor only */}
                    {!isTransmitter && (
                        <CircleBtn onClick={takeScreenshot} title="Take screenshot">
                            <CameraIcon />
                        </CircleBtn>
                    )}

                    {/* Pairing code pill — transmitter */}
                    {isTransmitter && device?.pairingCode && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 6px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}>Code</span>
                            <span style={{ color: '#818cf8', fontSize: '17px', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.2em' }}>{device.pairingCode}</span>
                        </div>
                    )}

                    <Divider />

                    {/* Stop / end call */}
                    <CircleBtn onClick={handleStop} danger title={isTransmitter ? 'Stop streaming' : 'Disconnect'}>
                        {isTransmitter ? <VideoOffIcon /> : <PhoneOffIcon />}
                    </CircleBtn>
                </div>
            </div>
        </div>
    );
}

// ---- Small reusable components ----

function Divider() {
    return <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />;
}

function CircleBtn({ onClick, active, danger, title, children }) {
    const bg = danger
        ? 'rgba(239,68,68,0.9)'
        : active
            ? 'rgba(239,68,68,0.85)'
            : 'rgba(255,255,255,0.12)';

    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                width: '52px', height: '52px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', flexShrink: 0,
                background: bg,
                color: '#fff',
                transition: 'background 0.15s',
            }}
        >
            {children}
        </button>
    );
}

// SVG icon components
function MicIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
    );
}
function MicOffIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
            <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
    );
}
function VolumeIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
        </svg>
    );
}
function VolumeXIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
    );
}
function CameraIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
        </svg>
    );
}
function VideoOffIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}
function PhoneOffIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.43 9a19.79 19.79 0 01-3.07-8.63A2 2 0 012.18.36h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.18 8.18" />
            <line x1="23" y1="1" x2="1" y2="23" />
        </svg>
    );
}

export default StreamPage;
