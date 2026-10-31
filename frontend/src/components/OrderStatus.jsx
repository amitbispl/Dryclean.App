import { useState, useEffect } from 'react'
import { getOrders, updateOrderStatus } from '../api/client'
import { fmtDate, fmtMoney, statusBadgeClass } from '../utils'
import Modal from './Modal'
import { useToast } from './Toast'

const STATUS_FLOW = ['Received','Processing','Completed','Packing','Ready','Delivered','Cancelled']
const STATUS_COLORS = { Received: '#1B4FD8', Processing: '#F59E0B', Completed: '#0BA5A4', Packing: '#7C3AED', Ready: '#10B981', Delivered: '#374151', Cancelled: '#EF4444' }

export default function OrderStatus() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [statusModal, setStatusModal] = useState(null)
  const [newStatus, setNewStatus] = useState('')
  const [note, setNote] = useState('')
  const toast = useToast()

  const load = () => {
    const params = filter ? { status: filter } : {}
    getOrders(params).then(setOrders).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  async function doUpdate() {
    if (!newStatus) return
    try {
      await updateOrderStatus(statusModal.id, { status: newStatus, note, updated_by: 'Admin' })
      toast(`Status → ${newStatus}`)
      setStatusModal(null)
      load()
    } catch { toast('Failed', 'danger') }
  }

  const counts = STATUS_FLOW.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length
    return acc
  }, {})

  if (loading) return <div className="loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div><h2>Order Status</h2><p>Track and manage order progress</p></div>
      </div>

      <div className="two-col" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Filter by Status</div>
          </div>
          <div className="panel-body" style={{ padding: '8px 14px' }}>
            <div className="status-flow">
              {STATUS_FLOW.map((s, i) => (
                <div className="sf-item" key={s} onClick={() => setFilter(filter === s ? '' : s)} style={{ cursor: 'pointer', background: filter === s ? 'var(--blue-lt)' : '', borderRadius: 6, padding: '9px 6px' }}>
                  <div className="sf-dot" style={{ background: STATUS_COLORS[s] }}>{i + 1}</div>
                  <div>
                    <div className="sf-label">{s}</div>
                  </div>
                  <div className="sf-count">{counts[s]}</div>
                  <div className="sf-line" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {filter && <div className="alert alert-info" style={{ marginBottom: 8 }}>
            Showing: <strong>{filter}</strong> ({orders.length} orders)
            <button className="btn btn-sm btn-outline" style={{ marginLeft: 'auto' }} onClick={() => setFilter('')}>Clear</button>
          </div>}
          <div className="panel">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Receipt</th><th>Customer</th><th>Delivery</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td><strong style={{ color: 'var(--blue)' }}>{o.id}</strong></td>
                      <td>{o.cust_name}<div style={{ fontSize: 11, color: 'var(--gray400)' }}>{o.mobile}</div></td>
                      <td>{fmtDate(o.delivery_date)}</td>
                      <td>{fmtMoney(o.total)}</td>
                      <td><span className={`badge ${statusBadgeClass(o.status)}`}>{o.status}</span></td>
                      <td>
                        {o.status !== 'Delivered' && o.status !== 'Cancelled' &&
                          <button className="btn btn-primary btn-sm" onClick={() => { setStatusModal(o); setNewStatus(''); setNote('') }}>Update</button>}
                      </td>
                    </tr>
                  ))}
                  {!orders.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--gray400)' }}>No orders</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!statusModal} title="Update Status" onClose={() => setStatusModal(null)}
        footer={<>
          <button className="btn btn-outline" onClick={() => setStatusModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={doUpdate}>Update</button>
        </>}>
        {statusModal && <>
          <div style={{ marginBottom: 12 }}>
            <span className={`badge ${statusBadgeClass(statusModal.status)}`}>{statusModal.status}</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--gray600)' }}>{statusModal.id} — {statusModal.cust_name}</span>
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>New Status</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              <option value="">-- Select --</option>
              {STATUS_FLOW.filter(s => s !== statusModal.status).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Note (optional)</label>
            <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </>}
      </Modal>
    </>
  )
}
