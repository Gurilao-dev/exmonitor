import { useState, useEffect } from 'react';

function VideoOverlay({ deviceName, status, fps = 0 }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentDate(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const formatDate = (date) => {
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
            {/* Top Bar */}
            <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm" style={{
                    background: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                }}>
                    {/* REC indicator */}
                    <div className="flex items-center gap-1.5">
                        <span className="status-dot-live" style={{ width: '6px', height: '6px' }} />
                        <span className="text-[10px] sm:text-xs text-red-400 font-bold tracking-wider uppercase">Rec</span>
                    </div>
                    <span className="w-px h-3 bg-white/10" />
                    <span className="text-[10px] sm:text-xs text-primary-300 font-semibold truncate max-w-[120px] sm:max-w-none">
                        {deviceName}
                    </span>
                </div>

                <div className="px-2.5 py-1.5 rounded-lg text-right font-mono" style={{
                    background: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                }}>
                    <div className="text-[10px] text-gray-400">{formatDate(currentDate)}</div>
                    <div className="text-sm sm:text-lg font-bold text-white tracking-widest leading-none mt-0.5">
                        {formatTime(currentDate)}
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex justify-between items-end gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono" style={{
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    color: 'rgba(255, 255, 255, 0.35)',
                }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    ExMonitor Secure Stream
                </div>

                {fps > 0 && (
                    <div className="px-2 py-1 rounded text-[10px] font-mono text-green-400" style={{
                        background: 'rgba(0, 0, 0, 0.45)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                    }}>
                        {fps} FPS
                    </div>
                )}
            </div>

            {/* Center crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ opacity: 0.12 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="0.5">
                    <circle cx="12" cy="12" r="8" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                    <circle cx="12" cy="12" r="1" fill="white" />
                </svg>
            </div>
        </div>
    );
}

export default VideoOverlay;
