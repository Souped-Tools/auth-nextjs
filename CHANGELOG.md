# Changelog

All notable changes to `@souped-tools/auth-nextjs` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-07-16

### Added

- **`SOUPED_POST_LOGIN_REDIRECT`** (optional env var, `postLoginRedirect`
  in `SoupedConfig`): where the callback redirects after login when no
  `return_to` was captured. Defaults to `/` as before. Set it to the
  app's gated entry route (e.g. `/app`) so a login started from a bare
  `/api/auth/login` link doesn't drop the user back on the public
  landing — the session was created, but landing on `/` reads as
  "login didn't work".

### Security

- **`return_to` values are now validated to be same-origin** — checked
  in `handleLogin` before the cookie is stored and again in
  `handleCallback` before the redirect. Values that resolve outside the
  app's origin are ignored and fall through to
  `SOUPED_POST_LOGIN_REDIRECT` / `/`. Upgrading is recommended.

## [0.4.1] - 2026-06-22

### Fixed

- Gate redirect now points at the service entry-point instead of the
  themed page directly. The previous build assumed the SDK could reach
  the gate UI under `SOUPED_URL`, which fails when the service and the
  UI live on different origins.

## [0.4.0] - 2026-06-22

### Added

- **`publicRoutes` option** on `withSoupedAuth`. New overload:
  `withSoupedAuth({ publicRoutes: [...] }, handler?)`. Lists routes that
  bypass OAuth (landing pages, marketing, public APIs, webhooks).
  `/api/auth/*` remains always-public regardless of the list.
- Optional support for the Souped site-password feature (opt-in by the
  project owner from the Souped dashboard).

### Notes

- Backward-compatible: the `withSoupedAuth(handler)` signature is
  preserved. Apps that don't migrate continue to behave exactly like
  v0.3.x.

## [0.3.1] - 2026-06-18

### Added

- The publish workflow now creates a matching `vX.Y.Z` GitHub release automatically after publishing to npm. Release notes are taken from this changelog when an entry for the version exists.

## [0.3.0] - 2026-06-18

### Added

- `SoupedConfig` now exposes `audience` and `issuer` fields, sourced from the new `SOUPED_AUDIENCE` and `SOUPED_ISSUER` env vars.
- `verifyToken` passes both values to `jose`'s `jwtVerify`, so JWTs are now checked against the expected `aud` and `iss` claims in addition to signature and expiry.
- Missing-env-var errors now list exactly which variables are unset, and flag a common typo (`SOUPED_PROJECT_ID` was sometimes used instead of `SOUPED_APP_ID`).

### Changed (BREAKING)

- `SOUPED_AUDIENCE` and `SOUPED_ISSUER` are required. The SDK throws at startup if either is missing (same path that already rejects missing `SOUPED_CLIENT_ID` / `SOUPED_CLIENT_SECRET` / `SOUPED_URL` / `SOUPED_APP_ID`).

### Migration

1. Get the audience and issuer for each project from `glaze_get_project_auth_setup` (over MCP) or the project's Auth page in the Souped dashboard.
2. Set `SOUPED_AUDIENCE` and `SOUPED_ISSUER` in every environment (local `.env.local`, Vercel preview, Vercel production, …) **before** upgrading the dependency.
3. Bump `@souped-tools/auth-nextjs` to `^0.3.0` and redeploy.

Apps that stay on `^0.2.x` are unaffected — the upgrade is opt-in.

## [0.2.4] - 2025-05-22

Last release of the `0.2.x` series. See git history for details.
