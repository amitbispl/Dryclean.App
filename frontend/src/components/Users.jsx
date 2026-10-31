import { useState, useEffect } from 'react'
import { getUsers, createUser, updateUser, deleteUser, changePassword, getCompanies } from '../api/client'
import Modal from './Modal'

const ROLES = ['Admin', 'Counter', 'Staff']
const ROLES_SUPER = ['SuperAdmin', 'Admin', 'Counter', 'Staff']

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

const roleBadge = (role) => {
  const map = { SuperAdmin: '#7C3AED', Admin: '#1B4FD8', Counter: '#0BA5A4', Staff: '#F59E0B' }
  return <span style={{ background: map[role] + '22', color: map[role], fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{role}</span>
}

export default function Users() {
  const me = getUser()
  const isSuperAdmin = me.role === 'SuperAdmin'
  const [users, setUsers] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | 'edit' | 'password'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'Counter', companyId: me.companyId || '' })
  const [pwForm, setPwForm] = useState({ newPassword: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      getUsers(),
      isSuperAdmin ? getCompanies() : Promise.resolve([])
    ]).then(([u, c]) => { setUsers(u); setCompanies(c) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setForm({ name: '', username: '', password: '', role: 'Counter', companyId: me.companyId || '' })
    setError(''); setModal('add')
  }

  const openEdit = (u) => {
    setSelected(u)
    setForm({ name: u.name, username: u.username, password: '', role: u.role, companyId: u.companyId || '' })
    setError(''); setModal('edit')
  }

  const openPw = (u) => { setSelected(u); setPwForm({ newPassword: '' }); setError(''); setModal('password') }

  const save = async () => {
    setSaving(true); setError('')
    try {
      if (modal === 'add') {
        await createUser({ name: form.name, username: form.username, password: form.password, role: form.role, companyId: form.companyId ? parseInt(form.companyId) : null })
      } else {
        await updateUser(selected.id, { name: form.name, username: form.username, role: form.role, active: true })
      }
      setModal(null); load()
    } catch (e) {
      setError(e.response?.data?.message || 'Error saving user')
    } finally { setSaving(false) }
  }

  const savePw = async () => {
    setSaving(true); setError('')
    try {
      await changePassword(selected.id, pwForm.newPassword)
      setModal(null)
    } catch { setError('Error changing password') }
    finally { setSaving(false) }
  }

  const deactivate = async (u) => {
    if (!confirm(`Deactivate user "${u.name}"?`)) return
    await deleteUser(u.id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Users</h2><p>Manage user accounts and roles</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add User</button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Username</th><th>Role</th>
                {isSuperAdmin && <th>Company</th>}
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isSuperAdmin ? 6 : 5} style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={isSuperAdmin ? 6 : 5} style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td style={{ color: '#6B7280' }}>{u.username}</td>
                  <td>{roleBadge(u.role)}</td>
                  {isSuperAdmin && <td style={{ fontSize: 12, color: '#6B7280' }}>{u.companyName || '—'}</td>}
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, color: u.active ? '#059669' : '#DC2626' }}>
                      {u.active ? '● Active' : '● Inactive'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>Edit</button>
                    <button className="btn btn-outline btn-sm" onClick={() => openPw(u)}>Password</button>
                    {u.id !== me.id && u.active && (
                      <button className="btn btn-danger btn-sm" onClick={() => deactivate(u)}>Disable</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal === 'add' || modal === 'edit'} title={modal === 'add' ? 'Add User' : 'Edit User'} onClose={() => setModal(null)}
        footer={<>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </>}>
        {error && <div style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div className="form-grid">
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
          </div>
          <div className="form-group">
            <label>Username</label>
            <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Login username" />
          </div>
          {modal === 'add' && (
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Set password" />
            </div>
          )}
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {(isSuperAdmin ? ROLES_SUPER : ROLES).map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          {isSuperAdmin && (
            <div className="form-group">
              <label>Company</label>
              <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}>
                <option value="">— None (SuperAdmin) —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal open={modal === 'password'} title={`Change Password — ${selected?.name}`} onClose={() => setModal(null)}
        footer={<>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={savePw} disabled={saving}>{saving ? 'Saving...' : 'Change Password'}</button>
        </>}>
        {error && <div style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div className="form-group">
          <label>New Password</label>
          <input type="password" value={pwForm.newPassword} onChange={e => setPwForm({ newPassword: e.target.value })} placeholder="Enter new password" />
        </div>
      </Modal>
    </div>
  )
}
