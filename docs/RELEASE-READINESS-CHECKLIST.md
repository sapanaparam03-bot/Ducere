# Ducere release-readiness checklist

Automated tests and a successful build do not prove that authentication, database persistence, or streaming lookups work in production.

## Repository checks
- [ ] npm ci
- [ ] npm test
- [ ] npm run typecheck
- [ ] npm run build
- [ ] Review GitHub Actions for the exact release commit.
- [ ] Review security workflow findings.
- [ ] Confirm service-role keys and provider secrets are not committed or bundled into browser code.

## Browser and mobile smoke test
Use a dedicated test account and sample data.
- [ ] App loads on desktop and Android-sized screens without console errors.
- [ ] Navigation works at narrow widths.
- [ ] Search works for movies, TV, and anime; loading, empty, and error states are clear.
- [ ] Adding a title and changing its status updates the library correctly.
- [ ] Episode progress, ratings, and reviews survive reload.
- [ ] Search does not show duplicate cards for the same title.
- [ ] Poster/artwork areas remain blank or use only the approved original Ducere neutral placeholder; no third-party poster, backdrop, still, thumbnail, logo or image URL is requested or rendered.
- [ ] Confirm there are no hidden poster/image dependencies in catalogue search, local storage, UI components, API responses or marketing assets.
- [ ] Verify every curated title field (including ratings, summaries, cast/crew, runtime and provider references) has documented provenance and permitted use; remove fields that cannot be cleared.
- [ ] CSV and JSON exports download and preserve non-English characters.
- [ ] Invalid or oversized imports are rejected clearly.
- [ ] A mismatched imported release year does not silently choose another adaptation.

## Supabase and account checks (requires an active project)
- [ ] Confirm the deployed schema matches the checked-in schema.
- [ ] Confirm anonymous clients have no table privileges on personal profile/archive tables.
- [ ] Verify Row Level Security prevents access to another user's records.
- [ ] If the Supabase plan supports it (Pro and above), enable leaked-password protection and confirm the security advisor warning is cleared; if staying on Free, document this as a plan limitation and retain strong password requirements.
- [ ] Register, sign in, refresh, and sign out.
- [ ] Request a password-reset email, open the link on the production domain, set a new password, and sign in with it.
- [ ] Confirm expired/invalid reset links show a recoverable error and do not create a second account.
- [ ] Confirm archive and profile persist after reload and on a second device.
- [ ] Test network failure and verify data is not silently lost.
- [ ] Test archive reset with a dedicated account.
- [ ] Test account deletion with a dedicated account and verify related records are removed.
- [ ] Verify Edge Function authentication, input validation, and server-only secrets.

## Community availability checks (requires reviewed community schema and moderation workflow)
- [ ] Confirm no Watchmode requests, SDKs, attribution labels, secrets or API data remain.
- [ ] Delete the retired Watchmode Edge Function and remove its API key from Supabase secrets.
- [ ] Apply the reviewed `supabase-community-availability.sql` only after a backup and schema review.
- [ ] Test authenticated report submission, one vote per user, reporter self-vote prevention and moderator-only verification.
- [ ] Test pending, verified, contested, rejected, expired and removed states.
- [ ] Verify only verified, unexpired claims are public and region-specific.
- [ ] Verify evidence URLs are HTTPS and are never fetched server-side.
- [ ] Verify provider links open the expected official destination.
- [ ] Test abuse limits, duplicate reports, audit history and appeal process.

## Security, privacy and legal release gate
- [ ] Publish a Privacy Policy and Terms of Service that accurately describe collection, use, processors, retention, deletion, international transfers, user rights, contact details and applicable age restrictions.
- [ ] Complete a jurisdiction-by-jurisdiction privacy review for launch markets, including India's DPDP framework and rules/commencement provisions then in force; obtain qualified legal review.
- [ ] Confirm every poster, backdrop, logo, font, icon, rating and promotional asset has documented rights for the intended display and commercial use. Public availability is not a licence.
- [ ] Confirm TVmaze CC BY-SA attribution and ShareAlike obligations are met before storing or redistributing derived catalogue data.
- [ ] Confirm Wikidata structured-data CC0 provenance and follow the Wikimedia API access policy; do not assume Wikipedia prose or Commons images are CC0.
- [ ] Verify rate limits or abuse controls for expensive external API calls; test repeated requests, oversized input, malformed JSON, and concurrent requests.
- [ ] Review browser security headers and CSP against actual production scripts, styles, API and image origins; add CSP only after compatibility testing.
- [ ] Enable repository secret scanning/dependency alerts where available; rotate any credential that was ever committed or exposed.
- [ ] Verify database backups/restore process and account deletion across Auth, database, exports and any other retained copies.
- [ ] Conduct an independent security review before public launch; automated CI and RLS checks are not a penetration test.

## Release gate
Do not describe Ducere as production-ready until repository checks pass and live account, data-isolation, deletion, and streaming checks are complete. Record the tested commit, date, device/browser, and failures.
