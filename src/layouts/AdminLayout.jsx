
import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Ticket, LogOut, Menu, TrendingUp, Map, Store, Scan } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AdminLayout() {
    const navigate = useNavigate()
    const [businessName, setBusinessName] = useState('Admin')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                // Try fetching from profiles table first
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('business_name')
                    .eq('id', user.id)
                    .single()

                if (profile?.business_name) {
                    setBusinessName(profile.business_name)
                } else if (user.user_metadata?.business_name) {
                    // Fallback to metadata if profile not created yet (though trigger should handle it)
                    setBusinessName(user.user_metadata.business_name)
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    return (
        <div className="dashboard-grid">
            {/* Sidebar */}
            <aside style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)', height: '100vh', position: 'sticky', top: 0, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '0 0.5rem 2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Store color="white" size={20} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <h2 style={{ fontSize: '1rem', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {loading ? '...' : businessName}
                        </h2>
                        <div className="text-muted text-sm">Dashboard</div>
                    </div>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <NavLink
                        to="/"
                        className={({ isActive }) => `btn`}
                        style={({ isActive }) => ({
                            justifyContent: 'flex-start',
                            background: isActive ? 'var(--primary-light)' : 'transparent',
                            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                        })}
                    >
                        <LayoutDashboard size={20} />
                        Dashboard
                    </NavLink>

                    <NavLink
                        to="/insights"
                        className={({ isActive }) => `btn`}
                        style={({ isActive }) => ({
                            justifyContent: 'flex-start',
                            background: isActive ? 'var(--primary-light)' : 'transparent',
                            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                        })}
                    >
                        <TrendingUp size={20} />
                        Insights
                    </NavLink>

                    <NavLink
                        to="/billboards"
                        className={({ isActive }) => `btn`}
                        style={({ isActive }) => ({
                            justifyContent: 'flex-start',
                            background: isActive ? 'var(--primary-light)' : 'transparent',
                            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                        })}
                    >
                        <Map size={20} />
                        Billboards
                    </NavLink>

                    <NavLink
                        to="/coupons"
                        className={({ isActive }) => `btn`}
                        style={({ isActive }) => ({
                            justifyContent: 'flex-start',
                            background: isActive ? 'var(--primary-light)' : 'transparent',
                            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                        })}
                    >
                        <Ticket size={20} />
                        Coupons
                    </NavLink>

                    <NavLink
                        to="/scanner"
                        className={({ isActive }) => `btn`}
                        style={({ isActive }) => ({
                            justifyContent: 'flex-start',
                            background: isActive ? 'var(--primary-light)' : 'transparent',
                            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                        })}
                    >
                        <Scan size={20} />
                        Scanner
                    </NavLink>
                </nav>

                <button onClick={handleLogout} className="btn" style={{ justifyContent: 'flex-start', color: 'var(--danger)', marginTop: 'auto' }}>
                    <LogOut size={20} />
                    Sign Out
                </button>
            </aside>

            {/* Main Content */}
            <main style={{ padding: '2rem' }}>
                <Outlet />
            </main>
        </div>
    )
}
