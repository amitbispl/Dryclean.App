import { useState, useEffect } from 'react'
import { getSettings, updateSettings } from '../api/client'
import { useToast } from './Toast'
import { loadPrintSettings, savePrintSettings } from '../utils/printSettings'
import { forgetBluetoothPrinter } from '../utils/printUtils'

export default function Settings() {
  const [form, setForm] = useState({ shopName: '', shopAddress: '', shopCity: '', shopPhone: '', whatsapp: false, barcode: false, sms: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [printCfg, setPrintCfg] = useState(() => loadPrintSettings())
  const [printSaved, setPrintSaved] = useState(false)
  const toast = useToast()

  useEffect(() => {
    getSettings().then(data => setForm(data)).finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      await updateSettings(form)
      toast('Settings saved successfully!')
    } catch { toast('Failed to save', 'danger') }
    finally { setSaving(false) }
  }

  function savePrint() {
    savePrintSettings(printCfg)
    setPrintSaved(true)
    setTimeout(() => setPrintSaved(false), 2000)
  }

  function setPrint(key, value) {
    setPrintCfg(p => ({ ...p, [key]: value }))
  }

  const toggles = [
    { key: 'whatsapp', label: 'WhatsApp Notifications', sub: 'Send order status updates via WhatsApp' },
    { key: 'barcode', label: 'Barcode / QR Code', sub: 'Print barcode on receipts for quick scanning' },
    { key: 'sms', label: 'SMS Alerts', sub: 'Send SMS when order is ready for delivery' },
  ]

  if (loading) return <div className="loading">Loading settings...</div>

  return (
    <>
      <div className="page-header">
        <div><h2>Settings</h2><p>Configure your shop details</p></div>
      </div>

      <div className="settings-section">
        <h3>Shop Information</h3>
        <div className="form-grid">
          <div className="form-row">
            <div className="form-group">
              <label>Shop Name</label>
              <input type="text" value={form.shopName} onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="text" value={form.shopPhone} onChange={e => setForm(f => ({ ...f, shopPhone: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <input type="text" value={form.shopAddress} onChange={e => setForm(f => ({ ...f, shopAddress: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>City / State</label>
            <input type="text" value={form.shopCity} onChange={e => setForm(f => ({ ...f, shopCity: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Integrations & Features</h3>
        {toggles.map(t => (
          <div className="toggle-row" key={t.key}>
            <div className="toggle-info">
              <p>{t.label}</p>
              <span>{t.sub}</span>
            </div>
            <div className={`toggle${form[t.key] ? ' on' : ''}`} onClick={() => setForm(f => ({ ...f, [t.key]: !f[t.key] }))} />
          </div>
        ))}
      </div>

      <div className="settings-section">
        <h3>Print Settings</h3>
        <div className="form-grid">

          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--gray500)' }}>Bill / Receipt Printer</p>
          <div className="form-row">
            <div className="form-group">
              <label>Paper Size</label>
              <select value={printCfg.paperSize} onChange={e => setPrint('paperSize', e.target.value)}>
                <option value="58">58 mm (narrow thermal)</option>
                <option value="80">80 mm (standard thermal)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Print Mode</label>
              <select value={printCfg.defaultMode} onChange={e => setPrint('defaultMode', e.target.value)}>
                <option value="normal">Normal (browser print dialog)</option>
                <option value="usb">USB / OTG — silent, no dialog</option>
                <option value="bluetooth">Bluetooth — silent, no dialog</option>
              </select>
              {printCfg.defaultMode === 'bluetooth' && (
                <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 6, fontSize: 12 }}
                  onClick={() => { forgetBluetoothPrinter(); window.location.reload() }}>
                  Forget saved printer
                </button>
              )}
            </div>
            <div className="form-group">
              <label>Printer Language</label>
              <select value={printCfg.printerLanguage || 'escpos'} onChange={e => setPrint('printerLanguage', e.target.value)}>
                <option value="escpos">ESC/POS (standard thermal)</option>
                <option value="cpcl">CPCL (DCode MP30, Zebra)</option>
              </select>
            </div>
          </div>

          <p style={{ fontWeight: 600, fontSize: 13, margin: '12px 0 4px', color: 'var(--gray500)' }}>Label / Tag Printer</p>
          <div className="form-row">
            <div className="form-group">
              <label>Print Mode</label>
              <select value={printCfg.tagMode || 'usb'} onChange={e => setPrint('tagMode', e.target.value)}>
                <option value="normal">Normal (browser print dialog)</option>
                <option value="usb">USB / OTG — silent, no dialog</option>
                <option value="bluetooth">Bluetooth — silent, no dialog</option>
              </select>
            </div>
            <div className="form-group">
              <label>Printer Language</label>
              <select value={printCfg.tagLanguage || 'escpos'} onChange={e => setPrint('tagLanguage', e.target.value)}>
                <option value="escpos">ESC/POS (standard thermal)</option>
                <option value="cpcl">CPCL (DCode MP30, Zebra)</option>
              </select>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 8 }}>
            <div className="form-group">
              <label>Number of Copies</label>
              <select value={printCfg.copies} onChange={e => setPrint('copies', e.target.value)}>
                <option value="1">1 copy</option>
                <option value="2">2 copies</option>
                <option value="3">3 copies</option>
              </select>
            </div>
            <div className="form-group">
              <label>Receipt Footer Text</label>
              <input type="text" value={printCfg.footerText} onChange={e => setPrint('footerText', e.target.value)} placeholder="Thank you! Visit again!" />
            </div>
          </div>
        </div>

        <div className="toggle-row" style={{ marginTop: 10 }}>
          <div className="toggle-info">
            <p>Show Logo on Receipt</p>
            <span>Print shop logo at the top of each receipt</span>
          </div>
          <div className={`toggle${printCfg.showLogo ? ' on' : ''}`} onClick={() => setPrint('showLogo', !printCfg.showLogo)} />
        </div>

        <div className="toggle-row">
          <div className="toggle-info">
            <p>Auto-Print on New Order</p>
            <span>Automatically open print dialog after saving a new order</span>
          </div>
          <div className={`toggle${printCfg.autoPrint ? ' on' : ''}`} onClick={() => setPrint('autoPrint', !printCfg.autoPrint)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn btn-success" onClick={savePrint}>
            {printSaved ? '✓ Saved!' : '✓ Save Print Settings'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-success" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : '✓ Save Settings'}
        </button>
      </div>
    </>
  )
}
