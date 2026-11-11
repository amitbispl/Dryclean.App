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
  const is58 = paperSize === '58'
  const value = (!is58 && mobile)
    ? `${sanitize(orderId)}-${sanitize(mobile)}`
    : sanitize(orderId)

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

  // Render at the right module width — NO scaling after this.
  // Scaling introduces anti-aliasing that blurs bar edges → unreadable on printer.
  const moduleWidth = is58 ? 2 : 3
  const tmp = document.createElement('canvas')
  try {
    window.JsBarcode(tmp, value, {
      format: 'CODE128',
      width: moduleWidth,
      height: is58 ? 60 : 70,
      displayValue: true,
      fontSize: 12,
      margin: 10,
      background: '#ffffff',
      lineColor: '#000000',
    })
  } catch (e) {
    console.error('Barcode render error:', e)
    return []
  }

  const srcW = tmp.width
  const srcH = tmp.height

  // Paper printable dots: 58mm→384, 80mm→576. Center barcode within paper row.
  const paperDots = is58 ? 384 : 576
  const widthBytes = Math.ceil(paperDots / 8)
  const offsetDots = Math.max(0, Math.floor((paperDots - srcW) / 2))

  const imgData = tmp.getContext('2d').getImageData(0, 0, srcW, srcH)

  const bytes = []
  bytes.push(GS, 0x76, 0x30, 0x00)                        // GS v 0 — raster image
  bytes.push(widthBytes & 0xFF, (widthBytes >> 8) & 0xFF)  // xL xH (width in bytes)
  bytes.push(srcH & 0xFF, (srcH >> 8) & 0xFF)              // yL yH (height in dots)

  for (let y = 0; y < srcH; y++) {
    for (let bx = 0; bx < widthBytes; bx++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const dotX = bx * 8 + bit      // dot column in paper
        const srcX = dotX - offsetDots // corresponding pixel in canvas
        if (srcX >= 0 && srcX < srcW) {
          const i = (y * srcW + srcX) * 4
          // threshold at 64 — only solid black pixels, no anti-aliased gray
          if (imgData.data[i] < 64) {
            byte |= (0x80 >> bit)
          }
        }
      }
      bytes.push(byte)
    }
  }

  bytes.push(LF)
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
    addLine(twoCol('Total:', sanitize(fmtMoney(detail.total))))
    lines.push(ESC, 0x45, 0x00)
    addLine(twoCol('Advance:', sanitize(fmtMoney(detail.advance))))
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
// Supports XPrinter BLE and common generic BLE thermal printers
const BLE_SERVICES = [
  { service: '000018f0-0000-1000-8000-00805f9b34fb', char: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', char: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', char: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
]

export async function printBluetooth(data) {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome on Android/Desktop.')
  }

  const optionalServices = BLE_SERVICES.map(s => s.service)

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices,
  })

  const server = await device.gatt.connect()

  let characteristic = null

  for (const { service: svcUuid, char: charUuid } of BLE_SERVICES) {
    try {
      const svc = await server.getPrimaryService(svcUuid)
      characteristic = await svc.getCharacteristic(charUuid)
      break
    } catch {
      // try next
    }
  }

  if (!characteristic) {
    device.gatt.disconnect()
    throw new Error('Could not find a compatible print characteristic. Check your printer model.')
  }

  // Send data in chunks (BLE MTU is typically 20-512 bytes)
  const CHUNK = 200
  for (let i = 0; i < data.length; i += CHUNK) {
    await characteristic.writeValue(data.slice(i, i + CHUNK))
  }

  device.gatt.disconnect()
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

export function printBrowserTag(detail, fmtDate, settings = {}) {
  const shopName = settings.shopName || 'WashMitra'
  const barcodeValue = detail.mobile
    ? `${detail.id}-${detail.mobile}`
    : detail.id

  const itemsHtml = (detail.items || [])
    .map(it => `<div class="item">${it.productName} &times;${it.qty}</div>`)
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Packing Tag — ${detail.id}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
  @page { size: 58mm auto; margin: 2mm; }
  body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 4px; width: 54mm; }
  h1 { font-size: 13px; text-align: center; margin: 0 0 2px; }
  .sub { text-align: center; font-size: 10px; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 6px; }
  .order-id { font-size: 22px; font-weight: 900; text-align: center; letter-spacing: 1px; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; margin: 1px 0; }
  .label { color: #555; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .item { font-size: 10px; }
  svg { display: block; margin: 4px auto; }
</style>
</head>
<body>
<h1>${shopName}</h1>
<div class="sub">PACKING TAG</div>
<div class="order-id">${detail.id}</div>
<div class="row"><span class="label">Customer:</span><span>${detail.custName || ''}</span></div>
<div class="row"><span class="label">Mobile:</span><span>${detail.mobile || ''}</span></div>
<div class="row"><span class="label">Delivery:</span><span>${fmtDate(detail.deliveryDate)}</span></div>
${itemsHtml ? `<div class="divider"></div>${itemsHtml}` : ''}
<div class="divider"></div>
<svg id="bc"></svg>
<script>
  JsBarcode('#bc', '${barcodeValue}', {
    format: 'CODE128', width: 1.5, height: 40,
    displayValue: true, fontSize: 10, margin: 2,
  });
  window.onload = () => window.print();
<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=400,height=600')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
