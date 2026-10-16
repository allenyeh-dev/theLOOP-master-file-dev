import { request } from './client'

export function fetchRoles() {
  return request('/api/roles')
}

export function fetchAnnouncements() {
  return request('/api/announcements')
}

export function fetchHappenings() {
  return request('/api/happenings')
}

export function fetchBrands() {
  return request('/api/brands')
}

export function fetchBrandNotices(brandId) {
  return request(`/api/brands/${brandId}/notices`)
}

export function fetchOpsBoard(brandId, date) {
  return request(`/api/brands/${brandId}/ops?date=${date}`)
}

export function saveOpsBoard(brandId, date, board) {
  return request(`/api/brands/${brandId}/ops?date=${date}`, { method: 'PUT', body: JSON.stringify(board) })
}
