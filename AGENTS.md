# Media Club Crew Center working instructions

## Project and source of truth

- Work in this repository: `/Users/shenghanlang/Documents/GitHub/Media-club-page`.
- Treat the checked-out code, SQL, and tests here as the implementation source of truth.
- Inspect the relevant implementation before changing it. Preserve unrelated work and existing visual, authorization, and routing behavior.
- Keep searches, file reads, tool output, and updates focused on the current task without skipping required verification.
- Do not create or maintain progress plans or setup/tutorial Markdown unless the user asks. Do not read those guides routinely; consult a specific guide only when needed for the task.

## Connected services and plugins

- When a task depends on current hosted state, use an available connected service or plugin to inspect Supabase, Cloudflare, Resend, or another named provider instead of asking the user to copy dashboard details unnecessarily.
- Access is capability-specific, not blanket access. Confirm that the relevant connection and permission are actually available before claiming live visibility or a completed action.
- Read-only inspection is appropriate for diagnosis. Only mutate hosted data, authentication settings, DNS, deployments, email configuration, or other external state when the user's request clearly authorizes that exact action.
- Never place API keys, access tokens, passwords, private user data, or dashboard secrets in the repository, logs, commits, or user-facing output.
- Verify the project, account, environment, and exact target before any live change. Report what was changed and what remains local-only.
- Use the Supabase plugin for hosted inspection and authorized SQL changes, never computer use. Apply reviewed incremental migrations; do not automatically rerun complete schema or policy files.

## Implementation boundaries

- Keep permission enforcement in Supabase RLS/RPC/Storage policies as well as the frontend. Do not rely on hidden UI alone for authorization.
- For changes spanning services, check every affected layer: frontend, schema, RLS, Storage, Cron, Edge Functions, email templates, CSP headers, and deployment configuration as applicable.
- Treat student and member information as personal data. Use the minimum data needed and avoid exposing records during debugging or in screenshots and logs.
- Store and display student names as first name plus last-name initial (for example `Alex P.`), including applications, Auth metadata, attendance, booking snapshots, exports and messages. Keep UUIDs as identity keys. Only a trusted `Faculty` member row permits a full staff name; admin privileges or self-declared metadata do not. Collect only a surname initial on public applications, and use shortened student names in free text and media captions. Preserve the server-side minimization triggers and test them when changing identity data flows.
- Preserve the existing extensionless Cloudflare Pages routes. Do not add manual `200` rewrites from `/name` to `/name.html`; Cloudflare's clean-URL handling can turn those rules into redirect loops.

## Verification and delivery

- Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run build:info` for relevant code changes. Also run `git diff --check`.
- Validate affected responsive UI in a rendered browser when presentation or interaction changes.
- Make concise, descriptive local commits after verified changes. Do not push, deploy, send production email, or apply live SQL unless the user explicitly asks.
- Clearly distinguish local code, committed code, pushed code, and live deployed state in the final response.

## Daily Settings changelog

- Keep the changelog in the existing Settings section. `changelog.json` is the source; do not edit the generated `CREW CHANGELOG` block in `index.html` directly.
- Use one entry per Europe/Berlin workday, newest first, starting with coverage on 2026-10-09. Skip days without commits. Each entry contains one concise summary of the biggest user-facing improvement (at most 180 characters); the renderer adds the second bullet, “Fixed minor issues and improved user experience.” Do not list every commit or imply that local work has been deployed.
- Before the first commit of a new day, run `npm run changelog:check`. Review the Git subjects and relevant diffs for any missing completed workdays, especially yesterday, and add their summaries. The check uses committed workdays, so quiet days need no entry and a gap of several days still catches older omissions. Keep the coverage start date unchanged.
- During today's work, add or refine today's single entry when there is an improvement to report; consolidate later changes into that same summary. Run `npm run changelog:sync` after editing the data, then `npm run changelog:check` before every commit. The current day may remain unfinished; completed days must be covered. CI repeats this check with full Git history.
