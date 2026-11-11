import { useState, useEffect } from 'react'
import { getOrders, getOrder, getSettings } from '../api/client'
import { fmtDate, fmtMoney, statusBadgeClass } from '../utils'
import Modal from './Modal'
import { buildEscPosReceipt, printBluetooth, printUSB } from '../utils/printUtils'
import { loadPrintSettings } from '../utils/printSettings'

export default function Billing() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)
  const [printModal, setPrintModal] = useState(false)
  const [printStatus, setPrintStatus] = useState('')   // '', 'printing', 'done', 'error'
  const [printError, setPrintError] = useState('')
  const [printCfg, setPrintCfg] = useState(loadPrintSettings)
  const [shopName, setShopName] = useState('')

  useEffect(() => {
    getOrders().then(setOrders).finally(() => setLoading(false))
    getSettings().then(s => setShopName(s.shopName || '')).catch(() => {})
  }, [])

  const filtered = orders.filter(o =>
    !search || o.id.toLowerCase().includes(search.toLowerCase()) || o.custName.toLowerCase().includes(search.toLowerCase())
  )

  async function openBill(id) {
    const o = await getOrder(id)
    setDetail(o)
  }

  function openPrintOptions() {
    setPrintCfg(loadPrintSettings())
    setPrintStatus('')
    setPrintError('')
    setPrintModal(true)
  }

  // Called by the main Print button — goes directly to the saved default mode
  async function handlePrint() {
    const cfg = { ...loadPrintSettings(), shopName }
    setPrintCfg(cfg)
    if (cfg.defaultMode === 'bluetooth') {
      setPrintModal(true)
      setPrintStatus('printing')
      setPrintError('')
      try {
        const data = await buildEscPosReceipt(detail, fmtDate, fmtMoney, cfg)
        await printBluetooth(data)
        setPrintStatus('done')
      } catch (e) {
        setPrintStatus('error')
        setPrintError(e.message || 'Bluetooth print failed')
      }
    } else if (cfg.defaultMode === 'usb') {
      setPrintModal(true)
      setPrintStatus('printing')
      setPrintError('')
      try {
        const data = await buildEscPosReceipt(detail, fmtDate, fmtMoney, cfg)
        await printUSB(data)
        setPrintStatus('done')
      } catch (e) {
        setPrintStatus('error')
        setPrintError(e.message || 'USB print failed')
      }
    } else {
      // normal — open print window directly, no modal needed
      printNormalWith(cfg)
    }
  }

  function printNormalWith(cfg) {
    if (!detail) return
    const { paperSize, showLogo, footerText, copies, barcode: showBarcode, shopName: sName } = cfg
    const displayName = sName || shopName || 'WashMitra'
    const pageW = paperSize === '58' ? '58mm' : '80mm'
    const logoHtml = showLogo ? `<div style="text-align:center"><img src="/logo.jpg" style="height:40px;object-fit:contain" /></div>` : ''
    const copyCount = Math.max(1, Math.min(3, Number(copies) || 1))
    const barcodeVal  = detail.mobile ? `${detail.id}-${detail.mobile}` : detail.id
    const barcodeHtml = showBarcode !== false
      ? `<div style="text-align:center;margin:8px 0"><svg class="barcode-${detail.id}"></svg></div>` : ''

    let bodyHtml = ''
    for (let c = 0; c < copyCount; c++) {
      bodyHtml += `
      <div class="copy" style="${c > 0 ? 'page-break-before:always' : ''}">
        ${logoHtml}
        <h2>${displayName}</h2>
        <p style="text-align:center;font-size:11px">Tax Invoice</p>
        <hr>
        <div class="row"><span>Invoice No:</span><strong>${detail.id}</strong></div>
        <div class="row"><span>Date:</span><span>${fmtDate(detail.entryDate)}</span></div>
        <div class="row"><span>Customer:</span><span>${detail.custName}</span></div>
        <div class="row"><span>Mobile:</span><span>${detail.mobile}</span></div>
        <div class="row"><span>Delivery:</span><span>${fmtDate(detail.deliveryDate)}</span></div>
        <hr>
        ${(detail.items || []).map(i => `<div class="row"><span>${i.productName} \xd7${i.qty}</span><span>₹${i.amount}</span></div>`).join('')}
        <hr>
        <div class="row"><span>Subtotal:</span><strong>₹${detail.total}</strong></div>
        <div class="row"><span>Advance Paid:</span><span>₹${detail.advance}</span></div>
        <div class="total"><span>Balance Due:</span><span>₹${detail.balance}</span></div>
        <p style="text-align:center;margin-top:10px;font-size:11px">Payment: ${detail.payMode}</p>
        ${barcodeHtml}
        <p style="text-align:center;font-size:10px">${footerText}</p>
      </div>`
    }

    const w = window.open('', '_blank')
    const barcodeInit = showBarcode !== false ? `
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
      <script>JsBarcode(".barcode-${detail.id}", "${barcodeVal}", {format:"CODE128",width:1.5,height:40,displayValue:true,fontSize:10,margin:4});<\/script>
    ` : ''
    w.document.write(`<html><head><title>Invoice ${detail.id}</title>
    <style>
      body{font-family:Arial;max-width:${pageW};margin:10px auto;font-size:12px}
      h2{text-align:center;font-size:16px}
      .row{display:flex;justify-content:space-between;padding:3px 0}
      .total{background:#000;color:#fff;padding:8px;display:flex;justify-content:space-between;font-weight:700}
      hr{border:none;border-top:1px dashed #ccc;margin:8px 0}
      @media print{@page{size:${pageW} auto;margin:4mm}}
    </style>
    </head><body>${bodyHtml}
    ${barcodeInit}
    <script>window.addEventListener('load',()=>{window.print();window.close();});<\/script></body></html>`)
    setPrintModal(false)
  }

  function printNormal() { printNormalWith({ ...printCfg, shopName }) }

  async function doPrintBluetooth() {
    setPrintStatus('printing')
    setPrintError('')
    try {
      const data = await buildEscPosReceipt(detail, fmtDate, fmtMoney, { ...printCfg, shopName })
      await printBluetooth(data)
      setPrintStatus('done')
    } catch (e) {
      setPrintStatus('error')
      setPrintError(e.message || 'Bluetooth print failed')
    }
  }

  async function doPrintUSB() {
    setPrintStatus('printing')
    setPrintError('')
    try {
      const data = await buildEscPosReceipt(detail, fmtDate, fmtMoney, { ...printCfg, shopName })
      await printUSB(data)
      setPrintStatus('done')
    } catch (e) {
      setPrintStatus('error')
      setPrintError(e.message || 'USB print failed')
    }
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
                  <td>{fmtDate(o.entryDate)}</td>
                  <td>{o.custName}</td>
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
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="btn btn-primary" style={{ borderRadius: '7px 0 0 7px' }} onClick={handlePrint}>
              <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
            <button className="btn btn-primary" style={{ borderRadius: '0 7px 7px 0', padding: '7px 9px', borderLeft: '1px solid rgba(255,255,255,.25)' }}
              title="More print options" onClick={openPrintOptions}>
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', fill: 'none', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
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
            <div className="receipt-row"><span>Date</span><span>{fmtDate(detail.entryDate)}</span></div>
            <div className="receipt-row"><span>Customer</span><span>{detail.custName}</span></div>
            <div className="receipt-row"><span>Mobile</span><span>{detail.mobile}</span></div>
            <div className="receipt-row"><span>Delivery Date</span><span>{fmtDate(detail.deliveryDate)}</span></div>
            <hr className="receipt-divider" />
            {(detail.items || []).map((it, i) => (
              <div className="receipt-row" key={i}><span>{it.productName} ×{it.qty}</span><span>{fmtMoney(it.amount)}</span></div>
            ))}
            <hr className="receipt-divider" />
            <div className="receipt-row"><span>Total</span><strong>{fmtMoney(detail.total)}</strong></div>
            <div className="receipt-row"><span>Advance Paid</span><span>{fmtMoney(detail.advance)}</span></div>
            <div className="receipt-total"><span>Balance Due</span><span>{fmtMoney(detail.balance)}</span></div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--gray400)' }}>Payment: {detail.payMode}</div>
          </div>
        )}
      </Modal>

      {/* Print Options Modal */}
      <Modal open={printModal} title="Print Options" onClose={() => setPrintModal(false)}
        footer={<>
          <a href="/settings" className="btn btn-outline" style={{ fontSize: 12 }}
            onClick={() => setPrintModal(false)}>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Print Settings
          </a>
          <button className="btn btn-outline" onClick={() => setPrintModal(false)}>Cancel</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Current settings summary */}
          <div style={{ padding: '8px 12px', background: 'var(--gray50)', borderRadius: 8, fontSize: 12, color: 'var(--gray600)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Paper: <strong>{printCfg.paperSize}mm</strong></span>
            <span>Copies: <strong>{printCfg.copies}</strong></span>
            <span>Logo: <strong>{printCfg.showLogo ? 'On' : 'Off'}</strong></span>
            <span style={{ marginLeft: 'auto', color: 'var(--blue)', fontWeight: 600 }}>
              Default: {printCfg.defaultMode === 'bluetooth' ? 'Bluetooth' : printCfg.defaultMode === 'usb' ? 'USB/OTG' : 'Normal'}
            </span>
          </div>

          {/* Normal Print */}
          <button className="btn btn-outline" style={{ justifyContent: 'flex-start', padding: '12px 16px', textAlign: 'left' }} onClick={printNormal}>
            <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, flexShrink: 0, stroke: 'var(--blue)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            <div>
              <div style={{ fontWeight: 700 }}>Normal Print</div>
              <div style={{ fontSize: 11, color: 'var(--gray400)', marginTop: 2 }}>Desktop / network printer via browser</div>
            </div>
          </button>

          {/* USB / OTG Print */}
          <button className="btn btn-outline" style={{ justifyContent: 'flex-start', padding: '12px 16px', textAlign: 'left' }}
            onClick={doPrintUSB} disabled={printStatus === 'printing'}>
            <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, flexShrink: 0, stroke: 'var(--teal)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M12 2v4"/><path d="M9 5h6"/>
            </svg>
            <div>
              <div style={{ fontWeight: 700 }}>USB / OTG Thermal Print</div>
              <div style={{ fontSize: 11, color: 'var(--gray400)', marginTop: 2 }}>USB thermal printer via OTG cable (Chrome required)</div>
            </div>
          </button>

          {/* Bluetooth Print */}
          <button className="btn btn-outline" style={{ justifyContent: 'flex-start', padding: '12px 16px', textAlign: 'left' }}
            onClick={doPrintBluetooth} disabled={printStatus === 'printing'}>
            <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, flexShrink: 0, stroke: 'var(--purple)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
            </svg>
            <div>
              <div style={{ fontWeight: 700 }}>Bluetooth Thermal Print</div>
              <div style={{ fontSize: 11, color: 'var(--gray400)', marginTop: 2 }}>BLE thermal printer (Chrome on Android / Desktop)</div>
            </div>
          </button>

          {/* Status feedback */}
          {printStatus === 'printing' && (
            <div style={{ padding: '10px 14px', background: 'var(--blue-lt)', borderRadius: 8, fontSize: 13, color: 'var(--blue)' }}>
              Sending to printer...
            </div>
          )}
          {printStatus === 'done' && (
            <div style={{ padding: '10px 14px', background: 'var(--green-lt)', borderRadius: 8, fontSize: 13, color: 'var(--green)' }}>
              Printed successfully!
            </div>
          )}
          {printStatus === 'error' && (
            <div style={{ padding: '10px 14px', background: 'var(--red-lt)', borderRadius: 8, fontSize: 13, color: 'var(--red)' }}>
              {printError}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
