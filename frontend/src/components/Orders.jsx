import { useState, useEffect, useCallback } from 'react'
import { getOrders, getOrder, updateOrderStatus, getSettings } from '../api/client'
import { fmtDate, fmtMoney, statusBadgeClass, today } from '../utils'
import Modal from './Modal'
import { useToast } from './Toast'
import { buildEscPosTag, printBrowserTag, printBluetooth, printUSB } from '../utils/printUtils'
import { loadPrintSettings } from '../utils/printSettings'

const STATUS_FLOW = ['Received','Processing','Completed','Packing','Ready','Delivered','Cancelled']

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const [statusModal, setStatusModal] = useState(null)
  const [newStatus, setNewStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [shopName, setShopName] = useState('')
  const toast = useToast()

  useEffect(() => {
    getSettings().then(s => setShopName(s.shopName || '')).catch(() => {})
  }, [])

  const load = useCallback(() => {
    const params = {}
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    if (serviceFilter) params.service = serviceFilter
    getOrders(params).then(setOrders).finally(() => setLoading(false))
  }, [search, statusFilter, serviceFilter])

  useEffect(() => { load() }, [load])

  async function openDetail(id) {
    try {
      const o = await getOrder(id)
      setDetailOrder(o)
    } catch { toast('Failed to load order', 'danger') }
  }

  async function printTag(o) {
    const settings = { ...loadPrintSettings(), shopName }
    try {
      if (settings.defaultMode === 'bluetooth') {
        const data = await buildEscPosTag(o, fmtDate, settings)
        await printBluetooth(data)
      } else if (settings.defaultMode === 'usb') {
        const data = await buildEscPosTag(o, fmtDate, settings)
        await printUSB(data)
      } else {
        printBrowserTag(o, fmtDate, settings)
      }
    } catch (e) {
      toast('Print tag failed: ' + (e.message || 'Error'), 'danger')
    }
  }

  async function doUpdateStatus() {
    if (!newStatus) return
    try {
      await updateOrderStatus(statusModal.id, { status: newStatus, note: statusNote, updatedBy: 'Admin' })
      toast(`Status updated to ${newStatus}`)
      setStatusModal(null)
      setDetailOrder(null)
      load()
    } catch { toast('Failed to update status', 'danger') }
  }

  if (loading) return <div className="loading">Loading orders...</div>

  return (
    <>
      <div className="page-header">
        <div><h2>All Orders</h2><p>Complete list of all orders</p></div>
        <a href="/new-order" className="btn btn-primary">+ New Order</a>
      </div>
      <div className="search-bar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" type="text" placeholder="Search receipt no or customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {STATUS_FLOW.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
          <option value="">All Services</option>
          <option>Dry Clean</option><option>Rafu</option><option>Charak</option>
        </select>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Mobile</th><th>Items</th><th>Amount</th><th>Balance</th><th>Delivery</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ cursor: 'pointer' }}>
                  <td onClick={() => openDetail(o.id)}><strong style={{ color: 'var(--blue)' }}>{o.id}</strong></td>
                  <td>{fmtDate(o.entryDate)}</td>
                  <td onClick={() => openDetail(o.id)}>{o.custName}</td>
                  <td>{o.mobile}</td>
                  <td>{o.items?.length || '–'}</td>
                  <td>{fmtMoney(o.total)}</td>
                  <td style={{ color: o.balance > 0 ? 'var(--red)' : 'var(--green)' }}>{fmtMoney(o.balance)}</td>
                  <td style={{ color: o.deliveryDate < today() && o.status !== 'Delivered' ? 'var(--red)' : 'inherit' }}>{fmtDate(o.deliveryDate)}</td>
                  <td><span className={`badge ${statusBadgeClass(o.status)}`}>{o.status}</span></td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openDetail(o.id)}>View</button>
                    {o.status !== 'Delivered' && o.status !== 'Cancelled' &&
                      <button className="btn btn-primary btn-sm" onClick={() => { setStatusModal(o); setNewStatus('') }}>Update</button>}
                  </td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 30, color: 'var(--gray400)' }}>No orders found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!detailOrder} title={`Order — ${detailOrder?.id}`} onClose={() => setDetailOrder(null)}
        footer={<>
          <button className="btn btn-outline" onClick={() => detailOrder && printTag(detailOrder)}>Print Tag</button>
          {detailOrder?.status !== 'Delivered' && detailOrder?.status !== 'Cancelled' &&
            <button className="btn btn-primary" onClick={() => { setStatusModal(detailOrder); setDetailOrder(null); setNewStatus('') }}>Update Status</button>}
          <button className="btn btn-outline" onClick={() => setDetailOrder(null)}>Close</button>
        </>}>
        {detailOrder && (
          <div className="receipt">
            <div className="receipt-logo">
              <img src="/logo.jpg" alt="WashMitra" style={{ height: 40, objectFit: 'contain', display: 'block', margin: '0 auto 4px' }} />
              <h2>WashMitra</h2>
              <p>Order Receipt</p>
            </div>
            <hr className="receipt-divider" />
            <div className="receipt-row"><span>Receipt No</span><strong>{detailOrder.id}</strong></div>
            <div className="receipt-row"><span>Date</span><span>{fmtDate(detailOrder.entryDate)}</span></div>
            <div className="receipt-row"><span>Customer</span><span>{detailOrder.custName}</span></div>
            <div className="receipt-row"><span>Mobile</span><span>{detailOrder.mobile}</span></div>
            <div className="receipt-row"><span>Delivery Date</span><span>{fmtDate(detailOrder.deliveryDate)}</span></div>
            <div className="receipt-row"><span>Status</span><span className={`badge ${statusBadgeClass(detailOrder.status)}`}>{detailOrder.status}</span></div>
            <hr className="receipt-divider" />
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray400)', marginBottom: 6 }}>ITEMS</div>
            {(detailOrder.items || []).map((it, i) => (
              <div className="receipt-row" key={i}><span>{it.productName} ×{it.qty}</span><span>{fmtMoney(it.amount)}</span></div>
            ))}
            <hr className="receipt-divider" />
            <div className="receipt-row"><span>Total</span><strong>{fmtMoney(detailOrder.total)}</strong></div>
            <div className="receipt-row"><span>Advance</span><span>{fmtMoney(detailOrder.advance)}</span></div>
            <div className="receipt-total"><span>Balance Due</span><span>{fmtMoney(detailOrder.balance)}</span></div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--gray400)' }}>Payment: {detailOrder.payMode}</div>
            {detailOrder.history?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Status History</div>
                {detailOrder.history.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--gray100)', fontSize: 12 }}>
                    <span className={`badge ${statusBadgeClass(h.status)}`}>{h.status}</span>
                    <span style={{ color: 'var(--gray400)' }}>{new Date(h.updatedAt).toLocaleString('en-IN')}</span>
                    <span style={{ color: 'var(--gray600)' }}>{h.updatedBy}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Status Update Modal */}
      <Modal open={!!statusModal} title="Update Status" onClose={() => setStatusModal(null)}
        footer={<>
          <button className="btn btn-outline" onClick={() => setStatusModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={doUpdateStatus}>Update</button>
        </>}>
        {statusModal && (
          <>
            <div style={{ marginBottom: 14 }}>
              <span className={`badge ${statusBadgeClass(statusModal.status)}`}>{statusModal.status}</span>
              <span style={{ fontSize: 13, color: 'var(--gray400)', marginLeft: 8 }}>
                Current — <strong>{statusModal.id}</strong> · {statusModal.custName}
              </span>
            </div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Select New Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                <option value="">-- Select --</option>
                {STATUS_FLOW.filter(s => s !== statusModal.status).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Note (optional)</label>
              <textarea rows={2} placeholder="Add a note..." value={statusNote} onChange={e => setStatusNote(e.target.value)} />
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
