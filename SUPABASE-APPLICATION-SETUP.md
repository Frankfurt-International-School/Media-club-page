# Application review setup

## 1. Update the database

In Supabase, open **SQL Editor**, create a new query, paste the complete contents of
`supabase-schema.sql`, and click **Run**. The script uses `if not exists`, so it keeps
existing rows and adds the application review fields safely.

## 2. Configure authentication links

In Supabase, open **Authentication > URL Configuration**.

- Set **Site URL** to `https://media-club-page.pages.dev`
- Add `https://media-club-page.pages.dev/**` to **Redirect URLs**

The invitation link will return applicants to the Crew Center password setup screen.

## 3. Create the Edge Function

In Supabase, open **Edge Functions**, create a function named `review-application`,
and use the code from `supabase/functions/review-application/index.ts`. Keep JWT
verification enabled, then deploy the function.

With the Supabase CLI, the equivalent command is:

```sh
supabase functions deploy review-application
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied to
hosted Edge Functions by Supabase. Never put the service role key in frontend code.

## 4. Configure rejection email

Create a Resend account, verify a sending domain, and create an API key. In Supabase,
open **Edge Functions > Secrets** and add:

- `RESEND_API_KEY`: the Resend API key
- `FROM_EMAIL`: a verified sender, for example `Media Club <crew@your-domain.com>`
- `SITE_URL`: `https://media-club-page.pages.dev`

Approval emails use Supabase Auth's invitation template. You can edit that message in
**Authentication > Email Templates > Invite user**.

## 5. Publish and test

Push the repository through GitHub Desktop and wait for Cloudflare Pages to finish its
deployment. Submit a test application with an email address you control, then test:

1. Approve: the application disappears from Pending, a Member row is created, and an
   invitation email arrives. Its link opens the Set Password screen.
2. Reject: the admin must enter a reason. The application is marked rejected only after
   the decision email is accepted by Resend.

