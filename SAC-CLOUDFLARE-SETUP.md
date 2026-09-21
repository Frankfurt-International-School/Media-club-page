# SAC Cloudflare setup

This guide prepares `sac.fismediaclub.org` as a dedicated entry point for the
Student Athletic Council workspace. It is a setup plan only. Creating the
custom domain, changing DNS, deploying code, and changing Supabase settings are
live operations and require explicit authorization.

## Recommended hosting model

Attach `sac.fismediaclub.org` to the existing private Crew Center Pages project,
`media-club-page`.

The SAC hostname should serve the same application and deployment as
`fismediaclub.org`. The application will use the hostname to open in SAC mode by
default, while the workspace switcher lets eligible members return to Media Club.
This avoids a second codebase and a second authentication system.

Keep public SAC information and the SAC membership-request entry point in the
public project at `info.fismediaclub.org/sac`. Do not expose the authenticated SAC
workspace, member directory, signups, or attendance through the public build.

This arrangement is reversible. If SAC later becomes a separate application,
the hostname can be detached from `media-club-page` and attached to a new Pages
project after that project is ready.

## Verified Cloudflare state

Read-only Cloudflare inspection on 21 September 2026 showed:

- `media-club-page` deploys from the `main` branch.
- `media-club-page.pages.dev` is the generated Pages hostname.
- `fismediaclub.org` is an active custom domain on `media-club-page`.
- `media-club-info` is the separate public Pages project.
- `info.fismediaclub.org` is attached to `media-club-info`.
- `sac.fismediaclub.org` is not currently attached to a Pages project.

Recheck this state immediately before making a live change.

## Fix the private Pages build before adding SAC

The private Crew Center repository already has a production build that copies
the deployable site to `dist` and fingerprints its CSS and JavaScript URLs. The
Pages project must publish that generated directory. Publishing the repository
root skips the fingerprints and can combine new HTML with an older stylesheet
that is still in a visitor's browser cache.

In **Cloudflare Dashboard > Workers & Pages > media-club-page > Settings >
Builds & deployments**, set the production build configuration to:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` or blank |

Save the settings, then start one new production deployment of the latest
`main` commit. In its build log, confirm that `npm run build` succeeds and that
Cloudflare uploads files from `dist`.

After deployment, inspect the live HTML. Stylesheet and script references must
contain a fingerprint query such as:

```text
crew-center.css?v=...
scripts/workspaces.js?v=...
```

If those references have no `?v=...`, stop: the project is still publishing the
repository root. Do not attach `sac.fismediaclub.org` until this is corrected.

The repository also sends `no-cache` response headers for the unversioned app
shell files as a fallback. That protects visitors from another mixed-version
screen, but it does not replace the correct `dist` build configuration.

## Prerequisites before adding the hostname

1. Deploy code that recognizes `sac.fismediaclub.org` and selects the SAC
   workspace after authentication.
2. Confirm that a member can still use the workspace switcher to open Media Club
   while visiting the SAC hostname.
3. Keep routes, assets, and internal links host-safe. Do not hard-code the main
   hostname for ordinary in-app navigation.
4. Keep canonical invitation and notification links on `https://fismediaclub.org`
   unless a specific SAC flow intentionally needs to return to the SAC hostname.
5. In Supabase Auth URL Configuration, add the exact production callback used by
   SAC password recovery. The current client sends recovery back to:

   ```text
   https://sac.fismediaclub.org/signin
   ```

   Add other exact SAC callback paths only when the application uses them.
   Supabase recommends exact production redirect URLs instead of broad wildcards.
6. Confirm that the SAC hostname does not appear in a Cloudflare DNS record,
   Worker Custom Domain, redirect rule, or another Pages project.
7. Confirm that any SAC Edge Function origin allowlist includes the exact SAC
   origin before invoking it from the new hostname.

## Add the Pages custom domain

Do this through the Pages project before manually creating a DNS record. A CNAME
alone, without associating the hostname with the Pages project, can return a 522.

1. Open **Cloudflare Dashboard > Workers & Pages**.
2. Open the existing **media-club-page** Pages project.
3. Open **Custom domains**.
4. Select **Set up a domain**.
5. Enter `sac.fismediaclub.org`.
6. Continue and review the proposed DNS record.
7. Because `fismediaclub.org` is already a Cloudflare-managed zone, allow Pages
   to create the proxied CNAME automatically.
