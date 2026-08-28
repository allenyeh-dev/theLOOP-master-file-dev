const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: JSON_HEADERS,
    ...options,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Request failed: ${res.status}`)
  }
  return data
}
