
import { useEffect, useState } from 'react'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Eye, TrendingUp, Activity, Bookmark, Zap, Info, Wallet, Loader2, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
    const [loading, setLoading] = useState(true)
    const [businesses, setBusinesses] = useState([])
    const [selectedBusiness, setSelectedBusiness] = useState('All Businesses')
    const [allData, setAllData] = useState({
        billboards: [],
        analytics: [],
        merchantOffers: []
    })
    const [metrics, setMetrics] = useState({
        totalViews: 0,
        totalClaims: 0,
        totalRedemptions: 0,
        conversionRate: 0,
        activeCampaigns: 0
    })
    const [engagementData, setEngagementData] = useState([])
    const [interestData, setInterestData] = useState([])
    const [insightText, setInsightText] = useState('')

    useEffect(() => {
        fetchDashboardData()
    }, [])

    useEffect(() => {
        if (!loading) {
            calculateMetrics()
        }
    }, [selectedBusiness, allData])

    const fetchDashboardData = async () => {
        try {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Fetch Merchant's Billboards with Error Logging
            const { data: billboards, error: bbError } = await supabase
                .from('billboards')
                // Removed 'is_active' just in case it was causing a silent column error. 
                // If you know it's on the billboards table, you can add it back.
                .select('id, category, campaigns(business_name, is_active)')
                .eq('owner_id', user.id)

            if (bbError) {
                console.error('❌ Supabase Error fetching billboards:', bbError.message)
            }

            const billboardIds = billboards?.map(b => b.id) || []

            // ROBUST EXTRACTION: Safely handle both arrays and objects
            const bizNames = [...new Set(
                billboards?.flatMap(b => {
                    if (!b.campaigns) return [];
                    // If Supabase returns an array of campaigns
                    if (Array.isArray(b.campaigns)) return b.campaigns.map(c => c.business_name);
                    // If Supabase returns a single object
                    return [b.campaigns.business_name];
                }).filter(Boolean)
            )]

            setBusinesses(['All Businesses', ...bizNames.sort()])

            // 2. Fetch Actual Saved Offers
            const { data: merchantOffers, error: offerError } = await supabase
                .from('saved_offers')
                .select('id, is_redeemed, created_at, billboard_id')
                .in('billboard_id', billboardIds.length > 0 ? billboardIds : ['00000000-0000-0000-0000-000000000000'])

            if (offerError) console.error('❌ Supabase Error fetching offers:', offerError.message)

            // 3. Fetch analytics (Resilient 30-day filter)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            thirtyDaysAgo.setUTCHours(0, 0, 0, 0); // Reset to midnight UTC to prevent "Ghosting" due to PKT lag
            const filterDate = thirtyDaysAgo.toISOString();

            const { data: analytics, error: analyticsError } = await supabase
                .from('analytics_events')
                .select('event_type, created_at, billboard_id')
                .in('billboard_id', billboardIds.length > 0 ? billboardIds : ['00000000-0000-0000-0000-000000000000'])
                .gte('created_at', filterDate)

            if (analyticsError) console.error('❌ Supabase Error fetching analytics:', analyticsError.message)

            setAllData({
                billboards: billboards || [],
                analytics: analytics || [],
                merchantOffers: merchantOffers || []
            })

        } catch (error) {
            console.error('❌ Error loading dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateMetrics = () => {
        const { billboards, analytics, merchantOffers } = allData

        // ROBUST FILTERING
        const filteredBillboards = selectedBusiness === 'All Businesses'
            ? billboards
            : billboards.filter(b => {
                if (!b.campaigns) return false;
                if (Array.isArray(b.campaigns)) {
                    return b.campaigns.some(c => c.business_name === selectedBusiness);
                }
                return b.campaigns.business_name === selectedBusiness;
            })

        const filteredBillboardIds = filteredBillboards.map(b => b.id)

        // Filter related data by filtered billboard IDs
        const filteredAnalytics = analytics.filter(e => filteredBillboardIds.includes(e.billboard_id))
        const filteredOffers = merchantOffers.filter(o => filteredBillboardIds.includes(o.billboard_id))

        // Calculate Funnel Metrics
        const claims = filteredOffers.length
        const redemptions = filteredOffers.filter(o => o.is_redeemed).length
        const totalViews = filteredAnalytics.filter(e => ['view', 'map_view', 'proximity', 'ar_view_3s'].includes(e.event_type)).length

        // Count active billboards (Checking if any linked campaign is active)
        const activeCount = filteredBillboards.filter(b => {
            if (Array.isArray(b.campaigns)) return b.campaigns.some(c => c.is_active);
            return b.campaigns?.is_active;
        }).length

        // ROI: Sales / Views
        const conversion = totalViews > 0 ? ((redemptions / totalViews) * 100) : 0

        setMetrics({
            totalViews: totalViews,
            totalClaims: claims,
            totalRedemptions: redemptions,
            conversionRate: conversion.toFixed(1),
            activeCampaigns: activeCount
        })

        // --- Engagement Data (Last 7 Days) ---
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (6 - i))
            const dateStr = d.toISOString().split('T')[0]
            return {
                name: d.toLocaleDateString('en-US', { weekday: 'short' }),
                date: dateStr,
                views: 0,
                claims: 0,
                redemptions: 0
            }
        })

        filteredAnalytics.forEach(e => {
            if (!e.created_at) return;
            const date = e.created_at.split('T')[0]
            const day = last7Days.find(d => d.date === date)
            if (day && ['view', 'map_view', 'proximity', 'ar_view_3s'].includes(e.event_type)) day.views++
        })

        filteredOffers.forEach(o => {
            if (!o.created_at) return;
            const date = o.created_at.split('T')[0]
            const day = last7Days.find(d => d.date === date)
            if (day) {
                day.claims++
                if (o.is_redeemed) day.redemptions++
            }
        })

        setEngagementData(last7Days)

        // --- Interests Data (By Category) ---
        const categories = {}
        filteredBillboards.forEach(b => {
            if (b.category) categories[b.category] = (categories[b.category] || 0) + 1
        })
        const pieData = Object.keys(categories).map(key => ({ name: key, value: categories[key] }))
        setInterestData(pieData)

        // Insight helper:
        if (totalViews > 0) {
            setInsightText(`Your ${selectedBusiness === 'All Businesses' ? 'billboards' : selectedBusiness + ' ads'} have reached ${totalViews} users in the last 30 days with a ${conversion.toFixed(1)}% sales conversion.`)
        } else {
            setInsightText("Interactive map views will appear here as users discover your billboards.")
        }
    }

    const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

    return (
        <div className="container">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ textShadow: '0 0 20px rgba(139, 92, 246, 0.3)' }}>Overview</h1>
                    <p className="text-muted">Real-time AR performance metrics</p>
                </div>

                {/* Business Filter Dropdown */}
                {!loading && businesses.length > 0 && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <Filter size={16} className="text-muted" />
                        <select
                            value={selectedBusiness}
                            onChange={(e) => setSelectedBusiness(e.target.value)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text)',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                outline: 'none',
                                paddingRight: '0.5rem'
                            }}
                        >
                            {businesses.map(biz => (
                                <option key={biz} value={biz} style={{ background: '#1e293b', color: '#fff' }}>
                                    {biz}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </header>

            {loading ? (
                <div className="flex-center" style={{ height: '400px', flexDirection: 'column', gap: '1rem' }}>
                    <Loader2 className="animate-spin" size={40} color="var(--primary)" />
                    <p className="text-muted">Analyzing your ad performance...</p>
                </div>
            ) : (
                <>
                    {/* KPI Cards: The Funnel */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <StatCard
                            title="Total Views"
                            value={metrics.totalViews.toLocaleString()}
                            icon={<Eye size={24} color="var(--accent)" />}
                            trend="Funnel Top"
                            tooltip="User scans the AR billboard."
                        />
                        <StatCard
                            title="Claims (Wallet)"
                            value={metrics.totalClaims.toLocaleString()}
                            icon={<Wallet size={24} color="var(--primary)" />}
                            trend="Funnel Middle"
                            tooltip="User saved the coupon to their wallet (Intent to Buy)."
                        />
                        <StatCard
                            title="Redemptions (Store)"
                            value={metrics.totalRedemptions.toLocaleString()}
                            icon={<Zap size={24} color="var(--warning)" />}
                            trend="Funnel Bottom"
                            tooltip="User visited the store and used the coupon (Actual Sale)."
                        />
                        <StatCard
                            title="Campaign ROI"
                            value={`${metrics.conversionRate}%`}
                            icon={<TrendingUp size={24} color="var(--success)" />}
                            trend="Global Conversion"
                            tooltip="Percentage of Views that turned into actual Store Redemptions."
                        />
                    </div>

                    {/* Charts */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '1.5rem' }}>

                        {/* Line Chart: Full Funnel Engagement */}
                        <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h3>Engagement Funnel</h3>
                                <Activity size={20} className="text-muted" />
                            </div>

                            <div style={{ flex: 1, minHeight: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={engagementData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--text-muted)" />
                                        <YAxis axisLine={false} tickLine={false} stroke="var(--text-muted)" />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                            itemStyle={{ color: 'var(--text)' }}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="views" stroke="var(--text-muted)" strokeWidth={2} dot={{ r: 2 }} name="Views" />
                                        <Line type="monotone" dataKey="claims" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} name="Claims" />
                                        <Line type="monotone" dataKey="redemptions" stroke="var(--success)" strokeWidth={3} dot={{ r: 4 }} name="Sales" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', borderLeft: '3px solid var(--primary)', fontSize: '0.875rem' }}>
                                <span className="text-muted">✨ Insight: </span>
                                <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                                    {insightText || "Gathering funnel data..."}
                                </span>
                            </div>
                        </div>

                        {/* Pie Chart: Interests */}
                        <div className="card" style={{ height: '400px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h3>Audience Interests</h3>
                                <div className="text-muted text-sm">Personalization Filter</div>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={interestData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {interestData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    <Legend verticalAlign="middle" align="right" layout="vertical" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                    </div>
                </>
            )}
        </div>
    )
}

function StatCard({ title, value, icon, trend, tooltip }) {
    const [showTooltip, setShowTooltip] = useState(false)

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <p className="text-muted text-sm" style={{ fontWeight: 500 }}>{title}</p>
                        {tooltip && (
                            <div
                                onMouseEnter={() => setShowTooltip(true)}
                                onMouseLeave={() => setShowTooltip(false)}
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                                <Info size={14} className="text-muted" />
                            </div>
                        )}
                    </div>
                    <h2 style={{ fontSize: '2rem', marginTop: '0.25rem' }}>{value}</h2>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                    {icon}
                </div>
            </div>

            {/* Tooltip Popup */}
            {showTooltip && (
                <div style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '50%',
                    transform: 'translate(-50%, -100%)',
                    background: '#334155',
                    color: '#fff',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    width: '180px',
                    zIndex: 10,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    pointerEvents: 'none'
                }}>
                    {tooltip}
                    <div style={{
                        position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                        width: '8px', height: '8px', background: '#334155'
                    }}></div>
                </div>
            )}

            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {trend}
            </div>
        </div>
    )
}
