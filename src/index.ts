import { cookies } from "next/headers"
import { verifyToken } from "./core.js"

export type { SoupedClaims, SoupedConfig } from "./core.js"

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value

  if (!token) return null

  try {
    return await verifyToken(token)
  } catch {
    return null
  }
}
