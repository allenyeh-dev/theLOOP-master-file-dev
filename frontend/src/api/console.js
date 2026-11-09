import { request } from './client'

const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const consoleApi = {
  listUsers: () => request('/api/console/users'),
  createUser: (p) => request('/api/console/users', json('POST', p)),
  updateUser: (id, p) => request(`/api/console/users/${id}`, json('PATCH', p)),
  impersonateUser: (id) => request(`/api/console/users/${id}/impersonate`, { method: 'POST' }),
  deleteUser: (id) => request(`/api/console/users/${id}`, { method: 'DELETE' }),

  listBrands: () => request('/api/console/brands'),
  createBrand: (p) => request('/api/console/brands', json('POST', p)),
  updateBrand: (id, p) => request(`/api/console/brands/${id}`, json('PATCH', p)),
  deleteBrand: (id) => request(`/api/console/brands/${id}`, { method: 'DELETE' }),

  listSopDepartments: () => request('/api/console/sop-departments'),
  createSopDepartment: (p) => request('/api/console/sop-departments', json('POST', p)),
  updateSopDepartment: (id, p) => request(`/api/console/sop-departments/${id}`, json('PATCH', p)),
  deleteSopDepartment: (id) => request(`/api/console/sop-departments/${id}`, { method: 'DELETE' }),

  listSopCategories: () => request('/api/console/sop-categories'),
  createSopCategory: (p) => request('/api/console/sop-categories', json('POST', p)),
  updateSopCategory: (id, p) => request(`/api/console/sop-categories/${id}`, json('PATCH', p)),
  deleteSopCategory: (id) => request(`/api/console/sop-categories/${id}`, { method: 'DELETE' }),

  listUserManagers: () => request('/api/console/user-managers'),
  setUserManager: (userId, managerId) => request(`/api/console/user-managers/${userId}`, json('PUT', { manager_id: managerId })),

  sopReads: () => request('/api/console/sop-reads'),

  listHappenings: () => request('/api/console/happenings'),
  createHappening: (p) => request('/api/console/happenings', json('POST', p)),
  deleteHappening: (id) => request(`/api/console/happenings/${id}`, { method: 'DELETE' }),

  listAnnouncements: () => request('/api/console/announcements'),
  createAnnouncement: (p) => request('/api/console/announcements', json('POST', p)),
  updateAnnouncement: (id, p) => request(`/api/console/announcements/${id}`, json('PATCH', p)),
  announcementReaders: (id) => request(`/api/console/announcements/${id}/readers`),
  deleteAnnouncement: (id) => request(`/api/console/announcements/${id}`, { method: 'DELETE' }),

  listBrandNotices: () => request('/api/console/brand-notices'),
  createBrandNotice: (p) => request('/api/console/brand-notices', json('POST', p)),
  updateBrandNotice: (id, p) => request(`/api/console/brand-notices/${id}`, json('PATCH', p)),
  deleteBrandNotice: (id) => request(`/api/console/brand-notices/${id}`, { method: 'DELETE' }),

  listPlaybook: () => request('/api/console/playbook'),
  playbookReads: (id) => request(`/api/console/playbook/${id}/reads`),
  createPlaybookSection: (p) => request('/api/console/playbook', json('POST', p)),
  updatePlaybookSection: (id, p) => request(`/api/console/playbook/${id}`, json('PATCH', p)),
  deletePlaybookSection: (id) => request(`/api/console/playbook/${id}`, { method: 'DELETE' }),
  reorderPlaybook: (ids) => request('/api/console/playbook/order', json('PUT', { ids })),

  listRoles: () => request('/api/console/roles'),
  createRole: (p) => request('/api/console/roles', json('POST', p)),
  updateRole: (id, p) => request(`/api/console/roles/${id}`, json('PATCH', p)),
  deleteRole: (id) => request(`/api/console/roles/${id}`, { method: 'DELETE' }),

  listPermissions: () => request('/api/console/permissions'),
  createPermission: (p) => request('/api/console/permissions', json('POST', p)),
  updatePermission: (id, p) => request(`/api/console/permissions/${id}`, json('PATCH', p)),
  deletePermission: (id) => request(`/api/console/permissions/${id}`, { method: 'DELETE' }),
}
