// ESC/POS thermal printer utilities

const ESC = 0x1B
const GS  = 0x1D
const LF  = 0x0A

// Strip characters the printer ROM can't render.
// ₹ (U+20B9) encodes as 3 UTF-8 bytes the printer shows as garbage — replace with Rs.
// Any other non-ASCII becomes '?'
function sanitize(text) {
  return String(text || '')
    .replace(/₹/g, 'Rs.')
    .replace(/[^\x00-\x7F]/g, '?')
}

function makeHelpers(width) {
  // Two-column: label left, value right-aligned.
  // If value is too long to share a line with the label, prints label then
  // value indented on the next line so nothing ever wraps mid-word.
  const twoCol = (left, right) => {
    const l = sanitize(left)
    const r = sanitize(right)
    if (l.length + 1 + r.length <= width) {
      return l.padEnd(width - r.length, ' ') + r
    }
    // Value too long — put it on its own next line, right-aligned
    return l + '\n' + r.padStart(width, ' ')
  }
  const centerText = (text) => {
    const t = sanitize(text).slice(0, width)
    const pad = Math.floor((width - t.length) / 2)
    return ' '.repeat(pad) + t
  }
  const divider = (char = '-') => char.repeat(width)
  // Fixed 2-column with explicit label width (safe for long values)
  const fixedCol = (label, value, labelW = 12) => {
    const l = sanitize(label).padEnd(labelW, ' ').slice(0, labelW)
    const v = sanitize(value).slice(0, width - labelW)
    return l + v
  }
  return { twoCol, centerText, divider, fixedCol }
}

// Encode a plain ASCII string to bytes (safe for thermal ROM)
function encode(text) {
  const bytes = []
  for (let i = 0; i < text.length; i++) {
    bytes.push(text.charCodeAt(i) & 0xFF)
  }
  bytes.push(LF)
  return bytes
}

// Render barcode via JsBarcode on a canvas then encode as ESC/POS raster image.
// This bypasses the printer's native GS k barcode command entirely — many cheap
// BT thermal printers generate visually plausible but unreadable barcodes with GS k.
// GS v 0 (raster image) works on every thermal printer that can print images.
async function generateBarcodeBytes(orderId, mobile, paperSize) {
  if (typeof window === 'undefined') return []
  // Always encode order ID only — including mobile makes the value 18+ chars which
  // overflows 58mm paper and produces a clipped/unreadable barcode.
  const value = sanitize(orderId)

  // Load JsBarcode once
  if (!window.JsBarcode) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
      s.onload = resolve
      s.onerror = () => reject(new Error('JsBarcode load failed'))
      document.head.appendChild(s)
    })
  }

  // Module width 3 for both paper sizes — wider bars tolerate thermal print smear.
  // Order ID only (~7 chars) → ~114 CODE128 modules × 3 = 342px → fits 58mm (384 dots).
  // NO scaling after render — scaling anti-aliases bar edges → scanner can't read.
  const tmp = document.createElement('canvas')
  try {
    window.JsBarcode(tmp, value, {
      format: 'CODE128',
      width: 3,
      height: 70,
      displayValue: true,
      fontSize: 13,
      margin: 12,
      background: '#ffffff',
      lineColor: '#000000',
    })
  } catch (e) {
    console.error('Barcode render error:', e)
    return []
  }

  const srcW = tmp.width
  const srcH = tmp.height
  // widthBytes rounded up to nearest byte; trailing bits in last byte will be white (0)
  const widthBytes = Math.ceil(srcW / 8)

  const imgData = tmp.getContext('2d').getImageData(0, 0, srcW, srcH)

  const bytes = []
  bytes.push(ESC, 0x61, 0x01)                             // center align
  bytes.push(GS, 0x76, 0x30, 0x00)                        // GS v 0 — raster image
  bytes.push(widthBytes & 0xFF, (widthBytes >> 8) & 0xFF)  // xL xH (bytes per row)
  bytes.push(srcH & 0xFF, (srcH >> 8) & 0xFF)              // yL yH (dot rows)

  for (let y = 0; y < srcH; y++) {
    for (let bx = 0; bx < widthBytes; bx++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const x = bx * 8 + bit
        if (x < srcW) {
          const i = (y * srcW + x) * 4
          // solid black only — threshold 64 avoids capturing anti-aliased gray edges
          if (imgData.data[i] < 64) {
            byte |= (0x80 >> bit)
          }
        }
      }
      bytes.push(byte)
    }
  }

  bytes.push(LF)
  bytes.push(ESC, 0x61, 0x00)  // back to left
  return bytes
}

