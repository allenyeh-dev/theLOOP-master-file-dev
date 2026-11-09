import { request } from './client'

export function fetchTasks(brandId) {
  return request(`/api/tasks?brand_id=${brandId}`)
}

export function createTask(task) {
  return request('/api/tasks', { method: 'POST', body: JSON.stringify(task) })
}

export function setTaskDone(id, done) {
  return request(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) })
}

export function deleteTask(id) {
  return request(`/api/tasks/${id}`, { method: 'DELETE' })
}

export function clearCompletedTasks(brandId) {
  return request(`/api/tasks/completed?brand_id=${brandId}`, { method: 'DELETE' })
}
