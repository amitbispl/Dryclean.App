import { useState, useEffect } from 'react'
import { getSalesReport } from '../api/client'
import { fmtDate, fmtMoney, today } from '../utils'

function monthAgo() {
  return new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
}

export default function Reports() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(monthAgo())
  const [to, setTo] = useState(today())

  const load = () => {
    setLoading(true)
    getSalesReport({ from_date: from, to_date: to }).then(setReport).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const catColors = { 'Dry Clean': 'var(--blue)', Rafu: 'var(--teal)', Charak: 'var(--purple)' }

  return (
    <>
      <div className="page-header">
        <div><h2>Sales Report</h2><p>Revenue and service breakdown</p></div>
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
            <button className="btn btn-primary" onClick={load}>Generate Report</button>
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
              <div className="kpi-lbl">Total Revenue</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-num" style={{ color: 'var(--red)' }}>{fmtMoney(report.total_balance)}</div>
              <div className="kpi-lbl">Outstanding Balance</div>
            </div>
          </div>

          <div className="two-col">
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Daily Sales</div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Orders</th><th>Revenue</th><th>Advance</th><th>Balance</th></tr></thead>
                  <tbody>
                    {report.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{fmtDate(r.date)}</td>
                        <td>{r.orders}</td>
                        <td style={{ fontWeight: 600 }}>{fmtMoney(r.amount)}</td>
                        <td>{fmtMoney(r.advance)}</td>
                        <td style={{ color: r.balance > 0 ? 'var(--red)' : 'var(--green)' }}>{fmtMoney(r.balance)}</td>
                      </tr>
                    ))}
                    {!report.rows.length && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--gray400)' }}>No data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><div className="panel-title">Service Breakdown</div></div>
              <div className="panel-body">
                {report.service_rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray100)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{r.category}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray400)' }}>{r.items} items</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: catColors[r.category] || 'var(--blue)' }}>{fmtMoney(r.revenue)}</div>
                    </div>
                  </div>
                ))}
                {!report.service_rows.length && <div style={{ textAlign: 'center', padding: 20, color: 'var(--gray400)' }}>No data</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
