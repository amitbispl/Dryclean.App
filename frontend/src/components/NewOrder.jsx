import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCustomers, getProducts, createOrder, createCustomer } from '../api/client'
import { today } from '../utils'
import { useToast } from './Toast'

export default function NewOrder() {
  const navigate = useNavigate()
  const toast = useToast()
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    cust_id: '', cust_name: '', mobile: '', customer_type: 'Regular',
    entry_date: today(),
    delivery_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    advance: 0, pay_mode: 'Cash',
  })

  useEffect(() => {
    getCustomers().then(setCustomers)
    getProducts().then(d => setProducts(d.filter(p => p.active)))
  }, [])

  const total = items.reduce((a, i) => a + (i.amount || 0), 0)
  const balance = Math.max(0, total - (parseFloat(form.advance) || 0))

  function onCustSelect(val) {
    if (val === 'new') {
      setForm(f => ({ ...f, cust_id: '', cust_name: '', mobile: '', customer_type: 'Regular' }))
      return
    }
    if (!val) return
    const c = customers.find(x => x.id == val)
    if (c) setForm(f => ({ ...f, cust_id: c.id, cust_name: c.name, mobile: c.mobile, customer_type: c.customer_type || 'Regular' }))
  }

  function addItem() {
    setItems(prev => [...prev, { product_name: '', category: '', qty: 1, rate: 0, amount: 0 }])
  }

  function removeItem(i) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateItem(i, field, val) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [field]: val }
      if (field === 'product_id') {
        const p = products.find(x => x.id == val)
        if (p) { updated.product_name = p.name; updated.category = p.category; updated.rate = p.price; updated.amount = p.price * item.qty }
      }
      if (field === 'qty') updated.amount = updated.rate * (parseFloat(val) || 1)
      if (field === 'rate') updated.amount = (parseFloat(val) || 0) * updated.qty
      return updated
    }))
  }

  async function save() {
    if (!form.cust_name || !form.mobile) { toast('Please fill customer details', 'danger'); return }
    if (items.length === 0) { toast('Add at least one item', 'danger'); return }
    setSaving(true)
    try {
      let custId = form.cust_id ? parseInt(form.cust_id) : null
      if (!custId && form.cust_name) {
        const nc = await createCustomer({ name: form.cust_name, mobile: form.mobile, address: '', email: '' })
        custId = nc.id
      }
      await createOrder({
        cust_id: custId,
        cust_name: form.cust_name,
        mobile: form.mobile,
        customer_type: form.customer_type || 'Regular',
        entry_date: form.entry_date,
        delivery_date: form.delivery_date,
        advance: parseFloat(form.advance) || 0,
        pay_mode: form.pay_mode,
        items: items.map(({ product_name, category, qty, rate, amount }) => ({ product_name, category, qty: parseInt(qty), rate: parseFloat(rate), amount: parseFloat(amount) })),
      })
      toast('Order saved successfully!')
      navigate('/orders')
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to save order', 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div><h2>New Order Entry</h2><p>Enter garment details when customer drops off clothes</p></div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Order Header</div></div>
        <div className="panel-body">
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Entry Date</label>
              <input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Expected Delivery Date</label>
              <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>Customer Select / Search</label>
              <select onChange={e => onCustSelect(e.target.value)}>
                <option value="">-- Select Customer --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.mobile}</option>)}
                <option value="new">+ Add New Customer</option>
              </select>
            </div>
            <div className="form-group">
              <label>Mobile No</label>
              <input type="text" placeholder="10 digit mobile" maxLength={10} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Customer Name</label>
              <input type="text" placeholder="Customer name" value={form.cust_name} onChange={e => setForm(f => ({ ...f, cust_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Customer Type</label>
              <select value={form.customer_type} onChange={e => setForm(f => ({ ...f, customer_type: e.target.value }))}>
                <option>Regular</option>
                <option>VIP</option>
                <option>Corporate</option>
                <option>Walk-in</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Products / Items</div>
          <button className="btn btn-outline btn-sm" onClick={addItem}>+ Add Item</button>
        </div>
        <div className="panel-body">
          <div className="table-wrap">
            <table className="prod-table">
              <thead><tr><th style={{ width: '35%' }}>Product</th><th style={{ width: '15%' }}>Category</th><th style={{ width: '12%' }}>Qty</th><th style={{ width: '15%' }}>Rate (₹)</th><th style={{ width: '15%' }}>Amount</th><th style={{ width: '8%' }}>Del</th></tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <select value={item.product_id || ''} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                        <option value="">-- Select --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                      </select>
                    </td>
                    <td><input type="text" value={item.category} readOnly /></td>
                    <td><input type="number" value={item.qty} min={1} onChange={e => updateItem(i, 'qty', e.target.value)} /></td>
                    <td><input type="number" value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} /></td>
                    <td><input type="number" value={item.amount} readOnly style={{ fontWeight: 700 }} /></td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => removeItem(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--gray400)', fontSize: 13 }}>No items. Click "+ Add Item" above.</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Payment Details</div></div>
        <div className="panel-body">
          <div className="form-row-4">
            <div className="form-group">
              <label>Total Amount (₹)</label>
              <input type="number" value={total} readOnly style={{ fontSize: 18, fontWeight: 700, color: 'var(--blue)' }} />
            </div>
            <div className="form-group">
              <label>Advance Payment (₹)</label>
              <input type="number" value={form.advance} onChange={e => setForm(f => ({ ...f, advance: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Balance Amount (₹)</label>
              <input type="number" value={balance} readOnly />
            </div>
            <div className="form-group">
              <label>Payment Mode</label>
              <select value={form.pay_mode} onChange={e => setForm(f => ({ ...f, pay_mode: e.target.value }))}>
                <option>Cash</option><option>UPI</option><option>Card</option><option>Credit</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => navigate('/')}>Cancel</button>
            <button className="btn btn-success" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : '✓ Save Order'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
