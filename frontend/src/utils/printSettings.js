const KEY = 'washmitra_print_settings'

export const DEFAULT_PRINT_SETTINGS = {
  // Bill / Receipt printer
  defaultMode: 'normal',       // 'normal' | 'usb' | 'bluetooth' | 'service'
  printerLanguage: 'escpos',   // 'escpos' | 'cpcl'
  paperSize: '80',             // '58' | '80' mm
  copies: '1',
  showLogo: true,
  footerText: 'Thank you! Visit again!',
  billPrinterName: '',         // Windows printer name for 'service' mode
  // Label / Tag printer (separate device)
  tagMode: 'usb',              // 'normal' | 'usb' | 'bluetooth' | 'service'
  tagLanguage: 'escpos',       // 'escpos' | 'cpcl'
  tagPrinterName: '',          // Windows printer name for 'service' mode
  autoPrint: false,
  serviceUrl: 'http://127.0.0.1:9100', // local print service URL
}

export function loadPrintSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PRINT_SETTINGS }
    return { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PRINT_SETTINGS }
  }
}

export function savePrintSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {}
}
