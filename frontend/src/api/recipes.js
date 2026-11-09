import { request } from './client'

const json = (method, body) => ({ method, body: JSON.stringify(body ?? {}) })

export const recipeApi = {
  library: () => request('/api/recipe-library'),
  libraryGet: (id) => request(`/api/recipe-library/${id}`),
  brands: () => request('/api/recipes/brands'),
  list: () => request('/api/recipes'),
  get: (id) => request(`/api/recipes/${id}`),
  create: (payload) => request('/api/recipes', json('POST', payload)),
  update: (id, payload) => request(`/api/recipes/${id}`, json('PUT', payload)),
  publish: (id) => request(`/api/recipes/${id}/publish`, json('POST')),
  remove: (id) => request(`/api/recipes/${id}`, { method: 'DELETE' }),
  aiTranslate: (content, target) => request('/api/recipes/ai/translate', json('POST', { content, target })),
  aiStructure: (text) => request('/api/recipes/ai/structure', json('POST', { text })),
}
