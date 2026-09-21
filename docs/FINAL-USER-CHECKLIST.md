# Ducere — Final User Checklist

Everything the owner still needs to do. Technical work that can be completed remotely is documented in the repository.

## Do now

### 1. Browser QA
Open the deployed Ducere URL and test with a test account:
- Sign up / sign in / sign out
- Search a movie, TV show and anime
- Open title details
- Add/remove Watchlist
- Start Watching
- Update season/episode/progress
- Mark Watched
- Verify History
- Verify recommendations/discovery
- Change country
- Test streaming-service filters
- Test Where to Watch
- Test profile/settings
- Export JSON backup
- Export CSV
- Import a backup
- Test duplicate import behavior
- Test account deletion using a test account
- Open Privacy, Terms and About/Credits
- Check loading, empty and error states

### 2. Mobile QA
Repeat the important flows on:
- Android Chrome
- iPhone Safari, if available

Check navigation, touch targets, keyboard behavior, scrolling and layout.

### 3. Dependency lockfile
From the GitHub repository on a computer with Node/npm:
```bash
npm install
npm audit --audit-level=high
npm run typecheck
npm run build
```
Commit the generated `package-lock.json` and push it to `main`.

### 4. Deployment
After the lockfile commit, verify Vercel builds the latest `main` successfully and that the production URL opens normally.

## Do before public commercial launch

### 5. Provider rights
Confirm the exact commercial terms for Watchmode and any other production data/API provider. Keep written records.

### 6. Asset rights
Record the source and applicable license/terms for posters, backdrops, cast images and provider logos. Do not assume API availability equals ownership.

### 7. Name/trademark
Perform proper trademark/name clearance in the jurisdictions where Ducere will operate. A normal web search is not legal clearance.

### 8. Privacy/legal review
Have the final Privacy Policy and Terms reviewed for the intended launch jurisdictions before accepting paying customers or signing a transaction.

## Recommended before serious outreach

### 9. Monitoring
Connect an error/uptime monitoring service and configure alerts.

### 10. Real-user testing
Give the app to a small group of users and record usability issues and retention/usage metrics.

### 11. Load/abuse testing
Run controlled staging tests for search, availability, database writes, imports and repeated requests.

### 12. Final security review
Run the final dependency audit and, if commercial due diligence warrants it, an independent penetration test.

## Not needed yet

Do not spend money on incorporation, trademark registration, lawyers, paid monitoring, penetration testing or a custom domain solely to prepare a first informal product conversation. Do those when there is a concrete commercial reason.

## Important limitation

The Supabase Security Advisor currently has one warning: leaked-password protection is disabled. This is a plan-dependent Supabase Auth feature. The Performance Advisor currently has zero findings.
