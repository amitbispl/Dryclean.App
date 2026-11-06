import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import NewOrder from './components/NewOrder'
import Orders from './components/Orders'
import OrderStatus from './components/OrderStatus'
import Delivery from './components/Delivery'
import Reports from './components/Reports'
import Billing from './components/Billing'
import ScanStation from './components/ScanStation'
import Products from './components/Products'
import Customers from './components/Customers'
import Settings from './components/Settings'
import Users from './components/Users'
import Companies from './components/Companies'
import Subscriptions from './components/Subscriptions'
import Login from './components/Login'
import { ToastProvider } from './components/Toast'
import { getOrders } from './api/client'
import { today } from './utils'

function isTokenValid() {
  const token = localStorage.getItem('token')
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

function RequireAuth({ children }) {
  const location = useLocation()
  if (!isTokenValid()) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

function AppRoutes() {
  const [overdueCnt, setOverdueCnt] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    getOrders().then(orders => {
      const cnt = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled' && o.delivery_date < today()).length
      setOverdueCnt(cnt)
    }).catch(() => {})
  }, [])

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <RequireAuth>
          <Layout overdueCnt={overdueCnt}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new-order" element={<NewOrder />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/scan" element={<ScanStation />} />
              <Route path="/status" element={<OrderStatus />} />
              <Route path="/delivery" element={<Delivery />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/products" element={<Products />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/users" element={<Users />} />
              {user.role === 'SuperAdmin' && <Route path="/companies" element={<Companies />} />}
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </RequireAuth>
      } />
    </Routes>
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
