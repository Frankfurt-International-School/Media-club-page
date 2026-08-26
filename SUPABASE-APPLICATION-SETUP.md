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
The login page's **Forgot password?** button uses Supabase Auth directly and returns
members to `/signin` to choose a new password. It does not require an Edge Function.

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

## 4. Configure the invitation email

Approval emails use Supabase Auth's invitation template, while member password resets
use its reset-password template. You can edit those messages in **Authentication >
Email Templates > Invite user** and **Reset password**. Rejected applications are
recorded in Supabase and the reviewer is reminded to email the applicant manually; no
custom email domain or Resend account is required.

## 5. Publish and test

Push the repository through GitHub Desktop and wait for Cloudflare Pages to finish its
deployment. Submit a test application with an email address you control, then test:

1. Approve: the application disappears from Pending, a Member row is created, and an
   invitation email arrives. Its link opens the Set Password screen.
2. Reject: the admin must enter a reason. The application is marked rejected and a
   notification reminds the reviewer to email the applicant manually.
3. Password reset: enter a member email on `/signin`, select **Forgot password?**, and
   confirm that the email link opens the Reset Password screen before the dashboard.
