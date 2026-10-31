import { useState, useEffect } from 'react'
import { getDeliveryReport, updateOrderStatus } from '../api/client'
import { fmtDate, fmtMoney, statusBadgeClass, today } from '../utils'
import { useToast } from './Toast'

export default function Delivery() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const toast = useToast()

  const load = () => {
    setLoading(true)
    const params = filter !== 'all' ? { filter } : {}
    getDeliveryReport(params).then(setOrders).catch(() => toast('Failed to load', 'danger')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  async function markDelivered(id) {
    try {
      await updateOrderStatus(id, { status: 'Delivered', updatedBy: 'Counter' })
      toast(`${id} marked as Delivered`)
      load()
    } catch { toast('Failed', 'danger') }
  }

  return (
    <>
      <div className="page-header">
        <div><h2>Delivery Management</h2><p>Manage today's and pending deliveries</p></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['all','All Pending'],['today',"Today's"],['tomorrow',"Tomorrow's"],['overdue','Overdue']].map(([val,label]) => (
          <button key={val} className={`btn ${filter === val ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(val)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <>
          {orders.length === 0 && (
            <div className="empty-state"><p>No deliveries for this filter</p></div>
          )}
          {orders.map(o => (
            <div className="del-card" key={o.id}>
              <div className="del-head">
                <div>
                  <span className="del-receipt">{o.id}</span>
                  <span style={{ marginLeft: 10 }}><span className={`badge ${statusBadgeClass(o.status)}`}>{o.status}</span></span>
                  {o.overdue_days > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--red)' }}>⚠ {o.overdue_days} day{o.overdue_days > 1 ? 's' : ''} overdue</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {o.status !== 'Delivered' && (
                    <button className="btn btn-success btn-sm" onClick={() => markDelivered(o.id)}>Mark Delivered</button>
                  )}
                </div>
              </div>
              <div className="del-body">
                <div className="del-field"><span>Customer</span><strong>{o.cust_name}</strong></div>
                <div className="del-field"><span>Mobile</span><strong>{o.mobile}</strong></div>
                <div className="del-field"><span>Due Date</span><strong style={{ color: o.overdue_days > 0 ? 'var(--red)' : 'inherit' }}>{fmtDate(o.delivery_date)}</strong></div>
                <div className="del-field"><span>Total</span><strong>{fmtMoney(o.total)}</strong></div>
                <div className="del-field"><span>Balance Due</span><strong style={{ color: o.balance > 0 ? 'var(--red)' : 'var(--green)' }}>{fmtMoney(o.balance)}</strong></div>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  )
}
