# Student Athletic Council implementation plan

This is the agreed implementation sequence for adding the Student Athletic
Council (SAC) to the existing Crew Center. SAC is an independent student service
group, not CAS. The authenticated Crew Center remains one application with two
workspaces; SAC membership never grants authority merely because of a hostname
or URL.

## Confirmed rules

- SAC membership is a dedicated `sac` membership tag.
- An SAC-only member has the `SAC` tag and no Media Club role tag or Media Club
  operating access.
- A dual member shows their existing Media Club role first and `SAC` second.
- Every SAC member has the base rank `SAC Member` and may hold at most one title:
  President, Vice President, Media Manager, Attendance Manager, or Club Manager.
- Athletics Intern is not an SAC title in this version.
- The SAC President appears in the existing directory's Leaders section with a
  distinct SAC-styled member card.
- Auth Admin, SAC President, and SAC Vice President may add or remove SAC
  membership and assign or remove an SAC title.
- Auth Admin and SAC President may review future SAC applications.
- Auth Admin, President, Vice President, Attendance Manager, and Club Manager may
  create future SAC events. Media Manager may not create events.
- SAC membership normally requires Grade 9–12. Only Auth Admin may deliberately
  override that rule.
- SAC removal keeps past signups, attendance, and the membership audit history.
- SAC applications will stay open, contain minimal questions, and state that SAC
  meets during lunch on B days.
- Applicants will choose Media Club, SAC, or both. Existing Crew Center members
  identify themselves with their school email so approval adds only the SAC tag.
- A rejected SAC application is deleted only after an explicit warning. SAC does
  not use the current rejection-email workflow.
- Future SAC signup sheets are time-slot-first, not role-first. Only current SAC
  members may claim a slot; Auth Admin may assign any SAC member, while SAC title
  holders may only sign up themselves.
- Nonmembers may see a locked preview and an invitation to apply, but not an
  actionable signup control. There is no separate Media Club discovery section.

## Delivery sequence

1. Preserve the existing Media Club, CAS, News Team, and Athletics behavior as
   separate concepts.
2. Add `media_club` and `sac` to canonical team memberships without converting
   the existing CAS membership.
3. Backfill existing directory members as Media Club members so later SAC-only
   accounts can be represented without inheriting Media Club access.
4. Add one nullable, constrained SAC title field to the SAC membership row.
5. Add a durable SAC membership audit log containing member and actor snapshots.
6. Audit SAC membership creation, title changes, and membership removal with a
   database trigger.
7. Add database capability functions for membership management, application
   review, and SAC event creation.
8. Route membership and title changes through one guarded RPC instead of direct
   browser writes.
9. Enforce Grade 9–12 inside that RPC and make the override Auth-Admin-only.
10. Return the SAC title from the protected member-directory function.
11. Add frontend capability helpers matching the database authority matrix.
12. Add directory tags for SAC-only and dual members without changing existing
   Media Club role data.
13. Place the SAC President after all Media Club leaders in the Leaders section
   and give that card a distinct treatment with the Warriors mark.
14. Add a focused membership editor for allowed managers, including the single
   title selector, grade warning, override acknowledgement, and change history.
15. Validate the foundation with database-policy, business-rule, desktop, and
   phone tests before applying any hosted migration.
16. Obtain and review the real initial SAC member list; do not infer or bulk-tag
   students before that list is supplied.
17. Apply the reviewed schema and policy migration to hosted Supabase in the
   documented order during a controlled rollout.
18. Import the initial SAC membership and title assignments, then verify every
   affected directory card and manager capability.
19. Extend the public application form with Media Club, SAC, and both choices,
   plus the existing-member school-email route.
20. Add the Grade 9–12 application rule and the B-day lunch meeting notice to the
   form and server-side submission validation.
21. Build the SAC application review queue for Auth Admin and SAC President,
   including approve, explicit-warning delete, and in-app plus email approval
   notification.
22. Add SAC event records and enforce the confirmed creator titles in database
   policies as well as the interface.
23. Support either a manually entered SAC event or an optional link to a Media
   Club livestream/event when schedules do not conflict.
24. Build automatic 30-minute signup intervals with an editable interval length,
   starting with Scoreboard and at least two spots per interval.
25. Enforce current SAC membership for every signup write, allow multiple
   non-overlapping slots, allow free cancellation, and omit a waitlist.
26. Add the locked nonmember preview and SAC application invitation, then test
   the complete application-to-membership-to-signup path on desktop and phone.
27. Add SAC meetings and an attendance view for the confirmed SAC leadership
   titles, keeping attendance scoped to the whole event unless later clarified.
28. Finish the SAC dashboard with its own member count and optimize every new
   application, directory, event, meeting, and signup state for phone screens.

## Current implementation boundary

Steps 1–15 and the application code in steps 19–21 are prepared locally. The
application choice, Grade 9–12 check, pending queue, SAC-only approval/delete,
approval notifications, and Media Club authorization isolation require the
updated schema, database and Storage policies, Edge Functions,
and both site builds to be deployed together. The reviewer must still verify
that a declared current SAC member is on the real roster before approval.
Steps 22–26 now have local SAC Events and Sign-up Sheets routes. Events can be
independent or linked to a Media Club livestream. The SAC sheet generates
30-minute Scoreboard shifts with two places by default, with per-event interval
and capacity settings editable before bookings exist. Current SAC members may
claim multiple non-overlapping shifts and freely cancel their own bookings;
Auth Admins may assign and cancel for any current SAC member. Membership,
capacity, and overlap are enforced in database functions and constraints, not
only in the interface. Eligible nonmembers see a locked schedule preview and
the SAC application link. Linked Media Club sign-up sheets point directly to
the matching SAC sheet. If an event schedule changes after booking, affected
bookings remain visible for review and cancellation rather than disappearing.
The SAC workspace also has local Members and My Shifts routes. Members shows
current SAC-tagged people, separate from Grade 9–12 workspace eligibility.
My Shifts shows a member's upcoming active bookings. Successful Scoreboard
claims are confirmed immediately, and the sheet reloads before announcing that
the booking is visible. SAC booking changes refresh open sheets through the
RLS-protected Realtime publication after the policy SQL is applied.
My Shifts also prepares a local calendar download for each of the member's own
upcoming active bookings. Each file uses the saved shift times, event title and
location, with a link to its sign-up sheet. Calendar copies must be updated or
removed manually after a booking changes or is cancelled. The export adds no
new database access or external calendar connection; hosted calendar downloads
and imports still need verification after deployment.
Steps 27–28 now also have local SAC Meetings and Attendance routes and a SAC
dashboard member count. The count uses current SAC tags, not Grade 9–12
workspace eligibility. Eligible members can view meeting schedules, while Auth
Admin, President, Vice President, Attendance Manager, and Club Manager can
create or edit meetings and record attendance. Each event roll contains members
with active Scoreboard bookings for that event, once per person. Each meeting
roll contains all current SAC members. Marks are Present, Late, Absent, and
Excused; no mark is shown as Not marked. Database functions enforce the roll
membership and allowed marks, and attendance is one mark per whole activity.
These features are not live until the new schema and policies are applied and
both site builds are deployed. Steps 16–18 (roster and hosted rollout) remain
follow-up work. Live authenticated testing of the new routes also remains.
The application-to-membership-to-signup path still needs a live authenticated
test after an approved rollout. No Cloudflare setting, deployment, hosted
Supabase schema, production member record, or live application is changed by
committing this plan.
