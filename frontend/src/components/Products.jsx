import { useState, useEffect } from 'react'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api/client'
import { fmtMoney } from '../utils'
import Modal from './Modal'
import { useToast } from './Toast'

const CATEGORIES = ['Dry Clean', 'Rafu', 'Charak', 'Other']
const EMOJIS = { 'Dry Clean': '👔', Rafu: '🪡', Charak: '✂️', Other: '📦' }
const EMPTY = { name: '', category: 'Dry Clean', price: 0, emoji: '👔', active: true }

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const toast = useToast()

  const load = () => getProducts().then(setProducts).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  function openAdd() { setForm({ ...EMPTY }); setModal('add') }
  function openEdit(p) { setForm({ ...p }); setModal('edit') }

  async function save() {
    setSaving(true)
    try {
      if (modal === 'add') {
        await createProduct(form)
        toast('Product added')
      } else {
        await updateProduct(form.id, form)
        toast('Product updated')
      }
      setModal(null)
      load()
    } catch { toast('Failed to save', 'danger') }
    finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Delete this product?')) return
    try { await deleteProduct(id); toast('Deleted'); load() }
    catch { toast('Cannot delete — may be in use', 'danger') }
  }

  async function toggleActive(p) {
    await updateProduct(p.id, { ...p, active: !p.active })
    load()
  }

  const filtered = catFilter ? products.filter(p => p.category === catFilter) : products

  const catBadgeMap = { 'Dry Clean': 'b-dryclean', Rafu: 'b-rafu', Charak: 'b-charak', Other: '' }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div><h2>Products</h2><p>Manage services and pricing</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className={`btn btn-sm ${!catFilter ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCatFilter('')}>All</button>
        {CATEGORIES.map(c => (
          <button key={c} className={`btn btn-sm ${catFilter === c ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCatFilter(c)}>{c}</button>
        ))}
      </div>

      <div className="products-grid">
        {filtered.map(p => (
          <div className="prod-card" key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
            <div className="prod-avi" style={{ background: p.active ? 'var(--blue-lt)' : 'var(--gray100)' }}>{p.emoji || EMOJIS[p.category] || '📦'}</div>
            <div style={{ flex: 1 }}>
              <div className="prod-name">{p.name}</div>
              <div className="prod-cat"><span className={`badge ${catBadgeMap[p.category] || ''}`}>{p.category}</span></div>
            </div>
            <div className="prod-price">{fmtMoney(p.price)}</div>
            <div className="prod-actions">
              <button className="btn btn-outline btn-sm" onClick={() => toggleActive(p)}>{p.active ? 'Disable' : 'Enable'}</button>
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>✕</button>
            </div>
          </div>
        ))}
        {!filtered.length && <div className="empty-state"><p>No products</p><span>Click "+ Add Product" to get started</span></div>}
      </div>

      <Modal open={!!modal} title={modal === 'add' ? 'Add Product' : 'Edit Product'} onClose={() => setModal(null)}
        footer={<>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </>}>
        <div className="form-grid">
          <div className="form-row">
            <div className="form-group">
              <label>Product Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, emoji: EMOJIS[e.target.value] || f.emoji }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Price (₹)</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="form-group">
              <label>Emoji</label>
              <input type="text" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4} />
            </div>
          </div>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><p style={{ fontSize: 13, fontWeight: 600 }}>Active</p><span style={{ fontSize: 11, color: 'var(--gray400)' }}>Show in order entry</span></div>
            <div className={`toggle${form.active ? ' on' : ''}`} onClick={() => setForm(f => ({ ...f, active: !f.active }))} />
          </div>
        </div>
      </Modal>
    </>
  )
}
