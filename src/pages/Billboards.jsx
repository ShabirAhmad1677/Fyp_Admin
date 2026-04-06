import { useEffect, useState } from 'react'
import { MapPin, Eye, Trash2, Search, Plus, Upload, X, Loader2, Locate, Pencil, Zap, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import imageCompression from 'browser-image-compression'

export default function Billboards() {
    const [billboards, setBillboards] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [locating, setLocating] = useState(false)

    // Form State
    const [form, setForm] = useState({
        title: '',
        business: '',
        category: 'Retail',
        city: 'Mardan',
        latitude: '',
        longitude: '',
        full_description: '',
        contact: '',
        features: '',
        hours: '',
        discount: '',
        image_target_url: '',
        physical_width: '1.0',
        cloud_anchor_id: '',
        glb_asset_url: ''
    })
    const [imageFile, setImageFile] = useState(null)
    const [targetFile, setTargetFile] = useState(null)
    const [glbFile, setGlbFile] = useState(null)
    const [editingId, setEditingId] = useState(null)

    useEffect(() => {
        fetchBillboards()
    }, [])

    const fetchBillboards = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Fetch Billboards & Campaigns
        const { data, error } = await supabase
            .from('billboards')
            .select('*, campaigns(*)')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching billboards:', error)
            setLoading(false)
            return
        }

        // 2. Fetch View Counts for all merchant's billboards from Analytics
        const billboardIds = data?.map(b => b.id) || []
        const { data: analytics } = await supabase
            .from('analytics_events')
            .select('billboard_id, event_type')
            .in('billboard_id', billboardIds)
            .in('event_type', ['view', 'map_view', 'ar_view_3s'])

        // Aggregate views by ID
        const viewCounts = {}
        analytics?.forEach(e => {
            viewCounts[e.billboard_id] = (viewCounts[e.billboard_id] || 0) + 1
        })

        if (data) {
            const flattened = data.map(b => {
                const active = b.campaigns?.find(c => c.is_active) || b.campaigns?.[0]
                return {
                    ...b,
                    business: active?.business_name || 'N/A',
                    title: active?.title || 'Untitled',
                    image_url: active?.media_url || '',
                    full_description: active?.description || '',
                    contact: active?.contact || '',
                    features: active?.features || [],
                    hours: active?.hours || '',
                    discount: active?.discount || '',
                    views: viewCounts[b.id] || 0 // Actual live count
                }
            })
            setBillboards(flattened)
        }
        setLoading(false)
    }

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0])
        }
    }

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            return alert('Geolocation is not supported by your browser')
        }
        setLocating(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setForm(prev => ({
                    ...prev,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }))
                setLocating(false)
            },
            (error) => {
                alert('Unable to retrieve your location: ' + error.message)
                setLocating(false)
            }
        )
    }

    const validateFile = (file, type) => {
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_SIZE) {
            alert(`File "${file.name}" is too large. Max limit is 5MB.`);
            return false;
        }
        if (type === 'glb' && !file.name.toLowerCase().endsWith('.glb')) {
            alert('Please upload a valid .glb 3D model.');
            return false;
        }
        return true;
    };

    const compressImage = async (file) => {
        if (!file) return null;
        if (!validateFile(file, 'image')) return null;
        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
        };
        try {
            return await imageCompression(file, options);
        } catch (error) {
            console.error("Compression Error:", error);
            return file;
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault()
        try {
            setUploading(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('You must be logged in')

            // --- Phase 0: Image Compression ---
            const compressedImage = await (imageFile ? compressImage(imageFile) : null);
            const compressedTarget = await (targetFile ? compressImage(targetFile) : null);

            let publicUrl = null
            // 1. Upload Banner Image
            if (compressedImage) {
                const fileExt = compressedImage.name.split('.').pop()
                const fileName = `${Date.now()}-banner.${fileExt}`
                const { error: uploadError } = await supabase.storage
                    .from('billboards')
                    .upload(`media/${fileName}`, compressedImage)

                if (uploadError) throw uploadError
                const { data: urlData } = supabase.storage.from('billboards').getPublicUrl(`media/${fileName}`)
                publicUrl = urlData.publicUrl
            }

            let targetUrl = null
            // 2. Upload AR Target
            if (compressedTarget) {
                const fileExt = compressedTarget.name.split('.').pop()
                const fileName = `${Date.now()}-target.${fileExt}`
                const { error: targetError } = await supabase.storage
                    .from('billboards')
                    .upload(`targets/${fileName}`, compressedTarget)

                if (targetError) throw targetError
                const { data: targetData } = supabase.storage.from('billboards').getPublicUrl(`targets/${fileName}`)
                targetUrl = targetData.publicUrl
            }

            let glbUrl = null
            // 3. Upload GLB Asset
            if (glbFile) {
                const fileName = `${Date.now()}-model.glb`
                const { error: glbError } = await supabase.storage
                    .from('billboards')
                    .upload(`models/${fileName}`, glbFile)

                if (glbError) throw glbError
                const { data: glbData } = supabase.storage.from('billboards').getPublicUrl(`models/${fileName}`)
                glbUrl = glbData.publicUrl
            }

            // --- Phase 1: ATOMIC TRANSACTION (RPC) ---
            const { data: billboardId, error: rpcError } = await supabase.rpc('publish_billboard_with_campaign', {
                p_billboard_id: editingId, // null for new
                p_owner_id: user.id,
                p_latitude: parseFloat(form.latitude),
                p_longitude: parseFloat(form.longitude),
                p_address: `${form.city}, Pakistan`,
                p_city: form.city,
                p_category: form.category,
                p_image_target_url: targetUrl || (editingId ? undefined : ''),
                p_physical_width: parseFloat(form.physical_width || '1.0'),
                p_cloud_anchor_id: form.cloud_anchor_id || null,
                p_glb_asset_url: glbUrl || form.glb_asset_url || null,
                p_business_name: form.business,
                p_title: form.title,
                p_description: form.full_description,
                p_media_url: publicUrl || (editingId ? undefined : ''), // Keep old media if no new upload
                p_discount: form.discount,
                p_features: form.features ? form.features.split(',').map(f => f.trim()).filter(f => f) : [],
                p_hours: form.hours,
                p_contact: form.contact
            })

            if (rpcError) throw new Error(`Save Failed: ${rpcError.message}`)

            // --- Phase 2: Finalization ---
            await fetchBillboards()
            alert(editingId ? 'Ad updated successfully! 🚀' : 'Ad published successfully! 🎊')
            setShowModal(false)
            resetForm()

        } catch (error) {
            console.error('Senior Review Error Catch:', error.message)
            alert(error.message)
        } finally {
            setUploading(false)
        }
    }

    const resetForm = () => {
        setForm({ title: '', business: '', category: 'Retail', city: 'Mardan', latitude: '', longitude: '', full_description: '', contact: '', features: '', hours: '', discount: '', image_target_url: '', physical_width: '1.0', cloud_anchor_id: '', glb_asset_url: '' })
        setImageFile(null)
        setTargetFile(null)
        setGlbFile(null)
        setEditingId(null)
    }

    const handleEdit = (billboard) => {
        setEditingId(billboard.id)
        setForm({
            title: billboard.title || '',
            business: billboard.business || '',
            category: billboard.category || 'Retail',
            city: billboard.city || '',
            latitude: billboard.latitude || '',
            longitude: billboard.longitude || '',
            full_description: billboard.full_description || '',
            contact: billboard.contact || '',
            features: Array.isArray(billboard.features) ? billboard.features.join(', ') : (billboard.features || ''),
            hours: billboard.hours || '',
            discount: billboard.discount || '',
            physical_width: billboard.physical_width || '1.0',
            image_target_url: billboard.image_target_url || '',
            cloud_anchor_id: billboard.cloud_anchor_id || '',
            glb_asset_url: billboard.glb_asset_url || ''
        })
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('Are you sure? This action cannot be undone. All linked coupons and analytics will also be deleted.')) return

        try {
            const { error } = await supabase.from('billboards').delete().eq('id', id)
            if (error) throw error
            setBillboards(billboards.filter(b => b.id !== id))
            alert('Billboard deleted successfully')
        } catch (error) {
            console.error('Error deleting billboard:', error.message)
            alert('Failed to delete billboard. It might have active campaigns or coupons. Error: ' + error.message)
        }
    }

    const filtered = billboards.filter(b =>
        b.title?.toLowerCase().includes(search.toLowerCase()) ||
        b.business?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="container">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ textShadow: '0 0 20px rgba(6, 182, 212, 0.3)' }}>My Ads</h1>
                    <p className="text-muted">Manage your AR campaigns</p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    <Plus size={20} />
                    Create New Ad
                </button>
            </header>

            {/* Search Bar */}
            <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', maxWidth: '400px' }}>
                <Search size={18} className="text-muted" />
                <input
                    type="text"
                    placeholder="Search campaigns..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ border: 'none', background: 'transparent', padding: 0 }}
                />
            </div>

            {loading ? (
                <div className="flex-center" style={{ height: '200px' }}><Loader2 className="animate-spin" /></div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Creative</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Details</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Location</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Performance</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                                            <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 600 }}>{item.title}</div>
                                        <div className="text-muted text-sm">{item.business} • {item.category}</div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            <MapPin size={14} />
                                            {item.latitude && item.longitude ? (
                                                <span>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</span>
                                            ) : (
                                                <span>{item.city}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                                            <Eye size={16} color="var(--accent)" />
                                            <span style={{ fontWeight: 600 }}>{item.views}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '99px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            background: item.is_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                            color: item.is_active ? 'var(--success)' : 'var(--danger)',
                                            border: `1px solid ${item.is_active ? 'var(--success)' : 'var(--danger)'}`
                                        }}>
                                            {item.is_active ? 'LIVE' : 'PAUSED'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <button className="btn" style={{ color: 'var(--primary)', padding: '0.5rem', marginRight: '0.5rem' }} onClick={() => handleEdit(item)}>
                                            <Pencil size={18} />
                                        </button>
                                        <button className="btn" style={{ color: 'var(--danger)', padding: '0.5rem' }} onClick={() => handleDelete(item.id)}>
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 3, 3, 0.94)', zIndex: 1, padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', }}>
                    <div className="card" style={{
                        width: '100%',
                        maxWidth: '900px',
                        maxHeight: '90vh',
                        background: '#1e293b',
                        // opacity: 0.1,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 0,
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.01)'
                    }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                            <h3 style={{ margin: 0, color: 'var(--primary)', textShadow: '0 0 10px rgba(139, 92, 246, 0.3)' }}>{editingId ? 'Edit Campaign' : 'Launch New Campaign'}</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>

                                    {/* Left Column: Basic Info */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>General Information</h4>
                                        <div>
                                            <label className="text-sm text-muted">Campaign Title</label>
                                            <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Summer Sale 2024" />
                                        </div>
                                        <div>
                                            <label className="text-sm text-muted">Business Name</label>
                                            <input required value={form.business} onChange={e => setForm({ ...form, business: e.target.value })} placeholder="e.g. Urban Kicks" />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label className="text-sm text-muted">Category</label>
                                                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                                    <option>Retail</option>
                                                    <option>Food</option>
                                                    <option>Tech</option>
                                                    <option>Fashion</option>
                                                    <option>Entertainment</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-sm text-muted">Promo Badge (e.g. 20% OFF)</label>
                                                <input value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} placeholder="15% OFF, New!" />
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label className="text-sm text-muted">City</label>
                                                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="e.g. Mardan" />
                                            </div>
                                            <div>
                                                <label className="text-sm text-muted">Short Features (comma separated)</label>
                                                <input value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} placeholder="WiFi, Parking, AC" />
                                            </div>
                                        </div>

                                        <h4 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact Details</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label className="text-sm text-muted">Phone Number</label>
                                                <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="0312-3456789" />
                                            </div>
                                            <div>
                                                <label className="text-sm text-muted">Business Hours</label>
                                                <input value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} placeholder="9 AM - 10 PM" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Creative & Location */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location & Media</h4>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label className="text-sm text-muted">Latitude</label>
                                                <input required type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="34.198" />
                                            </div>
                                            <div>
                                                <label className="text-sm text-muted">Longitude</label>
                                                <input required type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="72.043" />
                                            </div>
                                        </div>

                                        <button type="button" className="btn" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)', border: '1px solid rgba(139, 92, 246, 0.2)', width: '100%', padding: '0.75rem' }} onClick={handleGetLocation} disabled={locating}>
                                            {locating ? <Loader2 className="animate-spin" size={18} /> : <Locate size={18} />}
                                            {locating ? 'Locating...' : 'Detect My Location'}
                                        </button>

                                        <div>
                                            <label className="text-sm text-muted">Description (Detailed)</label>
                                            <textarea
                                                value={form.full_description}
                                                onChange={e => setForm({ ...form, full_description: e.target.value })}
                                                placeholder="Write a compelling description for your ad..."
                                                style={{ width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm text-muted">Ad Creative (Image shown in AR)</label>
                                            <div
                                                style={{
                                                    border: '2px dashed var(--border)',
                                                    borderRadius: '12px',
                                                    padding: '1.5rem',
                                                    textAlign: 'center',
                                                    cursor: 'pointer',
                                                    background: 'rgba(0,0,0,0.2)',
                                                    transition: 'all 0.2s ease',
                                                    borderColor: imageFile ? 'var(--success)' : 'var(--border)',
                                                    marginBottom: '1rem'
                                                }}
                                                onClick={() => document.getElementById('adUpload').click()}
                                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                                onMouseOut={e => e.currentTarget.style.borderColor = imageFile ? 'var(--success)' : 'var(--border)'}
                                            >
                                                {imageFile ? (
                                                    <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                        <Check size={20} />
                                                        <span className="text-sm font-medium">{imageFile.name}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload className="mx-auto text-muted" style={{ display: 'block', margin: '0 auto 0.5rem auto' }} />
                                                        <span className="text-muted text-sm">Upload Ad Image / Photo</span>
                                                    </>
                                                )}
                                                <input id="adUpload" type="file" accept="image/*" hidden onChange={handleFileChange} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm text-muted">AR Target Image (Physical Board Photo)</label>
                                            <div
                                                style={{
                                                    border: '2px dashed var(--border)',
                                                    borderRadius: '12px',
                                                    padding: '1.5rem',
                                                    textAlign: 'center',
                                                    cursor: 'pointer',
                                                    background: 'rgba(0,0,0,0.2)',
                                                    transition: 'all 0.2s ease',
                                                    borderColor: targetFile ? 'var(--success)' : 'var(--border)',
                                                    marginBottom: '1rem'
                                                }}
                                                onClick={() => document.getElementById('targetUpload').click()}
                                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                                onMouseOut={e => e.currentTarget.style.borderColor = targetFile ? 'var(--success)' : 'var(--border)'}
                                            >
                                                {targetFile ? (
                                                    <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                        <Check size={20} />
                                                        <span className="text-sm font-medium">{targetFile.name}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload className="mx-auto text-muted" style={{ display: 'block', margin: '0 auto 0.5rem auto' }} />
                                                        <span className="text-muted text-sm">Upload Photo of the Real Billboard</span>
                                                    </>
                                                )}
                                                <input id="targetUpload" type="file" accept="image/*" hidden onChange={(e) => setTargetFile(e.target.files[0])} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm text-muted">Physical Width (Meters)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={form.physical_width}
                                                onChange={e => setForm({ ...form, physical_width: e.target.value })}
                                                placeholder="e.g. 1.5"
                                            />
                                        </div>

                                        <h4 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3D Spatial Data</h4>
                                        <div>
                                            <label className="text-sm text-muted">Cloud Anchor ID (Generated by App)</label>
                                            <input
                                                value={form.cloud_anchor_id}
                                                onChange={e => setForm({ ...form, cloud_anchor_id: e.target.value })}
                                                placeholder="rv-anchor-xxxxxxx"
                                                style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
                                            />
                                            <p className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>This ID connects the billboard to its 3D physical location.</p>
                                        </div>
                                        <div>
                                            <label className="text-sm text-muted">3D Model (.glb) - Max 5MB</label>
                                            <div
                                                style={{
                                                    border: '2px dashed var(--border)',
                                                    borderRadius: '12px',
                                                    padding: '1.5rem',
                                                    textAlign: 'center',
                                                    cursor: 'pointer',
                                                    background: 'rgba(0,0,0,0.2)',
                                                    transition: 'all 0.2s ease',
                                                    borderColor: glbFile ? 'var(--success)' : 'var(--border)',
                                                    marginBottom: '0.5rem'
                                                }}
                                                onClick={() => document.getElementById('glbUpload').click()}
                                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                                onMouseOut={e => e.currentTarget.style.borderColor = glbFile ? 'var(--success)' : 'var(--border)'}
                                            >
                                                {glbFile ? (
                                                    <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                        <Check size={20} />
                                                        <span className="text-sm font-medium">{glbFile.name} ({(glbFile.size / 1024 / 1024).toFixed(2)}MB)</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload className="mx-auto text-muted" style={{ display: 'block', margin: '0 auto 0.5rem auto' }} />
                                                        <span className="text-muted text-sm">Upload 3D Asset (.glb)</span>
                                                    </>
                                                )}
                                                <input 
                                                    id="glbUpload" 
                                                    type="file" 
                                                    accept=".glb" 
                                                    hidden 
                                                    onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file && validateFile(file, 'glb')) {
                                                            setGlbFile(file);
                                                        }
                                                    }} 
                                                />
                                            </div>
                                            <input
                                                value={form.glb_asset_url}
                                                onChange={e => setForm({ ...form, glb_asset_url: e.target.value })}
                                                placeholder="Or paste external .glb URL"
                                                style={{ fontSize: '0.8rem', opacity: 0.7 }}
                                            />
                                            <p className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>Direct upload is recommended for stability.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn" onClick={() => setShowModal(false)} style={{ border: '1px solid var(--border)' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={uploading} style={{ minWidth: '160px', justifyContent: 'center' }}>
                                    {uploading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={18} />
                                            <span>{editingId ? 'Save Changes' : 'Publish Ad'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
