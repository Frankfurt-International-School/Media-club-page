# Media Club Crew Center working instructions

## Project and source of truth

- Work in this repository: `/Users/shenghanlang/Documents/GitHub/Media-club-page`.
- Treat the checked-out code, SQL, tests, and setup documents here as the implementation source of truth.
- Inspect the relevant implementation before changing it. Preserve unrelated work and existing visual, authorization, and routing behavior.

## Connected services and plugins

- When a task depends on current hosted state, use an available connected service or plugin to inspect Supabase, Cloudflare, Resend, or another named provider instead of asking the user to copy dashboard details unnecessarily.
- Access is capability-specific, not blanket access. Confirm that the relevant connection and permission are actually available before claiming live visibility or a completed action.
- Read-only inspection is appropriate for diagnosis. Only mutate hosted data, authentication settings, DNS, deployments, email configuration, or other external state when the user's request clearly authorizes that exact action.
- Never place API keys, access tokens, passwords, private user data, or dashboard secrets in the repository, logs, commits, or user-facing output.
- Verify the project, account, environment, and exact target before any live change. Report what was changed and what remains local-only.

## Implementation boundaries

- Keep permission enforcement in Supabase RLS/RPC/Storage policies as well as the frontend. Do not rely on hidden UI alone for authorization.
- For changes spanning services, check every affected layer: frontend, schema, RLS, Storage, Cron, Edge Functions, email templates, CSP headers, and deployment configuration as applicable.
- Treat student and member information as personal data. Use the minimum data needed and avoid exposing records during debugging or in screenshots and logs.
- Preserve the existing extensionless Cloudflare Pages routes. Do not add manual `200` rewrites from `/name` to `/name.html`; Cloudflare's clean-URL handling can turn those rules into redirect loops.

## Verification and delivery

- Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run build:info` for relevant code changes. Also run `git diff --check`.
- Validate affected responsive UI in a rendered browser when presentation or interaction changes.
- Make concise, descriptive local commits after verified changes. Do not push, deploy, send production email, or apply live SQL unless the user explicitly asks.
- Clearly distinguish local code, committed code, pushed code, and live deployed state in the final response.
