# @souped-tools/auth-nextjs

Souped OAuth integration for Next.js. Adds authentication to your app in minutes.

## Setup

### 1. Create a Web App in Souped

Go to the [Souped dashboard](https://build.souped.app), create a Web App, and copy your credentials.

Set your allowed redirect URI to:
```
https://yourapp.com/api/auth/callback
```

For local development, also add:
```
http://localhost:3000/api/auth/callback
```

### 2. Install

```bash
npm install @souped-tools/auth-nextjs
```

### 3. Environment variables

Create a `.env.local` file:

```env
# OAuth client credentials from your Web App in the Souped dashboard.
SOUPED_CLIENT_ID=
SOUPED_CLIENT_SECRET=
# Souped project ID (UUID), shown in the dashboard next to your Web App.
SOUPED_APP_ID=
# Glaze auth API URL — NOT the marketing site or dashboard. The exact
# value depends on the environment your Souped project lives in; get it
# from `glaze_get_project_auth_setup` over MCP, or from the dashboard.
SOUPED_URL=

# Expected `aud` claim in issued JWTs. Get it from
# `glaze_get_project_auth_setup` (MCP) or the Souped dashboard.
SOUPED_AUDIENCE=

# Expected `iss` claim in issued JWTs (the platform's stable identity,
# not the API host above). Same source as SOUPED_AUDIENCE.
SOUPED_ISSUER=
```

All six variables are required as of `0.3.0` — the SDK throws at startup if any is missing. `SOUPED_AUDIENCE` and `SOUPED_ISSUER` enable standard OIDC `aud` / `iss` claim validation.

### 4. Add the auth routes

Create a catch-all route handler:

```ts
// src/app/api/auth/[...souped]/route.ts
export { GET } from "@souped-tools/auth-nextjs/handlers"
```

This creates three routes automatically:
- `GET /api/auth/login` — redirects to Souped login
- `GET /api/auth/callback` — handles the OAuth callback
- `GET /api/auth/logout` — clears the session

### 5. Protect your app

**Option A: No existing proxy/middleware (simplest)**

```ts
// src/proxy.ts (Next.js 16+) or middleware.ts (Next.js 15)
export { proxy } from "@souped-tools/auth-nextjs/proxy"

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

**Option B: You already have a proxy/middleware**

```ts
// src/proxy.ts (Next.js 16+)
import { withSoupedAuth } from "@souped-tools/auth-nextjs/proxy"
import { NextResponse } from "next/server"

export const proxy = withSoupedAuth((request) => {
  // your existing logic here
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

```ts
// middleware.ts (Next.js 15)
import { withSoupedAuth } from "@souped-tools/auth-nextjs/proxy"
import { NextResponse } from "next/server"

export const middleware = withSoupedAuth((request) => {
  // your existing logic here
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

That's it. Your app is now protected. Unauthenticated users are redirected to Souped to log in.

---

## Public routes

By default, every request that matches `config.matcher` requires a session — only `/api/auth/*` (the login flow itself) is hard-coded as public. For landing pages, marketing routes, public APIs, or webhook receivers, declare them explicitly via `publicRoutes`:

```ts
// src/proxy.ts
import { withSoupedAuth } from "@souped-tools/auth-nextjs/proxy"
import { NextResponse } from "next/server"

export const proxy = withSoupedAuth(
  {
    publicRoutes: ["/", "/pricing", "/blog/:slug*", "/api/webhooks/:path*"],
  },
  () => NextResponse.next(),
)

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

Patterns support Next.js matcher syntax: `:name`, `:name*`, `:name+`. Webhook routes are a common gotcha — Stripe/Resend/etc. hit them without a session, so list them explicitly or they'll redirect to login and fail.

Added in `0.4.0`. Backward-compatible with the previous `withSoupedAuth(handler)` signature.

---

## Reading the session

### Server components

```ts
import { getSession } from "@souped-tools/auth-nextjs"

export default async function Page() {
  const user = await getSession()
  // user: { sub, email, roles, org, project, aud, iat, exp } | null
  return <p>Hello, {user?.email}</p>
}
```

### Client components

Wrap your app with the provider (in a server component):

```tsx
// src/app/layout.tsx
import { getSession } from "@souped-tools/auth-nextjs"
import { SoupedProvider } from "@souped-tools/auth-nextjs/client"

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <html>
      <body>
        <SoupedProvider user={session}>
          {children}
        </SoupedProvider>
      </body>
    </html>
  )
}
```

Then use the hook in any client component:

```tsx
"use client"
import { useSession } from "@souped-tools/auth-nextjs/client"

export function UserGreeting() {
  const user = useSession()
  if (!user) return null
  return <p>Hello, {user.email}</p>
}
```

---

## API reference

### `@souped-tools/auth-nextjs`

| Export | Description |
|---|---|
| `getSession()` | Returns the validated user claims from the session cookie, or `null` |
| `SoupedClaims` | TypeScript type for the JWT claims |
| `SoupedConfig` | TypeScript type for the config object |

### `@souped-tools/auth-nextjs/handlers`

| Export | Description |
|---|---|
| `GET` | Route handler for `/api/auth/[...souped]` |

### `@souped-tools/auth-nextjs/proxy`

| Export | Description |
|---|---|
| `proxy` | Standalone proxy function — use when you have no existing proxy/middleware |
| `withSoupedAuth(handler)` | Wrapper — composes Souped auth with your existing proxy/middleware logic |
| `config` | Default matcher config |

### `@souped-tools/auth-nextjs/client`

| Export | Description |
|---|---|
| `SoupedProvider` | React context provider — pass `user` from `getSession()` |
| `useSession()` | Hook that returns the current user or `null` |
| `SoupedUser` | TypeScript type (`{ sub, email, roles }`) |

---

## JWT claims

The session contains these claims from Souped:

| Claim | Type | Description |
|---|---|---|
| `sub` | `string` | User ID (UUID) |
| `email` | `string` | User email |
| `roles` | `string[]` | Role names (e.g. `["User", "Admin"]`) |
| `org` | `string` | Organization slug |
| `project` | `string` | Project slug |
| `aud` | `string \| string[]` | Audience |
| `iat` | `number` | Issued at (Unix timestamp) |
| `exp` | `number` | Expiration (Unix timestamp) |

## Migrating from 0.2.x

`0.3.0` introduces standard OIDC claim validation: the SDK now checks the `aud` and `iss` claims of every JWT it receives, on top of the existing signature + expiry checks. Two env vars become required.

1. Get the audience and issuer for each project from `glaze_get_project_auth_setup` (over MCP) or the project's Auth page in the Souped dashboard.
2. Set `SOUPED_AUDIENCE` and `SOUPED_ISSUER` in every environment (local `.env.local`, Vercel preview, Vercel production, …) **before** upgrading the dependency. The SDK throws at startup if either is missing.
3. Bump `@souped-tools/auth-nextjs` to `^0.3.0` and redeploy.

Apps that stay on `^0.2.x` are unaffected — the upgrade is opt-in.

See [CHANGELOG.md](./CHANGELOG.md) for the full list of changes.

## License

MIT
