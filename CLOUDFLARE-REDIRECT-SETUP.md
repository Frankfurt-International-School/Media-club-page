# Redirect the old Pages address

Use an account-level Cloudflare Bulk Redirect for the generated Pages hostname. Do
not put this redirect in the repository's `_redirects` file: that file runs on both
hostnames and a host-agnostic redirect would loop on `fismediaclub.org`.

## Create the redirect

1. Open **Cloudflare > Workers & Pages > media-club-page > Custom domains** and
   confirm `fismediaclub.org` is Active.
2. Open **Bulk Redirects** at the account level and create a list named
   `media-club-canonical-domain`.
3. Add this redirect:

| Source URL | Target URL | Status |
| --- | --- | --- |
| `media-club-page.pages.dev` | `https://fismediaclub.org` | `301` |

4. Enable all four parameters for the entry:
   - Preserve query string
   - Subpath matching
   - Preserve path suffix
   - Include subdomains
5. Save the list, then create and enable a Bulk Redirect Rule that uses it.

## Verify

Test in a private browser window after the rule propagates:

- `https://media-club-page.pages.dev/signin` must become
  `https://fismediaclub.org/signin`.
- `https://media-club-page.pages.dev/signups?event=test` must become
  `https://fismediaclub.org/signups?event=test`.
- `https://fismediaclub.org` must continue to load without a redirect loop.

Keep the old `pages.dev` URL in Supabase's allowed redirect URLs temporarily so old
single-use authentication emails can finish safely. Remove it later after those old
links have expired and new invitation/recovery emails consistently use the custom
domain.
