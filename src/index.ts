import { cookies } from "next/headers"
import { verifyToken, getConfig, refreshAccessToken } from "./core.js"

export type { SoupedClaims, SoupedConfig } from "./core.js"

/**
 * Get the current user's session from the cookie.
 * If the access token is expired but a refresh token exists, it will
 * automatically refresh the session and update the cookies.
 * Returns `null` if not authenticated.
 */
export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value

  if (token) {
    try {
      return await verifyToken(token)
    } catch {
      // Token invalid/expired — try refresh below
    }
  }

  // Attempt refresh if we have a refresh token
  const refreshToken = cookieStore.get("souped_refresh")?.value
  if (!refreshToken) return null

  try {
    const config = getConfig()
    const tokens = await refreshAccessToken(config, refreshToken)

    cookieStore.set("session", tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: tokens.expires_in,
    })

    cookieStore.set("souped_refresh", tokens.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 24 * 60 * 60,
    })

    return await verifyToken(tokens.access_token)
  } catch {
    // Refresh token also invalid — clear everything
    cookieStore.delete("session")
    cookieStore.delete("souped_refresh")
    return null
  }
}

/**
 * Get the raw access token string from the session cookie.
 * Useful for passing to `getUserInfo()` or custom API calls.
 * Returns `null` if not authenticated.
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("session")?.value ?? null
}
