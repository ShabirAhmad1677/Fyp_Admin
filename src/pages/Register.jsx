
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Store } from 'lucide-react'

export default function Register() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [businessName, setBusinessName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    const handleSignUp = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        business_name: businessName
                    }
                }
            })

            if (error) throw error

            setSuccess(true)
        } catch (error) {
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Create Account</h2>
                <p className="text-muted" style={{ textAlign: 'center', marginBottom: '2rem' }}>Join the AR Ad Platform</p>

                {error && (
                    <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', border: '1px solid var(--danger)' }}>
                        {error}
                    </div>
                )}

                {success ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ color: 'var(--success)', fontSize: '1.1rem', marginBottom: '1rem' }}>✨ Account Created!</div>
                        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Please check your email to confirm your account.</p>
                        <Link to="/login" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Business Name</label>
                            <div style={{ position: 'relative' }}>
                                <Store size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="e.g. NeoTokyo Cafe"
                                    required
                                    style={{ paddingLeft: '2.5rem' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="merchant@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </button>

                        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
                            <span className="text-muted">Already have an account? </span>
                            <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Login</Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
