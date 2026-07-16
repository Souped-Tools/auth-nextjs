import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import {
  getConfig,
  generatePKCE,
  generateState,
  getAuthorizeUrl,
  exchangeCode,
} from "./core.js"

function getCallbackUrl(requestUrl: string): string {
  const url = new URL(requestUrl)
  return `${url.origin}/api/auth/callback`
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
}

// Resolve a return_to value against the current origin and reject anything
// that lands off-site (absolute URLs, protocol-relative and backslash
// variants). Same guard as the site-password `next` param. Returns the
// resolved same-origin URL, or null if the value is missing or unsafe.
function safeReturnUrl(value: string | null | undefined, requestUrl: string): URL | null {
  if (!value) return null
  let resolved: URL
  try {
    resolved = new URL(value, requestUrl)
  } catch {
    return null
  }
  if (resolved.origin !== new URL(requestUrl).origin) return null
  return resolved
}

async function handleLogin(request: Request): Promise<Response> {
  const config = getConfig()
  const { verifier, challenge } = await generatePKCE()
  const state = generateState()
  const redirectUri = getCallbackUrl(request.url)
  const loginUrl = getAuthorizeUrl(config, redirectUri, state, challenge)

  const cookieStore = await cookies()

  // Save the URL the user came from so we can redirect back after login.
  // Only same-origin values are kept; anything that resolves off-site is
  // dropped here and re-checked at redirect time in handleCallback.
  const returnTo = safeReturnUrl(
    new URL(request.url).searchParams.get("return_to"),
    request.url,
  )
  if (returnTo) {
    cookieStore.set("souped_return_to", returnTo.pathname + returnTo.search + returnTo.hash, {
      ...COOKIE_OPTIONS,
      maxAge: 600,
    })
  }

  cookieStore.set("souped_verifier", verifier, { ...COOKIE_OPTIONS, maxAge: 600 })
  cookieStore.set("souped_state", state, { ...COOKIE_OPTIONS, maxAge: 600 })

  return NextResponse.redirect(loginUrl)
}

async function handleCallback(request: Request): Promise<Response> {
  const config = getConfig()
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  const cookieStore = await cookies()
  const storedState = cookieStore.get("souped_state")?.value
  const verifier = cookieStore.get("souped_verifier")?.value
  const returnTo = cookieStore.get("souped_return_to")?.value

  if (!code || !state || !storedState || state !== storedState || !verifier) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url))
  }

  try {
    const redirectUri = getCallbackUrl(request.url)
    const tokens = await exchangeCode(config, code, redirectUri, verifier)

    cookieStore.delete("souped_verifier")
    cookieStore.delete("souped_state")
    cookieStore.delete("souped_return_to")

    cookieStore.set("session", tokens.access_token, {
      ...COOKIE_OPTIONS,
      maxAge: tokens.expires_in,
    })

    cookieStore.set("souped_refresh", tokens.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 90 * 24 * 60 * 60, // 90 days (matches Souped refresh token TTL)
    })

    // Validate again at use time (defense in depth — the cookie is ours, but
    // cheap to re-check). Note the "/" fallback is usually the PUBLIC
    // landing: a login started without return_to drops the user back where
    // they came from, which reads as "login didn't work". Login links should
    // point at a gated route (the proxy fills return_to) or carry
    // ?return_to= explicitly — see "Post-login redirect" in the README.
    const destination =
      safeReturnUrl(returnTo, request.url) ?? new URL("/", request.url)
    return NextResponse.redirect(destination)
  } catch {
    return NextResponse.redirect(new URL("/api/auth/login", request.url))
  }
}

async function handleLogout(request: Request): Promise<Response> {
  const cookieStore = await cookies()
  cookieStore.delete("session")
  cookieStore.delete("souped_refresh")
  return NextResponse.redirect(new URL("/api/auth/login", request.url))
}

// Site-password gate callback. Receives `?gate_code=...&next=...`,
// exchanges the code server-side for the long-lived gate token, sets it
// as a cookie on this app's domain, then redirects to `next`.
async function handleSitePasswordCallback(request: Request): Promise<Response> {
  const config = getConfig()
  const url = new URL(request.url)
  const gateCode = url.searchParams.get("gate_code")
  const next = url.searchParams.get("next") ?? "/"

  if (!gateCode) {
    return NextResponse.json({ error: "missing_gate_code" }, { status: 400 })
  }

  // Validate `next` against the current origin to block open-redirects.
  let nextUrl: URL
  try {
    nextUrl = new URL(next, request.url)
  } catch {
    return NextResponse.json({ error: "invalid_next" }, { status: 400 })
  }
  if (nextUrl.origin !== url.origin) {
    return NextResponse.json({ error: "invalid_next" }, { status: 400 })
  }

  // Exchange the gate_code for the gate_token. Confidential-client style —
  // we send client_secret + redirect_uri so a stolen code (from logs,
  // referrers, browser history) can't be exchanged from somewhere else.
  let exchangeRes: Response
  try {
    exchangeRes = await fetch(`${config.soupedUrl}/auth/site-password/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        gate_code: gateCode,
        redirect_uri: next,
      }),
    })
  } catch {
    return NextResponse.redirect(
      new URL("/api/auth/site-password/login-failed", request.url),
    )
  }

  if (!exchangeRes.ok) {
    // Send the user back to the gate (via the service entry-point) with a
    // generic error param. The form page reads `?error=…` to show a banner.
    const gateUrl = new URL("/auth/site-password/start", config.soupedUrl)
    gateUrl.searchParams.set("client_id", config.clientId)
    gateUrl.searchParams.set("redirect_uri", nextUrl.toString())
    gateUrl.searchParams.set("error", "exchange_failed")
    return NextResponse.redirect(gateUrl)
  }

  const data = (await exchangeRes.json()) as {
    gate_token?: string
    maxAge?: number
  }
  if (!data.gate_token || typeof data.maxAge !== "number") {
    return NextResponse.json({ error: "invalid_exchange_response" }, { status: 502 })
  }

  const response = NextResponse.redirect(nextUrl)
  response.cookies.set("souped_site_gate", data.gate_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: data.maxAge,
  })
  return response
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // Exact-path dispatch. Avoids accidental matches like
  // `/api/auth/foo/callback` falling through to the OAuth handler.
  if (path === "/api/auth/site-password/callback") return handleSitePasswordCallback(request)
  if (path === "/api/auth/login")    return handleLogin(request)
  if (path === "/api/auth/callback") return handleCallback(request)
  if (path === "/api/auth/logout")   return handleLogout(request)

  return NextResponse.redirect(new URL("/api/auth/login", request.url))
}
