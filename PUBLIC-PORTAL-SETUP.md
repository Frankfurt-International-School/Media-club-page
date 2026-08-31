# Public Media Club portal setup

The repository now produces two intentionally separate sites:

- `fismediaclub.org` — the private, authenticated Crew Center (`dist/`)
- `info.fismediaclub.org` — public About, sample dashboard, and Join portal (`dist-info/`)

The public build contains no Supabase browser client and no private Crew Center
scripts. Applications go through a dedicated Edge Function that validates
Cloudflare Turnstile before writing with the server-only service role.

## 1. Create the Turnstile widget

In Cloudflare, open **Turnstile**, select **Add widget**, choose **Managed**, and add
these hostnames:

- `info.fismediaclub.org`
- `media-club-info.pages.dev` (for testing the Pages deployment before DNS is live)

Copy the generated **site key** and **secret key**. The site key is safe in the
public Pages build. The secret key belongs only in Supabase Edge Function secrets.

## 2. Deploy the public application Edge Function

In Supabase, add these Edge Function secrets:

```text
TURNSTILE_SECRET_KEY=<the secret key from Cloudflare>
PUBLIC_PORTAL_ORIGINS=https://info.fismediaclub.org,https://media-club-info.pages.dev
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by
Supabase. Never copy the service role key into the website or Cloudflare Pages.

The repository's `supabase/config.toml` disables JWT verification only for
`submit-application`, because applicants do not have accounts yet, while keeping it
enabled for `review-application`. The public function performs its own strict origin,
Turnstile, input, and duplicate-email checks. Deploy it with:

```sh
supabase functions deploy submit-application
```

If deploying in the dashboard instead, create `submit-application` from
`supabase/functions/submit-application/index.ts` and turn off JWT verification for
that function only.

## 3. Close direct browser writes

Only after `submit-application` is live, run the complete contents of
`supabase-public-portal.sql` in Supabase SQL Editor. It removes direct application
inserts and revokes the retired visitor-preview RPCs. Staff can still read and
review applications through the existing authenticated policies.

## 4. Create the second Cloudflare Pages project

Create a new Pages project from the same GitHub repository. Use:

- **Project name:** `media-club-info`
- **Production branch:** `main`
- **Build command:** `node tools/build-info.mjs`
- **Build output directory:** `dist-info`
- **Environment variable:** `INFO_TURNSTILE_SITE_KEY=<the Turnstile site key>`

Do not point this project at `dist/`; that is the private Crew Center bundle.

After the first successful deployment, open **Custom domains**, add
`info.fismediaclub.org`, and let Cloudflare create the proxied DNS record and TLS
certificate. Because the domain and DNS are already in Cloudflare, the subdomain,
DNS record, Pages hosting, and standard TLS certificate cost **$0** on the current
free plans.

## 5. Retire anonymous Auth sign-ins

In Supabase Authentication settings, disable **Anonymous Sign-Ins**. The Crew Center
code no longer calls `signInAnonymously()`, but disabling the provider closes the
server-side route too.

If the earlier cleanup was not already run, inspect before deleting:

```sql
select id, created_at, last_sign_in_at
from auth.users
where is_anonymous is true
order by created_at desc;
```

Then remove only anonymous Auth users:

```sql
delete from auth.users
where is_anonymous is true;
```

Do not delete rows based only on a role label; approved member accounts must remain.

## 6. Production checks

1. Open `https://info.fismediaclub.org` in a private browser window.
2. Confirm navigation contains only About, Crew Center preview, Join, and Member sign in.
3. Confirm the sample dashboard says **Preview data only** and contains no real records.
4. Submit one controlled application with a valid FIS alias email.
5. Confirm it appears once under Pending applications in the private Crew Center.
6. Submit it again and confirm the duplicate-pending message appears.
7. Use an invalid alias and an `http://` work link and confirm both are rejected.
8. Confirm `https://fismediaclub.org/signin` has no visitor access button.
9. Confirm the member sign-in link on the public portal opens the private sign-in page.

For local rendering, build with Cloudflare's always-pass Turnstile test site key:

```sh
INFO_TURNSTILE_SITE_KEY=1x00000000000000000000AA node tools/build-info.mjs
```

Use the test secret only for local function testing, never as the production secret.
