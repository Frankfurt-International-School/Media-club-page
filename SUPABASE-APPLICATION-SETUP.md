# Application review setup

Public applications are now submitted from `info.fismediaclub.org` through a
Turnstile-protected Edge Function. Complete `PUBLIC-PORTAL-SETUP.md` before testing
new applications; this document covers the staff review and invitation half of the
workflow.

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

Push the repository through GitHub Desktop and wait for both Cloudflare Pages projects
to finish. Submit the test application on `https://info.fismediaclub.org/#join` with
an alias email you control, then test:

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

## 6. Enable event and meeting subscription emails

The Crew Center can send one-to-one operational emails when production staff create
or update an upcoming event or meeting. Members opt in separately under **Settings >
Notifications**. Meeting delivery follows the same General, News Team, and Leadership
audience rules as the private Meetings page. New events go to opted-in student members.
For event updates, ordinary detail changes go only to opted-in members already signed
up; a newly opened role or increased capacity goes to every opted-in student member.
If a role closes or its capacity drops below an existing assignment, the affected
signup holder receives a personal warning to ask a Supervisor. Adult-grade members do
not receive event emails.

1. Re-run the complete `supabase-schema.sql` file, then the complete
   `supabase-auth-policies.sql` file in the SQL Editor. This adds the opt-in fields,
   event version timestamps, private delivery ledgers, and the server-side schedule
   snapshots used to explain exactly what changed. Existing members remain unsubscribed
   until they turn either email option on.
2. In Resend, create a new sending-only API key restricted to
   `auth.fismediaclub.org`. Keep it separate from the key stored in Supabase SMTP.
3. In **Supabase > Edge Functions > Secrets**, add:
   - `RESEND_API_KEY` = the new Resend API key
   - `SITE_URL` = `https://fismediaclub.org`
   - Optional: `NOTIFICATION_FROM_EMAIL` =
     `FIS Media Club <notifications@auth.fismediaclub.org>`
4. Deploy the complete `supabase/functions/send-schedule-notification/` directory,
   including both `index.ts` and `routing.ts`, as the `send-schedule-notification`
   function with JWT verification enabled.

With the Supabase CLI:

```sh
supabase secrets set RESEND_API_KEY=YOUR_SENDING_ONLY_KEY SITE_URL=https://fismediaclub.org
supabase functions deploy send-schedule-notification
```

Do not paste the API key into the repository or the browser configuration. The Edge
Function reads member email addresses using the service role, checks the caller's
production permission, recalculates the meeting audience, and sends each recipient a
separate message through Resend's individual email endpoint. Each message includes a
private `.ics` calendar invitation; Resend's batch endpoint cannot send attachments.
The function stays below the default API request rate and retries one rate-limited
request using Resend's response header. A private per-recipient ledger makes the same
saved version safe to retry without duplicate messages.

Test with one controlled member first:

1. Sign in as that member and enable **Email: event updates** and/or **Email: meeting
   updates** under Settings > Notifications.
2. Create an upcoming event as production staff. Confirm the UI reports one emailed
   subscriber and the message links to the saved event.
3. Schedule a News Team meeting. Confirm that an opted-in non-News-Team member does
   not receive it, while an opted-in current News Team member does.
4. Edit only the event details and confirm only its opted-in signup holders receive the
   update. Add a role or increase capacity and confirm every opted-in student receives
   the availability message. Remove an assigned role and confirm its affected signup
   holder receives the Supervisor warning without losing the signup.
5. Saving an already-completed or archived item does not email subscribers. Confirm the
   update email lists the changed fields and that opening the attached `.ics` file
   updates the same calendar entry rather than adding a duplicate.
