// Returns the de-duplicated ids if every one is an existing brand and at least
// one was given, otherwise null. Every user must belong to at least one brand.
export async function validBrandIds(db: D1Database, ids: unknown): Promise<number[] | null> {
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((n) => Number.isInteger(n))) return null
  const unique = [...new Set(ids as number[])]
  const { results } = await db
    .prepare(`SELECT id FROM brands WHERE id IN (${unique.map(() => '?').join(',')})`)
    .bind(...unique)
    .all<{ id: number }>()
  return results.length === unique.length ? unique : null
}

export function insertUserBrands(db: D1Database, userId: number, brandIds: number[]) {
  return brandIds.map((bid) =>
    db.prepare(`INSERT INTO user_brands (user_id, brand_id) VALUES (?, ?)`).bind(userId, bid)
  )
}

export function replaceUserBrands(db: D1Database, userId: number, brandIds: number[]) {
  return [
    db.prepare(`DELETE FROM user_brands WHERE user_id = ?`).bind(userId),
    ...insertUserBrands(db, userId, brandIds),
  ]
}

// Attaches `brands: [{id,key,label}]` to each user row, keyed by `id`.
export async function withBrands<T extends { id: number }>(db: D1Database, users: T[]) {
  const { results } = await db
    .prepare(
      `SELECT ub.user_id, b.id, b.key, b.label FROM user_brands ub
       JOIN brands b ON b.id = ub.brand_id
       ORDER BY b.sort_order, b.id`
    )
    .all<{ user_id: number; id: number; key: string; label: string }>()
  const byUser = new Map<number, { id: number; key: string; label: string }[]>()
  for (const r of results) {
    const list = byUser.get(r.user_id) ?? []
    list.push({ id: r.id, key: r.key, label: r.label })
    byUser.set(r.user_id, list)
  }
  return users.map((u) => ({ ...u, brands: byUser.get(u.id) ?? [] }))
}
