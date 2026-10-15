# Account deletion function deployment

Ducere's Settings page calls the Supabase Edge Function named `delete-account`.
The function verifies the caller's access token and derives the account ID from that token;
it never accepts a target user ID from the browser. Deleting the Auth user cascades to
the user's `profiles` and `user_titles` rows through the foreign keys in
`supabase-schema.sql`.

## Before it can work in production

1. Ensure the Supabase project is active and the current database schema has been applied.
2. Deploy `supabase/functions/delete-account/index.ts` as the Edge Function named
   `delete-account`.
3. Ensure these server-side function secrets are configured:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Test deletion with a dedicated test account, then verify the Auth user and its profile/archive
   rows are gone. Do not test with the owner's real account.

Example deployment from a trusted computer with the Supabase CLI authenticated:

```sh
supabase functions deploy delete-account --project-ref YOUR_PROJECT_REF
```

Never place the service-role key in Vite environment variables, browser code, or GitHub files.
The checked-in function only reads it from the Edge Function server environment.

## Failure behavior

The function returns a non-success status if the caller is not authenticated, required secrets
are missing, or Supabase cannot delete the account. A successful response means Supabase
accepted the Auth deletion; verify cascade behavior in the intended production schema before launch.
