import { useState, useEffect } from 'react'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api/client'
import { avatarColor, initials, fmtDate } from '../utils'
import Modal from './Modal'
import { useToast } from './Toast'

const EMPTY = { name: '', mobile: '', address: '', email: '', customerType: 'Regular' }

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = () => getCustomers().then(setCustomers).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const filtered = search
    ? customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.mobile.includes(search))
    : customers

  function openAdd() { setForm({ ...EMPTY }); setModal('add') }
  function openEdit(c) { setForm({ ...c }); setModal('edit') }

  async function save() {
    if (!form.name || !form.mobile) { toast('Name and mobile required', 'danger'); return }
    setSaving(true)
    try {
      if (modal === 'add') { await createCustomer(form); toast('Customer added') }
      else { await updateCustomer(form.id, form); toast('Customer updated') }
      setModal(null)
      load()
    } catch (e) { toast(e.response?.data?.message || 'Failed', 'danger') }
    finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Delete this customer?')) return
    try { await deleteCustomer(id); toast('Deleted'); load() }
    catch { toast('Cannot delete — has orders', 'danger') }
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div><h2>Customers</h2><p>{customers.length} registered customers</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      <div className="search-bar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" placeholder="Search name or mobile..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="customers-grid">
        {filtered.map((c, i) => (
          <div className="cust-card" key={c.id}>
            <div className="cust-avi" style={{ background: avatarColor(c.id) }}>{initials(c.name)}</div>
            <div style={{ flex: 1 }}>
              <div className="cust-name">{c.name}</div>
              <div className="cust-meta">📞 {c.mobile}</div>
              {c.address && <div className="cust-meta">📍 {c.address}</div>}
              <div className="cust-meta">Since {fmtDate(c.regDate)}</div>
              {c.createdBy && <div className="cust-meta" style={{fontSize:10,color:'#888'}}>Added by: {c.createdBy}{c.createdByIp ? ` · IP: ${c.createdByIp}` : ''}</div>}
              {c.customerType && c.customerType !== 'Regular' && (
                <span className="badge" style={{
                  fontSize: 10, padding: '2px 6px', marginTop: 2,
                  background: c.customerType === 'VIP' ? '#7C3AED' : c.customerType === 'Corporate' ? '#0BA5A4' : '#6B7280',
                  color: '#fff'
                }}>{c.customerType}</span>
              )}
            </div>
            <div className="cust-orders">
              <span>{c.orderCount || 0}</span>
              <p>Orders</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>Delete</button>
            </div>
          </div>
        ))}
        {!filtered.length && <div className="empty-state"><p>No customers found</p></div>}
      </div>

      <Modal open={!!modal} title={modal === 'add' ? 'Add Customer' : 'Edit Customer'} onClose={() => setModal(null)}
        footer={<>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </>}>
        <div className="form-grid">
          <div className="form-row">
            <div className="form-group">
              <label>Customer Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Mobile No *</label>
              <input type="text" maxLength={10} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Email (optional)</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Customer Type</label>
            <select value={form.customerType || 'Regular'} onChange={e => setForm(f => ({ ...f, customerType: e.target.value }))}>
              <option>Regular</option>
              <option>VIP</option>
              <option>Corporate</option>
              <option>Walk-in</option>
            </select>
          </div>
        </div>
      </Modal>
    </>
  )
}
