-- Evaluate session-wide roster checks once, while retaining per-member ownership.
alter policy "Read setup attendance" on public.event_setup_attendance
using (not (select public.is_visitor_session()) and (select auth.uid()) is not null
  and ((select public.is_admin_panel_user()) or member_id = (select public.current_member_id())));

-- Support cascade cleanup without scanning growing attendance and audit tables.
create index if not exists event_setup_attendance_marked_by_idx
  on public.event_setup_attendance (marked_by);
create index if not exists event_setup_attendance_history_event_idx
  on crew_private.event_setup_attendance_history (event_id);
create index if not exists event_setup_attendance_history_member_idx
  on crew_private.event_setup_attendance_history (member_id);
create index if not exists event_setup_attendance_history_actor_idx
  on crew_private.event_setup_attendance_history (actor_id);
