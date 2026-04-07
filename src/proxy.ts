import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken, getConfig, refreshAccessToken } from "./core.js"

type ProxyHandler = (
  request: NextRequest
) => Response | NextResponse | Promise<Response | NextResponse>

async function tryAuth(request: NextRequest): Promise<"ok" | NextResponse> {
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return "ok"
  }

  const session = request.cookies.get("session")?.value

  // Try verifying the existing session token
  if (session) {
    try {
      await verifyToken(session)
      return "ok"
    } catch {
      // Token invalid/expired — try refresh below
    }
  }

  // Attempt refresh if we have a refresh token
  const refreshToken = request.cookies.get("souped_refresh")?.value
  if (refreshToken) {
    try {
      const config = getConfig()
      const tokens = await refreshAccessToken(config, refreshToken)

      // Set new cookies and continue the request
      const response = NextResponse.next()
      response.cookies.set("session", tokens.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: tokens.expires_in,
      })
      response.cookies.set("souped_refresh", tokens.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 90 * 24 * 60 * 60,
      })
      return response
    } catch {
      // Refresh also failed — clear and redirect to login
    }
  }

  // No valid session — redirect to login with return_to
  const loginUrl = new URL("/api/auth/login", request.url)
  loginUrl.searchParams.set("return_to", request.nextUrl.pathname)
  const response = NextResponse.redirect(loginUrl)
  response.cookies.delete("session")
  response.cookies.delete("souped_refresh")
  return response
}

/**
 * Standalone proxy — use when you don't have existing proxy/middleware logic.
 *
 * ```ts
 * // src/proxy.ts
 * export { proxy } from "@souped-tools/auth-nextjs/proxy"
 * export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }
 * ```
 */
export async function proxy(request: NextRequest) {
  const result = await tryAuth(request)
  if (result !== "ok") return result
  return NextResponse.next()
}

/**
 * Composable wrapper — use when you have existing proxy/middleware logic.
 *
 * ```ts
 * // src/proxy.ts (Next.js 16+)
 * import { withSoupedAuth } from "@souped-tools/auth-nextjs/proxy"
 *
 * export const proxy = withSoupedAuth((request) => {
 *   // your custom logic here
 *   return NextResponse.next()
 * })
 * ```
 *
 * ```ts
 * // middleware.ts (Next.js 15)
 * import { withSoupedAuth } from "@souped-tools/auth-nextjs/proxy"
 *
 * export const middleware = withSoupedAuth((request) => {
 *   return NextResponse.next()
 * })
 * ```
 */
export function withSoupedAuth(handler: ProxyHandler): ProxyHandler {
  return async (request: NextRequest) => {
    const result = await tryAuth(request)
    if (result !== "ok") return result
    return handler(request)
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
