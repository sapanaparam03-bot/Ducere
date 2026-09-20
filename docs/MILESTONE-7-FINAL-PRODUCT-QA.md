# Milestone 7 — Final Product QA

Status: Prepared and code-level QA complete; hands-on browser/device execution remains required.

## Verified from source
- Authentication and onboarding routes are present.
- Home, Discover, Library, Watchlist, Watching, History, Calendar, Title, Profile, Settings, Privacy, Terms, and About routes are wired.
- Archive export/import is wired.
- Account deletion is wired through a JWT-protected Edge Function.
- Responsive Tailwind classes and mobile navigation are present.
- Error boundary, loading state, empty states, and 404 state are present.
- No TODO/FIXME markers were found in the prior audit.

## Cannot be completed remotely
A real release QA pass requires an interactive browser session with a test account and device sizes. The available GitHub/Supabase integrations cannot replace that.

## Release test script
1. Sign up/sign in.
2. Complete onboarding.
3. Search a title.
4. Add to Watchlist.
5. Move to Watching and update episode/progress.
6. Mark Watched and rate.
7. Verify History and Profile stats.
8. Change country and subscription filters.
9. Verify title availability messaging.
10. Export JSON/CSV and re-import.
11. Open Privacy/Terms/About.
12. Delete the test account.
13. Repeat core flow on mobile viewport.
