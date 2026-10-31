import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import NewOrder from './components/NewOrder'
import Orders from './components/Orders'
import OrderStatus from './components/OrderStatus'
import Delivery from './components/Delivery'
import Reports from './components/Reports'
import Billing from './components/Billing'
import Products from './components/Products'
import Customers from './components/Customers'
import Settings from './components/Settings'
import { ToastProvider } from './components/Toast'
import { getOrders } from './api/client'
import { today } from './utils'

function AppRoutes() {
  const [overdueCnt, setOverdueCnt] = useState(0)

  useEffect(() => {
    getOrders().then(orders => {
      const cnt = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled' && o.delivery_date < today()).length
      setOverdueCnt(cnt)
    }).catch(() => {})
  }, [])

  return (
    <Layout overdueCnt={overdueCnt}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new-order" element={<NewOrder />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/status" element={<OrderStatus />} />
        <Route path="/delivery" element={<Delivery />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/products" element={<Products />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  )
}
