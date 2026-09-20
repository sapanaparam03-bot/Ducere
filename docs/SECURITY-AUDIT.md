# Ducere — Security Audit

Last reviewed: 2026-09-20

## Scope

This is the practical application-security audit for the current production architecture: Vite/React frontend, Supabase Auth/Postgres/Edge Functions, Watchmode availability, and Vercel deployment.

The audit follows the current OWASP Top 10:2025 categories, including broken access control, security misconfiguration, software supply-chain failures, injection, authentication failures, and data-integrity risks.

## Findings

### Access control — PASS at database layer

- `public.profiles` has RLS enabled.
- `public.user_titles` has RLS enabled.
- Both tables restrict access to the authenticated user's own UUID.
- UPDATE policies include both a row ownership condition and a matching `WITH CHECK`, preventing reassignment of another user's rows.

### Edge Functions — PASS

- `watchmode-availability`: JWT verification enabled, version 3.
- `delete-account`: JWT verification enabled, version 2.
- Secret API credentials are read server-side from Edge Function environment variables.
- The browser client uses the Supabase publishable/anon key, not the service-role key.
- CORS was hardened from wildcard access to an explicit production/local development allowlist.
- Watchmode input now has title length and year validation.

### Secrets — PASS from repository scan

No service-role key or obvious secret credential was found in the searched repository source. `.env`, `.env.local`, and local environment variants are ignored by Git.

### Injection / unsafe DOM APIs — no obvious issue found

Repository searches found no use of `dangerouslySetInnerHTML`, `eval(`, direct `innerHTML`, or `document.cookie`.

This is a source-level review, not a penetration test.

### Authentication — PASS with one platform limitation

Supabase Auth handles authentication and sessions. Logout/sign-out is implemented, and sensitive account deletion is JWT protected.

Supabase's Security Advisor currently reports one warning:

**Leaked Password Protection is disabled.**

The current project plan does not expose this feature for activation. This is therefore recorded as a platform configuration limitation rather than silently ignored.

### Dependency / supply-chain — OPEN

The repository has a `package.json`, but no committed `package-lock.json` was found during this audit.

That means exact dependency resolution is not frozen in Git. Before a serious commercial release, generate and commit a lockfile and run dependency/security scanning against the frozen dependency tree.

### Logging / errors — PASS with normal production follow-up

The app avoids exposing secrets in user-facing errors and Edge Functions return generic failure messages. Server-side errors are logged for diagnosis.

A formal centralized monitoring/alerting system is not yet configured.

## Production hardening already applied

- Explicit CORS allowlist for production and local development.
- JWT requirement retained on both Edge Functions.
- Watchmode request validation.
- RLS ownership checks verified directly in PostgreSQL.
- Supabase Performance Advisor: 0 findings.
- Supabase Security Advisor: 1 known warning (leaked-password protection).

## What this does NOT prove

This audit is not a professional penetration test, bug bounty, SOC 2 audit, or guarantee of absence of vulnerabilities.

Final release QA should still include:
- authenticated browser testing;
- mobile testing;
- dependency audit with a committed lockfile;
- HTTPS/header inspection;
- rate-limit/abuse testing;
- penetration testing if required for commercial diligence.

## Current security conclusion

The core authorization model and server-side secret handling are in place. The remaining material technical security items are the dependency lockfile/audit, platform password-protection limitation, and full external security testing.
