import { useState, useEffect } from 'react'
import { getCompanies, createCompany, updateCompany } from '../api/client'
import Modal from './Modal'

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    getCompanies().then(setCompanies).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setForm({ name: '', address: '', city: '', phone: '', email: '' })
    setError(''); setModal('add')
  }

  const openEdit = (c) => {
    setSelected(c)
    setForm({ name: c.name, address: c.address || '', city: c.city || '', phone: c.phone || '', email: c.email || '' })
    setError(''); setModal('edit')
  }

  const save = async () => {
    setSaving(true); setError('')
    try {
      if (modal === 'add') await createCompany(form)
      else await updateCompany(selected.id, { ...form, active: selected.active })
      setModal(null); load()
    } catch (e) {
      setError(e.response?.data?.message || 'Error saving company')
    } finally { setSaving(false) }
  }

  const toggleActive = async (c) => {
    if (!confirm(`${c.active ? 'Deactivate' : 'Activate'} company "${c.name}"?`)) return
    await updateCompany(c.id, { name: c.name, address: c.address, city: c.city, phone: c.phone, email: c.email, active: !c.active })
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Companies</h2><p>Manage all registered companies</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Company</button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Company Name</th><th>City</th><th>Phone</th><th>Email</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Loading...</td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>No companies found</td></tr>
              ) : companies.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong><br /><span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.address}</span></td>
                  <td>{c.city || '—'}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.active ? '#059669' : '#DC2626' }}>
                      {c.active ? '● Active' : '● Inactive'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>Edit</button>
                    <button className={`btn btn-sm ${c.active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(c)}>
                      {c.active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal === 'add' || modal === 'edit'} title={modal === 'add' ? 'Add Company' : 'Edit Company'} onClose={() => setModal(null)}
        footer={<>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </>}>
        {error && <div style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div className="form-grid">
          <div className="form-group">
            <label>Company Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Company name" />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Shop address" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" />
          </div>
        </div>
      </Modal>
    </div>
  )
}