8. Wait until both the domain and its certificate show **Active**.

If automatic DNS creation does not occur, first keep the domain associated with
the Pages project and then create this proxied record in the `fismediaclub.org`
zone:

| Type | Name | Target | Proxy status |
| --- | --- | --- | --- |
| CNAME | `sac` | `media-club-page.pages.dev` | Proxied |

Do not create a redirect from `sac.fismediaclub.org` to `fismediaclub.org`; that
would remove the dedicated SAC entry behavior. Do not add a hostname rewrite to
the repository's `_redirects` file. The same Pages application should answer both
hostnames directly.

## Supabase follow-up

After the Cloudflare hostname is active:

1. Keep the Supabase **Site URL** at the canonical private Crew Center URL,
   `https://fismediaclub.org`.
2. Add `https://sac.fismediaclub.org/signin` to the Auth Redirect URLs allowlist
   before testing password recovery from the SAC hostname.
3. Check every feature that derives a callback from `window.location.origin`.
4. Keep Edge Function `SITE_URL` at `https://fismediaclub.org` unless the product
   decision explicitly changes the canonical email destination.
5. Add `https://sac.fismediaclub.org` only to the origin allowlists of functions
   SAC actually calls.
6. Never place the Supabase service-role key or other server secrets in Pages
   variables or browser code.

Repository configuration does not install these hosted settings automatically.

## Verification

Use a private browser session after DNS and TLS become active.

1. Confirm the DNS record resolves:

   ```sh
   dig +short sac.fismediaclub.org
   ```

2. Check the root response and certificate:

   ```sh
   curl -I https://sac.fismediaclub.org
   ```

3. Confirm these routes load without redirect loops:

   ```text
   https://sac.fismediaclub.org/signin
   https://sac.fismediaclub.org/dashboard
   https://sac.fismediaclub.org/events
   https://sac.fismediaclub.org/signups
   https://sac.fismediaclub.org/meetings
   https://sac.fismediaclub.org/profile
   ```

4. Confirm an eligible Grade 9-or-above account opens in SAC mode.
5. Confirm the workspace switcher can open Media Club and return to SAC.
6. Confirm a Grade 8 account cannot use SAC signups even if it manipulates the
   URL or browser request.
7. Confirm a non-SAC Grade 9-or-above member is labelled **Media Club member** on
   an SAC signup.
8. Confirm an SAC member is labelled with the approved SAC/Dual Member identity.
9. Confirm only an SAC Leader, Faculty, or Auth Admin can create or modify an SAC
   event.
10. Request one controlled password-recovery email from the SAC hostname and
    confirm its link returns to the allowed SAC sign-in URL.
11. Confirm `fismediaclub.org` continues to open Media Club by default.
12. Confirm `info.fismediaclub.org` remains the separate public bundle and does
    not expose private SAC data.

## Rollback

If the SAC hostname must be removed from the current project:

1. In Cloudflare DNS, locate and remove only the `sac` CNAME created for Pages.
2. Open **Workers & Pages > media-club-page > Custom domains**.
3. Open the menu beside `sac.fismediaclub.org` and select **Remove domain**.
4. Remove the SAC recovery callback from the Supabase Auth allowlist after any
   outstanding single-use links have expired.
5. Verify that `fismediaclub.org` and `info.fismediaclub.org` remain unchanged.

## Moving SAC to a separate Pages project later

1. Build and verify the replacement project on its `pages.dev` hostname.
2. Configure its Supabase origins and redirect URLs without removing the existing
   hostname yet.
3. Schedule a short maintenance window because Pages custom-domain ownership and
   certificate activation may not transfer instantly.
4. Remove `sac.fismediaclub.org` from `media-club-page` and its old DNS record.
5. Add `sac.fismediaclub.org` through the replacement Pages project's **Custom
   domains** screen.
6. Wait for the domain and certificate to become Active.
7. Repeat the complete verification checklist before declaring the move live.

## References

- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- `CLOUDFLARE-REDIRECT-SETUP.md`
- `PUBLIC-PORTAL-SETUP.md`
