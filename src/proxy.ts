import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken, getConfig, refreshAccessToken } from "./core.js"

type ProxyHandler = (
  request: NextRequest
) => Response | NextResponse | Promise<Response | NextResponse>

export interface SoupedAuthOptions {
  /**
   * Routes that should bypass OAuth authentication.
   * `/api/auth/*` is always public (handles the login flow itself).
   *
   * Default: [] — all routes covered by config.matcher require a session.
   * Use this for landing pages, marketing routes, public APIs, or webhook receivers.
   *
   * Patterns support Next.js matcher syntax: `"/blog/:slug*"`, `"/api/webhooks/:path*"`.
   *
   * @example
   * withSoupedAuth({ publicRoutes: ["/", "/pricing", "/api/webhooks/:path*"] })
   */
  publicRoutes?: string[]
}

// Read once at module load — no per-request fetch to Glaze, no cache to
// invalidate. The Souped dashboard sets this env var on the project's Vercel
// project (via Spark) and triggers a redeploy when the owner toggles the
// site-password gate. Mismo modelo que Vercel Password Protection.
const SITE_GATE_ENABLED = process.env.SOUPED_SITE_GATE_ENABLED === "true"

// Log once per cold-start when the gate is enabled. Helps devs/agents notice
// that a narrow matcher won't get full coverage — the gate only applies to
// routes where the proxy actually runs.
if (SITE_GATE_ENABLED && process.env.NODE_ENV !== "test") {
  // eslint-disable-next-line no-console
  console.warn(
    "[souped-auth] Site-password gate is enabled. Make sure your middleware " +
      "matcher covers all routes you want gated. Recommended default: " +
      '["/((?!_next/static|_next/image|favicon.ico).*)"]'
  )
}

function matchesPublicRoute(path: string, publicRoutes: string[]): boolean {
  for (const pattern of publicRoutes) {
    if (matchesPattern(path, pattern)) return true
  }
  return false
}

// Subset of Next.js matcher syntax that's enough for `publicRoutes` lists.
// Supports: exact paths, `:name`, `:name*` (zero+ path segments), `:name+`
// (one+ path segments). No groups, no regex — the matcher in `config.matcher`
// is the place for complex patterns; `publicRoutes` is for the human-readable
// allowlist.
function matchesPattern(path: string, pattern: string): boolean {
  // Convert `/blog/:slug*` → /^\/blog(?:\/.*)?$/
  // Convert `/blog/:slug`  → /^\/blog\/[^/]+$/
  // Convert `/`           → /^\/$/
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\/:(\w+)\*/g, "(?:/.*)?")
    .replace(/\/:(\w+)\+/g, "/.+")
    .replace(/:(\w+)/g, "[^/]+")
  const regex = new RegExp(`^${escaped}$`)
  return regex.test(path)
}

async function tryAuth(
  request: NextRequest,
  options: SoupedAuthOptions = {}
): Promise<"ok" | NextResponse> {
  const path = request.nextUrl.pathname

  // Short-circuit: /api/auth/* is always public — handles the OAuth callback
  // and the site-password callback (which would otherwise lock itself out).
  if (path.startsWith("/api/auth")) {
    return "ok"
  }

  // Step 1: site-password gate (if env var is set).
  if (SITE_GATE_ENABLED) {
    const gateCookie = request.cookies.get("souped_site_gate")?.value
    if (!gateCookie || !isGateCookieValid(gateCookie)) {
      return redirectToGate(request)
    }
  }

  // Step 2: publicRoutes — bypass OAuth for these paths.
  if (options.publicRoutes && matchesPublicRoute(path, options.publicRoutes)) {
    return "ok"
  }

  // Step 3: OAuth session check (unchanged from v0.3.x).
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

function redirectToGate(request: NextRequest): NextResponse {
  const config = getConfig()
  const gateUrl = new URL("/site-password", config.soupedUrl)
  gateUrl.searchParams.set("client_id", config.clientId)
  gateUrl.searchParams.set(
    "redirect_uri",
    `${request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`
  )
  return NextResponse.redirect(gateUrl)
}

// Light-touch validation: presence + expiration. The SDK does NOT verify the
// HMAC signature (no STATE_SIGNING_SECRET on the client). Glaze signed the
// token at /exchange; tampering with it just means the next round-trip fails
// — and the cookie is httpOnly so client-side JS can't see or rewrite it.
function isGateCookieValid(token: string): boolean {
  const dotIndex = token.lastIndexOf(".")
  if (dotIndex === -1) return false
  const payload = token.slice(0, dotIndex)
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { exp?: number; purpose?: string }
    if (decoded.purpose !== "site_gate") return false
    if (typeof decoded.exp !== "number") return false
    if (decoded.exp < Math.floor(Date.now() / 1000)) return false
    return true
  } catch {
    return false
  }
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
 * Two overloads:
 *   - `withSoupedAuth(handler)` — pre-existing, unchanged behavior.
 *   - `withSoupedAuth({ publicRoutes }, handler?)` — new in v0.4, lets you
 *     declare routes that bypass OAuth (e.g. landings, webhooks).
 *
 * ```ts
 * // src/proxy.ts (Next.js 16+)
 * import { withSoupedAuth } from "@souped-tools/auth-nextjs/proxy"
 *
 * export const proxy = withSoupedAuth(
 *   { publicRoutes: ["/", "/pricing", "/api/webhooks/:path*"] },
 *   (request) => NextResponse.next()
 * )
 * ```
 *
 * ```ts
 * // middleware.ts (Next.js 15)
 * import { withSoupedAuth } from "@souped-tools/auth-nextjs/proxy"
 *
 * export const middleware = withSoupedAuth(
 *   { publicRoutes: ["/"] },
 *   (request) => NextResponse.next()
 * )
 * ```
 */
export function withSoupedAuth(handler: ProxyHandler): ProxyHandler
export function withSoupedAuth(
  options: SoupedAuthOptions,
  handler?: ProxyHandler
): ProxyHandler
export function withSoupedAuth(
  optionsOrHandler: SoupedAuthOptions | ProxyHandler,
  maybeHandler?: ProxyHandler
): ProxyHandler {
  const isHandler = typeof optionsOrHandler === "function"
  const handler: ProxyHandler = isHandler
    ? (optionsOrHandler as ProxyHandler)
    : maybeHandler ?? (() => NextResponse.next())
  const options: SoupedAuthOptions = isHandler
    ? {}
    : (optionsOrHandler as SoupedAuthOptions)
  return async (request: NextRequest) => {
    const result = await tryAuth(request, options)
    if (result !== "ok") return result
    return handler(request)
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
