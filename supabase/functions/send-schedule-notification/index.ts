import { createClient } from "npm:@supabase/supabase-js@2";
import {
  eventAvailabilityChanges,
  eventRoleCapacities,
  routeEventUpdateRecipients,
  type EventSignupForRouting,
} from "./routing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type ResourceType = "event" | "meeting";
type NotificationAction = "created" | "updated";

type MemberRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  grade_level?: string | null;
  status: string;
  notification_preferences: Record<string, unknown> | null;
};

type ScheduleRecord = {
  id: string;
  title: string;
  location?: string | null;
  description?: string | null;
  agenda?: string | null;
  audience?: string | null;
  date?: string | null;
  starts_at?: string | null;
  ends_at: string;
  updated_at: string;
  archived_at?: string | null;
  open_signup_roles?: string[] | null;
  single_role_slot_limit?: number | null;
  photographer_slot_limit?: number | null;
};

type ScheduleSnapshot = {
  title: string;
  start: string;
  end: string;
  location: string;
  detail: string;
  audience: string;
  roleCapacities: Record<string, number> | null;
};

type ScheduleChange = {
  label: string;
  before: string;
  after: string;
};

type RecipientSelection = {
  members: MemberRecord[];
  availabilityExpanded: boolean;
  availableRoles: string[];
  affectedRoleByMember: Map<string, string>;
};

type DeliveryContext = {
  affectedRole?: string;
  availabilityExpanded?: boolean;
  availableRoles?: string[];
};

const normalizeRole = (role: unknown) => String(role || "").trim().toLowerCase().replaceAll(" ", "-");
const isFisEmail = (email: unknown) => /^[^\s@]+@fis\.edu$/i.test(String(email || "").trim());
const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const berlinDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const berlinTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const audienceLabel = (audience: string) => (
  { general: "General", news_team: "News Team", leadership: "Leadership" }[audience] || "Meeting"
);

const recordStart = (record: ScheduleRecord, resourceType: ResourceType) => (
  String(resourceType === "event" ? record.date || "" : record.starts_at || "")
);

const formatScheduleValues = (startValue: string, endValue: string) => {
  const start = new Date(startValue);
  const end = new Date(endValue);
  return `${berlinDate.format(start)}, ${berlinTime.format(start)}–${berlinTime.format(end)} Berlin time`;
};

const formatSchedule = (record: ScheduleRecord, resourceType: ResourceType) => (
  formatScheduleValues(recordStart(record, resourceType), record.ends_at)
);

const sameInstant = (left: string, right: string) => Date.parse(left) === Date.parse(right);

const scheduleSnapshot = (record: ScheduleRecord, resourceType: ResourceType): ScheduleSnapshot => ({
  title: String(record.title || "").trim(),
  start: recordStart(record, resourceType),
  end: String(record.ends_at || ""),
  location: String(record.location || "").trim(),
  detail: String(resourceType === "event" ? record.description || "" : record.agenda || "").trim(),
  audience: resourceType === "meeting" ? String(record.audience || "general") : "",
  roleCapacities: resourceType === "event" ? eventRoleCapacities(record) : null,
});

const normalizeSnapshot = (value: unknown): ScheduleSnapshot | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const snapshot = {
    title: String(source.title || "").trim(),
    start: String(source.start || ""),
    end: String(source.end || ""),
    location: String(source.location || "").trim(),
    detail: String(source.detail || "").trim(),
    audience: String(source.audience || ""),
    roleCapacities: source.roleCapacities && typeof source.roleCapacities === "object" && !Array.isArray(source.roleCapacities)
      ? Object.fromEntries(Object.entries(source.roleCapacities as Record<string, unknown>)
        .map(([role, capacity]) => [role, Math.max(0, Number(capacity) || 0)]))
      : source.role_capacities && typeof source.role_capacities === "object" && !Array.isArray(source.role_capacities)
        ? Object.fromEntries(Object.entries(source.role_capacities as Record<string, unknown>)
          .map(([role, capacity]) => [role, Math.max(0, Number(capacity) || 0)]))
        : null,
  };
  return snapshot.title && snapshot.start && snapshot.end ? snapshot : null;
};

const changeDisplayValue = (value: string, fallback = "Not set") => {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean;
};

