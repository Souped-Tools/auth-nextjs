// src/core.ts
import { createRemoteJWKSet, jwtVerify } from "jose";
var cachedConfig = null;
function getConfig() {
  if (cachedConfig) return cachedConfig;
  const clientId = process.env.SOUPED_CLIENT_ID;
  const clientSecret = process.env.SOUPED_CLIENT_SECRET;
  const soupedUrl = process.env.SOUPED_URL;
  if (!clientId || !clientSecret || !soupedUrl) {
    throw new Error(
      "@souped/nextjs: Missing env vars. Set SOUPED_CLIENT_ID, SOUPED_CLIENT_SECRET, and SOUPED_URL."
    );
  }
  cachedConfig = { clientId, clientSecret, soupedUrl };
  return cachedConfig;
}
var jwks = null;
function getJWKS(soupedUrl) {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${soupedUrl}/.well-known/jwks.json`));
  }
  return jwks;
}
function randomHex(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(plain) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
}
function base64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function generatePKCE() {
  const verifier = randomHex(32);
  const challenge = base64url(await sha256(verifier));
  return { verifier, challenge };
}
function generateState() {
  return randomHex(16);
}
function getAuthorizeUrl(config, redirectUri, state, codeChallenge) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state
  });
  return `${config.soupedUrl}/authorize?${params}`;
}
async function exchangeCode(config, code, redirectUri, codeVerifier) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: config.clientId,
    client_secret: config.clientSecret
  });
  const res = await fetch(`${config.soupedUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Souped token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}
async function verifyToken(token) {
  const { soupedUrl } = getConfig();
  const { payload } = await jwtVerify(token, getJWKS(soupedUrl));
  return payload;
}

export {
  getConfig,
  generatePKCE,
  generateState,
  getAuthorizeUrl,
  exchangeCode,
  verifyToken
};
