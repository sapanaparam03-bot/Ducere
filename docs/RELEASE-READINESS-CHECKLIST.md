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
- [ ] Missing posters and metadata have graceful fallbacks.
- [ ] CSV and JSON exports download and preserve non-English characters.
- [ ] Invalid or oversized imports are rejected clearly.
- [ ] A mismatched imported release year does not silently choose another adaptation.

## Supabase and account checks (requires an active project)
- [ ] Confirm the deployed schema matches the checked-in schema.
- [ ] Verify Row Level Security prevents access to another user's records.
- [ ] Register, sign in, refresh, and sign out.
- [ ] Confirm archive and profile persist after reload and on a second device.
- [ ] Test network failure and verify data is not silently lost.
- [ ] Test archive reset with a dedicated account.
- [ ] Test account deletion with a dedicated account and verify related records are removed.
- [ ] Verify Edge Function authentication, input validation, and server-only secrets.

## Streaming availability checks (requires deployed function and valid provider credentials)
- [ ] Test known titles and ambiguous title names.
- [ ] Test known and conflicting release years.
- [ ] Test more than one region and unsupported regions.
- [ ] Never show availability as verified when a lookup fails.
- [ ] Check subscription versus rental/purchase distinctions when provided by the data source.
- [ ] Verify provider links open the expected destination.
- [ ] Test missing and invalid API credentials without exposing secrets.

## Release gate
Do not describe Ducere as production-ready until repository checks pass and live account, data-isolation, deletion, and streaming checks are complete. Record the tested commit, date, device/browser, and failures.
