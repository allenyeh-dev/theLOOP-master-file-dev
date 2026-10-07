import { request } from './client'

export function fetchAdminUsers() {
  return request('/api/admin/users')
}

export function createUser(payload) {
  return request('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUser(id, payload) {
  return request(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function fetchBrands() {
  return request('/api/admin/users/brands')
}
