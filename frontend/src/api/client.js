import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getDashboardStats = () => api.get('/dashboard/stats').then(r => r.data)

export const getCustomers = () => api.get('/customers').then(r => r.data)
export const createCustomer = (data) => api.post('/customers', data).then(r => r.data)
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data).then(r => r.data)
export const deleteCustomer = (id) => api.delete(`/customers/${id}`).then(r => r.data)

export const getProducts = () => api.get('/products').then(r => r.data)
export const createProduct = (data) => api.post('/products', data).then(r => r.data)
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then(r => r.data)
export const deleteProduct = (id) => api.delete(`/products/${id}`).then(r => r.data)

export const getOrders = (params = {}) => api.get('/orders', { params }).then(r => r.data)
export const getOrder = (id) => api.get(`/orders/${id}`).then(r => r.data)
export const createOrder = (data) => api.post('/orders', data).then(r => r.data)
export const updateOrderStatus = (id, data) => api.put(`/orders/${id}/status`, data).then(r => r.data)

export const getSalesReport = (params = {}) => api.get('/reports/sales', { params }).then(r => r.data)
export const getDeliveryReport = (params = {}) => api.get('/reports/delivery', { params }).then(r => r.data)

export const getSettings = () => api.get('/settings').then(r => r.data)
export const updateSettings = (data) => api.put('/settings', data).then(r => r.data)

export default api
