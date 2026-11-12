import { useState, useEffect } from 'react'
import { useToast } from './Toast'
import api from '../api/client'

async function getCategories() { return api.get('/categories').then(r => r.data) }
async function createCategory(name) { return api.post('/categories', { name }).then(r => r.data) }
async function updateCategory(id, name) { return api.put(`/categories/${id}`, { name }).then(r => r.data) }
async function deleteCategory(id) { return api.delete(`/categories/${id}`).then(r => r.data) }

export default function Categories() {
  const toast = useToast()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const load = () => {
    setLoading(true)
    getCategories().then(setCategories).catch(() => toast('Failed to load categories', 'danger')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!newName.trim()) { toast('Enter a category name', 'danger'); return }
    setAdding(true)
    try {
      await createCategory(newName.trim())
      setNewName('')
      toast('Category added')
      load()
    } catch (e) {
      toast(e.response?.data?.message || 'Failed to add category', 'danger')
    } finally { setAdding(false) }
  }

  async function handleUpdate(id) {
    if (!editName.trim()) return
    try {
      await updateCategory(id, editName.trim())
      setEditId(null)
      toast('Category updated')
      load()
    } catch (e) {
      toast(e.response?.data?.message || 'Failed to update', 'danger')
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Deactivate this category?')) return
    try {
      await deleteCategory(id)
      toast('Category removed')
      load()
    } catch { toast('Failed to delete', 'danger') }
  }

  return (
    <>
      <div className="page-header">
        <div><h2>Service Categories</h2><p>Manage garment service categories</p></div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><div className="panel-title">Add New Category</div></div>
        <div className="panel-body">
          <div style={{ display: 'flex', gap: 10, maxWidth: 420 }}>
            <input
              type="text" placeholder="Category name (e.g. Dry Clean, Rafu, Charak)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
              {adding ? 'Adding...' : '+ Add'}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Categories ({categories.filter(c => c.active).length})</div></div>
        {loading ? <div className="loading" style={{ padding: 20 }}>Loading...</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Category Name</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {categories.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--gray400)', width: 40 }}>{i + 1}</td>
                    <td>
                      {editId === c.id
                        ? <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditId(null) }}
                            autoFocus style={{ padding: '4px 8px', fontSize: 13 }} />
                        : <strong>{c.name}</strong>}
                    </td>
                    <td><span className={`badge ${c.active ? 'badge-success' : 'badge-gray'}`}>{c.active ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {editId === c.id ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(c.id)}>Save</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => { setEditId(c.id); setEditName(c.name) }}>Edit</button>
                          {c.active && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Remove</button>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!categories.length && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--gray400)' }}>No categories yet. Add one above.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