const describeScheduleChanges = (
  previous: ScheduleSnapshot | null,
  current: ScheduleSnapshot,
  resourceType: ResourceType,
): ScheduleChange[] => {
  if (!previous) return [];
  const changes: ScheduleChange[] = [];
  const add = (label: string, before: string, after: string) => {
    if (before.trim() === after.trim()) return;
    changes.push({ label, before: changeDisplayValue(before), after: changeDisplayValue(after, "Removed") });
  };
  add("Title", previous.title, current.title);
  if (!sameInstant(previous.start, current.start) || !sameInstant(previous.end, current.end)) {
    changes.push({
      label: "Schedule",
      before: formatScheduleValues(previous.start, previous.end),
      after: formatScheduleValues(current.start, current.end),
    });
  }
  add("Location", previous.location, current.location);
  if (resourceType === "meeting" && previous.audience !== current.audience) {
    add("Audience", audienceLabel(previous.audience), audienceLabel(current.audience));
  }
  add(resourceType === "event" ? "Description" : "Agenda", previous.detail, current.detail);
  if (resourceType === "event") {
    const availability = eventAvailabilityChanges(previous, current);
    [...availability.expanded, ...availability.reduced].forEach(change => {
      const slots = (count: number) => count === 0 ? "Unavailable" : `${count} ${count === 1 ? "slot" : "slots"}`;
      changes.push({ label: `Role · ${change.role}`, before: slots(change.before), after: slots(change.after) });
    });
  }
  return changes;
};

const resourceDestination = (record: ScheduleRecord, resourceType: ResourceType, siteUrl: string) => (
  resourceType === "event"
    ? `${siteUrl}/signups?event=${encodeURIComponent(record.id)}`
    : `${siteUrl}/meetings`
);

const escapeCalendarText = (value: unknown) => String(value || "")
  .replaceAll("\\", "\\\\")
  .replace(/\r?\n/g, "\\n")
  .replaceAll(";", "\\;")
  .replaceAll(",", "\\,");

const calendarTimestamp = (value: string) => new Date(value).toISOString()
  .replaceAll("-", "")
  .replaceAll(":", "")
  .replace(/\.\d{3}Z$/, "Z");

