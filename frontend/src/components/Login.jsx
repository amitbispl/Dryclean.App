import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/client'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(form.username, form.password)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.status === 401 ? 'Invalid username or password' : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F3F4F6',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🧺</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0D1B4B', marginTop: 8 }}>DryClean Pro</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Management System</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
          padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,.06)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1F2937', marginBottom: 6 }}>Sign In</h2>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24 }}>Enter your credentials to continue</p>

          {error && (
            <div style={{
              background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Username</label>
              <input
                type="text" placeholder="Enter username" required
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label>Password</label>
              <input
                type="password" placeholder="Enter password" required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: 14 }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 20 }}>
          Default: <strong>admin</strong> / <strong>Admin@123</strong>
        </p>
      </div>
    </div>
  )
}
