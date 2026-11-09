import { request } from './client'

const send = (path, method, body) => request(path, { method, body: JSON.stringify(body) })

export const fetchLogs = (date, brandId) =>
  request(`/api/logs?date=${date}${brandId ? `&brand_id=${brandId}` : ''}`)
export const createLog = (log) => send('/api/logs', 'POST', log)
export const updateLog = (id, log) => send(`/api/logs/${id}`, 'PUT', log)
export const deleteLog = (id) => request(`/api/logs/${id}`, { method: 'DELETE' })
