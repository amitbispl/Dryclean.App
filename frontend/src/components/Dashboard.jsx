import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats } from '../api/client'
import { fmtDate, fmtMoney, statusBadgeClass, catBadgeClass, today } from '../utils'

const STATUS_COLORS = { Received: '#1B4FD8', Processing: '#F59E0B', Completed: '#0BA5A4', Packing: '#7C3AED', Ready: '#10B981', Delivered: '#374151', Cancelled: '#EF4444' }

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getDashboardStats().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading dashboard...</div>
  if (!stats) return <div className="alert alert-danger">Failed to load dashboard</div>

  const dueOrders = stats.recent_orders?.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled' && o.delivery_date < today()) || []

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon si-blue">
            <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </div>
          <div className="stat-num">{stats.total_orders}</div>
          <div className="stat-lbl">Total Orders</div>
          <div className="stat-trend t-up">↑ Today: {stats.today_orders} new</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-amber">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="stat-num">{stats.pending_orders}</div>
          <div className="stat-lbl">Pending Orders</div>
          <div className={`stat-trend ${stats.overdue_orders > 0 ? 't-down' : 't-up'}`}>
            {stats.overdue_orders > 0 ? `⚠️ ${stats.overdue_orders} overdue` : '✓ All on time'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-green">
            <svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
          <div className="stat-num">{stats.ready_orders}</div>
          <div className="stat-lbl">Ready for Delivery</div>
          <div className="stat-trend t-up">✓ Ready to hand over</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-teal">
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="stat-num">{fmtMoney(stats.total_collection)}</div>
          <div className="stat-lbl">Total Collection</div>
          <div className="stat-trend t-up">Today: {fmtMoney(stats.today_collection)}</div>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Recent Orders
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/orders')}>View All →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Receipt</th><th>Customer</th><th>Amount</th><th>Delivery</th><th>Status</th></tr></thead>
              <tbody>
                {(stats.recent_orders || []).map(o => (
                  <tr key={o.id} onClick={() => navigate('/orders')} style={{ cursor: 'pointer' }}>
                    <td><strong style={{ color: 'var(--blue)' }}>{o.id}</strong></td>
                    <td>{o.cust_name}</td>
                    <td>{fmtMoney(o.total)}</td>
                    <td style={{ color: o.delivery_date < today() && o.status !== 'Delivered' ? 'var(--red)' : 'inherit' }}>{fmtDate(o.delivery_date)}</td>
                    <td><span className={`badge ${statusBadgeClass(o.status)}`}>{o.status}</span></td>
                  </tr>
                ))}
                {!stats.recent_orders?.length && <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20, color: 'var(--gray400)' }}>No orders yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Order Status
            </div>
          </div>
          <div className="panel-body" style={{ padding: '10px 14px' }}>
            <div className="status-flow">
              {Object.entries(STATUS_COLORS).map(([s, c], i) => (
                <div className="sf-item" key={s}>
                  <div className="sf-dot" style={{ background: c }}>{i + 1}</div>
                  <div>
                    <div className="sf-label">{s}</div>
                    <div className="sf-sub">{s === 'Ready' ? 'Ready for delivery' : s === 'Delivered' ? 'Complete' : ''}</div>
                  </div>
                  <div className="sf-count">{stats.status_counts?.[s] || 0}</div>
                  <div className="sf-line" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {dueOrders.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title" style={{ color: 'var(--red)' }}>
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Overdue Deliveries ({dueOrders.length})
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/delivery')}>Manage →</button>
          </div>
          <div className="panel-body">
            {dueOrders.map(o => {
              const days = Math.floor((new Date(today()) - new Date(o.delivery_date)) / 86400000)
              return (
                <div className="due-item" key={o.id}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: days > 2 ? '#FEF2F2' : '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👕</div>
                  <div>
                    <div className="due-name">{o.cust_name}</div>
                    <div className="due-meta">{o.id} · Due: {fmtDate(o.delivery_date)}</div>
                  </div>
                  <div className={`due-days ${days > 2 ? 'days-red' : 'days-amber'}`}>{days} days late</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
