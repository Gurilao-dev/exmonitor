import { useState } from 'react';
import api from '../../services/api';

// Shared SVG background — no container on mobile, full glass card on desktop
function AuthBg() {
    return (
        <>
            <div style={{
                position: 'fixed', inset: 0,
                background: 'radial-gradient(ellipse 80% 50% at 20% 20%, rgba(99,102,241,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(6,182,212,0.14) 0%, transparent 60%)',
                pointerEvents: 'none', zIndex: 0,
            }} />
        </>
    );
}

function GlobalPasswordGate({ onSuccess }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.validateGlobalPassword(password);
            onSuccess();
        } catch (err) {
            setError(err.error || 'Invalid access code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100dvh', background: '#030712', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <AuthBg />

            {/* Mobile: full-screen, no card. Desktop: glass card */}
            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '480px', padding: '0 16px' }}
                className="sm:glass-panel sm:animate-scale-in">

                <div className="py-8 px-4 sm:px-2">
                    {/* Inner content always centered */}
                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                        {/* Logo icon */}
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '72px', height: '72px', borderRadius: '20px', marginBottom: '20px',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.15))',
                            border: '1px solid rgba(99,102,241,0.2)',
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <path d="M9 12l2 2 4-4" />
                            </svg>
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>ExMonitor</h1>
                        <p style={{ color: '#6b7280', marginTop: '8px', fontSize: '14px' }}>Secure Remote Camera Monitoring</p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Access Code
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="input-field"
                                placeholder="Enter global password"
                                autoFocus
                                required
                            />
                            {error && (
                                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171', fontSize: '13px' }} className="animate-slide-down">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                    {error}
                                </div>
                            )}
                        </div>

                        <button type="submit" disabled={loading || !password} className="btn-primary w-full" style={{ marginTop: '8px' }}>
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <svg className="animate-spin" style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24">
                                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Validating...
                                </span>
                            ) : 'Access System'}
                        </button>
                    </form>

                    <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                        <p style={{ fontSize: '12px', color: '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            Protected by global authentication
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GlobalPasswordGate;
