import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCustomers, getProducts, createOrder, createCustomer, getCategories } from '../api/client'
import { today, fmtDate, fmtMoney } from '../utils'
import { useToast } from './Toast'
import { loadPrintSettings } from '../utils/printSettings'
import { buildReceiptData, printBluetooth, printUSB } from '../utils/printUtils'

export default function NewOrder() {
  const navigate = useNavigate()
  const toast = useToast()
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    custId: '', custName: '', mobile: '', customerType: 'Regular',
    entryDate: today(),
    deliveryDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    advance: 0, discount: 0, payMode: 'Cash',
  })

  useEffect(() => {
    getCustomers().then(setCustomers)
    getProducts().then(d => setProducts(d.filter(p => p.active)))
    getCategories().then(d => setCategories(d.filter(c => c.active)))
  }, [])

  const total = items.reduce((a, i) => a + (i.amount || 0), 0)
  const balance = Math.max(0, total - (parseFloat(form.discount) || 0) - (parseFloat(form.advance) || 0))

  function onCustSelect(val) {
    if (val === 'new') {
      setForm(f => ({ ...f, custId: '', custName: '', mobile: '', customerType: 'Regular' }))
      return
    }
    if (!val) return
    const c = customers.find(x => x.id == val)
    if (c) setForm(f => ({ ...f, custId: c.id, custName: c.name, mobile: c.mobile, customerType: c.customerType || 'Regular' }))
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
      if (field === 'product_name') {
        const p = products.find(x => x.name === val)
        if (p) { updated.category = p.category; updated.rate = p.price; updated.amount = p.price * item.qty }
      }
      if (field === 'qty') updated.amount = updated.rate * (parseFloat(val) || 1)
      if (field === 'rate') updated.amount = (parseFloat(val) || 0) * updated.qty
      if (field === 'amount') updated.amount = parseFloat(val) || 0
      return updated
    }))
  }

  async function save() {
    if (!form.custName || !form.mobile) { toast('Please fill customer details', 'danger'); return }
    if (items.length === 0) { toast('Add at least one item', 'danger'); return }
    setSaving(true)
    try {
      let custId = form.custId ? parseInt(form.custId) : null
      if (!custId && form.custName) {
        try {
          const nc = await createCustomer({ name: form.custName, mobile: form.mobile, address: '', email: '' })
          custId = nc.id
        } catch (ce) {
          if (ce.response?.status === 409) {
            // Mobile already registered — look up existing customer
            const existing = customers.find(x => x.mobile === form.mobile)
            if (existing) custId = existing.id
          } else { throw ce }
        }
      }
      const order = await createOrder({
        custId: custId,
        custName: form.custName,
        mobile: form.mobile,
        customerType: form.customerType || 'Regular',
        entryDate: form.entryDate,
        deliveryDate: form.deliveryDate,
        advance: parseFloat(form.advance) || 0,
        discount: parseFloat(form.discount) || 0,
        payMode: form.payMode,
        items: items.map(({ product_name, category, qty, rate, amount }) => ({ productName: product_name, category: category || 'General', qty: parseInt(qty) || 1, rate: parseFloat(rate), amount: parseFloat(amount) })),
      })
      toast('Order saved successfully!')
      await autoPrintOrder(order)
      navigate('/orders')
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to save order', 'danger')
    } finally {
      setSaving(false)
    }
  }

  async function autoPrintOrder(order) {
    const cfg = loadPrintSettings()
    if (!cfg.autoPrint) return

    const detail = {
      ...order,
      items: order.items || items.map(({ product_name, qty, amount }) => ({ productName: product_name, qty, amount })),
    }

    try {
      if (cfg.defaultMode === 'bluetooth') {
        const data = await buildReceiptData(detail, fmtDate, fmtMoney, cfg)
        await printBluetooth(data)
      } else if (cfg.defaultMode === 'usb') {
        const data = await buildReceiptData(detail, fmtDate, fmtMoney, cfg)
        await printUSB(data)
      } else {
        // Normal browser print
        const { paperSize, showLogo, footerText, copies } = cfg
        const pageW = paperSize === '58' ? '58mm' : '80mm'
        const logoHtml = showLogo ? `<div style="text-align:center"><img src="/logo.jpg" style="height:40px;object-fit:contain" /></div>` : ''
        const copyCount = Math.max(1, Math.min(3, Number(copies) || 1))
        let bodyHtml = ''
        for (let c = 0; c < copyCount; c++) {
          bodyHtml += `<div style="${c > 0 ? 'page-break-before:always' : ''}">
            ${logoHtml}<h2 style="text-align:center">WashMitra</h2>
            <p style="text-align:center;font-size:11px">Tax Invoice</p><hr>
            <div class="row"><span>Invoice No:</span><strong>${detail.id}</strong></div>
            <div class="row"><span>Date:</span><span>${fmtDate(detail.entryDate)}</span></div>
            <div class="row"><span>Customer:</span><span>${detail.custName}</span></div>
            <div class="row"><span>Mobile:</span><span>${detail.mobile}</span></div>
            <div class="row"><span>Delivery:</span><span>${fmtDate(detail.deliveryDate)}</span></div><hr>
            ${(detail.items || []).map(i => `<div class="row"><span>${i.productName} \xd7${i.qty}</span><span>₹${i.amount}</span></div>`).join('')}
            <hr>
            <div class="row"><span>Total:</span><strong>₹${detail.total}</strong></div>
            ${detail.discount > 0 ? `<div class="row"><span>Discount:</span><span>-₹${detail.discount}</span></div>` : ''}
            <div class="row"><span>Advance:</span><span>₹${detail.advance}</span></div>
            <div class="total"><span>Balance Due:</span><span>₹${detail.balance}</span></div>
            <p style="text-align:center;font-size:10px;margin-top:10px">${footerText}</p>
          </div>`
        }
        const w = window.open('', '_blank')
        w.document.write(`<html><head><title>Invoice ${detail.id}</title>
          <style>body{font-family:Arial;max-width:${pageW};margin:10px auto;font-size:12px}
          h2{font-size:16px}.row{display:flex;justify-content:space-between;padding:3px 0}
          .total{background:#000;color:#fff;padding:8px;display:flex;justify-content:space-between;font-weight:700}
          hr{border:none;border-top:1px dashed #ccc;margin:8px 0}
          @media print{@page{size:${pageW} auto;margin:4mm}}</style>
          </head><body>${bodyHtml}
          <script>window.print();window.close();<\/script></body></html>`)
      }
    } catch {
      // silent — don't block navigation on print error
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
              <input type="date" value={form.entryDate} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Expected Delivery Date</label>
              <input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
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
              <input
                type="text" placeholder="10 digit mobile" maxLength={10}
                value={form.mobile}
                onChange={e => {
                  const val = e.target.value
                  setForm(f => ({ ...f, mobile: val }))
                  if (val.length === 10) {
                    const c = customers.find(x => x.mobile === val)
                    if (c) setForm(f => ({ ...f, mobile: val, custId: c.id, custName: c.name, customerType: c.customerType || 'Regular' }))
                  }
                }}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Customer Name</label>
              <input type="text" placeholder="Customer name" value={form.custName} onChange={e => setForm(f => ({ ...f, custName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Customer Type</label>
              <select value={form.customerType} onChange={e => setForm(f => ({ ...f, customerType: e.target.value }))}>
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
              <thead><tr><th style={{ width: '30%' }}>Product Name</th><th style={{ width: '15%' }}>Category</th><th style={{ width: '12%' }}>Qty</th><th style={{ width: '15%' }}>Rate (₹)</th><th style={{ width: '15%' }}>Amount (₹)</th><th style={{ width: '8%' }}>Del</th></tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="text" list="product-list" placeholder="Type or pick product"
                        value={item.product_name}
                        onChange={e => updateItem(i, 'product_name', e.target.value)}
                      />
                      <datalist id="product-list">
                        {products.map(p => <option key={p.id} value={p.name} />)}
                      </datalist>
                    </td>
                    <td>
                      <select value={item.category} onChange={e => updateItem(i, 'category', e.target.value)}>
                        <option value="">-- Select --</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </td>
                    <td><input type="number" value={item.qty} min={1} onChange={e => updateItem(i, 'qty', e.target.value)} /></td>
                    <td><input type="number" value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} /></td>
                    <td><input type="number" value={item.amount} onChange={e => updateItem(i, 'amount', e.target.value)} style={{ fontWeight: 700 }} /></td>
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
              <label>Discount (₹)</label>
              <input type="number" value={form.discount} min={0} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group">
              <label>Advance Payment (₹)</label>
              <input type="number" value={form.advance} onChange={e => setForm(f => ({ ...f, advance: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Balance Amount (₹)</label>
              <input type="number" value={balance} readOnly />
            </div>
          </div>
          <div className="form-row-4" style={{ marginTop: 10 }}>
            <div className="form-group">
              <label>Payment Mode</label>
              <select value={form.payMode} onChange={e => setForm(f => ({ ...f, payMode: e.target.value }))}>
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
