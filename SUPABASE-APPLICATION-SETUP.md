# Application review setup

Public applications are now submitted from `info.fismediaclub.org` through a
Turnstile-protected Edge Function. Complete `PUBLIC-PORTAL-SETUP.md` before testing
new applications; this document covers the staff review and invitation half of the
workflow.

## SAC application rollout (not yet live)

The public Join form can offer **Media Club**, **SAC**, or **Both**. SAC choices
require Grade 9–12 and an explicit declaration that the applicant is already a
current SAC member. This declaration is not proof: the reviewer must check the
real SAC roster before approval. SAC-only applicants do not answer Media Club
production questions. Existing Crew Center members check the existing-account
box and use the same FIS email; approval adds the missing tag without replacing
their existing membership or sending a second Auth invitation.

During a separately authorized rollout, apply `supabase-schema.sql`, then
`supabase-auth-policies.sql`, then `supabase-storage-policies.sql`. Deploy the
updated `submit-application`, `review-application`, and
`send-schedule-notification` Edge Functions, and only then publish both the
public info site and Crew Center builds. The media-team membership gate in
those policies and the email recipient filter prevent SAC-only accounts from
seeing or receiving Media Club operations. Keep `RESEND_API_KEY` configured for approval
emails to existing members. The Auth Admin sees all application types; Faculty
sees Media Club-only requests; the SAC President sees SAC-only requests on the
SAC dashboard. A combined application is reviewed only by Auth Admin. SAC and
combined requests are approved or permanently deleted after an explicit
warning; no rejection email is sent. Approval creates an in-app notification,
and sends an Auth invitation for a new account or an approval email for an
existing one. Delivery errors are shown to the reviewer without silently
reversing an already-approved membership.

Before inviting students to use the option, test a Grade 9 SAC-only application,
a dual application, an existing-member SAC application, and Grade 8/Adult SAC
rejection. Verify that an SAC-only approval has only the SAC tag and that a
Media Club-only approval has only the Media Club tag. Do not treat a selected
form option as authorization for SAC event sign-ups.

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
password-reset request does not require an Edge Function. If Supabase returns an
expired or invalid invitation/recovery link, the Crew Center clears the stale
password-setup state and explains that the member does **not** need to apply again.
They enter the FIS email used for their approved account and request a fresh
**reset-password email**. Supabase's password-recovery flow is used here; the
browser cannot resend an admin invitation. Members should open only the newest
link and check spam if the email is not in their inbox. The password form also
has a **Get another password link** escape route if the session expires while it
is open. The email request does not disclose whether an account exists.

## 3. Create the Edge Function

In Supabase, open **Edge Functions**, create a function named `review-application`,
paste the complete `supabase/functions/review-application/index.ts` file into the
editor, keep JWT verification enabled, and deploy it. The email renderer is included
inside `index.ts`, so dashboard deployment does not depend on another source file.

With the Supabase CLI, the equivalent commands are:

```sh
supabase secrets set RESEND_API_KEY=YOUR_SENDING_ONLY_KEY SITE_URL=https://fismediaclub.org
supabase functions deploy review-application
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied to
hosted Edge Functions by Supabase. Never put the service role key in frontend code.
Add `SITE_URL=https://fismediaclub.org` under **Edge Functions > Secrets** so
application-review invitations use the production domain. Rejection messages use
the `RESEND_API_KEY` sending-only key also used for schedule notifications. You may
set `APPLICATION_FROM_EMAIL` to a verified sender; otherwise the function uses
`NOTIFICATION_FROM_EMAIL` and then
`FIS Media Club <notifications@auth.fismediaclub.org>` as its fallback. Secret
changes are available to hosted functions immediately; redeploy `review-application`
whenever its source code changes.

## 4. Configure authentication email

New-account approvals use Supabase Auth's invitation template; existing-account
approvals use the Edge Function's Resend email and an in-app notification. Member password resets
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
Using a Resend-hosted template for an Auth email would require a separate Supabase
Send Email Hook. Application rejection is not an Auth email: the `review-application`
Edge Function renders its version-controlled template and sends the private message
through Resend's individual email endpoint. The reviewer's reason is escaped before
it enters the HTML message, and a plain-text version is included. The application is
marked rejected only after Resend accepts the email; on a delivery error it remains
pending so the reviewer can retry.

## 5. Publish and test

Push the repository through GitHub Desktop and wait for both Cloudflare Pages projects
to finish. Submit the test application on `https://info.fismediaclub.org/#join` with
an alias email you control, then test:

1. Approve: the application disappears from Pending, a Member row is created, and an
   invitation email arrives. Its link opens the Set Password screen.
2. Reject: the admin must enter a reason. Confirm that one private decision email
   arrives with that reason and that the application is then marked rejected. If the
   send fails, confirm the provider error appears and the application stays pending.
3. Password reset: enter a member email on `https://fismediaclub.org/signin`, select
   **Forgot password?**, and confirm that the newest email link opens the Reset
   Password screen on `fismediaclub.org` before the dashboard. Recovery links are
   single-use.
4. Expired link: open `/signin#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired` and confirm it explains what happened, asks only for the FIS email, offers **Email me a new password link**, and does not show the unusable password form. Also test **Get another password link** from the password screen and confirm it returns to the FIS-email recovery screen rather than leaving the user on password setup.
5. Resend: confirm the Auth messages are delivered from
   `Media Club Crew Center <no-reply@auth.fismediaclub.org>`, the rejection message
   uses the configured application/notification sender, and SPF and DKIM pass in the
   provider logs.

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

## 7. Prune old notification history safely

Do not drop any of the current `public` tables to shorten the Supabase table list.
They are application tables, even when their names describe delivery history.

Old completed or failed rows in `schedule_email_dispatches` are safe to prune after
the school's chosen retention period. Their related `schedule_email_deliveries` rows
are removed automatically by the foreign key's `on delete cascade`. Old notifications
may also be pruned after members have read them. This example keeps 90 days:

```sql
begin;

delete from public.schedule_email_dispatches
where status in ('completed', 'failed')
  and last_attempt_at < now() - interval '90 days';

delete from public.notifications
where read_at is not null
  and created_at < now() - interval '90 days';

commit;
```

Do not routinely clear `schedule_email_resource_states`: each row is the current
snapshot used to calculate what changed in the next event or meeting email. Only
orphaned snapshots whose source record was permanently deleted are safe to remove:

```sql
delete from public.schedule_email_resource_states state
where (
    state.resource_type = 'event'
    and not exists (select 1 from public.events event where event.id = state.resource_id)
  ) or (
    state.resource_type = 'meeting'
    and not exists (select 1 from public.meetings meeting where meeting.id = state.resource_id)
  );
```

`join_applications`, signups, attendance, meetings, events, equipment reservations,
gallery records, members and team memberships are business records rather than logs.
Retain or delete those only under an approved school data-retention decision. Supabase
platform logs shown in Logs Explorer are managed separately and are not these tables.
