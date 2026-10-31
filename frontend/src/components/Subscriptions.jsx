import { useState, useEffect } from 'react'
import { getAllSubscriptions, getSubscriptionPlans, getSubscriptionStatus, getCompanies, createSubscription, updateSubscription } from '../api/client'
import Modal from './Modal'
import { useToast } from './Toast'

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

const STATUS_COLORS = { Active: '#10B981', Trial: '#3B82F6', Expired: '#EF4444', Cancelled: '#6B7280', Suspended: '#F59E0B' }
const BILLING_COLORS = { Monthly: '#3B82F6', Yearly: '#7C3AED' }

const EMPTY_FORM = { companyId: '', planId: '', startDate: '', endDate: '', paymentMode: 'Cash', amountPaid: 0, status: 'Active' }

export default function Subscriptions() {
  const user = getUser()
  const isSuperAdmin = user.role === 'SuperAdmin'
  const toast = useToast()

  const [subs, setSubs] = useState([])
  const [plans, setPlans] = useState([])
  const [companies, setCompanies] = useState([])
  const [myStatus, setMyStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editSub, setEditSub] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [plansData] = await Promise.all([getSubscriptionPlans()])
      setPlans(plansData)
      if (isSuperAdmin) {
        const [subsData, compsData] = await Promise.all([getAllSubscriptions(), getCompanies()])
        setSubs(subsData)
        setCompanies(compsData)
      } else {
        const status = await getSubscriptionStatus()
        setMyStatus(status)
      }
    } catch (e) {
      toast('Failed to load subscription data', 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm({ ...EMPTY_FORM, startDate: new Date().toISOString().split('T')[0] })
    setEditSub(null)
    setModal('form')
  }

  function openEdit(s) {
    setForm({
      companyId: s.companyId,
      planId: s.planId,
      startDate: s.start_date,
      endDate: s.end_date,
      paymentMode: s.paymentMode,
      amountPaid: s.amount_paid,
      status: s.status,
    })
    setEditSub(s)
    setModal('form')
  }

  async function save() {
    if (!form.planId || !form.startDate || !form.endDate) { toast('Fill required fields', 'danger'); return }
    if (!editSub && !form.companyId) { toast('Select a company', 'danger'); return }
    setSaving(true)
    try {
      if (editSub) {
        await updateSubscription(editSub.id, { planId: parseInt(form.planId), startDate: form.startDate, endDate: form.endDate, paymentMode: form.paymentMode, amountPaid: parseFloat(form.amountPaid) || 0, status: form.status })
        toast('Subscription updated')
      } else {
        await createSubscription({ companyId: parseInt(form.companyId), planId: parseInt(form.planId), startDate: form.startDate, endDate: form.endDate, paymentMode: form.paymentMode, amountPaid: parseFloat(form.amountPaid) || 0, status: form.status })
        toast('Subscription created')
      }
      setModal(null)
      load()
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to save', 'danger')
    } finally {
      setSaving(false)
    }
  }

  function autoEndDate(planId, startDate) {
    if (!planId || !startDate) return
    const p = plans.find(x => x.id == planId)
    if (!p) return
    const d = new Date(startDate)
    if (p.billingCycle === 'Yearly') d.setFullYear(d.getFullYear() + 1)
    else d.setMonth(d.getMonth() + 1)
    setForm(f => ({ ...f, endDate: d.toISOString().split('T')[0], amountPaid: p.price }))
  }

  if (loading) return <div className="loading">Loading...</div>

  // ─── Non-SuperAdmin: show own subscription status ───────────────────────────
  if (!isSuperAdmin) {
    const s = myStatus
    if (!s || s.status === 'None') return (
      <div className="panel" style={{ maxWidth: 500, margin: '40px auto' }}>
        <div className="panel-body" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <h3 style={{ marginBottom: 8 }}>No Active Subscription</h3>
          <p style={{ color: 'var(--gray400)' }}>Please contact your administrator to activate a subscription plan.</p>
        </div>
      </div>
    )

    const daysLeft = s.days_remaining || 0
    const isExpired = s.status === 'Expired'
    const isWarning = !isExpired && daysLeft <= 7

    return (
      <>
        <div className="page-header">
          <div><h2>Subscription</h2><p>Your current plan details</p></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-num" style={{ color: STATUS_COLORS[s.status] || '#374151' }}>{s.plan || '—'}</div>
            <div className="stat-lbl">Current Plan</div>
            <div className="stat-trend">
              <span style={{ background: STATUS_COLORS[s.status] || '#374151', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>{s.status}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: isExpired ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981' }}>{isExpired ? 'Expired' : daysLeft}</div>
            <div className="stat-lbl">{isExpired ? 'Status' : 'Days Remaining'}</div>
            <div className={`stat-trend ${isExpired || isWarning ? 't-down' : 't-up'}`}>
              Expires: {s.end_date}
            </div>
          </div>
          {s.billing_cycle && (
            <div className="stat-card">
              <div className="stat-num" style={{ color: BILLING_COLORS[s.billing_cycle] || '#374151' }}>{s.billing_cycle}</div>
              <div className="stat-lbl">Billing Cycle</div>
            </div>
          )}
          {s.max_orders > 0 && (
            <div className="stat-card">
              <div className="stat-num">{s.max_orders}</div>
              <div className="stat-lbl">Max Orders / Month</div>
            </div>
          )}
        </div>

        {(isExpired || isWarning) && (
          <div style={{ background: isExpired ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${isExpired ? '#FCA5A5' : '#FCD34D'}`, borderRadius: 8, padding: '14px 20px', marginBottom: 16 }}>
            <strong style={{ color: isExpired ? '#DC2626' : '#B45309' }}>
              {isExpired ? '🔴 Subscription expired.' : `⚠️ Subscription expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`}
            </strong>
            <span style={{ marginLeft: 8, color: '#6B7280', fontSize: 13 }}>Please contact your administrator.</span>
          </div>
        )}

        <div className="panel">
          <div className="panel-head"><div className="panel-title">Available Plans</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, padding: 16 }}>
            {plans.map(p => (
              <div key={p.id} style={{ border: p.name === s.plan ? '2px solid var(--blue)' : '1px solid var(--border)', borderRadius: 10, padding: 16, background: p.name === s.plan ? 'rgba(27,79,216,0.04)' : 'var(--surface)' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)', marginBottom: 4 }}>₹{p.price}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--gray400)' }}>/{p.billingCycle === 'Yearly' ? 'yr' : 'mo'}</span></div>
                <div style={{ fontSize: 12, color: 'var(--gray400)', marginBottom: 8 }}>{p.description}</div>
                {p.name === s.plan && <span style={{ background: 'var(--blue)', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>Active</span>}
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ─── SuperAdmin: manage all company subscriptions ───────────────────────────
  return (
    <>
      <div className="page-header">
        <div><h2>Subscriptions</h2><p>Manage company subscriptions and plans</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Subscription</button>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">All Subscriptions</div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Plan</th>
                <th>Billing</th>
                <th>Start</th>
                <th>End</th>
                <th>Days Left</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.company_name}</strong></td>
                  <td>{s.plan_name}</td>
                  <td>
                    <span style={{ background: BILLING_COLORS[s.billing_cycle] || '#6B7280', color: '#fff', padding: '2px 7px', borderRadius: 10, fontSize: 11 }}>
                      {s.billing_cycle}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{s.start_date}</td>
                  <td style={{ fontSize: 12, color: s.days_remaining === 0 ? '#EF4444' : s.days_remaining <= 7 ? '#F59E0B' : 'inherit' }}>{s.end_date}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: s.days_remaining === 0 ? '#EF4444' : s.days_remaining <= 7 ? '#F59E0B' : '#10B981' }}>
                    {s.days_remaining === 0 ? '—' : s.days_remaining}
                  </td>
                  <td>
                    <span className="badge" style={{ background: STATUS_COLORS[s.effective_status] || '#6B7280', color: '#fff' }}>
                      {s.effective_status}
                    </span>
                  </td>
                  <td>₹{s.amount_paid}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button>
                  </td>
                </tr>
              ))}
              {!subs.length && <tr><td colSpan="9" style={{ textAlign: 'center', padding: 20, color: 'var(--gray400)' }}>No subscriptions yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Plans</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, padding: 16 }}>
          {plans.map(p => (
            <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--surface)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)', marginBottom: 4 }}>₹{p.price}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--gray400)' }}>/{p.billingCycle === 'Yearly' ? 'yr' : 'mo'}</span></div>
              <div style={{ fontSize: 11, color: 'var(--gray400)', marginBottom: 6 }}>{p.description}</div>
              <div style={{ fontSize: 11 }}>
                {p.maxOrders > 0 && <div>Orders: {p.maxOrders}/mo</div>}
                {p.maxUsers > 0 && <div>Users: {p.maxUsers}</div>}
                {p.maxOrders === 0 && <div style={{ color: '#10B981' }}>Unlimited</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={modal === 'form'} title={editSub ? 'Edit Subscription' : 'Add Subscription'} onClose={() => setModal(null)}
        footer={<>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </>}>
        <div className="form-grid">
          {!editSub && (
            <div className="form-group">
              <label>Company *</label>
              <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}>
                <option value="">-- Select Company --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Plan *</label>
            <select value={form.planId} onChange={e => { setForm(f => ({ ...f, planId: e.target.value })); autoEndDate(e.target.value, form.startDate) }}>
              <option value="">-- Select Plan --</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.price}/{p.billingCycle === 'Yearly' ? 'yr' : 'mo'}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => { setForm(f => ({ ...f, startDate: e.target.value })); autoEndDate(form.planId, e.target.value) }} />
            </div>
            <div className="form-group">
              <label>End Date *</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Payment Mode</label>
              <select value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}>
                <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option>
              </select>
            </div>
            <div className="form-group">
              <label>Amount Paid (₹)</label>
              <input type="number" value={form.amountPaid} onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option>Active</option><option>Trial</option><option>Expired</option><option>Cancelled</option><option>Suspended</option>
            </select>
          </div>
        </div>
      </Modal>
    </>
  )
}
