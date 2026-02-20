
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import WebRTCService from '../../services/webrtc';
import { useStream } from '../stream/StreamContext';

function TransmitterDashboard({ onLogout }) {
    const navigate = useNavigate();
    const { webrtcRef, setSessionInfo } = useStream();

    const [devices, setDevices] = useState([]);
    const [deviceName, setDeviceName] = useState('');
    const [showAddDevice, setShowAddDevice] = useState(false);
    const [loading, setLoading] = useState(false);
    const [currentDevice, setCurrentDevice] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ id: null, step: 0 });
    const [availableCameras, setAvailableCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');

    useEffect(() => {
        loadDevices();
        checkCameras();
    }, []);

    const checkCameras = async () => {
        try {
            if (navigator.mediaDevices?.enumerateDevices) {
                const all = await navigator.mediaDevices.enumerateDevices();
                const cameras = all.filter(d => d.kind === 'videoinput');
                setAvailableCameras(cameras);
                if (cameras.length > 0) setSelectedCameraId(cameras[0].deviceId);
            }
        } catch (e) {
            console.error('[Transmitter] Error checking cameras:', e);
        }
    };

    const loadDevices = async () => {
        try {
            const data = await api.listDevices('transmitter');
            setDevices(data.devices || []);
        } catch (e) {
            console.error('[Transmitter] Failed to load devices:', e);
        }
    };

    const handleAddDevice = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await api.registerDevice(deviceName);
            setDevices(prev => [...prev, data.device]);
            setDeviceName('');
            setShowAddDevice(false);
        } catch (e) {
            alert(e.error || 'Failed to register device');
        } finally {
            setLoading(false);
        }
    };

    const startStream = async (device) => {
        try {
            setLoading(true);
            setCurrentDevice(device);

            // Create WebRTC instance and store in shared context
            webrtcRef.current = new WebRTCService();

            if (!window.isSecureContext) {
                throw new Error('Camera access requires a secure context (HTTPS or localhost).');
            }

            const constraints = selectedCameraId
                ? { video: { deviceId: { exact: selectedCameraId } }, audio: true }
                : { video: true, audio: true };

            // Start local camera stream
            await webrtcRef.current.startLocalStream(constraints);

            // Get stream token & connect signaling
            const tokenData = await api.getStreamToken(device.deviceId);
            if (!tokenData?.streamToken) throw new Error('Failed to obtain stream token from server.');

            await webrtcRef.current.connect(tokenData.streamToken, device.deviceId);
            await webrtcRef.current.createOffer();

            // Mark device as streaming
            await api.updateDeviceStatus(device.deviceId, 'streaming');

            // Set session info and navigate to full-screen stream page
            setSessionInfo({
                mode: 'transmitter',
                device,
                streamStartTime: new Date(),
                onStop: async () => {
                    if (webrtcRef.current) {
                        webrtcRef.current.disconnect();
                        webrtcRef.current = null;
                    }
                    try {
                        await api.updateDeviceStatus(device.deviceId, 'offline');
                    } catch (_) { }
                    // Refresh device list on return
                    loadDevices();
                },
            });

            navigate('/stream');
        } catch (error) {
            console.error('[Transmitter] Error starting stream:', error);
            let msg = 'Unknown error';
            if (typeof error === 'string') msg = error;
            else if (error.error) msg = error.error;
            else if (error.message) msg = error.message;
            alert('Failed to start stream: ' + msg);

            if (webrtcRef.current) {
                webrtcRef.current.disconnect();
                webrtcRef.current = null;
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDevice = async (deviceId) => {
        if (confirmDelete.id !== deviceId || confirmDelete.step === 0) {
            setConfirmDelete({ id: deviceId, step: 1 });
            return;
        }
        if (confirmDelete.step === 1) {
            setConfirmDelete({ id: deviceId, step: 2 });
            return;
        }
        try {
            setLoading(true);
            await api.deleteDevice(deviceId);
            setDevices(prev => prev.filter(d => d.deviceId !== deviceId));
            setConfirmDelete({ id: null, step: 0 });
        } catch (e) {
            alert(e.error || 'Failed to delete device');
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
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.05))',
                                border: '1px solid rgba(99, 102, 241, 0.15)',
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
                                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-base font-bold text-white leading-none">Transmitter</h1>
                                <p className="text-xs text-gray-500 mt-0.5">Camera management</p>
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
                {/* Controls row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
                    <button
                        onClick={() => setShowAddDevice(!showAddDevice)}
                        className="btn-primary text-sm px-5 py-2.5 flex items-center justify-center gap-2"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Device
                    </button>

                    {availableCameras.length > 0 && (
                        <div className="flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500 shrink-0">
                                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <select
                                value={selectedCameraId}
                                onChange={(e) => setSelectedCameraId(e.target.value)}
                                className="input-field text-sm py-2 px-3 flex-1 sm:flex-none sm:w-auto"
                            >
                                {availableCameras.map((camera, i) => (
                                    <option key={camera.deviceId} value={camera.deviceId}>
                                        {camera.label || `Camera ${i + 1} `}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Add Device Form */}
                {showAddDevice && (
                    <div className="card mb-6 animate-slide-down">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary-400">
                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                            Register New Device
                        </h3>
                        <form onSubmit={handleAddDevice} className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                value={deviceName}
                                onChange={(e) => setDeviceName(e.target.value)}
                                className="input-field flex-1 text-sm"
                                placeholder="Device name (e.g., Living Room Camera)"
                                required
                            />
                            <div className="flex gap-2">
                                <button type="submit" disabled={loading} className="btn-primary text-sm px-5 py-2.5 flex-1 sm:flex-none">
                                    {loading ? 'Adding...' : 'Add'}
                                </button>
                                <button type="button" onClick={() => setShowAddDevice(false)} className="btn-secondary text-sm px-4 py-2.5 flex-1 sm:flex-none">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Devices Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.map((device) => (
                        <div key={device.deviceId} className="card animate-fade-in group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="min-w-0 pr-3">
                                    <h4 className="font-bold text-white text-sm truncate">{device.deviceName}</h4>
                                    <p className="text-xs text-gray-500 mt-1 font-mono">Code: {device.pairingCode}</p>
                                </div>
                                <span className={`badge text - [10px] shrink - 0 ${device.status === 'streaming' ? 'badge-live' : 'badge-offline'} `}>
                                    <span className={`${device.status === 'streaming' ? 'status-dot-live' : 'status-dot-offline'} `} style={{ width: '5px', height: '5px' }} />
                                    {device.status === 'streaming' ? 'Live' : 'Offline'}
                                </span>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => startStream(device)}
                                    disabled={loading}
                                    className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2"
                                >
                                    {loading && currentDevice?.deviceId === device.deviceId ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Connecting...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" />
                                                <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
                                            </svg>
                                            Start Stream
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => handleDeleteDevice(device.deviceId)}
                                    disabled={loading}
                                    className={`w - full text - xs py - 2 rounded - xl font - medium transition - all duration - 200 flex items - center justify - center gap - 1.5 ${confirmDelete.id === device.deviceId
                                        ? 'bg-red-600/90 text-white'
                                        : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                                        } `}
                                    style={confirmDelete.id !== device.deviceId ? {
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                    } : {}}
                                >
                                    {confirmDelete.id === device.deviceId ? (
                                        <>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                                <line x1="12" y1="9" x2="12" y2="13" />
                                                <line x1="12" y1="17" x2="12.01" y2="17" />
                                            </svg>
                                            {confirmDelete.step === 1 ? 'Confirm deletion?' : 'Click once more to delete'}
                                        </>
                                    ) : (
                                        <>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                            </svg>
                                            Delete
                                        </>
                                    )}
                                </button>

                                {confirmDelete.id === device.deviceId && (
                                    <button
                                        onClick={() => setConfirmDelete({ id: null, step: 0 })}
                                        className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors text-center"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty state */}
                {devices.length === 0 && !showAddDevice && (
                    <div className="text-center py-16 sm:py-24 animate-fade-in">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5" style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
                                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-gray-500 text-sm">No devices registered</p>
                        <p className="text-gray-600 text-xs mt-1">Add a device to start streaming</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default TransmitterDashboard;
