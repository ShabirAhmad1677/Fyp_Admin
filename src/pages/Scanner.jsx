import { useState, useEffect } from 'react'
import { Scanner as QrScanner } from '@yudiel/react-qr-scanner'
import { Scan, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Scanner() {
    const [scanResult, setScanResult] = useState(null)
    const [status, setStatus] = useState('idle') // idle, processing, success, error
    const [message, setMessage] = useState('')
    const [cameraLoading, setCameraLoading] = useState(true)
    const [manualCode, setManualCode] = useState('')

    const handleScan = async (detectedCodes) => {
        if (detectedCodes && detectedCodes.length > 0 && status === 'idle') {
            const code = detectedCodes[0].rawValue
            processCode(code)
        }
    }

    const handleError = (err) => {
        console.error('Camera Error:', err)
        setCameraLoading(false)
    }

    const processCode = async (rawCode) => {
        if (!rawCode) return
        const code = rawCode.trim()
        setStatus('processing')
        setMessage('')

        try {
            // Validation: Allow 36-char UUID (QR) OR 6-char Alphanumeric (Manual)
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code);
            const isShortCode = /^[a-z0-9]{6}$/i.test(code);

            if (!isUUID && !isShortCode) {
                throw new Error('Invalid format. Scan a QR or enter a 6-digit code.')
            }

            console.log(`🔍 Attempting redemption for: ${code} (Type: ${isUUID ? 'UUID' : 'ShortCode'})`);

            const { data, error } = await supabase.rpc('redeem_coupon', {
                p_code: code.toUpperCase() // Ensure uppercase for short codes
            })

            if (error) throw error

            if (data && data.success) {
                console.log('✅ Redemption Success:', data);
                setStatus('success')
                setMessage(data) 
                setManualCode('')
                setTimeout(() => {
                    setStatus('idle')
                    setMessage('')
                }, 5000)
            } else {
                console.warn('❌ Redemption Failed:', data?.error);
                throw new Error(data?.error || 'Redemption failed. Code might be invalid or expired.')
            }

        } catch (error) {
            console.error('⚠️ Verification Error:', error.message);
            setStatus('error')
            setMessage(error.message)
            setTimeout(() => {
                setStatus('idle')
                setMessage('')
            }, 4000)
        }
    }

    return (
        <div className="container" style={{ maxWidth: '600px' }}>
            <header style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.75rem', background: 'var(--primary)', borderRadius: '12px' }}>
                        <Scan color="white" size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Coupon Scanner</h1>
                        <p className="text-muted">Verify and redeem customer codes</p>
                    </div>
                </div>
            </header>

            <div className="card" style={{ padding: '1rem', overflow: 'hidden', textAlign: 'center' }}>

                {/* Status Overlays */}
                {status === 'processing' && (
                    <div className="flex-center" style={{ padding: '3rem', flexDirection: 'column', gap: '1rem' }}>
                        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
                        <p style={{ fontWeight: '500' }}>Verifying Redemption...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex-center" style={{ padding: '2rem', flexDirection: 'column', gap: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '16px', border: '2px solid var(--success)' }}>
                        <div style={{ background: 'var(--success)', padding: '1rem', borderRadius: '50%' }}>
                            <CheckCircle size={40} color="white" />
                        </div>
                        <div>
                            <h2 style={{ color: 'var(--success)', margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>Redeemed Successfully!</h2>
                            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{message.message}</p>
                        </div>
                        
                        <div style={{ width: '100%', background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'left' }}>
                            <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>Offer Details</p>
                            <p style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.25rem' }}>{message.offer_details?.title}</p>
                            <p style={{ color: 'var(--primary)', fontWeight: '600' }}>{message.offer_details?.business}</p>
                            {message.offer_details?.discount && (
                                <div style={{ marginTop: '0.75rem', display: 'inline-block', padding: '4px 12px', background: '#F3E8FF', color: '#7E22CE', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 'bold' }}>
                                    {message.offer_details.discount}
                                </div>
                            )}
                        </div>
                        <p className="text-sm">Transaction recorded in real-time</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex-center" style={{ padding: '3rem', flexDirection: 'column', gap: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '16px', border: '1px dashed var(--danger)' }}>
                        <XCircle size={64} color="var(--danger)" />
                        <h2 style={{ color: 'var(--danger)', margin: 0 }}>Validation Failed</h2>
                        <p style={{ fontWeight: '500' }}>{message}</p>
                        <button 
                            className="btn-secondary" 
                            style={{ marginTop: '1rem' }}
                            onClick={() => setStatus('idle')}
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Main Interaction Area */}
                {status === 'idle' && (
                    <>
                        <div style={{ 
                            position: 'relative', 
                            overflow: 'hidden', 
                            borderRadius: '16px', 
                            background: '#000', 
                            height: '350px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1.5rem',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                        }}>
                            {cameraLoading && (
                                <div className="flex-center" style={{ position: 'absolute', zIndex: 5, flexDirection: 'column', gap: '1rem' }}>
                                    <Loader2 className="animate-spin" size={32} color="white" />
                                    <p style={{ color: 'white', fontSize: '0.875rem' }}>Scanning for QR Code...</p>
                                </div>
                            )}
                            
                            <QrScanner
                                onScan={handleScan}
                                onError={handleError}
                                onLoad={() => setCameraLoading(false)}
                                constraints={{ facingMode: 'environment' }}
                                styles={{ 
                                    container: { width: '100%', height: '100%' },
                                    video: { width: '100%', height: '100%', objectFit: 'cover' }
                                }}
                            />

                            <div style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(139, 92, 246, 0.2) 50%, rgba(0,0,0,0) 100%)',
                                pointerEvents: 'none',
                                animation: 'scan 3s linear infinite',
                                zIndex: 10
                            }}></div>
                        </div>

                        {/* Manual Entry Section */}
                        <div style={{ 
                            borderTop: '1px solid var(--border)', 
                            paddingTop: '1.5rem',
                            marginBottom: '1.5rem'
                        }}>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: '500' }}>
                                OR ENTER 6-DIGIT CODE MANUALLY
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <input 
                                    type="text" 
                                    placeholder="E.G. A1B2C3"
                                    maxLength={6}
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                                    style={{ 
                                        flex: 1, 
                                        fontSize: '1.25rem', 
                                        textAlign: 'center', 
                                        letterSpacing: '4px',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase',
                                        padding: '0.75rem',
                                        borderRadius: '12px',
                                        border: '2px solid var(--border)'
                                    }}
                                />
                                <button 
                                    className="btn-primary"
                                    disabled={manualCode.length !== 6}
                                    onClick={() => processCode(manualCode)}
                                    style={{ padding: '0 1.5rem' }}
                                >
                                    Verify Code
                                </button>
                            </div>
                        </div>
                    </>
                )}

                <div style={{ textAlign: 'left', background: 'var(--surface)', padding: '1.25rem', borderRadius: '12px' }}>
                    <h3 style={{ fontSize: '0.875rem', marginBottom: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>Instructions</h3>
                    <ul className="text-muted text-sm" style={{ paddingLeft: '1.25rem' }}>
                        <li style={{ marginBottom: '0.4rem' }}>Scan the customer's QR code from their app.</li>
                        <li style={{ marginBottom: '0.4rem' }}>If scanning fails, type the 6-digit code shown below the QR.</li>
                        <li>Verify the offer details before providing the discount.</li>
                    </ul>
                </div>
            </div>
            <style>{`
                @keyframes scan {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
            `}</style>
        </div>
    )
}
