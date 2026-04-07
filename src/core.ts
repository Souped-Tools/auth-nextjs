import { createRemoteJWKSet, jwtVerify } from "jose"

export interface SoupedConfig {
  clientId: string
  clientSecret: string
  soupedUrl: string
  appId: string
}

export interface SoupedClaims {
  sub: string
  email: string
  roles: string[]
  org: string
  project: string
  aud: string | string[]
  iat: number
  exp: number
}

let cachedConfig: SoupedConfig | null = null

export function getConfig(): SoupedConfig {
  if (cachedConfig) return cachedConfig

  const clientId = process.env.SOUPED_CLIENT_ID
  const clientSecret = process.env.SOUPED_CLIENT_SECRET
  const soupedUrl = process.env.SOUPED_URL
  const appId = process.env.SOUPED_APP_ID

  if (!clientId || !clientSecret || !soupedUrl || !appId) {
    throw new Error(
      "@souped-tools/auth-nextjs: Missing env vars. Set SOUPED_CLIENT_ID, SOUPED_CLIENT_SECRET, SOUPED_URL, and SOUPED_APP_ID."
    )
  }

  cachedConfig = { clientId, clientSecret, soupedUrl, appId }
  return cachedConfig
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJWKS(soupedUrl: string) {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${soupedUrl}/.well-known/jwks.json`))
  }
  return jwks
}

// --- PKCE ---

function randomHex(length: number): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain))
}

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function generatePKCE() {
  const verifier = randomHex(32)
  const challenge = base64url(await sha256(verifier))
  return { verifier, challenge }
}

export function generateState(): string {
  return randomHex(16)
}

// --- URLs ---

export function getAuthorizeUrl(
  config: SoupedConfig,
  redirectUri: string,
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  })
  return `${config.soupedUrl}/authorize?${params}`
}

// --- Token exchange ---

export async function exchangeCode(
  config: SoupedConfig,
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<{
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const res = await fetch(`${config.soupedUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Souped token exchange failed: ${res.status} ${text}`)
  }

  return res.json()
}

// --- Token refresh ---

export async function refreshAccessToken(
  config: SoupedConfig,
  refreshToken: string
): Promise<{
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const res = await fetch(`${config.soupedUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Souped token refresh failed: ${res.status} ${text}`)
  }

  return res.json()
}

// --- JWT verification ---

export async function verifyToken(token: string): Promise<SoupedClaims> {
  const { soupedUrl } = getConfig()
  const { payload } = await jwtVerify(token, getJWKS(soupedUrl))
  return payload as unknown as SoupedClaims
}
