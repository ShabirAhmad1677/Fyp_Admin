import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, ClipboardCheck, History, Calendar, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Scanner() {
    const [status, setStatus] = useState('idle') // idle, processing, success, error
    const [message, setMessage] = useState('')
    const [manualCode, setManualCode] = useState('')
    const [history, setHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(true)

    useEffect(() => {
        fetchHistory()
    }, [])

    const fetchHistory = async () => {
        try {
            setLoadingHistory(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Fetch last 10 redemptions for this merchant's billboards
            const { data, error } = await supabase
                .from('saved_offers')
                .select(`
                    id,
                    redemption_code,
                    redeemed_at,
                    campaigns:campaign_id (
                        title,
                        business_name,
                        discount
                    )
                `)
                .eq('is_redeemed', true)
                .order('redeemed_at', { ascending: false })
                .limit(10)

            if (error) throw error
            setHistory(data || [])
        } catch (error) {
            console.error('Error fetching history:', error)
        } finally {
            setLoadingHistory(false)
        }
    }

    const processCode = async (rawCode) => {
        if (!rawCode) return
        const code = rawCode.trim()
        setStatus('processing')
        setMessage('')

        try {
            const isShortCode = /^[a-z0-9]{6}$/i.test(code);
            if (!isShortCode) {
                throw new Error('Invalid format. Please enter a valid 6-digit coupon code.')
            }

            const { data, error } = await supabase.rpc('redeem_coupon', {
                p_code: code.toUpperCase()
            })

            if (error) throw error

            if (data && data.success) {
                setStatus('success')
                setMessage(data) 
                setManualCode('')
                
                // Live prepend to history
                const newEntry = {
                    id: Math.random().toString(), // Temp ID for list
                    redemption_code: code.toUpperCase(),
                    redeemed_at: new Date().toISOString(),
                    campaigns: {
                        title: data.offer_details.title,
                        business_name: data.offer_details.business,
                        discount: data.offer_details.discount
                    }
                }
                setHistory(prev => [newEntry, ...prev.slice(0, 9)])

                setTimeout(() => {
                    setStatus('idle')
                    setMessage('')
                }, 8000)
            } else {
                throw new Error(data?.error || 'Redemption failed.')
            }

        } catch (error) {
            setStatus('error')
            setMessage(error.message)
            setTimeout(() => {
                setStatus('idle')
                setMessage('')
            }, 5000)
        }
    }

    return (
        <div className="container" style={{ maxWidth: '1200px' }}>
            <header style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.75rem', background: 'var(--primary)', borderRadius: '12px' }}>
                        <ClipboardCheck color="white" size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Coupon Verification</h1>
                        <p className="text-muted">Manually verify and track customer redemptions</p>
                    </div>
                </div>
            </header>

            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 350px', 
                gap: '2rem',
                alignItems: 'start'
            }}>
                
                {/* ---------- MAIN: VERIFICATION AREA ---------- */}
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center', minHeight: '500px' }}>
                    {status === 'processing' && (
                        <div className="flex-center" style={{ padding: '3rem', flexDirection: 'column', gap: '1rem' }}>
                            <Loader2 className="animate-spin" size={48} color="var(--primary)" />
                            <p style={{ fontWeight: '500' }}>Verifying Redemption...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex-center" style={{ padding: '2rem', flexDirection: 'column', gap: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '24px', border: '2px solid var(--success)' }}>
                            <div style={{ background: 'var(--success)', padding: '1rem', borderRadius: '50%', boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)' }}>
                                <CheckCircle size={48} color="white" />
                            </div>
                            <div>
                                <h2 style={{ color: 'var(--success)', margin: '0 0 0.5rem 0', fontSize: '1.75rem' }}>Verified Successfully!</h2>
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontWeight: '500' }}>{message.message}</p>
                            </div>
                            
                            <div style={{ width: '100%', background: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'left' }}>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 'bold' }}>Offer Details</p>
                                <p style={{ fontWeight: '800', fontSize: '1.25rem', marginBottom: '0.25rem' }}>{message.offer_details?.title}</p>
                                <p style={{ color: 'var(--primary)', fontWeight: '700' }}>{message.offer_details?.business}</p>
                                {message.offer_details?.discount && (
                                    <div style={{ marginTop: '1rem', display: 'inline-block', padding: '6px 16px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)', borderRadius: '100px', fontSize: '0.875rem', fontWeight: 'bold' }}>
                                        {message.offer_details.discount} Saving applied
                                    </div>
                                )}
                            </div>
                            
                            <button className="btn-secondary" onClick={() => setStatus('idle')} style={{ width: '100%' }}>
                                Confirm & Next Service
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex-center" style={{ padding: '3rem', flexDirection: 'column', gap: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '24px', border: '1px dashed var(--danger)' }}>
                            <XCircle size={64} color="var(--danger)" />
                            <h2 style={{ color: 'var(--danger)', margin: 0 }}>Redemption Failed</h2>
                            <p style={{ fontWeight: '500' }}>{message}</p>
                            <button className="btn-primary" style={{ background: 'var(--danger)', border: 'none' }} onClick={() => setStatus('idle')}>
                                Try Different Code
                            </button>
                        </div>
                    )}

                    {status === 'idle' && (
                        <div style={{ padding: '1rem 0' }}>
                            <div style={{ 
                                background: 'rgba(139, 92, 246, 0.03)',
                                padding: '2.5rem',
                                borderRadius: '24px',
                                border: '1px solid var(--border)',
                                marginBottom: '2rem'
                            }}>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontWeight: '700', letterSpacing: '0.1em' }}>
                                    ENTER CUSTOMER REDEMPTION CODE
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <input 
                                        type="text" 
                                        placeholder="E.G. A1B2C3"
                                        maxLength={6}
                                        autoFocus
                                        value={manualCode}
                                        onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                                        style={{ 
                                            width: '100%', fontSize: '2.5rem', textAlign: 'center', letterSpacing: '12px', fontWeight: '900',
                                            textTransform: 'uppercase', padding: '1.5rem', borderRadius: '20px', background: 'white',
                                            border: '2px solid var(--primary)', color: 'var(--primary)', boxShadow: '0 10px 30px rgba(139, 92, 246, 0.15)', outline: 'none'
                                        }}
                                    />
                                    <button 
                                        className="btn-primary"
                                        disabled={manualCode.length !== 6}
                                        onClick={() => processCode(manualCode)}
                                        style={{ padding: '1.5rem', fontSize: '1.1rem', borderRadius: '16px' }}
                                    >
                                        Verify & Complete Transaction
                                    </button>
                                </div>
                            </div>
                            <div style={{ textAlign: 'left', background: 'var(--surface)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '800' }}>Verification Guidelines</h3>
                                <ul className="text-muted text-sm" style={{ paddingLeft: '1.25rem' }}>
                                    <li style={{ marginBottom: '0.6rem' }}>Confirm the code exactly as shown on the user's phone.</li>
                                    <li>Success automatically logs the sale in your Performance Dashboard.</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* ---------- ASIDE: RECENT HISTORY ---------- */}
                <aside style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0 0.5rem' }}>
                        <History size={18} className="text-muted" />
                        <h3 style={{ fontSize: '1rem', margin: 0 }}>Recent Redemptions</h3>
                        <div style={{ marginLeft: 'auto', background: 'var(--surface)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>{history.length}</div>
                    </div>

                    <div style={{ 
                        flex: 1, 
                        overflowY: 'auto', 
                        paddingRight: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                    }}>
                        {loadingHistory ? (
                            <div className="flex-center" style={{ height: '200px' }}>
                                <Loader2 className="animate-spin text-muted" size={24} />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="card-subtle" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '50%' }}>
                                    <Tag className="text-muted" size={32} strokeWidth={1} />
                                </div>
                                <p className="text-muted text-sm">No redemptions found. Verified coupons will appear here.</p>
                            </div>
                        ) : (
                            history.map((item, idx) => (
                                <div key={item.id} className="card" style={{ 
                                    padding: '1rem', 
                                    animation: idx === 0 ? 'popIn 0.5s ease-out' : 'none',
                                    borderLeft: `3px solid ${idx === 0 ? 'var(--success)' : 'var(--border)'}`,
                                    position: 'relative',
                                    background: idx === 0 ? 'rgba(16, 185, 129, 0.02)' : 'var(--bg-card)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                                        <p style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text)' }}>{item.campaigns.business_name}</p>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Calendar size={10} />
                                            {new Date(item.redeemed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600', marginBottom: '0.25rem' }}>{item.campaigns.title}</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.redemption_code}</p>
                                        {item.campaigns.discount && (
                                            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--success)' }}>{item.campaigns.discount}</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </aside>
            </div>

            <style>{`
                @keyframes popIn {
                    0% { transform: scale(0.9); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .card-subtle {
                    background: rgba(255,255,255,0.02);
                    border: 1px dashed var(--border);
                    border-radius: 12px;
                }
            `}</style>
        </div>
    )
}
