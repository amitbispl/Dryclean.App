const KEY = 'washmitra_print_settings'

export const DEFAULT_PRINT_SETTINGS = {
  paperSize: '80',          // '58' | '80' mm
  defaultMode: 'normal',    // 'normal' | 'usb' | 'bluetooth'
  copies: '1',              // '1' | '2' | '3'
  showLogo: true,
  footerText: 'Thank you! Visit again!',
  autoPrint: false,
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
