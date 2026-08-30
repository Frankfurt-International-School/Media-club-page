# Application review setup

## 1. Update the database

In Supabase, open **SQL Editor**, create a new query, paste the complete contents of
`supabase-schema.sql`, and click **Run**. The script uses `if not exists`, so it keeps
existing rows and adds the application review fields safely.

## 2. Configure authentication links

In Supabase, open **Authentication > URL Configuration**.

- Set **Site URL** to `https://fismediaclub.org`
- Add `https://fismediaclub.org/` and `https://fismediaclub.org/signin` to
  **Redirect URLs**
- Keep `https://media-club-page.pages.dev/**` temporarily while the old production
  hostname remains reachable

The invitation link will return applicants to the Crew Center password setup screen.
The login page's **Forgot password?** button uses Supabase Auth directly and returns
members to `/signin` on the origin where the request was made. Send members to
`https://fismediaclub.org/signin` so new recovery links use the custom domain. The
password-reset request does not require an Edge Function.

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
Add `SITE_URL=https://fismediaclub.org` under **Edge Functions > Secrets** so
application-review invitations use the production domain. Secret changes are
available to hosted functions immediately; redeploy `review-application` whenever
its source code changes need to be applied to the live project.

## 4. Configure authentication email

Approval emails use Supabase Auth's invitation template, while member password resets
use its reset-password template. Paste the repository's branded
`email-templates/invite-user.html` and `email-templates/reset-password.html` files
into **Authentication > Emails > Templates > Invite user** and **Reset password**.
The matching subjects and exact installation steps are in
`email-templates/README.md`. Keep Supabase's secure `{{ .ConfirmationURL }}` variable
in both templates.

Production authentication email is sent through Resend using the verified
`auth.fismediaclub.org` subdomain. In **Authentication > Emails > SMTP Settings**, use:

- **Sender name:** `Media Club Crew Center`
- **Sender email:** `no-reply@auth.fismediaclub.org`
- **Host:** `smtp.resend.com`
- **Port:** `465`
- **Username:** `resend`
- **Password:** a Resend sending-only API key restricted to
  `auth.fismediaclub.org`

Store the API key only in Supabase's SMTP settings. Never commit it or put it in
frontend code. Keep Resend open and click tracking disabled so authentication links
are not rewritten. With this SMTP setup, Supabase owns the message template and
Resend delivers it; creating a template only in Resend does not update Supabase.
Using a Resend-hosted template would require a separate Supabase Send Email Hook.
Rejected applications are recorded in Supabase and the reviewer is reminded to email
the applicant manually.

## 5. Publish and test

Push the repository through GitHub Desktop and wait for Cloudflare Pages to finish its
deployment at `https://fismediaclub.org`. Submit a test application with an email
address you control, then test:

1. Approve: the application disappears from Pending, a Member row is created, and an
   invitation email arrives. Its link opens the Set Password screen.
2. Reject: the admin must enter a reason. The application is marked rejected and a
   notification reminds the reviewer to email the applicant manually.
3. Password reset: enter a member email on `https://fismediaclub.org/signin`, select
   **Forgot password?**, and confirm that the newest email link opens the Reset
   Password screen on `fismediaclub.org` before the dashboard. Recovery links are
   single-use.
4. Resend: confirm both messages are delivered from
   `Media Club Crew Center <no-reply@auth.fismediaclub.org>` and that SPF and DKIM
   pass in the provider logs.
