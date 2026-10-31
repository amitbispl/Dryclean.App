import { useState, useEffect } from 'react'
import { getOrders, getOrder } from '../api/client'
import { fmtDate, fmtMoney, statusBadgeClass } from '../utils'
import Modal from './Modal'

export default function Billing() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    getOrders().then(setOrders).finally(() => setLoading(false))
  }, [])

  const filtered = orders.filter(o =>
    !search || o.id.toLowerCase().includes(search.toLowerCase()) || o.cust_name.toLowerCase().includes(search.toLowerCase())
  )

  async function openBill(id) {
    const o = await getOrder(id)
    setDetail(o)
  }

  function printBill() {
    if (!detail) return
    const w = window.open('', '_blank')
    w.document.write(`<html><head><title>Invoice ${detail.id}</title>
    <style>body{font-family:Arial;max-width:320px;margin:20px auto;font-size:12px}
    h2{text-align:center;font-size:16px}.row{display:flex;justify-content:space-between;padding:3px 0}
    .total{background:#000;color:#fff;padding:8px;display:flex;justify-content:space-between;font-weight:700}
    hr{border:none;border-top:1px dashed #ccc;margin:8px 0}
    .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px}</style>
    </head><body>
    <div style="text-align:center"><img src="/logo.jpg" style="height:40px;object-fit:contain" /></div>
    <h2>WashMitra</h2>
    <p style="text-align:center;font-size:11px">Tax Invoice</p>
    <hr>
    <div class="row"><span>Invoice No:</span><strong>${detail.id}</strong></div>
    <div class="row"><span>Date:</span><span>${fmtDate(detail.entry_date)}</span></div>
    <div class="row"><span>Customer:</span><span>${detail.cust_name}</span></div>
    <div class="row"><span>Mobile:</span><span>${detail.mobile}</span></div>
    <div class="row"><span>Delivery:</span><span>${fmtDate(detail.delivery_date)}</span></div>
    <hr>
    ${(detail.items || []).map(i => `<div class="row"><span>${i.product_name} ×${i.qty}</span><span>₹${i.amount}</span></div>`).join('')}
    <hr>
    <div class="row"><span>Subtotal:</span><strong>₹${detail.total}</strong></div>
    <div class="row"><span>Advance Paid:</span><span>₹${detail.advance}</span></div>
    <div class="total"><span>Balance Due:</span><span>₹${detail.balance}</span></div>
    <p style="text-align:center;margin-top:14px;font-size:11px">Payment Mode: ${detail.pay_mode}</p>
    <p style="text-align:center;font-size:10px">Thank you! 🙏</p>
    <script>window.print();window.close();<\/script></body></html>`)
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div><h2>Billing</h2><p>View and print invoices</p></div>
      </div>
      <div className="search-bar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" placeholder="Search by receipt or customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Total</th><th>Advance</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td><strong style={{ color: 'var(--blue)' }}>{o.id}</strong></td>
                  <td>{fmtDate(o.entry_date)}</td>
                  <td>{o.cust_name}</td>
                  <td style={{ fontWeight: 700 }}>{fmtMoney(o.total)}</td>
                  <td>{fmtMoney(o.advance)}</td>
                  <td style={{ color: o.balance > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{fmtMoney(o.balance)}</td>
                  <td><span className={`badge ${statusBadgeClass(o.status)}`}>{o.status}</span></td>
                  <td><button className="btn btn-outline btn-sm" onClick={() => openBill(o.id)}>🖨 Invoice</button></td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--gray400)' }}>No records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!detail} title={`Invoice — ${detail?.id}`} onClose={() => setDetail(null)}
        footer={<>
          <button className="btn btn-primary" onClick={printBill}>🖨️ Print Invoice</button>
          <button className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
        </>}>
        {detail && (
          <div className="receipt">
            <div className="receipt-logo">
              <img src="/logo.jpg" alt="WashMitra" style={{ height: 40, objectFit: 'contain', display: 'block', margin: '0 auto 4px' }} />
              <h2>WashMitra</h2>
              <p>Tax Invoice</p>
            </div>
            <hr className="receipt-divider" />
            <div className="receipt-row"><span>Invoice No</span><strong>{detail.id}</strong></div>
            <div className="receipt-row"><span>Date</span><span>{fmtDate(detail.entry_date)}</span></div>
            <div className="receipt-row"><span>Customer</span><span>{detail.cust_name}</span></div>
            <div className="receipt-row"><span>Mobile</span><span>{detail.mobile}</span></div>
            <div className="receipt-row"><span>Delivery Date</span><span>{fmtDate(detail.delivery_date)}</span></div>
            <hr className="receipt-divider" />
            {(detail.items || []).map((it, i) => (
              <div className="receipt-row" key={i}><span>{it.product_name} ×{it.qty}</span><span>{fmtMoney(it.amount)}</span></div>
            ))}
            <hr className="receipt-divider" />
            <div className="receipt-row"><span>Total</span><strong>{fmtMoney(detail.total)}</strong></div>
            <div className="receipt-row"><span>Advance Paid</span><span>{fmtMoney(detail.advance)}</span></div>
            <div className="receipt-total"><span>Balance Due</span><span>{fmtMoney(detail.balance)}</span></div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--gray400)' }}>Payment: {detail.pay_mode}</div>
          </div>
        )}
      </Modal>
    </>
  )
}
