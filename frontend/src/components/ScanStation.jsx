import { useState, useEffect, useRef, useCallback } from 'react'
import { getOrder, getOrders, updateOrderStatus, getSettings } from '../api/client'
import { fmtDate, fmtMoney, statusBadgeClass } from '../utils'
import { useToast } from './Toast'
import { buildEscPosTag, printBrowserTag, printBluetooth, printUSB } from '../utils/printUtils'
import { loadPrintSettings } from '../utils/printSettings'

const STATUS_FLOW = ['Received', 'Processing', 'Completed', 'Packing', 'Ready', 'Delivered', 'Cancelled']
const TERMINAL = ['Delivered', 'Cancelled']

export default function ScanStation() {
  const [inputVal, setInputVal]     = useState('')
  const [order, setOrder]           = useState(null)
  const [loading, setLoading]       = useState(false)
  const [updating, setUpdating]     = useState(false)
  const [cameraOn, setCameraOn]     = useState(false)
  const [cameraErr, setCameraErr]   = useState('')
  const [scanFlash, setScanFlash]   = useState(false) // green flash on scan
  const [deliveryMode, setDeliveryMode] = useState(false)
  const [mobileResults, setMobileResults] = useState([])
  const [shopName, setShopName] = useState('')
  const [testModal, setTestModal] = useState(false)
  const [lastRaw, setLastRaw] = useState('')   // debug: last value received
  const toast = useToast()

  useEffect(() => {
    getSettings().then(s => setShopName(s.shopName || '')).catch(() => {})
  }, [])

  const inputRef    = useRef(null)
  const videoRef    = useRef(null)
  const streamRef   = useRef(null)
  const detectorRef = useRef(null)
  const rafRef      = useRef(null)
  const cooldownRef = useRef(false)   // debounce repeated scans of same barcode

  // Keep the text input focused for keyboard-wedge scanner
  useEffect(() => {
    if (!cameraOn) inputRef.current?.focus()
  }, [cameraOn, order])

  useEffect(() => {
    const refocus = (e) => {
      // Don't steal focus from buttons / other inputs
      if (!cameraOn && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        inputRef.current?.focus()
      }
    }
    document.addEventListener('click', refocus)
    return () => document.removeEventListener('click', refocus)
  }, [cameraOn])

  async function handleScan(raw) {
    // Strip ESC/POS code-set prefix {B/{A/{C if printer included it in barcode output
    const cleaned = raw.trim().replace(/^\{[A-Ca-c]/, '')
    if (!cleaned || cooldownRef.current) return
    setLastRaw(cleaned)
    cooldownRef.current = true
    setTimeout(() => { cooldownRef.current = false }, 1500)

    // Mobile number search: 10 digits
    if (/^\d{10}$/.test(cleaned)) {
      setLoading(true)
      setOrder(null)
      setMobileResults([])
      try {
        const results = await getOrders({ search: cleaned })
        if (results.length === 0) {
          toast(`No orders found for mobile ${cleaned}`, 'danger')
          if (navigator.vibrate) navigator.vibrate([80, 40, 80])
        } else if (results.length === 1) {
          await loadOrder(results[0].id)
        } else {
          setMobileResults(results)
        }
      } catch {
        toast('Search failed', 'danger')
      } finally {
        setLoading(false)
        setInputVal('')
        inputRef.current?.focus()
      }
      return
    }

    // Barcode format "DC10003-9876543210" — extract order ID before the first dash
    const full = cleaned.toUpperCase()
    const id = full.includes('-') ? full.split('-')[0] : full
    if (!id) return

    setLoading(true)
    setOrder(null)
    setMobileResults([])
    setScanFlash(false)
    await loadOrder(id)
  }

  async function loadOrder(id) {
    try {
      const o = await getOrder(id)
      setOrder(o)
      setScanFlash(true)
      setTimeout(() => setScanFlash(false), 600)
      if (navigator.vibrate) navigator.vibrate(80)

      // Delivery mode: only auto-deliver if status is Ready
      if (deliveryMode) {
        if (o.status === 'Ready') {
          await updateOrderStatus(o.id, { status: 'Delivered', note: 'Auto-delivered via scan', updatedBy: 'Scan' })
          setOrder(prev => prev ? { ...prev, status: 'Delivered' } : prev)
          toast(`${o.id} marked Delivered`)
        } else if (!['Delivered', 'Cancelled'].includes(o.status)) {
          toast(`Order not Ready yet — Status: ${o.status}`, 'danger')
        }
      }
    } catch {
      toast(`Order "${id}" not found`, 'danger')
      if (navigator.vibrate) navigator.vibrate([80, 40, 80])
    } finally {
      setLoading(false)
      setInputVal('')
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      handleScan(inputVal)
    }
  }

  // ── Camera scanning via BarcodeDetector API (Chrome 83+) ────────────────
  async function startCamera() {
    setCameraErr('')
    if (!('BarcodeDetector' in window)) {
      setCameraErr('BarcodeDetector API not supported. Use Chrome 83+ on Android or Desktop.')
      return
    }
    try {
      detectorRef.current = new window.BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code'],
      })
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      })
      streamRef.current = stream
      setCameraOn(true)
    } catch (e) {
      setCameraErr(e.message || 'Camera access denied')
    }
  }

  // Start scanning loop once video is ready
  useEffect(() => {
    if (!cameraOn || !videoRef.current || !streamRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current
    video.play()

    let active = true
    const loop = async () => {
      if (!active) return
      if (video.readyState >= 2) {
        try {
          const hits = await detectorRef.current.detect(video)
          if (hits.length > 0) {
            handleScan(hits[0].rawValue)
            await new Promise(r => setTimeout(r, 1500)) // pause after hit
          }
        } catch {}
      }
      if (active) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      active = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [cameraOn])

  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOn(false)
    setCameraErr('')
  }

  useEffect(() => () => stopCamera(), [])

  // ── Status update ────────────────────────────────────────────────────────
  async function doUpdate(newStatus) {
    if (!order || updating) return
    setUpdating(true)
    try {
      await updateOrderStatus(order.id, {
        status: newStatus,
        note: 'Updated via barcode scan',
        updatedBy: 'Scan',
      })
      toast(`${order.id} → ${newStatus}`)
      setOrder(o => ({ ...o, status: newStatus }))
    } catch {
      toast('Failed to update status', 'danger')
    } finally {
      setUpdating(false)
    }
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

  function showTestBarcode() {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Test Barcode</title>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
    <style>body{font-family:Arial;text-align:center;padding:30px;background:#fff}
    h2{margin-bottom:4px}p{color:#666;font-size:13px;margin:4px 0 20px}
    svg{display:block;margin:0 auto}</style></head>
    <body><h2>Scanner Test Barcode</h2>
    <p>Scan this with your scanner — if the order loads, it's working!</p>
    <svg id="bc"></svg>
    <p style="margin-top:16px;font-size:12px;color:#999">Value: DC10001</p>
    <script>JsBarcode('#bc','DC10001',{format:'CODE128',width:3,height:100,displayValue:true,fontSize:14,margin:20});<\/script>
    </body></html>`
    const w = window.open('', '_blank', 'width=500,height=380')
    if (w) { w.document.write(html); w.document.close() }
  }

  const nextStatuses = STATUS_FLOW.filter(s => order && s !== order.status)

  // ── Status button color map ───────────────────────────────────────────────
  const statusColor = {
    Received: 'var(--blue)', Processing: 'var(--amber)', Completed: 'var(--teal)',
    Packing: 'var(--purple)', Ready: 'var(--green)', Delivered: 'var(--green)',
    Cancelled: 'var(--red)',
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Scan Station</h2>
          <p>Scan order barcode to view and update status</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <div style={{
            width: 44, height: 24, borderRadius: 12, background: deliveryMode ? 'var(--green)' : 'var(--gray200)',
            position: 'relative', transition: 'background .2s', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 2, left: deliveryMode ? 22 : 2, width: 20, height: 20,
              borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
              transition: 'left .2s',
            }} />
            <input type="checkbox" checked={deliveryMode} onChange={e => setDeliveryMode(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: deliveryMode ? 'var(--green)' : 'var(--gray500)' }}>
            {deliveryMode ? 'Delivery Mode ON' : 'Delivery Mode OFF'}
          </span>
        </label>
      </div>

      {/* Scanner input */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <svg viewBox="0 0 24 24" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, stroke: 'var(--gray400)', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', pointerEvents: 'none' }}>
                <path d="M3 5h2M3 10h2M3 15h2M7 3v18M17 3v18M21 5h-2M21 10h-2M21 15h-2"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={onKeyDown}
                onPaste={e => { e.preventDefault(); const v = e.clipboardData.getData('text'); if (v) handleScan(v) }}
                placeholder="Scan barcode or type order ID and press Enter..."
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px 10px 36px',
                  border: `2px solid ${scanFlash ? 'var(--green)' : 'var(--gray200)'}`,
                  borderRadius: 8, fontSize: 15, outline: 'none',
                  background: scanFlash ? 'var(--green-lt)' : '#fff',
                  transition: 'border-color .15s, background .15s',
                }}
              />
            </div>
            <button className="btn btn-primary" onClick={() => handleScan(inputVal)} disabled={loading}>
              {loading ? '...' : 'Look up'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {!cameraOn
              ? <button className="btn btn-outline btn-sm" onClick={startCamera}>
                  <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Use Camera
                </button>
              : <button className="btn btn-danger btn-sm" onClick={stopCamera}>
                  <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Stop Camera
                </button>
            }
            {cameraErr && <span style={{ fontSize: 12, color: 'var(--red)' }}>{cameraErr}</span>}
            <button className="btn btn-outline btn-sm" onClick={showTestBarcode} title="Open a test barcode to verify your scanner">
              Test Scanner
            </button>
            <span style={{ fontSize: 12, color: 'var(--gray400)', marginLeft: 'auto' }}>
              {lastRaw
                ? <span>Last received: <strong style={{ color: 'var(--blue)' }}>{lastRaw}</strong></span>
                : 'Keyboard / BT scanner: just scan — input is always ready'}
            </span>
          </div>
        </div>
      </div>

      {/* Camera feed */}
      {cameraOn && (
        <div className="panel" style={{ marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ position: 'relative', background: '#000', maxHeight: 280 }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
            {/* Scan guide overlay */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: '60%', maxWidth: 280, height: 80, border: '2px solid rgba(255,255,255,.7)', borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }} />
            </div>
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 12, opacity: .8 }}>
              Hold barcode inside the box
            </div>
          </div>
        </div>
      )}

      {/* Mobile search results */}
      {mobileResults.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--gray100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{mobileResults.length} orders found — select one</span>
            <button className="btn btn-outline btn-sm" onClick={() => { setMobileResults([]); inputRef.current?.focus() }}>Clear</button>
          </div>
          {mobileResults.map(o => (
            <div key={o.id}
              onClick={() => { setMobileResults([]); setLoading(true); loadOrder(o.id) }}
              style={{ padding: '12px 20px', borderBottom: '1px solid var(--gray100)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
            >
              <div>
                <div style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 14 }}>{o.id}</div>
                <div style={{ fontSize: 12, color: 'var(--gray600)' }}>{o.custName} · {o.entryDate ? new Date(o.entryDate).toLocaleDateString('en-IN') : ''}</div>
              </div>
              <span className={`badge ${statusBadgeClass(o.status)}`}>{o.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Order card */}
      {loading && (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--gray400)' }}>
          Looking up order...
        </div>
      )}

      {order && !loading && (
        <div className="panel" style={{ border: `2px solid ${statusColor[order.status] || 'var(--gray200)'}` }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>{order.id}</div>
                <div style={{ fontSize: 13, color: 'var(--gray600)', marginTop: 2 }}>{order.custName} · {order.mobile}</div>
              </div>
            </div>
            <span className={`badge ${statusBadgeClass(order.status)}`} style={{ fontSize: 13, padding: '4px 12px' }}>{order.status}</span>
          </div>

          <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
            <div><div style={{ fontSize: 11, color: 'var(--gray400)' }}>Entry Date</div><div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(order.entryDate)}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--gray400)' }}>Delivery</div><div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(order.deliveryDate)}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--gray400)' }}>Total</div><div style={{ fontSize: 13, fontWeight: 600 }}>{fmtMoney(order.total)}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--gray400)' }}>Balance</div><div style={{ fontSize: 13, fontWeight: 600, color: order.balance > 0 ? 'var(--red)' : 'var(--green)' }}>{fmtMoney(order.balance)}</div></div>
          </div>

          {(order.items || []).length > 0 && (
            <div style={{ padding: '0 20px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--gray400)', marginBottom: 6 }}>ITEMS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {order.items.map((it, i) => (
                  <span key={i} style={{ background: 'var(--gray100)', borderRadius: 6, padding: '3px 10px', fontSize: 12 }}>
                    {it.productName} ×{it.qty} · {fmtMoney(it.amount)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!TERMINAL.includes(order.status) && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray100)' }}>
              <div style={{ fontSize: 12, color: 'var(--gray400)', marginBottom: 8, fontWeight: 600 }}>UPDATE STATUS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {nextStatuses.map(s => (
                  <button
                    key={s}
                    className="btn btn-sm"
                    style={{
                      background: s === 'Cancelled' ? 'var(--red-lt)' : s === 'Delivered' ? 'var(--green-lt)' : 'var(--blue-lt)',
                      color: s === 'Cancelled' ? 'var(--red)' : s === 'Delivered' ? 'var(--green)' : 'var(--blue)',
                      border: 'none', fontWeight: 700,
                    }}
                    onClick={() => doUpdate(s)}
                    disabled={updating}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {TERMINAL.includes(order.status) && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray100)', fontSize: 13, color: 'var(--gray400)' }}>
              This order is <strong>{order.status}</strong> — no further status update needed.
            </div>
          )}

          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--gray100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => printTag(order)}>
              Print Tag
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => { setOrder(null); inputRef.current?.focus() }}>
              Clear · Scan Next
            </button>
          </div>
        </div>
      )}
    </>
  )
}
