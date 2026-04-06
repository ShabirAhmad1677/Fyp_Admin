
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, X, MapPin, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Coupons() {
    const [coupons, setCoupons] = useState([])
    const [billboards, setBillboards] = useState([]) // New state for dropdown
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        discount_code: '',
        discount_amount: '',
        valid_until: '',
        billboard_id: '' // New field
    })

    useEffect(() => {
        fetchCoupons()
        fetchBillboards()
    }, [])

    const fetchCoupons = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from('coupons')
            .select(`
                *,
                billboards:billboard_id (title)
            `)
            .eq('owner_id', user.id) // Filter by owner
            .order('created_at', { ascending: false })

        if (error) console.error('Error fetching coupons:', error)
        else setCoupons(data || [])
        setLoading(false)
    }

    // Fetch billboards for the dropdown
    const fetchBillboards = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('billboards')
            .select('id, title')
            .eq('owner_id', user.id) // Only show my billboards
        setBillboards(data || [])
    }

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this coupon?')) return

        const { error } = await supabase.from('coupons').delete().eq('id', id)
        if (error) {
            alert('Error deleting coupon')
        } else {
            setCoupons(coupons.filter(c => c.id !== id))
        }
    }

    const [editingId, setEditingId] = useState(null)

    const handleEdit = (coupon) => {
        setEditingId(coupon.id)
        setFormData({
            title: coupon.title,
            description: coupon.description || '',
            discount_code: coupon.discount_code,
            discount_amount: coupon.discount_amount,
            valid_until: coupon.valid_until ? new Date(coupon.valid_until).toISOString().slice(0, 16) : '',
            billboard_id: coupon.billboard_id || ''
        })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('You must be logged in')

            const payload = {
                ...formData,
                owner_id: user.id
            }
            if (!payload.valid_until) payload.valid_until = null
            if (!payload.billboard_id) payload.billboard_id = null

            if (editingId) {
                const { error } = await supabase
                    .from('coupons')
                    .update(payload)
                    .eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('coupons')
                    .insert([payload])
                if (error) throw error
            }

            fetchCoupons()
            setShowModal(false)
            resetForm()

        } catch (error) {
            alert('Error saving coupon: ' + error.message)
        }
    }

    const resetForm = () => {
        setFormData({ title: '', description: '', discount_code: '', discount_amount: '', valid_until: '', billboard_id: '' })
        setEditingId(null)
    }

    return (
        <div className="container" style={{ position: 'relative' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Coupons</h1>
                    <p className="text-muted">Manage your offers and discounts</p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    <Plus size={20} />
                    Create Coupon
                </button>
            </header>

            {loading ? (
                <div className="flex-center" style={{ height: '200px', flexDirection: 'column', gap: '1rem' }}>
                    <Loader2 className="animate-spin" size={32} color="var(--primary)" />
                    <p className="text-muted">Fetching your coupons...</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Title</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Target Ad</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Code</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Discount</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Valid Until</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No coupons found. Create one to get started.
                                    </td>
                                </tr>
                            ) : (
                                coupons.map((coupon) => (
                                    <tr key={coupon.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 500 }}>{coupon.title}</div>
                                            <div className="text-muted text-sm" style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {coupon.description}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {coupon.billboards ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
                                                    <MapPin size={14} />
                                                    <span style={{ fontSize: '0.9rem' }}>{coupon.billboards.title}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted text-sm">Generic (All Users)</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <code style={{ background: 'var(--bg-body)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                                {coupon.discount_code}
                                            </code>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{coupon.discount_amount}</span>
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                                            {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString() : 'No expiry'}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <button
                                                className="btn"
                                                style={{ padding: '0.5rem', color: 'var(--primary)', marginRight: '0.5rem' }}
                                                onClick={() => handleEdit(coupon)}
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                className="btn"
                                                style={{ padding: '0.5rem', color: 'var(--danger)' }}
                                                onClick={() => handleDelete(coupon.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', background: '#1e293b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3>{editingId ? 'Edit Coupon' : 'Create New Coupon'}</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Billboard Dropdown */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--accent)', fontWeight: 500 }}>Target Billboard (Optional)</label>
                                <select
                                    value={formData.billboard_id}
                                    onChange={e => setFormData({ ...formData, billboard_id: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-body)', color: 'var(--text)' }}
                                >
                                    <option value="">-- Generic (Any Ad) --</option>
                                    {billboards.map(b => (
                                        <option key={b.id} value={b.id}>{b.title}</option>
                                    ))}
                                </select>
                                <p className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>
                                    Select a specific ad to link this discount to.
                                </p>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Title</label>
                                <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Summer Sale" />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Details about the offer..."
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontFamily: 'inherit', background: 'var(--bg-body)', color: 'var(--text)' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Code</label>
                                    <input required value={formData.discount_code} onChange={e => setFormData({ ...formData, discount_code: e.target.value })} placeholder="SUMMER25" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Amount</label>
                                    <input required value={formData.discount_amount} onChange={e => setFormData({ ...formData, discount_amount: e.target.value })} placeholder="25% OFF" />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Valid Until</label>
                                <input type="datetime-local" value={formData.valid_until} onChange={e => setFormData({ ...formData, valid_until: e.target.value })} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn" onClick={() => setShowModal(false)} style={{ border: '1px solid var(--border)' }}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingId ? 'Save Changes' : 'Create Coupon'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