const utf8Base64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const foldCalendarLine = (value: string) => {
  const lines: string[] = [];
  let line = "";
  for (const character of value) {
    const candidate = `${line}${character}`;
    if (new TextEncoder().encode(candidate).length > 75 && line) {
      lines.push(line);
      line = ` ${character}`;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines.join("\r\n");
};

const calendarAttachment = (record: ScheduleRecord, resourceType: ResourceType, siteUrl: string) => {
  const snapshot = scheduleSnapshot(record, resourceType);
  const description = [snapshot.detail, `Crew Center: ${resourceDestination(record, resourceType, siteUrl)}`]
    .filter(Boolean)
    .join("\n\n");
  const sequence = Math.max(0, Math.floor(new Date(record.updated_at).getTime() / 1000));
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FIS Media Club//Crew Center//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${resourceType}-${record.id}@fismediaclub.org`,
    `DTSTAMP:${calendarTimestamp(record.updated_at)}`,
    `DTSTART:${calendarTimestamp(snapshot.start)}`,
    `DTEND:${calendarTimestamp(snapshot.end)}`,
    `LAST-MODIFIED:${calendarTimestamp(record.updated_at)}`,
    `SEQUENCE:${sequence}`,
    "STATUS:CONFIRMED",
    "CLASS:PRIVATE",
    `SUMMARY:${escapeCalendarText(snapshot.title)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    `LOCATION:${escapeCalendarText(snapshot.location || "Location to be confirmed")}`,
    `URL:${escapeCalendarText(resourceDestination(record, resourceType, siteUrl))}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].map(foldCalendarLine).join("\r\n");
  const safeTitle = snapshot.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return {
    content: utf8Base64(calendar),
    filename: `${safeTitle || resourceType}.ics`,
    content_type: "text/calendar; charset=utf-8; method=PUBLISH",
  };
};

const emailCopy = (record: ScheduleRecord, resourceType: ResourceType, action: NotificationAction, context: DeliveryContext = {}) => {
  const resourceLabel = resourceType === "event" ? "event" : "meeting";
  const actionLabel = action === "created" ? "New" : "Updated";
  const detail = resourceType === "event" ? record.description : record.agenda;
  const audience = resourceType === "meeting" ? audienceLabel(record.audience || "") : "Media Club production";
  if (resourceType === "event" && context.affectedRole) {
    return {
      subject: `Action needed: ${context.affectedRole} changed for ${record.title}`,
      eyebrow: "Role update",
      heading: `Check your ${context.affectedRole} assignment.`,
      intro: `Your ${context.affectedRole} role is no longer available as configured for this event. Your signup has been kept; ask a Supervisor for information before making changes.`,
      detail: String(detail || "").trim(),
      audience,
      cta: "Review event signup",
      accent: "#a40134",
      accentSoft: "#f8e9ee",
    };
  }
  if (resourceType === "event" && action === "updated" && context.availabilityExpanded) {
    const roles = context.availableRoles || [];
    return {
      subject: `A crew role is available: ${record.title}`,
      eyebrow: "Role available",
      heading: `More crew coverage is available for ${record.title}.`,
      intro: `${roles.length === 1 ? roles[0] : "One or more crew roles"} now has additional availability. Open the event if you would like to sign up.`,
      detail: String(detail || "").trim(),
      audience,
      cta: "Open available roles",
      accent: "#28787b",
      accentSoft: "#e6f8f8",
    };
  }
  return {
    subject: `${actionLabel} Media Club ${resourceLabel}: ${record.title}`,
    eyebrow: `${actionLabel} ${resourceLabel}`,
    heading: action === "created" ? `${record.title} is on the schedule.` : `${record.title} has changed.`,
    intro: action === "created"
      ? `A new FIS Media Club ${resourceLabel} is ready for your attention.`
      : `The schedule or details for this FIS Media Club ${resourceLabel} were updated.`,
    detail: String(detail || "").trim(),
    audience,
    cta: resourceType === "event" ? "Open event signups" : "Open meetings",
    accent: resourceType === "event" ? "#a40134" : "#4f5fb7",
    accentSoft: resourceType === "event" ? "#f8e9ee" : "#eceefe",
  };
};

const renderEmail = (
  member: MemberRecord,
  record: ScheduleRecord,
  resourceType: ResourceType,
  action: NotificationAction,
  siteUrl: string,
  previousSnapshot: ScheduleSnapshot | null,
  context: DeliveryContext = {},
) => {
  const copy = emailCopy(record, resourceType, action, context);
  const firstName = String(member.name || "Media Club member").trim().split(/\s+/)[0] || "Media Club member";
  const destination = resourceDestination(record, resourceType, siteUrl);
  const preferencesUrl = `${siteUrl}/profile?tab=notifications`;
  const schedule = formatSchedule(record, resourceType);
  const location = String(record.location || "").trim() || "Location to be confirmed";
  const currentSnapshot = scheduleSnapshot(record, resourceType);
  const changes = action === "updated" ? describeScheduleChanges(previousSnapshot, currentSnapshot, resourceType) : [];
  const changesHtml = changes.length ? `<tr><td style="padding:0 36px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff8e9;border:1px solid #efd69e;border-radius:10px;"><tr><td style="padding:17px 18px;"><div style="margin-bottom:10px;color:#6d4b13;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">What changed</div>${changes.map(change => `<div style="padding:9px 0;border-top:1px solid #f1dfb8;color:#57505b;font-size:13px;line-height:20px;"><strong style="color:#201923;">${escapeHtml(change.label)}</strong><br><span style="color:#7b747e;text-decoration:line-through;">${escapeHtml(change.before)}</span><br><span style="color:#201923;">→ ${escapeHtml(change.after)}</span></div>`).join("")}</td></tr></table></td></tr>` : "";
  const changesText = changes.length
    ? `\n\nWhat changed:\n${changes.map(change => `- ${change.label}: ${change.before} -> ${change.after}`).join("\n")}`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ec;color:#25222c;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(copy.intro)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e4ded5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:28px 36px;background:#201923;background-image:linear-gradient(135deg,#201923 0%,#53092a 60%,${copy.accent} 100%);border-top:6px solid #e0aa4f;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="70" valign="middle"><img src="${siteUrl}/assets/fis-logo.png" width="58" height="58" alt="FIS" style="display:block;width:58px;height:58px;border-radius:50%;background:#fff;border:2px solid #fff;"></td><td valign="middle"><div style="color:#e8b75f;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FIS Media Club</div><div style="margin-top:4px;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:25px;font-weight:700;line-height:31px;letter-spacing:0.2px;">Crew Center</div></td></tr></table>
</td></tr>
<tr><td style="padding:38px 36px 18px;"><div style="display:inline-block;padding:7px 11px;border-radius:999px;background:${copy.accentSoft};color:${copy.accent};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(copy.eyebrow)}</div><h1 style="margin:18px 0 12px;color:#201923;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:700;line-height:40px;letter-spacing:-0.3px;overflow-wrap:break-word;">${escapeHtml(copy.heading)}</h1><p style="margin:0;color:#57505b;font-size:16px;line-height:25px;">Hi ${escapeHtml(firstName)}, ${escapeHtml(copy.intro)}</p></td></tr>
<tr><td style="padding:10px 36px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f6f2;border-left:4px solid #e0aa4f;border-radius:8px;"><tr><td style="padding:16px 18px;color:#57505b;font-size:14px;line-height:22px;"><strong style="color:#201923;">When</strong><br>${escapeHtml(schedule)}<br><br><strong style="color:#201923;">Where</strong><br>${escapeHtml(location)}${resourceType === "meeting" ? `<br><br><strong style="color:#201923;">Audience</strong><br>${escapeHtml(copy.audience)}` : ""}</td></tr></table></td></tr>
${changesHtml}
${copy.detail ? `<tr><td style="padding:0 36px 20px;"><p style="margin:0;color:#57505b;font-size:14px;line-height:22px;">${escapeHtml(copy.detail)}</p></td></tr>` : ""}
<tr><td style="padding:2px 36px 18px;"><a href="${escapeHtml(destination)}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:${copy.accent};color:#fff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(copy.cta)} &nbsp;→</a></td></tr>
<tr><td style="padding:0 36px 38px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${copy.accentSoft};border-radius:8px;"><tr><td width="38" style="padding:13px 0 13px 15px;color:${copy.accent};font-size:20px;">&#128197;</td><td style="padding:13px 15px 13px 6px;color:#57505b;font-size:13px;line-height:19px;"><strong style="color:#201923;">Calendar invitation attached</strong><br>Open the .ics file to add or update this ${resourceType} in your calendar.</td></tr></table></td></tr>
<tr><td style="padding:22px 36px;background:#201923;color:#cfc5cc;font-size:12px;line-height:19px;text-align:center;">You received this because you opted in to ${resourceType} email updates.<br><a href="${escapeHtml(preferencesUrl)}" style="color:#e8b75f;text-decoration:none;">Manage email notifications</a> · <a href="${escapeHtml(siteUrl)}" style="color:#e8b75f;text-decoration:none;">fismediaclub.org</a></td></tr>
</table></td></tr></table></body></html>`;

  const text = `${copy.heading}\n\nHi ${firstName}, ${copy.intro}\n\nWhen: ${schedule}\nWhere: ${location}${resourceType === "meeting" ? `\nAudience: ${copy.audience}` : ""}${changesText}${copy.detail ? `\n\n${copy.detail}` : ""}\n\n${copy.cta}: ${destination}\n\nA calendar invitation is attached. Open the .ics file to add or update this ${resourceType}.\n\nYou received this because you opted in to ${resourceType} email updates. Manage notifications: ${preferencesUrl}`;
  return { ...copy, html, text, calendar: calendarAttachment(record, resourceType, siteUrl) };
};

const listAuthAdminEmails = async (adminClient: ReturnType<typeof createClient>) => {
  const emails = new Set<string>();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Auth Admin lookup failed: ${error.message}`);
    for (const user of data.users) {
      if (String(user.app_metadata?.role || "").toLowerCase() === "admin" && user.email) emails.add(user.email.toLowerCase());
    }
    if (data.users.length < 1000) break;
  }
  return emails;
};

