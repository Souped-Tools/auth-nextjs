# Changelog

All notable changes to `@souped-tools/auth-nextjs` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
