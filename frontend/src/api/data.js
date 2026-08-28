import { request } from './client'

export function fetchRoles() {
  return request('/api/roles')
}

export function fetchAnnouncements() {
  return request('/api/announcements')
}