const eligibleRecipients = async (
  adminClient: ReturnType<typeof createClient>,
  resourceType: ResourceType,
  record: ScheduleRecord,
  action: NotificationAction,
  previousSnapshot: ScheduleSnapshot | null,
  currentSnapshot: ScheduleSnapshot,
): Promise<RecipientSelection> => {
  const { data, error } = await adminClient
    .from("members")
    .select("id, name, email, role, grade_level, status, notification_preferences");
  if (error) throw new Error(`Member subscription lookup failed: ${error.message}`);

  const { data: mediaMemberships, error: mediaMembershipError } = await adminClient
    .from("member_team_memberships")
    .select("member_id")
    .eq("team_key", "media_club");
  if (mediaMembershipError) throw new Error(`Media Club audience lookup failed: ${mediaMembershipError.message}`);
  const mediaMemberIds = new Set((mediaMemberships || []).map(membership => membership.member_id));

  let members = (data || []) as MemberRecord[];
  const preferenceKey = resourceType === "event" ? "email_event_updates" : "email_meeting_updates";
  members = members.filter(member =>
    mediaMemberIds.has(member.id)
    && String(member.status || "").toLowerCase() !== "inactive"
    && member.notification_preferences?.[preferenceKey] === true
    && isFisEmail(member.email)
    && (resourceType !== "event" || String(member.grade_level || "").trim().toLowerCase() !== "adult")
  );

  if (resourceType === "event") {
    if (action === "created") {
      return { members, availabilityExpanded: false, availableRoles: [], affectedRoleByMember: new Map() };
    }
    const { data: rawSignups, error: signupError } = await adminClient
      .from("signups")
      .select("member_id, signup_role, role_slot, confirmation_status")
      .eq("event_id", record.id);
    if (signupError) throw new Error(`Event signup audience lookup failed: ${signupError.message}`);
    const routing = routeEventUpdateRecipients(
      members.map(member => member.id),
      (rawSignups || []) as EventSignupForRouting[],
      previousSnapshot,
      currentSnapshot,
    );
    const recipientIds = new Set(routing.recipientIds);
    members = members.filter(member => recipientIds.has(member.id));
    return {
      members,
      availabilityExpanded: routing.availabilityExpanded,
      availableRoles: routing.availableRoles,
      affectedRoleByMember: new Map(Object.entries(routing.affectedRoleByMember)),
    };
  }

  if (record.audience === "general") {
    return { members, availabilityExpanded: false, availableRoles: [], affectedRoleByMember: new Map() };
  }

  if (record.audience === "news_team") {
    if (!members.length) return { members: [], availabilityExpanded: false, availableRoles: [], affectedRoleByMember: new Map() };
    const { data: memberships, error: membershipError } = await adminClient
      .from("member_team_memberships")
      .select("member_id")
      .eq("team_key", "news_team")
      .in("member_id", members.map(member => member.id));
    if (membershipError) throw new Error(`Meeting audience lookup failed: ${membershipError.message}`);
    const newsTeamIds = new Set((memberships || []).map(membership => membership.member_id));
    return { members: members.filter(member => newsTeamIds.has(member.id)), availabilityExpanded: false, availableRoles: [], affectedRoleByMember: new Map() };
  }

  const authAdminEmails = await listAuthAdminEmails(adminClient);
  return {
    members: members.filter(member =>
      ["faculty", "leader", "co-leader", "moderator"].includes(normalizeRole(member.role))
      || authAdminEmails.has(member.email.toLowerCase())
    ),
    availabilityExpanded: false,
    availableRoles: [],
    affectedRoleByMember: new Map(),
  };
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let dispatchId = "";
  let adminClient: ReturnType<typeof createClient> | null = null;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const siteUrl = (Deno.env.get("SITE_URL") || "https://fismediaclub.org").replace(/\/$/, "");
    const from = Deno.env.get("NOTIFICATION_FROM_EMAIL") || "FIS Media Club <notifications@auth.fismediaclub.org>";
    if (!resendApiKey) return json({ error: "Email delivery is not configured." }, 503);

    const authorization = request.headers.get("Authorization") || "";
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user || user.is_anonymous) return json({ error: "Sign in again before sending schedule emails." }, 401);

    const authAdmin = String(user.app_metadata?.role || "").toLowerCase() === "admin";
    const { data: callerMember, error: callerError } = await adminClient
      .from("members")
      .select("role")
      .ilike("email", user.email || "")
      .maybeSingle();
    if (callerError) throw new Error(`Sender permission lookup failed: ${callerError.message}`);
    if (!authAdmin && !["faculty", "leader", "co-leader", "moderator"].includes(normalizeRole(callerMember?.role))) {
      return json({ error: "Production staff access is required to send schedule emails." }, 403);
    }

    const body = await request.json();
    const resourceType = body.resourceType as ResourceType;
    const action = body.action as NotificationAction;
    const resourceId = String(body.resourceId || "");
    if (!resourceId || !["event", "meeting"].includes(resourceType) || !["created", "updated"].includes(action)) {
      return json({ error: "Invalid schedule notification request." }, 400);
    }

    const table = resourceType === "event" ? "events" : "meetings";
    const columns = resourceType === "event"
      ? "id, title, description, date, ends_at, location, updated_at, archived_at, open_signup_roles, single_role_slot_limit, photographer_slot_limit"
      : "id, title, agenda, starts_at, ends_at, location, audience, updated_at, archived_at";
    const { data: rawRecord, error: recordError } = await adminClient
      .from(table)
      .select(columns)
      .eq("id", resourceId)
      .maybeSingle();
    if (recordError || !rawRecord) return json({ error: "The saved schedule item could not be found." }, 404);
    const record = rawRecord as unknown as ScheduleRecord;
    if (record.archived_at || new Date(record.ends_at).getTime() <= Date.now()) {
      return json({ ok: true, sentCount: 0, skipped: "inactive" });
    }

    const currentSnapshot = scheduleSnapshot(record, resourceType);
    let previousSnapshot: ScheduleSnapshot | null = null;
    if (action === "updated") {
      const { data: resourceState, error: stateError } = await adminClient
        .from("schedule_email_resource_states")
        .select("resource_version, resource_snapshot")
        .eq("resource_type", resourceType)
        .eq("resource_id", record.id)
        .maybeSingle();
      if (stateError) throw new Error(`Previous schedule state could not be read: ${stateError.message}`);
      if (resourceState && !sameInstant(resourceState.resource_version, record.updated_at)) {
        previousSnapshot = normalizeSnapshot(resourceState.resource_snapshot);
      }
    }

    const identity = {
      resource_type: resourceType,
      resource_id: record.id,
      action,
      resource_version: record.updated_at,
      requested_by: user.id,
      status: "processing",
      error_message: null,
      last_attempt_at: new Date().toISOString(),
      completed_at: null,
    };
    const { data: newDispatch, error: insertError } = await adminClient
      .from("schedule_email_dispatches")
      .insert(identity)
      .select("id, status, sent_count")
      .maybeSingle();

    if (insertError && insertError.code !== "23505") throw new Error(`Email dispatch could not start: ${insertError.message}`);
    if (newDispatch) {
      dispatchId = newDispatch.id;
    } else {
      const { data: existing, error: existingError } = await adminClient
        .from("schedule_email_dispatches")
        .select("id, status, sent_count, last_attempt_at")
        .eq("resource_type", resourceType)
        .eq("resource_id", record.id)
        .eq("action", action)
        .eq("resource_version", record.updated_at)
        .single();
      if (existingError) throw new Error(`Existing email dispatch could not be read: ${existingError.message}`);
      dispatchId = existing.id;
      const processingRecently = existing.status === "processing"
        && Date.now() - new Date(existing.last_attempt_at).getTime() < 5 * 60 * 1000;
      if (existing.status === "completed" || processingRecently) {
        return json({ ok: true, duplicate: true, sentCount: Number(existing.sent_count) || 0 });
      }
      const { error: retryError } = await adminClient.from("schedule_email_dispatches").update({
        status: "processing",
        error_message: null,
        last_attempt_at: new Date().toISOString(),
        completed_at: null,
      }).eq("id", dispatchId);
      if (retryError) throw new Error(`Email dispatch retry could not start: ${retryError.message}`);
    }

    const recipientSelection = await eligibleRecipients(adminClient, resourceType, record, action, previousSnapshot, currentSnapshot);
    const recipients = recipientSelection.members;
    if (recipients.length) {
      const { error: deliveryError } = await adminClient.from("schedule_email_deliveries").upsert(
        recipients.map(member => ({ dispatch_id: dispatchId, member_id: member.id, recipient_email: member.email.toLowerCase() })),
        { onConflict: "dispatch_id,member_id", ignoreDuplicates: true },
      );
      if (deliveryError) throw new Error(`Email recipient ledger failed: ${deliveryError.message}`);
    }

    const { data: pendingRows, error: pendingError } = await adminClient
      .from("schedule_email_deliveries")
      .select("id, member_id, recipient_email, status")
      .eq("dispatch_id", dispatchId)
      .neq("status", "sent")
      .order("created_at");
    if (pendingError) throw new Error(`Pending email lookup failed: ${pendingError.message}`);

    const membersById = new Map(recipients.map(member => [member.id, member]));
    const staleRows = (pendingRows || []).filter(delivery => !membersById.has(delivery.member_id));
    if (staleRows.length) {
      await Promise.all(staleRows.map(delivery => adminClient!.from("schedule_email_deliveries").update({
        status: "failed",
        error_message: "Recipient is no longer subscribed or eligible.",
      }).eq("id", delivery.id)));
    }
    const eligiblePendingRows = (pendingRows || []).filter(delivery => membersById.has(delivery.member_id));
    const deliveryFailures: string[] = [];
    for (let index = 0; index < eligiblePendingRows.length; index += 1) {
      const delivery = eligiblePendingRows[index];
      const member = membersById.get(delivery.member_id) || { id: delivery.member_id, name: "Media Club member", email: delivery.recipient_email, role: "Member", status: "active", notification_preferences: {} };
      const rendered = renderEmail(member, record, resourceType, action, siteUrl, previousSnapshot, {
        affectedRole: recipientSelection.affectedRoleByMember.get(delivery.member_id),
        availabilityExpanded: recipientSelection.availabilityExpanded,
        availableRoles: recipientSelection.availableRoles,
      });
      const payload = {
        from,
        to: [delivery.recipient_email],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: [rendered.calendar],
        tags: [
          { name: "message_type", value: `${resourceType}_${action}` },
          { name: "resource_id", value: record.id },
        ],
      };

      let response: Response | null = null;
      let responseBody: Record<string, unknown> = {};
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `schedule-${dispatchId}-${delivery.id}`,
          },
          body: JSON.stringify(payload),
        });
        responseBody = await response.json().catch(() => ({}));
        if (response.status !== 429 || attempt === 1) break;
        const retryAfter = Math.max(1, Number(response.headers.get("retry-after")) || 1);
        await new Promise(resolve => setTimeout(resolve, Math.min(10_000, retryAfter * 1000)));
      }

      if (!response?.ok || typeof responseBody.id !== "string") {
        const message = String(responseBody.message || responseBody.error || `Resend returned ${response?.status || 0}`);
        await adminClient.from("schedule_email_deliveries").update({ status: "failed", error_message: message }).eq("id", delivery.id);
        deliveryFailures.push(message);
      } else {
        await adminClient.from("schedule_email_deliveries").update({
          status: "sent",
          provider_message_id: responseBody.id,
          error_message: null,
          sent_at: new Date().toISOString(),
        }).eq("id", delivery.id);
      }
      if (index < eligiblePendingRows.length - 1) await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (deliveryFailures.length) {
      throw new Error(`Resend delivery failed for ${deliveryFailures.length} recipient(s): ${deliveryFailures[0]}`);
    }

    const { count: sentCount, error: countError } = await adminClient
      .from("schedule_email_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("dispatch_id", dispatchId)
      .eq("status", "sent");
    if (countError) throw new Error(`Email delivery count failed: ${countError.message}`);
    const { error: stateUpdateError } = await adminClient.from("schedule_email_resource_states").upsert({
      resource_type: resourceType,
      resource_id: record.id,
      resource_version: record.updated_at,
      resource_snapshot: currentSnapshot,
      updated_at: new Date().toISOString(),
    }, { onConflict: "resource_type,resource_id" });
    if (stateUpdateError) throw new Error(`Schedule email state could not be saved: ${stateUpdateError.message}`);
    const { error: completeError } = await adminClient.from("schedule_email_dispatches").update({
      status: "completed",
      recipient_count: recipients.length,
      sent_count: sentCount || 0,
      error_message: null,
      completed_at: new Date().toISOString(),
    }).eq("id", dispatchId);
    if (completeError) throw new Error(`Email dispatch could not be completed: ${completeError.message}`);
    return json({ ok: true, sentCount: sentCount || 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Schedule email delivery failed.";
    if (adminClient && dispatchId) {
      await adminClient.from("schedule_email_dispatches").update({ status: "failed", error_message: message }).eq("id", dispatchId);
    }
    return json({ error: message }, 502);
  }
});
