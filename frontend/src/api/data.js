import { request } from './client'

export function fetchRoles() {
  return request('/api/roles')
}

export function fetchAnnouncements() {
  return request('/api/announcements')
}

export function fetchPendingAnnouncements() {
  return request('/api/announcements/pending')
}

export function ackAnnouncement(id) {
  return request(`/api/announcements/${id}/ack`, { method: 'POST' })
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

export function removePopupFromLog(id) {
  return request(`/api/announcements/${id}/log`, { method: 'DELETE' })
}

export function fetchBrandPopups(brandId) {
  return request(`/api/brands/${brandId}/popups`)
}

export function fetchOpsBoard(brandId, date) {
  return request(`/api/brands/${brandId}/ops?date=${date}`)
}

export function saveOpsBoard(brandId, date, board) {
  return request(`/api/brands/${brandId}/ops?date=${date}`, { method: 'PUT', body: JSON.stringify(board) })
}

export function fetchPlaybook() {
  return request('/api/playbook')
}

export function setPlaybookRead(id, read) {
  return request(`/api/playbook/${id}/read`, { method: 'PUT', body: JSON.stringify({ read }) })
}
