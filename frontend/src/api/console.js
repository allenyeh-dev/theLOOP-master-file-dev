import { request } from './client'

const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const consoleApi = {
  listUsers: () => request('/api/console/users'),
  createUser: (p) => request('/api/console/users', json('POST', p)),
  updateUser: (id, p) => request(`/api/console/users/${id}`, json('PATCH', p)),
  deleteUser: (id) => request(`/api/console/users/${id}`, { method: 'DELETE' }),

  listBrands: () => request('/api/console/brands'),
  createBrand: (p) => request('/api/console/brands', json('POST', p)),
  updateBrand: (id, p) => request(`/api/console/brands/${id}`, json('PATCH', p)),
  deleteBrand: (id) => request(`/api/console/brands/${id}`, { method: 'DELETE' }),

  listSopDepartments: () => request('/api/console/sop-departments'),
  createSopDepartment: (p) => request('/api/console/sop-departments', json('POST', p)),
  updateSopDepartment: (id, p) => request(`/api/console/sop-departments/${id}`, json('PATCH', p)),
  deleteSopDepartment: (id) => request(`/api/console/sop-departments/${id}`, { method: 'DELETE' }),

  listHappenings: () => request('/api/console/happenings'),
  createHappening: (p) => request('/api/console/happenings', json('POST', p)),
  deleteHappening: (id) => request(`/api/console/happenings/${id}`, { method: 'DELETE' }),

  listAnnouncements: () => request('/api/console/announcements'),
  createAnnouncement: (p) => request('/api/console/announcements', json('POST', p)),
  updateAnnouncement: (id, p) => request(`/api/console/announcements/${id}`, json('PATCH', p)),
  deleteAnnouncement: (id) => request(`/api/console/announcements/${id}`, { method: 'DELETE' }),

  listBrandNotices: () => request('/api/console/brand-notices'),
  createBrandNotice: (p) => request('/api/console/brand-notices', json('POST', p)),
  updateBrandNotice: (id, p) => request(`/api/console/brand-notices/${id}`, json('PATCH', p)),
  deleteBrandNotice: (id) => request(`/api/console/brand-notices/${id}`, { method: 'DELETE' }),

  listRoles: () => request('/api/console/roles'),
  createRole: (p) => request('/api/console/roles', json('POST', p)),
  updateRole: (id, p) => request(`/api/console/roles/${id}`, json('PATCH', p)),
  deleteRole: (id) => request(`/api/console/roles/${id}`, { method: 'DELETE' }),

  listPermissions: () => request('/api/console/permissions'),
  createPermission: (p) => request('/api/console/permissions', json('POST', p)),
  updatePermission: (id, p) => request(`/api/console/permissions/${id}`, json('PATCH', p)),
  deletePermission: (id) => request(`/api/console/permissions/${id}`, { method: 'DELETE' }),
}
