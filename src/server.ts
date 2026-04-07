import { getConfig } from "./core.js"
import type { SoupedClaims } from "./core.js"

export type { SoupedClaims }

// --- UserInfo ---

export interface SoupedUserInfo {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string | null
  roles: string[]
}

/**
 * Fetch fresh user data from Souped's `/userinfo` endpoint.
 * Uses the user's access token (from session cookie).
 *
 * ```ts
 * import { getSession } from "@souped-tools/auth-nextjs"
 * import { getUserInfo } from "@souped-tools/auth-nextjs/server"
 *
 * const session = await getSession()
 * const userInfo = await getUserInfo(session.accessToken)
 * // { sub, email, email_verified, name, roles }
 * ```
 */
export async function getUserInfo(accessToken: string): Promise<SoupedUserInfo> {
  const { soupedUrl } = getConfig()

  const res = await fetch(`${soupedUrl}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Souped userinfo failed: ${res.status} ${text}`)
  }

  return res.json()
}

// --- Users API ---

export interface SoupedAppUser {
  id: string
  email: string
  name: string | null
  email_verified: boolean
  roles: string[]
  joined_at: string
  last_active_at: string | null
}

export interface SoupedAppUsersResponse {
  data: SoupedAppUser[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

export interface GetAppUsersOptions {
  page?: number
  per_page?: number
  search?: string
  order_by?: "created_at" | "last_used_at" | "email"
  order?: "asc" | "desc"
}

function getBasicAuth(): string {
  const { clientId, clientSecret } = getConfig()
  return btoa(`${clientId}:${clientSecret}`)
}

function getUsersBaseUrl(): string {
  const { soupedUrl, appId } = getConfig()
  return `${soupedUrl}/api/apps/${appId}/users`
}

/**
 * List users of your app from Souped's Users API.
 * Authenticated server-side with `client_id` + `client_secret`.
 *
 * ```ts
 * import { getAppUsers } from "@souped-tools/auth-nextjs/server"
 *
 * const { data: users, pagination } = await getAppUsers({ page: 1, per_page: 20 })
 * ```
 */
export async function getAppUsers(
  options: GetAppUsersOptions = {}
): Promise<SoupedAppUsersResponse> {
  const params = new URLSearchParams()
  if (options.page) params.set("page", String(options.page))
  if (options.per_page) params.set("per_page", String(options.per_page))
  if (options.search) params.set("search", options.search)
  if (options.order_by) params.set("order_by", options.order_by)
  if (options.order) params.set("order", options.order)

  const qs = params.toString()
  const url = `${getUsersBaseUrl()}${qs ? `?${qs}` : ""}`

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${getBasicAuth()}` },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Souped users API failed: ${res.status} ${text}`)
  }

  return res.json()
}

/**
 * Get a single user by ID from Souped's Users API.
 * Authenticated server-side with `client_id` + `client_secret`.
 *
 * ```ts
 * import { getAppUser } from "@souped-tools/auth-nextjs/server"
 *
 * const user = await getAppUser("user-uuid")
 * // { id, email, name, email_verified, roles, joined_at, last_active_at }
 * ```
 */
export async function getAppUser(userId: string): Promise<SoupedAppUser> {
  const url = `${getUsersBaseUrl()}/${userId}`

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${getBasicAuth()}` },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Souped user lookup failed: ${res.status} ${text}`)
  }

  return res.json()
}
