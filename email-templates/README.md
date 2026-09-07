# Crew Center authentication email templates

These templates are for **Supabase Auth**, with Resend acting as Supabase's SMTP
delivery service. Creating a template only in the Resend dashboard will not change
emails sent by Supabase's built-in invitation and password-reset flows.

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

## Important details

- Keep `{{ .ConfirmationURL }}` exactly as written. Supabase replaces it with the
  recipient's secure, single-use action link.
- `password-changed.html` is a post-change security notification, so it intentionally
  has no `{{ .ConfirmationURL }}`. Its button opens the Crew Center sign-in page,
  where an affected user can request a fresh reset link.
- The header uses the email-compatible PNG at
  `https://fismediaclub.org/assets/fis-logo.png`. Publish the website before sending
  production emails if that URL is not yet reachable.
- The templates mirror the website's self-hosted Bebas Neue headings and Space
  Grotesk body text. Email-safe Arial fallbacks remain in place for clients that do
  not load custom web fonts.
- Leave Resend open and click tracking disabled so authentication URLs are not
  rewritten.
- Test with a fresh invitation and a fresh password-reset email. Use only the newest
  link and click it once.
- If a mail client blocks remote images, the header and call-to-action still retain
  their text and color treatment.

## When Resend dashboard templates would be used

Resend dashboard templates require the sender to call the Resend API with a published
template ID. For Supabase Auth, that means replacing the simple SMTP-only path with a
Supabase Send Email Hook. That provides more control, but it adds code, secrets, hook
configuration, and another authentication-email failure point. It is not required
for the Crew Center's current invitation and recovery emails.
