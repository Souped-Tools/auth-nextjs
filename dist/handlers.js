import {
  exchangeCode,
  generatePKCE,
  generateState,
  getAuthorizeUrl,
  getConfig
} from "./chunk-7NTWS23R.js";

// src/handlers.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
function getCallbackUrl(requestUrl) {
  const url = new URL(requestUrl);
  return `${url.origin}/api/auth/callback`;
}
async function handleLogin(request) {
  const config = getConfig();
  const { verifier, challenge } = await generatePKCE();
  const state = generateState();
  const redirectUri = getCallbackUrl(request.url);
  const loginUrl = getAuthorizeUrl(config, redirectUri, state, challenge);
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600
  };
  cookieStore.set("souped_verifier", verifier, cookieOptions);
  cookieStore.set("souped_state", state, cookieOptions);
  return NextResponse.redirect(loginUrl);
}
async function handleCallback(request) {
  const config = getConfig();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get("souped_state")?.value;
  const verifier = cookieStore.get("souped_verifier")?.value;
  if (!code || !state || !storedState || state !== storedState || !verifier) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }
  try {
    const redirectUri = getCallbackUrl(request.url);
    const tokens = await exchangeCode(config, code, redirectUri, verifier);
    cookieStore.delete("souped_verifier");
    cookieStore.delete("souped_state");
    cookieStore.set("session", tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: tokens.expires_in
    });
    return NextResponse.redirect(new URL("/", request.url));
  } catch {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }
}
async function handleLogout(request) {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  return NextResponse.redirect(new URL("/api/auth/login", request.url));
}
async function GET(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.endsWith("/login")) return handleLogin(request);
  if (path.endsWith("/callback")) return handleCallback(request);
  if (path.endsWith("/logout")) return handleLogout(request);
  return NextResponse.redirect(new URL("/api/auth/login", request.url));
}
export {
  GET
};