// Build ESC/POS byte array for the receipt
// settings: { paperSize: '58'|'80', copies: '1'|'2'|'3', footerText: string, barcode: bool }
export async function buildEscPosReceipt(detail, fmtDate, fmtMoney, settings = {}) {
  const paperSize = settings.paperSize || '80'
  const WIDTH = paperSize === '58' ? 30 : 42
  const footerText = sanitize(settings.footerText || 'Thank you! Visit again!')
  const printBarcode = settings.barcode !== false   // on by default
  const copies = Math.max(1, Math.min(3, Number(settings.copies) || 1))
  const shopName = sanitize(settings.shopName || 'WashMitra')

  const { twoCol, centerText, divider, fixedCol } = makeHelpers(WIDTH)
  const all = []

  for (let c = 0; c < copies; c++) {
    const lines = []
    const addLine = (text) => encode(sanitize(text)).forEach(b => lines.push(b))

    lines.push(ESC, 0x40)              // Init printer
    lines.push(ESC, 0x61, 0x01)        // Center align
    lines.push(ESC, 0x45, 0x01)        // Bold ON
    addLine(shopName)
    lines.push(ESC, 0x45, 0x00)        // Bold OFF
    addLine('Tax Invoice')
    addLine(divider('='))

    lines.push(ESC, 0x61, 0x00)        // Left align
    // Use fixedCol for the header block so long names never wrap mid-word
    addLine(fixedCol('Invoice No:', detail.id))
    addLine(fixedCol('Date:', fmtDate(detail.entryDate)))
    addLine(fixedCol('Customer:', detail.custName))
    addLine(fixedCol('Mobile:', detail.mobile))
    addLine(fixedCol('Delivery:', fmtDate(detail.deliveryDate)))
    addLine(divider())

    ;(detail.items || []).forEach(it => {
      // Item lines: "Product x2        Rs.800"
      const label = sanitize(`${it.productName} x${it.qty}`)
      const amt   = sanitize(fmtMoney(it.amount))
      addLine(twoCol(label, amt))
    })

    addLine(divider())
    lines.push(ESC, 0x45, 0x01)
    addLine(twoCol('Booking Amt:', sanitize(fmtMoney(detail.total))))
    lines.push(ESC, 0x45, 0x00)
    if (detail.discount > 0) addLine(twoCol('Discount:', '-' + sanitize(fmtMoney(detail.discount))))
    addLine(twoCol('Received:', sanitize(fmtMoney(detail.advance))))
    addLine(divider('='))
    lines.push(ESC, 0x45, 0x01)
    addLine(twoCol('Balance Due:', sanitize(fmtMoney(detail.balance))))
    lines.push(ESC, 0x45, 0x00)
    addLine(divider('='))
    addLine('Payment: ' + sanitize(detail.payMode || ''))
    lines.push(LF)

    // Barcode — rendered as bitmap image (bypasses printer's GS k engine)
    if (printBarcode && detail.id) {
      const bcBytes = await generateBarcodeBytes(detail.id, detail.mobile, paperSize)
      bcBytes.forEach(b => lines.push(b))
      lines.push(LF)
    }

    lines.push(ESC, 0x61, 0x01)        // Center
    addLine(footerText)
    lines.push(LF, LF, LF)
    lines.push(GS, 0x56, 0x01)        // Partial cut

    lines.forEach(b => all.push(b))
  }

  return new Uint8Array(all)
}

