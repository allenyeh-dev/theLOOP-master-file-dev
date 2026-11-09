import { request } from './client'

const post = (path, body, method = 'POST') => request(path, { method, body: JSON.stringify(body) })

export const fetchSchedule = (brandId, date) => request(`/api/schedule?brand_id=${brandId}&date=${date}`)
export const fetchStaff = (brandId) => request(`/api/schedule/staff?brand_id=${brandId}`)
export const addShift = (shift) => post('/api/schedule/shifts', shift)
export const deleteShift = (id) => request(`/api/schedule/shifts/${id}`, { method: 'DELETE' })
export const setPublished = (brandId, date, published) => post('/api/schedule/publish', { brand_id: brandId, date, published }, 'PUT')
export const copyLastWeek = (brandId, date) => post('/api/schedule/copy-last-week', { brand_id: brandId, date })
