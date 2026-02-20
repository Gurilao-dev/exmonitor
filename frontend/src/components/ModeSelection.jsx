import { useNavigate } from 'react-router-dom';

function ModeSelection() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-gray-950">
            {/* Decorative background */}
            <div className="bg-blob w-96 h-96 bg-primary-600 -top-48 left-1/4 animate-float" style={{ position: 'absolute' }} />
            <div className="bg-blob w-80 h-80 bg-accent-500 -bottom-40 right-1/4 animate-float" style={{ position: 'absolute', animationDelay: '-3s' }} />

            <div className="max-w-4xl w-full relative z-10 animate-fade-in">
                <div className="text-center mb-12 sm:mb-16">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                        Ex<span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #818cf8, #22d3ee)' }}>Monitor</span>
                    </h1>
                    <p className="text-gray-500 mt-3 text-base">Choose your operating mode</p>
                </div>

                <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
                    {/* Transmitter Mode */}
                    <button
                        onClick={() => navigate('/transmitter')}
                        className="card-interactive text-left group"
                    >
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-5">
                                <div className="w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110" style={{
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.05))',
                                    border: '1px solid rgba(99, 102, 241, 0.15)',
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
                                        <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 group-hover:text-primary-400 transition-all duration-300 group-hover:translate-x-1">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Transmitter</h2>
                            <p className="text-gray-500 text-sm mb-5 flex-grow leading-relaxed">
                                Share your camera feed with authorized monitors. Generate pairing codes and control who can view your stream.
                            </p>
                            <div className="pt-4 border-t border-white/5">
                                <ul className="space-y-2.5">
                                    {['Generate pairing codes', 'Stream camera in real-time', 'Manage connected devices'].map((item) => (
                                        <li key={item} className="flex items-center gap-2.5 text-sm text-gray-400">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500 shrink-0">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </button>

                    {/* Monitor Mode */}
                    <button
                        onClick={() => navigate('/monitor')}
                        className="card-interactive text-left group"
                    >
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-5">
                                <div className="w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110" style={{
                                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(6, 182, 212, 0.05))',
                                    border: '1px solid rgba(6, 182, 212, 0.15)',
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-400">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                </div>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 group-hover:text-accent-400 transition-all duration-300 group-hover:translate-x-1">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Monitor</h2>
                            <p className="text-gray-500 text-sm mb-5 flex-grow leading-relaxed">
                                View camera feeds from paired transmitters. Enter pairing codes to connect to remote cameras.
                            </p>
                            <div className="pt-4 border-t border-white/5">
                                <ul className="space-y-2.5">
                                    {['Pair with devices using code', 'View live camera feeds', 'Capture screenshots'].map((item) => (
                                        <li key={item} className="flex items-center gap-2.5 text-sm text-gray-400">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-500 shrink-0">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ModeSelection;
