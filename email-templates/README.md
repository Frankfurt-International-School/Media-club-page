# Crew Center email templates

The invitation, password-reset and password-changed templates are for **Supabase
Auth**, with Resend acting as Supabase's SMTP delivery service.
Creating a template only in the Resend dashboard will not change emails sent by
those built-in Supabase Auth flows.

## Install in Supabase

In the hosted Supabase dashboard, open **Authentication > Emails > Templates**.

1. Open **Invite user**.
2. Set the subject to `You’re invited to the FIS Media Club Crew Center`.
3. Paste the complete contents of `invite-user.html` into the message editor and save.
4. Open **Reset password**.
5. Set the subject to `Reset your FIS Media Club Crew Center password`.
6. Paste the complete contents of `reset-password.html` into the message editor and
   save.
7. Open **Password changed** under the security notification templates and enable
   that notification if it is currently disabled.
8. Set the subject to `Your FIS Media Club password was changed`.
9. Paste the complete contents of `password-changed.html` into the message editor
   and save.

The next invitation or password-reset request will use the saved Supabase template
and will be delivered through the existing Resend SMTP connection. Nothing needs to
be uploaded to Resend for this setup.

## Application rejection email

`application-rejected.html` is the reviewable design reference for the private
application-decision email. It is not a Supabase Auth template and should not be
pasted into **Authentication > Emails > Templates**.

The deployed `review-application` Edge Function renders the matching production
layout from `supabase/functions/review-application/rejection-email.mjs`, safely
inserts the applicant's first name and the reviewer's reason, and submits the final
HTML and plain-text versions directly to Resend. No Resend dashboard template is
required, so the email design remains versioned with the function that sends it.

The function uses the `RESEND_API_KEY` Edge Function secret already configured for
schedule notifications. It sends from `APPLICATION_FROM_EMAIL` when that optional
secret is present, then falls back to `NOTIFICATION_FROM_EMAIL`, and finally to
`FIS Media Club <notifications@auth.fismediaclub.org>`.

## Important details

- Keep `{{ .ConfirmationURL }}` exactly as written. Supabase replaces it with the
  recipient's secure, single-use action link.
- `password-changed.html` is a post-change security notification, so it intentionally
  has no `{{ .ConfirmationURL }}`. Its button opens the Crew Center sign-in page,
  where an affected user can request a fresh reset link.
- The header uses the email-compatible PNG at
  `https://fismediaclub.org/assets/fis-logo.png`. Publish the website before sending
  production emails if that URL is not yet reachable.
- The templates use Arial with Helvetica and generic sans-serif fallbacks throughout.
  This avoids unreliable web-font loading and condensed fallback rendering in Gmail,
  Outlook, and mobile mail clients.
- Leave Resend open and click tracking disabled so authentication URLs are not
  rewritten.
- Test with a fresh invitation and a fresh password-reset email. Use only the newest
  link and click it once.
- Test application rejection with one controlled pending application. The application
  should remain pending if Resend refuses the message, and should become rejected only
  after Resend accepts it.
- If a mail client blocks remote images, the header and call-to-action still retain
  their text and color treatment.

## When other Resend dashboard templates would be used

Resend dashboard templates require the sender to call the Resend API with a published
template ID. For Supabase Auth, that means replacing the simple SMTP-only path with a
Supabase Send Email Hook. That provides more control, but it adds code, secrets, hook
configuration, and another authentication-email failure point. It is not required
for the Crew Center's current invitation and recovery emails.
