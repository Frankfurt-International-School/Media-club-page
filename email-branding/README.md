# Sender avatar setup

The FIS logo inside the HTML email is already served from
`https://fismediaclub.org/assets/fis-logo.png`. The small profile image shown beside
the sender in an inbox is controlled by the mailbox provider, not by Resend's message
template.

## Current safe path

Use BIMI for a domain-wide sender avatar. The domain already has the important email
authentication foundation (Resend SPF/DKIM and an enforcing DMARC policy), but the
remaining BIMI steps require school/brand verification outside this repository:

1. Ask FIS for an approved, true-vector version of the logo and written confirmation
   that the Media Club may use it for authenticated school email. The supplied
   `FIS-LOGO.svg` is an SVG wrapper around a large embedded PNG, so it is not a valid
   SVG Tiny P/S BIMI logo and should not be published as one.
2. Obtain either a Common Mark Certificate (CMC) or Verified Mark Certificate (VMC)
   from a supported mark-verifying authority. Gmail requires one of these for BIMI;
   a VMC can additionally display Gmail's verified checkmark.
3. Have the authority produce/approve the SVG Tiny P/S logo and host the issued SVG
   and PEM certificate at stable public HTTPS URLs.
4. In Cloudflare DNS, add this record after the certificate URLs exist:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| `TXT` | `default._bimi.auth` | `v=BIMI1; l=https://CERTIFICATE-HOST/logo.svg; a=https://CERTIFICATE-HOST/certificate.pem;` | DNS only |

The selector above applies to mail sent from `@auth.fismediaclub.org`. Confirm with
the certificate authority whether it also wants an organizational-domain record at
`default._bimi.fismediaclub.org`.

Mailbox providers decide whether to display BIMI based on certification, domain
reputation, and their own product support, so publishing an uncertified logo alone
does not guarantee an avatar. Outlook currently does not support BIMI. A free
Gravatar is useful only for some third-party clients and requires a real receiving
mailbox for the exact sender address; `notifications@auth.fismediaclub.org` is a
Resend sending identity, not currently a receiving mailbox.
