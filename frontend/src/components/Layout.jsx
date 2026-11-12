import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

function initials(name) {
  return (name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

const pageTitles = {
  '/': 'Dashboard', '/new-order': 'New Order', '/orders': 'All Orders',
  '/scan': 'Scan Station', '/status': 'Order Status', '/delivery': 'Delivery Management', '/reports': 'Sales Report',
  '/billing': 'Billing', '/products': 'Products', '/categories': 'Categories', '/customers': 'Customers',
  '/settings': 'Settings', '/users': 'Users', '/companies': 'Companies', '/subscriptions': 'Subscriptions'
}

export default function Layout({ children, overdueCnt = 0 }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const user = getUser()
  const isSuperAdmin = user.role === 'SuperAdmin'

  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const title = pageTitles[location.pathname] || 'WashMitra'

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  const nav = (path) => { navigate(path); setSidebarOpen(false) }
  const active = (path) => location.pathname === path

  const NavItem = ({ path, icon, label, badge }) => (
    <div className={`nav-item${active(path) ? ' active' : ''}`} onClick={() => nav(path)}>
      {icon}
      {label}
      {badge && overdueCnt > 0 && <span className="nav-badge">{overdueCnt}</span>}
    </div>
  )

  return (
    <div className="app">
      <div className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="logo">
          <img src="/logo.jpg" alt="WashMitra" style={{ height: 36, objectFit: 'contain', marginBottom: 4 }} />
          <div className="logo-name">{user.companyName || 'WashMitra'}</div>
          <div className="logo-sub">Management System</div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Main</div>
          <NavItem path="/" label="Dashboard" icon={<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>} />
          <NavItem path="/new-order" label="New Order" icon={<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>} />
          <NavItem path="/orders" label="All Orders" icon={<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>} />
        </div>

        <div className="nav-group">
          <div className="nav-label">Process</div>
          <NavItem path="/scan" label="Scan Station" icon={<svg viewBox="0 0 24 24"><path d="M3 5h2M3 10h2M3 15h2M7 3v18M17 3v18M21 5h-2M21 10h-2M21 15h-2"/></svg>} />
          <NavItem path="/status" label="Order Status" icon={<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>} />
          <NavItem path="/delivery" label="Delivery" badge icon={<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>} />
        </div>

        <div className="nav-group">
          <div className="nav-label">Reports</div>
          <NavItem path="/reports" label="Sales Report" icon={<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>} />
          <NavItem path="/billing" label="Billing" icon={<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>} />
        </div>

        <div className="nav-group">
          <div className="nav-label">Setup</div>
          <NavItem path="/products" label="Products" icon={<svg viewBox="0 0 24 24"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>} />
          <NavItem path="/categories" label="Categories" icon={<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>} />
          <NavItem path="/customers" label="Customers" icon={<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
          <NavItem path="/users" label="Users" icon={<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>} />
          {isSuperAdmin && <NavItem path="/companies" label="Companies" icon={<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>} />}
          <NavItem path="/subscriptions" label="Subscriptions" icon={<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>} />
          <NavItem path="/settings" label="Settings" icon={<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>} />
        </div>

        <div className="sidebar-foot">
          <div className="user-row">
            <div className="avatar">{initials(user.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || 'User'}</div>
              <div className="user-role">{user.role || 'Staff'}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8BA3CC', padding: 4, flexShrink: 0 }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="hamburger" onClick={() => setSidebarOpen(s => !s)} aria-label="Menu">
              <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div className="topbar-title">{title}</div>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">{dateStr}</span>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/new-order')}>
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <span>New Order</span>
            </button>
            <button
              onClick={handleLogout}
              title="Logout"
              style={{ background: 'none', border: '1px solid var(--gray200)', borderRadius: 8, cursor: 'pointer', color: 'var(--gray500)', padding: '6px 8px', display: 'flex', alignItems: 'center' }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="content-area">{children}</div>
      </div>

      <nav className="bottom-nav">
        <div className="bnav-inner">
          {[
            { path: '/', label: 'Home', icon: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
            { path: '/new-order', label: 'New', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
            { path: '/orders', label: 'Orders', icon: <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
            { path: '/delivery', label: 'Delivery', icon: <svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
            { path: '/scan', label: 'Scan', icon: <svg viewBox="0 0 24 24"><path d="M3 5h2M3 10h2M3 15h2M7 3v18M17 3v18M21 5h-2M21 10h-2M21 15h-2"/></svg> },
          ].map(item => (
            <div key={item.path} className={`bnav-item${active(item.path) ? ' active' : ''}`} onClick={() => nav(item.path)}>
              {item.icon}
              {item.label}
            </div>
          ))}
        </div>
      </nav>
    </div>
  )
}
