import axios from 'axios'

const api = axios.create({ baseURL: (import.meta.env.VITE_API_BASE_URL || '') + '/api' })

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ─── AUTH ───────────────────────────────────────────────────────────────
export const login = (username, password) => api.post('/auth/login', { username, password }).then(r => r.data)
export const getMe = () => api.get('/auth/me').then(r => r.data)

// ─── COMPANIES ──────────────────────────────────────────────────────────
export const getCompanies = () => api.get('/companies').then(r => r.data)
export const createCompany = (data) => api.post('/companies', data).then(r => r.data)
export const updateCompany = (id, data) => api.put(`/companies/${id}`, data).then(r => r.data)

// ─── USERS ──────────────────────────────────────────────────────────────
export const getUsers = () => api.get('/users').then(r => r.data)
export const createUser = (data) => api.post('/users', data).then(r => r.data)
export const updateUser = (id, data) => api.put(`/users/${id}`, data).then(r => r.data)
export const deleteUser = (id) => api.delete(`/users/${id}`).then(r => r.data)
export const changePassword = (id, newPassword) => api.put(`/users/${id}/password`, { newPassword }).then(r => r.data)

// ─── DASHBOARD ──────────────────────────────────────────────────────────
export const getDashboardStats = () => api.get('/dashboard/stats').then(r => r.data)

// ─── CUSTOMERS ──────────────────────────────────────────────────────────
export const getCustomers = () => api.get('/customers').then(r => r.data)
export const createCustomer = (data) => api.post('/customers', data).then(r => r.data)
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data).then(r => r.data)
export const deleteCustomer = (id) => api.delete(`/customers/${id}`).then(r => r.data)

// ─── PRODUCTS ───────────────────────────────────────────────────────────
export const getProducts = () => api.get('/products').then(r => r.data)
export const createProduct = (data) => api.post('/products', data).then(r => r.data)
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then(r => r.data)
export const deleteProduct = (id) => api.delete(`/products/${id}`).then(r => r.data)

// ─── ORDERS ─────────────────────────────────────────────────────────────
export const getOrders = (params = {}) => api.get('/orders', { params }).then(r => r.data)
export const getOrder = (id) => api.get(`/orders/${id}`).then(r => r.data)
export const createOrder = (data) => api.post('/orders', data).then(r => r.data)
export const updateOrderStatus = (id, data) => api.put(`/orders/${id}/status`, data).then(r => r.data)

// ─── REPORTS ────────────────────────────────────────────────────────────
export const getSalesReport = (params = {}) => api.get('/reports/sales', { params }).then(r => r.data)
export const getDeliveryReport = (params = {}) => api.get('/reports/delivery', { params }).then(r => r.data)

// ─── SETTINGS ───────────────────────────────────────────────────────────
export const getSettings = () => api.get('/settings').then(r => r.data)
export const updateSettings = (data) => api.put('/settings', data).then(r => r.data)

// ─── SUBSCRIPTIONS ──────────────────────────────────────────────────────────
export const getSubscriptionPlans = () => api.get('/subscriptions/plans').then(r => r.data)
export const getSubscriptionStatus = () => api.get('/subscriptions/status').then(r => r.data)
export const getAllSubscriptions = () => api.get('/subscriptions').then(r => r.data)
export const getCompanySubscription = (id) => api.get(`/subscriptions/company/${id}`).then(r => r.data)
export const createSubscription = (data) => api.post('/subscriptions', data).then(r => r.data)
export const updateSubscription = (id, data) => api.put(`/subscriptions/${id}`, data).then(r => r.data)

export default api
