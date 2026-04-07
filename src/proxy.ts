import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken } from "./core.js"

type ProxyHandler = (
  request: NextRequest
) => Response | NextResponse | Promise<Response | NextResponse>

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
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }

  const session = request.cookies.get("session")?.value

  if (!session) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url))
  }

  try {
    await verifyToken(session)
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(
      new URL("/api/auth/login", request.url)
    )
    response.cookies.delete("session")
    return response
  }
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
    if (request.nextUrl.pathname.startsWith("/api/auth")) {
      return NextResponse.next()
    }

    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.redirect(new URL("/api/auth/login", request.url))
    }

    try {
      await verifyToken(session)
      return handler(request)
    } catch {
      const response = NextResponse.redirect(
        new URL("/api/auth/login", request.url)
      )
      response.cookies.delete("session")
      return response
    }
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
