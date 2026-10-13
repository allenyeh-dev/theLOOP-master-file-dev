import { request } from './client'

const json = (method, body) => ({ method, body: JSON.stringify(body ?? {}) })

export const sopApi = {
  list: (scope = 'published') => request(`/api/sops?scope=${scope}`),
  get: (id) => request(`/api/sops/${id}`),
  edit: (id) => request(`/api/sops/${id}/edit`),
  departments: () => request('/api/sops/departments'),
  roles: () => request('/api/sops/roles'),
  markRead: (id) => request(`/api/sops/${id}/read`, json('POST')),
  flag: (id, reason) => request(`/api/sops/${id}/flag`, json('POST', { reason })),
  flags: () => request('/api/sops/flags'),
  resolveFlag: (id) => request(`/api/sops/flags/${id}/resolve`, json('POST')),
  categories: () => request('/api/sops/categories'),
  addCategory: (label) => request('/api/sops/categories', json('POST', { label })),
  create: (payload) => request('/api/sops', json('POST', payload)),
  update: (id, payload) => request(`/api/sops/${id}`, json('PUT', payload)),
  submit: (id, aiReview) => request(`/api/sops/${id}/submit`, json('POST', { ai_review: aiReview })),
  approve: (id, comment) => request(`/api/sops/${id}/approve`, json('POST', { comment })),
  reject: (id, comment) => request(`/api/sops/${id}/reject`, json('POST', { comment })),
  aiStructure: (text) => request('/api/sops/ai/structure', json('POST', { text })),
  aiCheck: (content) => request('/api/sops/ai/check', json('POST', { content })),
  aiTranslate: (content, target) => request('/api/sops/ai/translate', json('POST', { content, target })),
}
