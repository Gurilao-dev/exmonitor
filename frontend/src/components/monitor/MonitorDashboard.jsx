
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import WebRTCService from '../../services/webrtc';
import { useStream } from '../stream/StreamContext';

function MonitorDashboard({ onLogout }) {
    const navigate = useNavigate();
    const { webrtcRef, setSessionInfo } = useStream();

    const [devices, setDevices] = useState([]);
    const [pairingCode, setPairingCode] = useState('');
    const [showPairForm, setShowPairForm] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadDevices();
    }, []);

    const loadDevices = async () => {
        try {
            const data = await api.listDevices('monitor');
            setDevices(data.devices || []);
        } catch (e) {
            console.error('Failed to load devices:', e);
        }
    };

    const handlePairDevice = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await api.pairDevice(pairingCode);
            setDevices(prev => [...prev, data.device]);
            setPairingCode('');
            setShowPairForm(false);
        } catch (e) {
            alert(e.error || 'Failed to pair device');
        } finally {
            setLoading(false);
        }
    };

    const watchStream = async (device) => {
        try {
            setLoading(true);

            // Create WebRTC instance and store in shared context
            webrtcRef.current = new WebRTCService();

            const tokenData = await api.getStreamToken(device.deviceId);
            await webrtcRef.current.connect(tokenData.streamToken, device.deviceId);
            webrtcRef.current.requestOffer();

            // Set session info and navigate to full-screen stream page
            setSessionInfo({
                mode: 'monitor',
                device,
                streamStartTime: new Date(),
                onStop: () => {
                    if (webrtcRef.current) {
                        webrtcRef.current.disconnect();
                        webrtcRef.current = null;
                    }
                    loadDevices();
                },
            });

            navigate('/stream');
        } catch (e) {
            console.error('Failed to watch stream:', e);
            alert('Failed to connect: ' + (e.message || 'Unknown error'));
            if (webrtcRef.current) {
                webrtcRef.current.disconnect();
                webrtcRef.current = null;
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Top navigation bar */}
            <header className="border-b border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{
                                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.05))',
                                border: '1px solid rgba(6, 182, 212, 0.15)',
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-400">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-base font-bold text-white leading-none">Monitor</h1>
                                <p className="text-xs text-gray-500 mt-0.5">Live camera feeds</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => navigate('/mode')} className="btn-secondary text-xs px-3 py-2 rounded-lg">
                                <span className="hidden sm:inline">Switch</span> Mode
                            </button>
                            <button onClick={onLogout} className="btn-secondary text-xs px-3 py-2 rounded-lg">
                                <span className="hidden sm:inline">Log</span>out
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Pair button */}
                <div className="mb-6">
                    <button
                        onClick={() => setShowPairForm(!showPairForm)}
                        className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                        </svg>
                        Pair Device
                    </button>
                </div>

                {/* Pair Device Form */}
                {showPairForm && (
                    <div className="card mb-6 animate-slide-down">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-center sm:justify-start gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-400" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                            </svg>
                            Pair with Transmitter
                        </h3>
                        <form onSubmit={handlePairDevice} className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                value={pairingCode}
                                onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="input-field flex-1 text-sm font-mono tracking-widest text-center sm:text-left"
                                placeholder="000000"
                                pattern="[0-9]{6}"
                                maxLength={6}
                                required
                            />
                            <div className="flex gap-2">
                                <button type="submit" disabled={loading} className="btn-primary text-sm px-5 py-2.5 flex-1 sm:flex-none flex items-center justify-center">
                                    {loading ? 'Pairing...' : 'Pair'}
                                </button>
                                <button type="button" onClick={() => setShowPairForm(false)} className="btn-secondary text-sm px-4 py-2.5 flex-1 sm:flex-none flex items-center justify-center">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Devices List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.map((device) => (
                        <div key={device.deviceId} className="card animate-fade-in relative group">
                            {/* Device Delete Button */}
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Delete this device?')) {
                                        try {
                                            await api.deleteDevice(device.deviceId);
                                            loadDevices();
                                        } catch (err) {
                                            alert(err.error || 'Failed to delete device');
                                        }
                                    }
                                }}
                                className="absolute top-3 right-3 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500/70 hover:text-red-500 rounded-lg transition-colors border border-red-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                                title="Delete device"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>

                            <div className="flex justify-between items-start mb-4 pr-8">
                                <div className="min-w-0 pr-3">
                                    <h4 className="font-bold text-white text-sm truncate">{device.deviceName}</h4>
                                    <p className="text-xs text-gray-600 mt-1 capitalize">{device.status}</p>
                                </div>
                                <span className={`badge text-[10px] shrink-0 ${device.status === 'streaming' ? 'badge-online' : 'badge-offline'} `}>
                                    <span className={`${device.status === 'streaming' ? 'status-dot-online' : 'status-dot-offline'} `} style={{ width: '5px', height: '5px' }} />
                                    {device.status === 'streaming' ? 'Online' : 'Offline'}
                                </span>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => watchStream(device)}
                                    disabled={loading || device.status !== 'streaming'}
                                    className={`w-full text-xs py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${device.status === 'streaming' ? 'btn-primary' : 'text-gray-600 cursor-not-allowed'
                                        }`}
                                    style={device.status !== 'streaming' ? {
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                    } : {}}
                                >
                                    {device.status === 'streaming' ? (
                                        <>
                                            {loading ? (
                                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '-1px' }}>
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            )}
                                            {loading ? 'Connecting...' : 'Watch Stream'}
                                        </>
                                    ) : 'Offline'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty state */}
                {devices.length === 0 && !showPairForm && (
                    <div className="text-center py-16 sm:py-24 animate-fade-in">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5" style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                            </svg>
                        </div>
                        <p className="text-gray-500 text-sm">No devices paired</p>
                        <p className="text-gray-600 text-xs mt-1">Use a pairing code to connect to a transmitter</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default MonitorDashboard;
