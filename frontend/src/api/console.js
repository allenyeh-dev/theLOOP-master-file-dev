import { request } from './client'

const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const consoleApi = {
  listUsers: () => request('/api/console/users'),
  createUser: (p) => request('/api/console/users', json('POST', p)),
  updateUser: (id, p) => request(`/api/console/users/${id}`, json('PATCH', p)),
  deleteUser: (id) => request(`/api/console/users/${id}`, { method: 'DELETE' }),

  listRoles: () => request('/api/console/roles'),
  createRole: (p) => request('/api/console/roles', json('POST', p)),
  updateRole: (id, p) => request(`/api/console/roles/${id}`, json('PATCH', p)),
  deleteRole: (id) => request(`/api/console/roles/${id}`, { method: 'DELETE' }),

  listPermissions: () => request('/api/console/permissions'),
  createPermission: (p) => request('/api/console/permissions', json('POST', p)),
  updatePermission: (id, p) => request(`/api/console/permissions/${id}`, json('PATCH', p)),
  deletePermission: (id) => request(`/api/console/permissions/${id}`, { method: 'DELETE' }),
}
