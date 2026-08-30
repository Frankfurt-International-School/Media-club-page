import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const isFisAliasEmail = (email: unknown) => /^[a-z]{2}\d{4,}@fis\.edu$/i.test(String(email || "").trim());

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
  const { data: reviewerMember } = await adminClient.from("members").select("role").ilike("email", user.email || "").maybeSingle();
  const memberRole = String(reviewerMember?.role || "").toLowerCase().trim().replaceAll(" ", "-");
  if (!authAdmin && memberRole !== "faculty") {
    return json({ error: "You do not have permission to review applications." }, 403);
  }

  const { applicationId, decision, reason = "" } = await request.json();
  if (!applicationId || !["approve", "reject"].includes(decision)) return json({ error: "Invalid review request." }, 400);

  const { data: application, error: applicationError } = await adminClient
    .from("join_applications")
    .select("*")
    .eq("id", applicationId)
    .eq("status", "pending")
    .is("reviewed_at", null)
    .maybeSingle();
  if (applicationError || !application) return json({ error: "This application is no longer pending." }, 409);

  const { data: claimedApplication, error: claimError } = await adminClient
    .from("join_applications")
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq("id", applicationId)
    .eq("status", "pending")
    .is("reviewed_at", null)
    .select("id")
    .maybeSingle();
  if (claimError || !claimedApplication) return json({ error: "This application is already being reviewed." }, 409);

  const releaseApplication = async () => {
    await adminClient.from("join_applications").update({ reviewed_at: null, reviewed_by: null }).eq("id", applicationId).eq("status", "pending");
  };

  if (decision === "approve") {
    const normalizedEmail = String(application.email).trim().toLowerCase();
    if (!isFisAliasEmail(normalizedEmail)) {
      await releaseApplication();
      return json({ error: "This application does not use a valid FIS alias email (2 letters followed by at least 4 numbers, ending in @fis.edu)." }, 400);
    }
    const { data: existingMember, error: existingMemberError } = await adminClient
      .from("members")
      .select("id, name")
      .ilike("email", normalizedEmail)
      .maybeSingle();
    if (existingMemberError) {
      await releaseApplication();
      return json({ error: `Member lookup failed: ${existingMemberError.message}` }, 500);
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://fismediaclub.org";
    const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: siteUrl,
      data: { full_name: existingMember?.name || application.name, role: "Member" },
    });
    if (inviteError) {
      await releaseApplication();
      const accountExists = /already|registered|exists/i.test(inviteError.message);
      return json({
        error: accountExists
          ? "This email already has a Supabase Auth account. Ask the applicant to sign in instead of sending another invitation."
          : `Invitation was not sent: ${inviteError.message}`,
      }, 400);
    }

    if (invite.user) {
      const { error: metadataError } = await adminClient.auth.admin.updateUserById(invite.user.id, { app_metadata: { role: "member" } });
      if (metadataError) {
        await adminClient.auth.admin.deleteUser(invite.user.id);
        await releaseApplication();
        return json({ error: `Account role setup failed: ${metadataError.message}` }, 500);
      }
    }

    let createdMemberId = "";
    if (!existingMember) {
      const { data: createdMember, error: memberError } = await adminClient.from("members").insert({
        name: application.name,
        email: normalizedEmail,
        role: "Member",
        grade_level: application.year_group || null,
        status: application.interests?.join(", ") || "General",
      }).select("id").single();
      if (memberError) {
        if (invite.user) await adminClient.auth.admin.deleteUser(invite.user.id);
        await releaseApplication();
        return json({ error: `Member record failed: ${memberError.message}` }, 500);
      }
      createdMemberId = createdMember.id;
    }

    const { error: updateError } = await adminClient.from("join_applications").update({
      status: "approved",
      rejection_reason: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq("id", applicationId).eq("status", "pending");
    if (updateError) {
      if (createdMemberId) await adminClient.from("members").delete().eq("id", createdMemberId);
      if (invite.user) await adminClient.auth.admin.deleteUser(invite.user.id);
      await releaseApplication();
      return json({ error: updateError.message }, 500);
    }
    return json({ ok: true });
  }

  if (!String(reason).trim()) {
    await releaseApplication();
    return json({ error: "A rejection reason is required." }, 400);
  }
  const { error: updateError } = await adminClient.from("join_applications").update({
    status: "rejected",
    rejection_reason: String(reason).trim(),
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  }).eq("id", applicationId);
  if (updateError) {
    await releaseApplication();
    return json({ error: updateError.message }, 500);
  }
  return json({ ok: true, applicantEmail: application.email });
});
