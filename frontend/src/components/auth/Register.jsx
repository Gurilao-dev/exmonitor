import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import encryption from '../../services/encryption';

function Register({ onSuccess }) {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleStep1 = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.requestRegister(email);
            setStep(2);
        } catch (err) {
            setError(err.error || 'Request failed');
        } finally {
            setLoading(false);
        }
    };

    const handleStep2 = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
        setLoading(true);
        try {
            const hashedPassword = encryption.hashPassword(password);
            await api.register(email, hashedPassword);
            onSuccess();
        } catch (err) {
            setError(err.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100dvh', background: '#030712', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{
                position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
                background: 'radial-gradient(ellipse 80% 50% at 80% 20%, rgba(6,182,212,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 80%, rgba(99,102,241,0.14) 0%, transparent 60%)',
            }} />

            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px', padding: '0 24px' }}
                className="sm:glass-panel sm:animate-scale-in">

                <div className="py-8 px-4 sm:px-2">
                    <div style={{ textAlign: 'center', marginBottom: '2.rem' }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '64px', height: '64px', borderRadius: '16px', marginBottom: '20px',
                            background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(99,102,241,0.15))',
                            border: '1px solid rgba(6,182,212,0.2)',
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <line x1="20" y1="8" x2="20" y2="14" />
                                <line x1="23" y1="11" x2="17" y2="11" />
                            </svg>
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>Create Account</h2>
                        <p style={{ color: '#6b7280', marginTop: '6px', fontSize: '14px' }}>Step {step} of 2 — {step === 1 ? 'Verify your email' : 'Set a password'}</p>

                        {/* Step bar */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                            <div style={{ width: '32px', height: '3px', borderRadius: '99px', background: step >= 1 ? '#6366f1' : '#374151', transition: 'background 0.3s' }} />
                            <div style={{ width: '32px', height: '3px', borderRadius: '99px', background: step >= 2 ? '#6366f1' : '#374151', transition: 'background 0.3s' }} />
                        </div>
                    </div>

                    {step === 1 ? (
                        <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="your@email.com" required />
                            </div>
                            {error && <ErrorMsg msg={error} />}
                            <button type="submit" disabled={loading} className="btn-primary w-full" style={{ marginTop: '8px' }}>
                                {loading ? <Spinner label="Processing..." /> : 'Continue'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
                                <input type="email" value={email} className="input-field" style={{ opacity: 0.5 }} disabled />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Password</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Minimum 8 characters" required minLength={8} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confirm Password</label>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="input-field" placeholder="Repeat your password" required />
                            </div>
                            {error && <ErrorMsg msg={error} />}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                                <button type="submit" disabled={loading} className="btn-primary w-full">
                                    {loading ? <Spinner label="Creating Account..." /> : 'Complete Registration'}
                                </button>
                                <button type="button" onClick={() => { setStep(1); setError(''); }} className="btn-secondary w-full text-sm">Back</button>
                            </div>
                        </form>
                    )}

                    <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                        <p style={{ color: '#6b7280', fontSize: '14px' }}>
                            Already have an account?{' '}
                            <Link to="/login" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ErrorMsg({ msg }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171', fontSize: '13px' }} className="animate-slide-down">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {msg}
        </div>
    );
}

function Spinner({ label }) {
    return (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg className="animate-spin" style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {label}
        </span>
    );
}

export default Register;