// ── CPCL Receipt (for label printers in LABEL/CPCL mode e.g. DCode DC MP30) ──
// Uses only universally-supported CPCL commands: TEXT, LINE, BARCODE, PRINT
// No CENTER/RIGHT/SETBOLD (not supported on many budget printers)
export function buildCpclReceipt(detail, fmtDate, fmtMoney, settings = {}) {
  const shopName = sanitize(settings.shopName || 'WashMitra')
  const footerText = sanitize(settings.footerText || 'Thank you! Visit again!')

  const lines = []
  let y = 10

  const t = (font, x, text) => { lines.push(`TEXT ${font} 0 ${x} ${y} ${sanitize(text)}`); y += font >= 3 ? 36 : 28 }
  const sep = () => { lines.push(`LINE 0 ${y} 380 ${y} 2`); y += 10 }
  const row = (label, value) => {
    lines.push(`TEXT 2 0 0 ${y} ${sanitize(label)}`)
    lines.push(`TEXT 2 0 220 ${y} ${sanitize(String(value))}`)
    y += 28
  }

  t(3, 0, shopName)
  t(2, 0, 'Tax Invoice')
  sep()
  row('Invoice:', detail.id)
  row('Date:', fmtDate(detail.entryDate))
  row('Customer:', detail.custName || '')
  if (detail.mobile) row('Mobile:', detail.mobile)
  row('Delivery:', fmtDate(detail.deliveryDate))
  sep()
  ;(detail.items || []).forEach(it => row(`${sanitize(it.productName)} x${it.qty}`, fmtMoney(it.amount)))
  sep()
  row('Total:', fmtMoney(detail.total))
  if (detail.discount > 0) row('Discount:', '-' + fmtMoney(detail.discount))
  row('Received:', fmtMoney(detail.advance))
  sep()
  t(3, 0, `Balance: ${fmtMoney(detail.balance)}`)
  if (detail.payMode) t(2, 0, 'Payment: ' + sanitize(detail.payMode))
  sep()
  t(2, 0, footerText)
  y += 10

  const header = `! 0 200 200 ${y} 1`
  return new TextEncoder().encode([header, ...lines, 'PRINT'].join('\r\n') + '\r\n')
}

// CPCL Tag — compact layout for 2"×1" labels (200 dots tall at 200 DPI)
// Layout: shop(small) | order-id(large) | cust+delivery(small) | barcode(small)
export function buildCpclTag(detail, fmtDate, settings = {}) {
  const shopName = sanitize(settings.shopName || 'WashMitra')

  const lines = []
  let y = 2

  // font 2 ≈ 20px, font 3 ≈ 28px at 200 DPI
  const t = (font, x, text) => { lines.push(`TEXT ${font} 0 ${x} ${y} ${sanitize(text)}`); y += font === 3 ? 32 : font === 2 ? 24 : 20 }

  t(1, 0, shopName)                                               // ~20 dots → y=22
  t(3, 0, detail.id || '')                                        // ~32 dots → y=54
  t(2, 0, sanitize(detail.custName || ''))                        // ~24 dots → y=78
  // mobile + delivery on one line to save height
  const info = [detail.mobile, fmtDate(detail.deliveryDate)].filter(Boolean).join('  ')
  t(1, 0, info)                                                   // ~20 dots → y=98
  lines.push(`BARCODE 128 1 1 50 0 ${y} ${sanitize(detail.id || '')}`)
  y += 60                                                         // → y=158, fits in 200

  const header = `! 0 200 200 ${y} 1`
  return new TextEncoder().encode([header, ...lines, 'PRINT'].join('\r\n') + '\r\n')
}

// Auto-select ESC/POS or CPCL based on settings.printerLanguage
export async function buildReceiptData(detail, fmtDate, fmtMoney, settings = {}) {
  if (settings.printerLanguage === 'cpcl') return buildCpclReceipt(detail, fmtDate, fmtMoney, settings)
  return buildEscPosReceipt(detail, fmtDate, fmtMoney, settings)
}

