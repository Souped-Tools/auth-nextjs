# Changelog

All notable changes to `@souped-tools/auth-nextjs` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-06-22

### Added

- **`publicRoutes` option** on `withSoupedAuth`. New overload:
  `withSoupedAuth({ publicRoutes: [...] }, handler?)`. Lists routes that should
  bypass OAuth (landing pages, marketing routes, public APIs, webhooks).
  `/api/auth/*` remains always-public regardless of the list.
- **Site-password gate support.** An optional, opt-in shared password (Vercel-
  style) that tapas the entire site before any rendering, orthogonal to OAuth.
  Activated from the Souped dashboard or via the `glaze_set_site_password` MCP
  tool. Requires Spark + a linked Vercel project. The SDK reads
  `process.env.SOUPED_SITE_GATE_ENABLED` at boot — zero runtime polling. The
  env var is pushed by Souped automatically on toggle.
- **`handleSitePasswordCallback`** handler at `/api/auth/site-password/callback`
  — exchanges the short-lived `gate_code` from Glaze for the long-lived gate
  cookie. Wired automatically when re-exporting `GET` from
  `@souped-tools/auth-nextjs/handlers`.
- **Boot-time warning** when the gate is enabled, to remind devs that the
  middleware matcher needs to be wide for full coverage.

### Notes

- **Not breaking.** The `withSoupedAuth(handler)` signature is preserved. Apps
  that don't migrate continue to behave exactly like v0.3.x. If the gate is
  later enabled by the owner, it only covers routes where the proxy actually
  runs — narrow matchers will leave some routes ungated.
- For full site coverage when the gate is on, your middleware should use a
  wide matcher (`["/((?!_next/static|_next/image|favicon.ico).*)"]`) and
  declare landing/marketing/webhook routes via `publicRoutes`. The
  boilerplate ships this config out of the box.

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
