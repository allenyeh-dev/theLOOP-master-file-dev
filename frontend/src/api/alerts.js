import { request } from './client'

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) })

export const createServiceAlert = (alert) => post('/api/alerts/service', alert)
export const createEmergencyAlert = (alert) => post('/api/alerts/emergency', alert)
export const fetchActiveEmergencies = () => request('/api/alerts/emergency/active')
export const resolveEmergency = (id) => request(`/api/alerts/emergency/${id}/resolve`, { method: 'POST' })