export async function buildTagData(detail, fmtDate, settings = {}) {
  if (settings.printerLanguage === 'cpcl') return buildCpclTag(detail, fmtDate, settings)
  return buildEscPosTag(detail, fmtDate, settings)
}

// --- Bluetooth Thermal Print ---
// Known service/characteristic pairs for common thermal printers
const BLE_SERVICES = [
  // DCode MP30 / generic Chinese BT thermal (0xff00 family)
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', char: '0000ff02-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', char: '0000ff01-0000-1000-8000-00805f9b34fb' },
  // Generic / GZM8006 / BT-8006 family
  { service: '000018f0-0000-1000-8000-00805f9b34fb', char: '00002af1-0000-1000-8000-00805f9b34fb' },
  // XPrinter
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', char: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
  // Rongta / HPRT
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', char: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
]

let _ble = null
let _printing = false

export function forgetBluetoothPrinter() {
  if (_ble) { try { _ble.device.gatt.disconnect() } catch {} }
  _ble = null
  _printing = false
}

export async function printBluetooth(data) {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth not supported. Use Chrome.')
  if (_printing) throw new Error('Print already in progress — please wait.')
  _printing = true
  try {
    await _doPrint(data)
  } finally {
    _printing = false
  }
}

async function _doPrint(data) {
  const optionalServices = BLE_SERVICES.map(s => s.service)

  // Try cached connection first
  if (_ble && _ble.device.gatt.connected) {
    try { await sendBleData(_ble.characteristic, data); return }
    catch { _ble = null }  // stale — fall through to reconnect
  }

  const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices })
  const server = await device.gatt.connect()
  // Small settle time after connect
  await new Promise(r => setTimeout(r, 300))

  let characteristic = null

  // 1. Try known service/char pairs
  for (const { service: svcUuid, char: charUuid } of BLE_SERVICES) {
    try {
      const svc = await server.getPrimaryService(svcUuid)
      const c = await svc.getCharacteristic(charUuid)
      if (c.properties.write || c.properties.writeWithoutResponse) {
        characteristic = c; break
      }
    } catch { /* try next */ }
  }

  // 2. Fallback: scan ALL services for any writable characteristic
  if (!characteristic) {
    try {
      const services = await server.getPrimaryServices()
      outer: for (const svc of services) {
        const chars = await svc.getCharacteristics()
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            characteristic = c; break outer
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (!characteristic) {
    device.gatt.disconnect()
    throw new Error('No writable characteristic found. Try USB mode instead.')
  }

  _ble = { device, characteristic }
  device.addEventListener('gattserverdisconnected', () => { _ble = null })

  await sendBleData(characteristic, data)
}

async function sendBleData(characteristic, data) {
  const useNoResp = characteristic.properties.writeWithoutResponse
  // BLE default MTU = 23 bytes; usable payload = 20. Use 20 to be safe on all printers.
  const CHUNK = 20
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK)
    if (useNoResp) {
      await characteristic.writeValueWithoutResponse(chunk)
      await new Promise(r => setTimeout(r, 50))
    } else {
      await characteristic.writeValue(chunk)
      await new Promise(r => setTimeout(r, 50))
    }
  }
}

// --- USB / OTG Thermal Print ---
// Works with WebUSB-compatible thermal printers
const USB_FILTERS = [
  { vendorId: 0x0FE6 }, // XPrinter
  { vendorId: 0x04B8 }, // Epson
  { vendorId: 0x0519 }, // Star Micronics
  { vendorId: 0x1504 }, // Bixolon
  { vendorId: 0x1FC9 }, // Rongta
  { vendorId: 0x0DD4 }, // Custom
  { vendorId: 0x20D1 }, // HPRT
  { vendorId: 0x6868 }, // Generic USB thermal
]

