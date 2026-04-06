
import { useEffect, useState } from 'react'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Eye, TrendingUp, Activity, Bookmark, Zap, Info, Wallet, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
    const [loading, setLoading] = useState(true)
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

    const fetchDashboardData = async () => {
        try {
            setLoading(true)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Fetch Merchant's Billboards
            const { data: billboards } = await supabase
                .from('billboards')
                .select('id, is_active, category')
                .eq('owner_id', user.id)

            const billboardIds = billboards?.map(b => b.id) || []

            // 2. Fetch Actual Saved Offers (Claims) for these billboards
            const { data: savedOffers } = await supabase
                .from('saved_offers')
                .select('is_redeemed, created_at')
                .in('campaign_id', 
                    billboards?.flatMap(b => b.campaign_id) || [] // Assuming campaigns are linked
                )
            
            // Re-fetching offers by billboard link to be safer
            const { data: merchantOffers } = await supabase
                .from('saved_offers')
                .select('id, is_redeemed, created_at, billboard_id')
                .in('billboard_id', billboardIds)

            // 3. Fetch analytics for real views
            const { data: analytics } = await supabase
                .from('analytics_events')
                .select('event_type, created_at')
                .in('billboard_id', billboardIds)
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

            // Calculate Funnel Metrics
            const claims = merchantOffers?.length || 0
            const redemptions = merchantOffers?.filter(o => o.is_redeemed).length || 0
            const totalViews = analytics?.filter(e => ['view', 'map_view'].includes(e.event_type)).length || 0
            const activeCount = billboards?.filter(b => b.is_active).length || 0

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

            analytics?.forEach(e => {
                const date = e.created_at.split('T')[0]
                const day = last7Days.find(d => d.date === date)
                if (day && ['view', 'map_view'].includes(e.event_type)) day.views++
            })

            merchantOffers?.forEach(o => {
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
            billboards?.forEach(b => {
                if (b.category) categories[b.category] = (categories[b.category] || 0) + 1
            })
            const pieData = Object.keys(categories).map(key => ({ name: key, value: categories[key] }))
            setInterestData(pieData)
            
            // Insight helper:
            if (totalViews > 0) {
                setInsightText(`Your billboards have reached ${totalViews} users in the last 30 days with a ${conversion.toFixed(1)}% sales conversion.`)
            } else {
                setInsightText("Interactive map views will appear here as users discover your billboards.")
            }

        } catch (error) {
            console.error('Error loading dashboard:', error)
        } finally {
            setLoading(false)
        }
    }
    const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

    return (
        <div className="container">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ textShadow: '0 0 20px rgba(139, 92, 246, 0.3)' }}>Overview</h1>
                <p className="text-muted">Real-time AR performance metrics</p>
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
