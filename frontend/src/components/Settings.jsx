import { useState, useEffect } from 'react'
import { getSettings, updateSettings } from '../api/client'
import { useToast } from './Toast'

export default function Settings() {
  const [form, setForm] = useState({ shop_name: '', shop_address: '', shop_city: '', shop_phone: '', whatsapp: false, barcode: false, sms: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
              <input type="text" value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="text" value={form.shop_phone} onChange={e => setForm(f => ({ ...f, shop_phone: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <input type="text" value={form.shop_address} onChange={e => setForm(f => ({ ...f, shop_address: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>City / State</label>
            <input type="text" value={form.shop_city} onChange={e => setForm(f => ({ ...f, shop_city: e.target.value }))} />
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

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-success" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : '✓ Save Settings'}
        </button>
      </div>
    </>
  )
}