export async function printUSB(data) {
  if (!navigator.usb) {
    throw new Error('WebUSB is not supported in this browser. Use Chrome on Android/Desktop (requires HTTPS).')
  }

  const device = await navigator.usb.requestDevice({ filters: USB_FILTERS })

  await device.open()

  if (device.configuration === null) {
    await device.selectConfiguration(1)
  }

  // Find the first bulk-out endpoint
  let endpointNumber = null
  let interfaceNumber = null

  for (const iface of device.configuration.interfaces) {
    for (const alt of iface.alternates) {
      for (const ep of alt.endpoints) {
        if (ep.direction === 'out' && ep.type === 'bulk') {
          endpointNumber = ep.endpointNumber
          interfaceNumber = iface.interfaceNumber
          break
        }
      }
      if (endpointNumber !== null) break
    }
    if (endpointNumber !== null) break
  }

  if (endpointNumber === null) {
    await device.close()
    throw new Error('Could not find a bulk-out endpoint. The printer may not be compatible.')
  }

  try {
    await device.claimInterface(interfaceNumber)
  } catch {
    // already claimed or driver attached — try anyway
  }

  // Send in chunks
  const CHUNK = 64
  for (let i = 0; i < data.length; i += CHUNK) {
    await device.transferOut(endpointNumber, data.slice(i, i + CHUNK))
  }

  await device.releaseInterface(interfaceNumber)
  await device.close()
}

// --- Packing Tag (compact label to attach to clothes bag) ---

export async function buildEscPosTag(detail, fmtDate, settings = {}) {
  const paperSize = settings.paperSize || '80'
  const WIDTH = paperSize === '58' ? 30 : 42
  const shopName = sanitize(settings.shopName || 'WashMitra')
  const { centerText, divider, fixedCol } = makeHelpers(WIDTH)
  const lines = []
  const addLine = (text) => encode(sanitize(text)).forEach(b => lines.push(b))

  lines.push(ESC, 0x40)              // Init
  lines.push(ESC, 0x61, 0x01)        // Center
  lines.push(ESC, 0x45, 0x01)        // Bold ON
  addLine(`${shopName} — PACKING TAG`)
  lines.push(ESC, 0x45, 0x00)        // Bold OFF
  addLine(divider('='))

  lines.push(ESC, 0x61, 0x00)        // Left
  // Large order ID
  lines.push(ESC, 0x21, 0x30)        // Double width+height
  addLine(centerText(detail.id || ''))
  lines.push(ESC, 0x21, 0x00)        // Normal

  addLine(fixedCol('Customer:', detail.custName))
  addLine(fixedCol('Mobile:', detail.mobile))
  addLine(fixedCol('Delivery:', fmtDate(detail.deliveryDate)))

  if ((detail.items || []).length > 0) {
    addLine(divider())
    detail.items.forEach(it => {
      addLine(sanitize(`${it.productName} x${it.qty}`))
    })
  }

  addLine(divider('='))

  // Barcode — rendered as bitmap image
  if (detail.id) {
    const bcBytes = await generateBarcodeBytes(detail.id, detail.mobile, paperSize)
    bcBytes.forEach(b => lines.push(b))
    lines.push(LF)
  }

  lines.push(LF, LF)
  lines.push(GS, 0x56, 0x01)        // Partial cut

  return new Uint8Array(lines)
}

