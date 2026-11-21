import { useState, useEffect } from 'react'
import { getScanReport } from '../api/client'
import { fmtMoney, today } from '../utils'

function monthAgo() {
  return new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
}

function fmtDateTime(d) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function exportToExcel(rows) {
  const headers = ['Order ID', 'Customer', 'Mobile', 'Status', 'Updated By', 'Updated At', 'Note']
  const csv = [
    headers.join(','),
    ...rows.map(r => [
      r.order_id, `"${r.cust_name}"`, r.mobile, r.status,
      r.updated_by, fmtDateTime(r.updated_at), `"${r.note || ''}"`
    ].join(','))
  ].join('\n')

  const BOM = '﻿'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `scan_report_${today()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const statusColor = {
  Received: 'var(--blue)', Processing: 'var(--orange)', Completed: 'var(--teal)',
  Packing: 'var(--purple)', Ready: 'var(--green)', Delivered: 'var(--green)', Cancelled: 'var(--red)',
}

export default function ScanReport() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(monthAgo())
  const [to, setTo] = useState(today())
  const [filterStatus, setFilterStatus] = useState('')

  const load = () => {
    setLoading(true)
    getScanReport({ from_date: from, to_date: to }).then(setReport).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = report?.rows?.filter(r => !filterStatus || r.status === filterStatus) || []

  return (
    <>
      <div className="page-header">
        <div><h2>Scan Report</h2><p>All order status changes and scan history</p></div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body">
          <div className="form-row-3" style={{ alignItems: 'flex-end' }}>
            <div className="form-group">
              <label>From Date</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>To Date</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={load}>Generate</button>
              <button className="btn btn-outline" onClick={() => filtered.length && exportToExcel(filtered)}
                disabled={!filtered.length}>
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
            <div className="kpi-card" onClick={() => setFilterStatus('')} style={{ cursor: 'pointer', outline: !filterStatus ? '2px solid var(--blue)' : 'none' }}>
              <div className="kpi-num" style={{ color: 'var(--blue)' }}>{report.total}</div>
              <div className="kpi-lbl">Total Scans</div>
            </div>
            {report.summary.map(s => (
              <div className="kpi-card" key={s.status} onClick={() => setFilterStatus(s.status === filterStatus ? '' : s.status)}
                style={{ cursor: 'pointer', outline: filterStatus === s.status ? `2px solid ${statusColor[s.status] || 'var(--blue)'}` : 'none' }}>
                <div className="kpi-num" style={{ color: statusColor[s.status] || 'var(--blue)' }}>{s.count}</div>
                <div className="kpi-lbl">{s.status}</div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                Scan History {filterStatus && <span style={{ fontSize: 12, color: 'var(--gray400)' }}> — {filterStatus}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray400)' }}>{filtered.length} records</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Order ID</th><th>Customer</th><th>Mobile</th><th>Status</th><th>Updated By</th><th>Date/Time</th><th>Note</th></tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td><strong style={{ color: 'var(--blue)' }}>{r.order_id}</strong></td>
                      <td>{r.cust_name}</td>
                      <td>{r.mobile}</td>
                      <td><span style={{ color: statusColor[r.status] || 'var(--gray600)', fontWeight: 600 }}>{r.status}</span></td>
                      <td>{r.updated_by}</td>
                      <td style={{ fontSize: 12 }}>{fmtDateTime(r.updated_at)}</td>
                      <td style={{ fontSize: 12, color: 'var(--gray400)' }}>{r.note}</td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--gray400)' }}>No scan records</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
