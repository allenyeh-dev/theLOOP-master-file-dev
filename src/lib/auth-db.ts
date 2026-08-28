export interface Role {
  id: number
  key: string
  label: string
}

export interface AuthUser {
  id: number
  name: string
  email: string
  title: string | null
  role: Role
  permissions: string[]
}

export interface UserRow {
  id: number
  name: string
  email: string
  password_hash: string
  title: string | null
  is_active: number
  role_id: number | null
  role_key: string | null
  role_label: string | null
}

export interface SessionUserRow extends UserRow {
  expires_at: string
}

const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.password_hash, u.title, u.is_active,
         r.id as role_id, r.key as role_key, r.label as role_label
  FROM users u
  LEFT JOIN roles r ON r.id = u.role_id
`

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare(`${USER_SELECT} WHERE u.email = ?`).bind(email).first<UserRow>()
}

export async function getPermissionsForRole(db: D1Database, roleId: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT p.key FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?`
    )
    .bind(roleId)
    .all<{ key: string }>()
  return results.map((r) => r.key)
}

export function toAuthUser(row: UserRow, permissions: string[]): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    title: row.title,
    role: { id: row.role_id ?? 0, key: row.role_key ?? '', label: row.role_label ?? '' },
    permissions,
  }
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export async function createSession(
  db: D1Database,
  userId: number
): Promise<{ id: string; expiresAt: Date }> {
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)
  await db
    .prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(id, userId, expiresAt.toISOString())
    .run()
  return { id, expiresAt }
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run()
}

export async function findSessionUser(db: D1Database, sessionId: string): Promise<SessionUserRow | null> {
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.password_hash, u.title, u.is_active,
              r.id as role_id, r.key as role_key, r.label as role_label,
              s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE s.id = ?`
    )
    .bind(sessionId)
    .first<SessionUserRow>()
}
