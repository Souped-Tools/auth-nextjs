# 0001 — `publicRoutes` and the site-password gate

Status: accepted (v0.4.0, 2026-06-22)

## Context

Souped projects need an optional "shared-password gate" — a single password that tapas the entire site before any rendering, à la Vercel Password Protection. Useful for pre-prod sites, demos, and staging shared with clients. Orthogonal to per-user OAuth.

For the gate to cover the whole site, the middleware proxy has to run on every request. The boilerplate's previous default matcher (`["/app/:path*", "/api/((?!auth).*)"]`) only ran on a subset, so the gate couldn't cover the landing or marketing pages.

A wide matcher (`["/((?!_next/static|_next/image|favicon.ico).*)"]`) solves that — but then every route runs `tryAuth`, which up to v0.3.x required an OAuth session for anything that wasn't `/api/auth/*`. Landing pages would break.

We needed a way to declare "this route runs the proxy but doesn't need a session".

## Decision

Two additive changes, no breaking signature:

1. **Add a `publicRoutes` option to `withSoupedAuth`.** New overload:
   `withSoupedAuth({ publicRoutes: [...] }, handler?)`. Routes that match a
   pattern in `publicRoutes` bypass the OAuth session check. `/api/auth/*`
   stays hard-coded as always-public.

2. **Read site-password state from `process.env.SOUPED_SITE_GATE_ENABLED`
   at boot.** No polling, no per-request fetch to Glaze. The Souped dashboard
   pushes the env var to the project's Vercel project (via Spark) and
   triggers a redeploy when the owner toggles the gate.

The previous `withSoupedAuth(handler)` signature is preserved — apps that don't migrate keep behaving exactly like v0.3.x.

## Why env var, not polling

Considered: have the SDK poll a `/auth/site-password/status` endpoint on Glaze with a short cache (e.g. 60s, fail-open).

Rejected because:
- Every app in production pays an extra network round-trip on cold-starts, regardless of whether the gate is ever used. The vast majority of Souped apps will never enable the gate.
- Each cold-start fetch adds 50–200ms of unconditional latency on the request path. For low-traffic apps with frequent cold lambdas, that's most requests.
- If Glaze is down, every Souped app's proxy starts timing out. Failure mode bleeds into apps that have nothing to do with the feature.
- Toggle latency under polling is the cache TTL (~60s); under env-var + redeploy it's the redeploy duration (~30s–2min). For a pre-prod feature, both are fine — and the env-var model is strictly cheaper on every dimension that matters in production.

The env-var model mirrors what Vercel itself does for Password Protection. The SDK reads it once at module load and the result is hard-coded into the request path. Zero overhead.

## Why not break the signature

Considered: bump `withSoupedAuth` to require `{ publicRoutes }`. Forces every consumer to update mentally, fail-closed on default.

Rejected because:
- Apps that don't enable the gate need zero new behaviour. Forcing them to refactor is wasted churn.
- Even apps that DO enable the gate: if their matcher is narrow, the gate still works for the routes that matcher covers. They're not unsafe — they're just under-covering. The boot warning nudges them.
- A breaking signature would make `pnpm up` a footgun. The SDK is public.

The two changes are additive. Backward-compatible. The boot warning is enough to surface the recommended migration path.

## Why no postinstall script

A postinstall banner would communicate the migration to devs/agents during `npm install`. We didn't add one because:

- Postinstall scripts widen the attack surface of an auth dependency. Not a good trade for a doc nudge.
- Many CI envs run `--ignore-scripts`. The banner wouldn't fire there anyway.
- The CHANGELOG, README, and the boot-time `console.warn` together cover the same ground without expanding the surface.

## Consequences

- Apps on v0.3.x can bump to v0.4 without code changes.
- Apps that want full site coverage when the gate is enabled have a small one-time migration (widen the matcher, declare `publicRoutes`).
- Apps that scaffold from `souped-boilerplate` ≥ v0.4 get the recommended config out of the box.
- Glaze gains three new endpoints (`/verify`, `/exchange`, `/status`) for the gate flow itself — those are NOT polled by the SDK at runtime; they're hit during the active gate ceremony (visitor submits the form, callback exchanges the code, glaze-ui consults `/status` once when rendering).
