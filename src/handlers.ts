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

async function handleLogin(request: Request): Promise<Response> {
  const config = getConfig()
  const { verifier, challenge } = await generatePKCE()
  const state = generateState()
  const redirectUri = getCallbackUrl(request.url)
  const loginUrl = getAuthorizeUrl(config, redirectUri, state, challenge)

  const cookieStore = await cookies()

  // Save the URL the user came from so we can redirect back after login
  const returnTo = new URL(request.url).searchParams.get("return_to")
  if (returnTo) {
    cookieStore.set("souped_return_to", returnTo, {
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

    const destination = returnTo || "/"
    return NextResponse.redirect(new URL(destination, request.url))
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

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  if (path.endsWith("/login")) return handleLogin(request)
  if (path.endsWith("/callback")) return handleCallback(request)
  if (path.endsWith("/logout")) return handleLogout(request)

  return NextResponse.redirect(new URL("/api/auth/login", request.url))
}
