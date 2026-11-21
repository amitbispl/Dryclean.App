import { useState, useEffect } from 'react'
import { getBillingReport } from '../api/client'
import { fmtDate, fmtMoney, today, statusBadgeClass } from '../utils'

function monthAgo() {
  return new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
}

function exportToExcel(rows, summary) {
  const headers = ['Order ID', 'Date', 'Delivery Date', 'Customer', 'Mobile', 'Type', 'Items', 'Total', 'Discount', 'Advance', 'Balance', 'Payment Mode', 'Status']
  const csv = [
    headers.join(','),
    ...rows.map(r => [
      r.id, r.entry_date, r.delivery_date, `"${r.cust_name}"`, r.mobile, r.customer_type,
      `"${r.items}"`, r.total, r.discount, r.advance, r.balance, r.pay_mode, r.status
    ].join(',')),
    '',
    `Total Orders,${summary.total_orders}`,
    `Total Amount,${summary.total_amount}`,
    `Total Discount,${summary.total_discount}`,
    `Total Advance,${summary.total_advance}`,
    `Total Balance,${summary.total_balance}`,
  ].join('\n')

  const BOM = '﻿'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `billing_report_${today()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function BillingReport() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(monthAgo())
  const [to, setTo] = useState(today())
  const [status, setStatus] = useState('')
  const [payMode, setPayMode] = useState('')

  const load = () => {
    setLoading(true)
    const params = { from_date: from, to_date: to }
    if (status) params.status = status
    if (payMode) params.pay_mode = payMode
    getBillingReport(params).then(setReport).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <>
      <div className="page-header">
        <div><h2>Billing Report</h2><p>Detailed order and payment report</p></div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ minWidth: 140 }}>
              <label>From Date</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ minWidth: 140 }}>
              <label>To Date</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="form-group" style={{ minWidth: 120 }}>
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All</option>
                <option>Received</option>
                <option>Processing</option>
                <option>Completed</option>
                <option>Packing</option>
                <option>Ready</option>
                <option>Delivered</option>
                <option>Cancelled</option>
              </select>
            </div>
            <div className="form-group" style={{ minWidth: 120 }}>
              <label>Payment</label>
              <select value={payMode} onChange={e => setPayMode(e.target.value)}>
                <option value="">All</option>
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Online</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={load}>Generate</button>
              <button className="btn btn-outline" onClick={() => report?.rows?.length && exportToExcel(report.rows, report)}
                disabled={!report?.rows?.length}>
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="loading">Loading report...</div> : report && (
        <>
          <div className="report-kpi">
            <div className="kpi-card">
              <div className="kpi-num" style={{ color: 'var(--blue)' }}>{report.total_orders}</div>
              <div className="kpi-lbl">Total Orders</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-num" style={{ color: 'var(--green)' }}>{fmtMoney(report.total_amount)}</div>
              <div className="kpi-lbl">Total Amount</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-num" style={{ color: 'var(--orange)' }}>{fmtMoney(report.total_discount)}</div>
              <div className="kpi-lbl">Total Discount</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-num" style={{ color: 'var(--teal)' }}>{fmtMoney(report.total_advance)}</div>
              <div className="kpi-lbl">Received</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-num" style={{ color: 'var(--red)' }}>{fmtMoney(report.total_balance)}</div>
              <div className="kpi-lbl">Balance Due</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Order Details</div>
              <div style={{ fontSize: 12, color: 'var(--gray400)' }}>{report.rows.length} orders</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th><th>Date</th><th>Customer</th><th>Mobile</th><th>Items</th>
                    <th>Total</th><th>Discount</th><th>Advance</th><th>Balance</th><th>Payment</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map(r => (
                    <tr key={r.id}>
                      <td><strong style={{ color: 'var(--blue)' }}>{r.id}</strong></td>
                      <td>{fmtDate(r.entry_date)}</td>
                      <td>{r.cust_name}</td>
                      <td>{r.mobile}</td>
                      <td style={{ fontSize: 12, maxWidth: 180 }}>{r.items}</td>
                      <td style={{ fontWeight: 700 }}>{fmtMoney(r.total)}</td>
                      <td style={{ color: 'var(--orange)' }}>{r.discount > 0 ? fmtMoney(r.discount) : '-'}</td>
                      <td style={{ color: 'var(--teal)' }}>{fmtMoney(r.advance)}</td>
                      <td style={{ color: r.balance > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{fmtMoney(r.balance)}</td>
                      <td>{r.pay_mode}</td>
                      <td><span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span></td>
                    </tr>
                  ))}
                  {!report.rows.length && <tr><td colSpan={11} style={{ textAlign: 'center', padding: 20, color: 'var(--gray400)' }}>No records</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
