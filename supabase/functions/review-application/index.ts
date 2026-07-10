import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = request.headers.get("Authorization") || "";
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return json({ error: "Sign in again before reviewing applications." }, 401);

  const authAdmin = String(user.app_metadata?.role || "").toLowerCase() === "admin";
  const { data: member } = await adminClient.from("members").select("role").ilike("email", user.email || "").maybeSingle();
  const memberRole = String(member?.role || "").toLowerCase().trim().replaceAll(" ", "-");
  if (!authAdmin && !["leader", "co-leader", "moderator"].includes(memberRole)) {
    return json({ error: "You do not have permission to review applications." }, 403);
  }

  const { applicationId, decision, reason = "" } = await request.json();
  if (!applicationId || !["approve", "reject"].includes(decision)) return json({ error: "Invalid review request." }, 400);

  const { data: application, error: applicationError } = await adminClient
    .from("join_applications")
    .select("*")
    .eq("id", applicationId)
    .eq("status", "pending")
    .maybeSingle();
  if (applicationError || !application) return json({ error: "This application is no longer pending." }, 409);

  if (decision === "approve") {
    const siteUrl = Deno.env.get("SITE_URL") || "https://media-club-page.pages.dev";
    const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(application.email, {
      redirectTo: siteUrl,
      data: { full_name: application.name, role: "Member" },
    });
    if (inviteError) return json({ error: `Invitation was not sent: ${inviteError.message}` }, 400);
    if (invite.user) await adminClient.auth.admin.updateUserById(invite.user.id, { app_metadata: { role: "member" } });

    const { error: memberError } = await adminClient.from("members").upsert({
      name: application.name,
      email: application.email,
      role: "Member",
      status: application.interests?.join(", ") || "General",
    }, { onConflict: "email" });
    if (memberError) return json({ error: `Member record failed: ${memberError.message}` }, 500);

    const { error: updateError } = await adminClient.from("join_applications").update({
      status: "approved",
      rejection_reason: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq("id", applicationId);
    if (updateError) return json({ error: updateError.message }, 500);
    return json({ ok: true });
  }

  if (!String(reason).trim()) return json({ error: "A rejection reason is required." }, 400);
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FROM_EMAIL");
  if (!resendKey || !fromEmail) return json({ error: "Rejection email is not configured yet." }, 503);

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [application.email],
      subject: "Your Media Club application",
      html: `<p>Hello ${escapeHtml(application.name)},</p><p>Thank you for applying to the FIS Student Media Club. We are unable to approve your application at this time.</p><p><strong>Reason:</strong> ${escapeHtml(String(reason).trim())}</p><p>Media Club Team</p>`,
    }),
  });
  if (!emailResponse.ok) return json({ error: "The decision email could not be sent." }, 502);

  const { error: updateError } = await adminClient.from("join_applications").update({
    status: "rejected",
    rejection_reason: String(reason).trim(),
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  }).eq("id", applicationId);
  if (updateError) return json({ error: updateError.message }, 500);
  return json({ ok: true });
});
