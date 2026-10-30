import { request } from './client'
import { getLang } from '../i18n/lang'

const json = (method, body) => ({ method, body: JSON.stringify(body ?? {}) })

// Shrink to <=1280px JPEG before upload so images stay small (D1 stores them).
async function shrink(file) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read this image'))), 'image/jpeg', 0.82))
}

export const sopImageUrl = (id) => `/api/sops/images/${id}`

export async function uploadSopImage(file) {
  let blob
  try {
    blob = await shrink(file)
  } catch {
    // Browser could not decode it (e.g. iPhone HEIC): send it as-is when it is already a small web image.
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1_500_000) {
      throw new Error('Cannot read this image — please use a JPG, PNG or WebP file')
    }
    blob = file
  }
  const res = await fetch('/api/sops/images', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': blob.type || 'image/jpeg', 'X-Lang': getLang() },
    body: blob,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.success) throw new Error(data?.error || `Upload failed: ${res.status}`)
  return data.id
}

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
  remove: (id) => request(`/api/sops/${id}`, { method: 'DELETE' }),
  versions: (id) => request(`/api/sops/${id}/versions`),
  restoreVersion: (id, versionId) => request(`/api/sops/${id}/versions/${versionId}/restore`, json('POST')),
  update: (id, payload) => request(`/api/sops/${id}`, json('PUT', payload)),
  submit: (id, aiReview, route) => request(`/api/sops/${id}/submit`, json('POST', { ai_review: aiReview, route })),
  myPrefs: () => request('/api/sops/my-prefs'),
  setFormView: (form_view) => request('/api/sops/my-prefs', json('PUT', { form_view })),
  myApprover: () => request('/api/sops/my-approver'),
  publish: (id) => request(`/api/sops/${id}/publish`, json('POST')),
  approve: (id, comment) => request(`/api/sops/${id}/approve`, json('POST', { comment })),
  reject: (id, comment) => request(`/api/sops/${id}/reject`, json('POST', { comment })),
  aiStructure: (text) => request('/api/sops/ai/structure', json('POST', { text })),
  aiCheck: (content) => request('/api/sops/ai/check', json('POST', { content })),
  aiTranslate: (content, target) => request('/api/sops/ai/translate', json('POST', { content, target })),
}
