import { createClient } from "npm:@supabase/supabase-js@2";

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

const formatSchedule = (record: ScheduleRecord, resourceType: ResourceType) => {
  const start = new Date(resourceType === "event" ? record.date! : record.starts_at!);
  const end = new Date(record.ends_at);
  return `${berlinDate.format(start)}, ${berlinTime.format(start)}–${berlinTime.format(end)} Berlin time`;
};

const emailCopy = (record: ScheduleRecord, resourceType: ResourceType, action: NotificationAction) => {
  const resourceLabel = resourceType === "event" ? "event" : "meeting";
  const actionLabel = action === "created" ? "New" : "Updated";
  const detail = resourceType === "event" ? record.description : record.agenda;
  const audience = resourceType === "meeting"
    ? ({ general: "General", news_team: "News Team", leadership: "Leadership" }[record.audience || ""] || "Meeting")
    : "Media Club production";
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
  };
};

const renderEmail = (
  member: MemberRecord,
  record: ScheduleRecord,
  resourceType: ResourceType,
  action: NotificationAction,
  siteUrl: string,
) => {
  const copy = emailCopy(record, resourceType, action);
  const firstName = String(member.name || "Media Club member").trim().split(/\s+/)[0] || "Media Club member";
  const destination = resourceType === "event"
    ? `${siteUrl}/signups?event=${encodeURIComponent(record.id)}`
    : `${siteUrl}/meetings`;
  const preferencesUrl = `${siteUrl}/profile?tab=notifications`;
  const schedule = formatSchedule(record, resourceType);
  const location = String(record.location || "").trim() || "Location to be confirmed";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ec;color:#25222c;font-family:'Space Grotesk',Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(copy.intro)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f1ec;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e4ded5;border-radius:18px;overflow:hidden;">
<tr><td style="padding:28px 36px;background:#201923;background-image:linear-gradient(135deg,#201923 0%,#53092a 60%,#a40134 100%);border-top:6px solid #e0aa4f;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="70" valign="middle"><img src="${siteUrl}/assets/fis-logo.png" width="58" height="58" alt="FIS" style="display:block;width:58px;height:58px;border-radius:50%;background:#fff;border:2px solid #fff;"></td><td valign="middle"><div style="color:#e8b75f;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FIS Media Club</div><div style="margin-top:4px;color:#fff;font-family:'Arial Narrow',Arial,sans-serif;font-size:26px;line-height:30px;text-transform:uppercase;">Crew Center</div></td></tr></table>
</td></tr>
<tr><td style="padding:38px 36px 18px;"><div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#f8e9ee;color:#8d062e;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">${escapeHtml(copy.eyebrow)}</div><h1 style="margin:18px 0 12px;color:#201923;font-family:'Arial Narrow',Arial,sans-serif;font-size:38px;line-height:43px;text-transform:uppercase;">${escapeHtml(copy.heading)}</h1><p style="margin:0;color:#57505b;font-size:16px;line-height:25px;">Hi ${escapeHtml(firstName)}, ${escapeHtml(copy.intro)}</p></td></tr>
<tr><td style="padding:10px 36px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f6f2;border-left:4px solid #e0aa4f;border-radius:8px;"><tr><td style="padding:16px 18px;color:#57505b;font-size:14px;line-height:22px;"><strong style="color:#201923;">When</strong><br>${escapeHtml(schedule)}<br><br><strong style="color:#201923;">Where</strong><br>${escapeHtml(location)}${resourceType === "meeting" ? `<br><br><strong style="color:#201923;">Audience</strong><br>${escapeHtml(copy.audience)}` : ""}</td></tr></table></td></tr>
${copy.detail ? `<tr><td style="padding:0 36px 20px;"><p style="margin:0;color:#57505b;font-size:14px;line-height:22px;">${escapeHtml(copy.detail)}</p></td></tr>` : ""}
<tr><td style="padding:2px 36px 38px;"><a href="${escapeHtml(destination)}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#a40134;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(copy.cta)} &nbsp;→</a></td></tr>
<tr><td style="padding:22px 36px;background:#201923;color:#cfc5cc;font-size:12px;line-height:19px;text-align:center;">You received this because you opted in to ${resourceType} email updates.<br><a href="${escapeHtml(preferencesUrl)}" style="color:#e8b75f;text-decoration:none;">Manage email notifications</a> · <a href="${escapeHtml(siteUrl)}" style="color:#e8b75f;text-decoration:none;">fismediaclub.org</a></td></tr>
</table></td></tr></table></body></html>`;

  const text = `${copy.heading}\n\nHi ${firstName}, ${copy.intro}\n\nWhen: ${schedule}\nWhere: ${location}${resourceType === "meeting" ? `\nAudience: ${copy.audience}` : ""}${copy.detail ? `\n\n${copy.detail}` : ""}\n\n${copy.cta}: ${destination}\n\nYou received this because you opted in to ${resourceType} email updates. Manage notifications: ${preferencesUrl}`;
  return { ...copy, html, text };
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
) => {
  const { data, error } = await adminClient
    .from("members")
    .select("id, name, email, role, status, notification_preferences");
  if (error) throw new Error(`Member subscription lookup failed: ${error.message}`);

  let members = (data || []) as MemberRecord[];
  const preferenceKey = resourceType === "event" ? "email_event_updates" : "email_meeting_updates";
  members = members.filter(member =>
    String(member.status || "").toLowerCase() !== "inactive"
    && member.notification_preferences?.[preferenceKey] === true
    && isFisEmail(member.email)
  );

  if (resourceType === "event" || record.audience === "general") return members;

  if (record.audience === "news_team") {
    if (!members.length) return [];
    const { data: memberships, error: membershipError } = await adminClient
      .from("member_team_memberships")
      .select("member_id")
      .eq("team_key", "news_team")
      .in("member_id", members.map(member => member.id));
    if (membershipError) throw new Error(`Meeting audience lookup failed: ${membershipError.message}`);
    const newsTeamIds = new Set((memberships || []).map(membership => membership.member_id));
    return members.filter(member => newsTeamIds.has(member.id));
  }

  const authAdminEmails = await listAuthAdminEmails(adminClient);
  return members.filter(member =>
    ["faculty", "leader", "co-leader", "moderator"].includes(normalizeRole(member.role))
    || authAdminEmails.has(member.email.toLowerCase())
  );
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
      ? "id, title, description, date, ends_at, location, updated_at, archived_at"
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

    const recipients = await eligibleRecipients(adminClient, resourceType, record);
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
    for (let index = 0; index < eligiblePendingRows.length; index += 100) {
      const chunk = eligiblePendingRows.slice(index, index + 100);
      const payload = chunk.map(delivery => {
        const member = membersById.get(delivery.member_id) || { id: delivery.member_id, name: "Media Club member", email: delivery.recipient_email, role: "Member", status: "active", notification_preferences: {} };
        const rendered = renderEmail(member, record, resourceType, action, siteUrl);
        return {
          from,
          to: [delivery.recipient_email],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          tags: [
            { name: "message_type", value: `${resourceType}_${action}` },
            { name: "resource_id", value: record.id },
          ],
        };
      });
      if (!payload.length) continue;

      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `schedule-${dispatchId}-${Math.floor(index / 100)}`,
        },
        body: JSON.stringify(payload),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(responseBody?.data) || responseBody.data.length !== chunk.length) {
        const message = String(responseBody?.message || responseBody?.error || `Resend returned ${response.status}`);
        await Promise.all(chunk.map(delivery => adminClient!.from("schedule_email_deliveries").update({ status: "failed", error_message: message }).eq("id", delivery.id)));
        throw new Error(`Resend batch failed: ${message}`);
      }

      await Promise.all(chunk.map((delivery, deliveryIndex) => adminClient!.from("schedule_email_deliveries").update({
        status: "sent",
        provider_message_id: responseBody.data[deliveryIndex]?.id || null,
        error_message: null,
        sent_at: new Date().toISOString(),
      }).eq("id", delivery.id)));
    }

    const { count: sentCount, error: countError } = await adminClient
      .from("schedule_email_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("dispatch_id", dispatchId)
      .eq("status", "sent");
    if (countError) throw new Error(`Email delivery count failed: ${countError.message}`);
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