// --- Local Print Service (silent, no dialog) ---
// Sends raw bytes to a local Node.js service running on the user's PC (port 9100).
// The service uses Windows P/Invoke to print directly — no browser dialog at all.
export async function printViaService(data, printerName, serviceUrl = 'http://127.0.0.1:9100') {
  if (!printerName) throw new Error('No printer name set. Configure it in Settings → Printer Name.')
  const base64 = btoa(String.fromCharCode(...data))
  const res = await fetch(`${serviceUrl}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer: printerName, data: base64 }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'Print service error')
}

export async function listServicePrinters(serviceUrl = 'http://127.0.0.1:9100') {
  const res = await fetch(`${serviceUrl}/printers`)
  const json = await res.json()
  return json.printers || []
}

// Browser print tag — 2" × 1" landscape label (matches 50.8mm × 25.4mm die-cut stock)
export function printBrowserTag(detail, fmtDate, settings = {}) {
  const shopName = settings.shopName || 'WashMitra'
  const barcodeValue = detail.id
  const custName = detail.custName || detail.customerName || ''
  const mobile = detail.mobile || detail.phone || ''
  const entryDate = detail.entryDate ? fmtDate(detail.entryDate)
    : detail.createdAt ? fmtDate(detail.createdAt) : ''
  const itemLines = (detail.items || []).map(it => `${it.productName} ×${it.qty}`)

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Tag — ${barcodeValue}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
  @page { size: 2in 1in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 2in; height: 1in; font-family: Arial, sans-serif; overflow: hidden; }
  .label { width: 2in; height: 1in; padding: 1px 2px; display: flex; flex-direction: column; }
  .shop { font-size: 7pt; font-weight: bold; text-align: center; line-height: 1.2; border-bottom: 0.5px solid #000; padding-bottom: 1px; }
  .body { display: flex; flex: 1; min-height: 0; }
  .left { width: 48%; display: flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: bold; }
  .divider { width: 0.5px; background: #000; align-self: stretch; }
  .right { flex: 1; padding-left: 3px; font-size: 6pt; line-height: 1.3; display: flex; flex-direction: column; justify-content: center; }
  .right .name { font-weight: bold; font-size: 7pt; }
  .right .mob { font-weight: bold; font-size: 6.5pt; }
  .bc-wrap { border-top: 0.5px solid #000; }
  .bc-wrap svg { display: block; width: 100%; height: 18px; }
</style>
<script>
  window.addEventListener('load', function() {
    JsBarcode('#bc', '${barcodeValue}', {
      format: 'CODE128', width: 1.5, height: 30,
      displayValue: false, margin: 1,
    });
    document.getElementById('bc').setAttribute('preserveAspectRatio', 'xMidYMid');
    window.print();
  });
<\/script>
</head>
<body>
<div class="label">
  <div class="shop">${shopName}</div>
  <div class="body">
    <div class="left">${barcodeValue}</div>
    <div class="divider"></div>
    <div class="right">
      ${custName ? `<div class="name">${custName}</div>` : ''}
      ${mobile ? `<div class="mob">${mobile}</div>` : ''}
      ${entryDate ? `<div>${entryDate}</div>` : ''}
      ${itemLines.map(l => `<div>${l}</div>`).join('')}
    </div>
  </div>
  <div class="bc-wrap"><svg id="bc"></svg></div>
</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=300,height=200')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// --- Silent tag print via local service (GDI-compatible, no browser dialog) ---
// Same architecture as receipt service printing: React renders to PNG canvas,
// POSTs to /print-image, service uses System.Drawing (Windows GDI) to print silently.
// Works with BarTender GDI driver and all other Windows GDI printer drivers.
export async function printTagViaService(detail, fmtDate, settings = {}) {
  const shopName = settings.shopName || 'WashMitra'
  const barcodeValue = detail.id
  const custName = detail.custName || detail.customerName || ''
  const mobile = detail.mobile || detail.phone || ''
  const entryDate = detail.entryDate ? fmtDate(detail.entryDate)
    : detail.createdAt ? fmtDate(detail.createdAt) : ''
  const itemLines = (detail.items || []).map(it => `${it.productName} ×${it.qty}`)
  const printerName = settings.tagPrinterName || ''
  const serviceUrl = settings.serviceUrl || 'http://127.0.0.1:9100'

  if (!printerName) throw new Error('No tag printer name set. Go to Settings → Tag Printer Name.')

  // Load JsBarcode
  if (!window.JsBarcode) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
      s.onload = resolve
      s.onerror = () => reject(new Error('JsBarcode CDN load failed'))
      document.head.appendChild(s)
    })
  }

  // Landscape canvas: 2in × 1in at 203 DPI (thermal printer native).
  // Service applies 90° CW matrix; BarTender driver 90° CCW cancels → upright.
  const DPI = 203
  const W = Math.round(2 * DPI)    // 406px
  const H = Math.round(1 * DPI)    // 203px
  const px = (mm) => Math.round(mm / 25.4 * DPI)

  // Barcode canvas (CODE128, no display text)
  const bcCanvas = document.createElement('canvas')
  window.JsBarcode(bcCanvas, barcodeValue, {
    format: 'CODE128',
    width: 2,
    height: px(8),
    displayValue: false,
    margin: px(1),
    background: '#ffffff',
    lineColor: '#000000',
  })

  const canvas = document.createElement('canvas')
  canvas.width = W    // 406 — landscape
  canvas.height = H   // 203 — landscape
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#000000'

  // ── Layout: company → name+mobile → date+product → order ID → barcode
  const margin = px(2)
  const pad = margin
  const lineH = px(3.2)
  let curY = margin

  // 1. Company name — centered, bold
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  ctx.font = `bold ${px(2.4)}px Arial`
  ctx.fillText(shopName, Math.round(W / 2), curY)
  curY += lineH
  ctx.fillRect(pad, curY - px(0.3), W - pad * 2, 1)

  // 2. Name + Mobile — on same line
  ctx.textAlign = 'left'
  ctx.font = `bold ${px(3)}px Arial`
  if (custName) ctx.fillText(custName, pad, curY)
  if (mobile) { ctx.textAlign = 'right'; ctx.fillText(mobile, W - pad, curY) }
  curY += lineH

  // 3. Date — left aligned
  ctx.textAlign = 'left'
  ctx.font = `bold ${px(2.2)}px Arial`
  if (entryDate) ctx.fillText(entryDate, pad, curY)
  curY += lineH

  // 4. Order ID — centered, large bold
  ctx.textAlign = 'center'
  ctx.font = `bold ${px(4)}px Arial`
  ctx.fillText(barcodeValue, Math.round(W / 2), curY)
  curY += px(4.5)
  ctx.fillRect(pad, curY, W - pad * 2, 1)
  curY += px(0.5)

  // 5. Barcode — centered, fills remaining space
  const bcY = curY
  const bcAvailH = H - bcY - margin
  const bcMaxW = W - pad * 2
  const bcScaleR = bcCanvas.width > bcMaxW ? bcMaxW / bcCanvas.width : 1
  const bcDrawW = Math.round(bcCanvas.width * bcScaleR)
  const bcDrawH = Math.min(Math.round(bcCanvas.height * bcScaleR), bcAvailH)
  const bcX = Math.round((W - bcDrawW) / 2)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(bcCanvas, bcX, bcY, bcDrawW, bcDrawH)

  // ── Convert canvas to 1-bit monochrome bitmap + TSPL raw commands ──
  // Bypasses the GDI driver entirely — sends raw bitmap data to the printer
  // port via winspool RawPrint. No driver rotation, exactly 1 label per print.
  const imgData = ctx.getImageData(0, 0, W, H)
  const widthBytes = Math.ceil(W / 8)  // 51
  const bitmapData = new Uint8Array(widthBytes * H)

  for (let y = 0; y < H; y++) {
    for (let bx = 0; bx < widthBytes; bx++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const x = bx * 8 + bit
        if (x < W) {
          const i = (y * W + x) * 4
          if (imgData.data[i] >= 128) byte |= (0x80 >> bit)
        }
      }
      bitmapData[y * widthBytes + bx] = byte
    }
  }

  const enc = new TextEncoder()
  const header = enc.encode(
    'SIZE 50.8 mm, 25.4 mm\r\n' +
    'GAP 3 mm, 0\r\n' +
    'DIRECTION 1\r\n' +
    'DENSITY 8\r\n' +
    'SPEED 4\r\n' +
    'CLS\r\n' +
    `BITMAP 0,0,${widthBytes},${H},0,`
  )
  const footer = enc.encode('\r\nPRINT 1,1\r\n')

  const buffer = new Uint8Array(header.length + bitmapData.length + footer.length)
  buffer.set(header, 0)
  buffer.set(bitmapData, header.length)
  buffer.set(footer, header.length + bitmapData.length)

  let binary = ''
  for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i])
  const base64 = btoa(binary)

  const res = await fetch(`${serviceUrl}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer: printerName, data: base64 }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.ok) throw new Error(json.error || `Print service error ${res.status}`)
}
