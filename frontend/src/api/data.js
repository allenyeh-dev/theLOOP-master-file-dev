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

export function fetchPendingPushes() {
  return request('/api/happenings/pending')
}

export function ackPush(id) {
  return request(`/api/happenings/pushes/${id}/ack`, { method: 'POST' })
}
