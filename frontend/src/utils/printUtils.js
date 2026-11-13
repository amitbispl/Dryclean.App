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

let _ble = null  // { device, characteristic }

export function forgetBluetoothPrinter() {
  if (_ble) { try { _ble.device.gatt.disconnect() } catch {} }
  _ble = null
}

export async function printBluetooth(data) {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth is not supported. Use Chrome on Desktop/Android.')
  }

  const optionalServices = BLE_SERVICES.map(s => s.service)

  if (_ble && _ble.device.gatt.connected) {
    try { await sendBleData(_ble.characteristic, data); return }
    catch { _ble = null }
  }

  const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices })
  const server = await device.gatt.connect()

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
    throw new Error('No writable characteristic found on this printer. Try USB mode instead.')
  }

  _ble = { device, characteristic }
  device.addEventListener('gattserverdisconnected', () => { _ble = null })

  await sendBleData(characteristic, data)
}

async function sendBleData(characteristic, data) {
  // Use writeValueWithoutResponse when available — required by many thermal printers
  const useNoResp = characteristic.properties.writeWithoutResponse
  const CHUNK = useNoResp ? 512 : 200
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK)
    if (useNoResp) {
      await characteristic.writeValueWithoutResponse(chunk)
      // Small delay to avoid buffer overflow on printer
      await new Promise(r => setTimeout(r, 20))
    } else {
      await characteristic.writeValue(chunk)
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

// Browser print tag — 2" × 1" label size
export function printBrowserTag(detail, fmtDate, settings = {}) {
  const shopName = settings.shopName || 'WashMitra'
  const barcodeValue = detail.id  // order ID only — keeps barcode short and readable

  const itemsSummary = (detail.items || [])
    .map(it => `${it.productName}×${it.qty}`)
    .join(', ')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Tag — ${detail.id}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
  @page { size: 2in 1in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: Arial, sans-serif;
    width: 2in; height: 1in;
    overflow: hidden;
  }
  .wrap { padding: 1.5mm 2mm 0 2mm; width: 2in; height: 1in; overflow: hidden; }
  .header {
    display: flex; justify-content: space-between; align-items: baseline;
    border-bottom: 0.8px solid #000; padding-bottom: 1px; margin-bottom: 1.5px;
    width: 100%;
  }
  .shop { font-size: 8px; color: #555; flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; }
  .order-id { font-size: 15px; font-weight: 900; flex-shrink: 0; margin-left: 4px; }
  .cust { font-size: 11.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; }
  .info { font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; }
  svg { display: block; width: 100%; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <span class="shop">${shopName}</span>
    <span class="order-id">${detail.id}</span>
  </div>
  <div class="cust">${detail.custName || ''}</div>
  <div class="info">${detail.mobile || ''} &nbsp;|&nbsp; ${fmtDate(detail.deliveryDate)}</div>
  ${itemsSummary ? `<div class="info">${itemsSummary}</div>` : ''}
  <svg id="bc"></svg>
</div>
<script>
  JsBarcode('#bc', '${barcodeValue}', {
    format: 'CODE128', width: 1.1, height: 12,
    displayValue: true, fontSize: 7, margin: 0, textMargin: 0,
  });
  window.onload = () => window.print();
<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=300,height=200')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
