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
const isFisSchoolEmail = (email: unknown) => /^[^\s@]+@fis\.edu$/i.test(String(email || "").trim());

const studentDisplayName = (value: unknown) => {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "";
  const initial = Array.from(Array.from(parts.at(-1)!)[0].toUpperCase())[0];
  return `${parts[0]} ${initial}.`;
};

const escapeEmailHtml = (value: unknown) => String(value || "").replace(/[&<>'"]/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
}[character]!));

const firstNameFrom = (name: unknown) => String(name || "Applicant").trim().split(/\s+/)[0] || "Applicant";

const publicInfoUrl = (value: unknown) => {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol === "https:") return url.toString();
  } catch (_) {
    // Fall through to the trusted production address.
  }
  return "https://info.fismediaclub.org/";
};

const renderRejectionEmail = ({ applicantName, reason, infoUrl }: { applicantName: unknown; reason: string; infoUrl: string }) => {
  const firstName = firstNameFrom(applicantName);
  const safeFirstName = escapeEmailHtml(firstName);
  const safeReason = escapeEmailHtml(reason).replace(/\r?\n/g, "<br>");
  const destination = publicInfoUrl(infoUrl);
  const safeInfoUrl = escapeEmailHtml(destination);
  const subject = "Update on your FIS Media Club application";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <style>
    @media only screen and (max-width:620px) {
      .email-shell { width:100% !important; max-width:100% !important; table-layout:fixed !important; }
      .email-pad { padding-left:24px !important; padding-right:24px !important; }
      .email-title { font-size:30px !important; line-height:38px !important; overflow-wrap:break-word !important; }
      .email-button { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f1ec;color:#25222c;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Thank you for applying to the FIS Media Club.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f4f1ec;font-family:Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #e4ded5;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(35,24,31,0.08);">
          <tr>
            <td bgcolor="#201923" style="padding:0;background-color:#201923;background-image:linear-gradient(135deg,#201923 0%,#53092a 60%,#a40134 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td style="height:6px;background-color:#e0aa4f;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td class="email-pad" style="padding:30px 42px 34px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="82" valign="middle" style="width:82px;">
                          <div style="width:68px;height:68px;border-radius:50%;background-color:#ffffff;border:2px solid rgba(255,255,255,0.7);">
                            <img src="https://fismediaclub.org/assets/fis-logo.png" width="68" height="68" alt="FIS logo" style="display:block;width:68px;height:68px;border:0;border-radius:50%;">
                          </div>
                        </td>
                        <td valign="middle" style="padding-left:16px;">
                          <div style="color:#e8b75f;font-size:12px;font-weight:700;line-height:16px;letter-spacing:2.4px;text-transform:uppercase;">FIS Media Club</div>
                          <div style="margin-top:5px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:27px;font-weight:700;line-height:32px;letter-spacing:0.2px;">Crew Center</div>
                          <div style="margin-top:5px;color:#e7dfe5;font-size:13px;line-height:18px;">Create · Cover · Collaborate</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:42px 42px 18px;">
              <div style="display:inline-block;padding:7px 11px;border-radius:999px;background-color:#f8e9ee;color:#8d062e;font-size:11px;font-weight:700;line-height:14px;letter-spacing:1.4px;text-transform:uppercase;">Application update</div>
              <h1 class="email-title" style="margin:18px 0 14px;color:#201923;font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:700;line-height:46px;letter-spacing:-0.4px;overflow-wrap:break-word;">Thank you for applying.</h1>
              <p style="margin:0;color:#57505b;font-size:17px;line-height:27px;">Hi ${safeFirstName},</p>
              <p style="margin:16px 0 0;color:#57505b;font-size:16px;line-height:26px;">Thank you for your interest in the FIS Media Club and for the time you put into your application. After reviewing it, we are unable to offer you a place in the club at this time.</p>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:12px 42px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8f6f2;border-left:4px solid #e0aa4f;border-radius:8px;">
                <tr>
                  <td style="padding:17px 19px;color:#625a64;font-size:14px;line-height:22px;overflow-wrap:anywhere;"><strong style="display:block;margin-bottom:6px;color:#302936;">Decision details</strong>${safeReason}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:0 42px 18px;">
              <p style="margin:0;color:#57505b;font-size:15px;line-height:24px;">We appreciate your interest and encourage you to keep developing your media skills. If you need clarification about this decision, please speak with a Media Club faculty supervisor.</p>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:10px 42px 38px;">
              <a class="email-button" href="${safeInfoUrl}" style="display:inline-block;padding:14px 22px;border-radius:10px;background-color:#a40134;color:#ffffff;font-size:15px;font-weight:700;line-height:20px;text-decoration:none;box-shadow:0 6px 16px rgba(164,1,52,0.22);">Visit the Media Club website&nbsp;&nbsp;→</a>
            </td>
          </tr>
          <tr>
            <td style="padding:23px 42px;background-color:#201923;color:#cfc5cc;font-size:12px;line-height:18px;text-align:center;">
              FIS Media Club Crew Center<br>
              <a href="${safeInfoUrl}" style="color:#e8b75f;text-decoration:none;">info.fismediaclub.org</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = `Thank you for applying\n\nHi ${firstName},\n\nThank you for your interest in the FIS Media Club and for the time you put into your application. After reviewing it, we are unable to offer you a place in the club at this time.\n\nDecision details\n${reason}\n\nWe appreciate your interest and encourage you to keep developing your media skills. If you need clarification about this decision, please speak with a Media Club faculty supervisor.\n\n${destination}`;

  return { subject, html, text };
};

const renderApprovalEmail = (applicantName: unknown, target: unknown) => {
  const name = firstNameFrom(applicantName);
  const group = target === "both" ? "Media Club and SAC" : target === "sac" ? "Student Athletic Council" : "Media Club";
  const subject = `Your FIS ${group} access is approved`;
  const message = `Your ${group} application has been approved. Sign in to the Crew Center with your FIS email. If you joined SAC, use the workspace switcher to open the SAC workspace; SAC event sign-ups require your approved SAC tag.`;
  const signInUrl = "https://fismediaclub.org/signin";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeEmailHtml(subject)}</title></head><body style="margin:0;padding:32px;background:#f4f1ec;color:#25222c;font-family:Arial,Helvetica,sans-serif;"><main style="max-width:560px;margin:auto;padding:32px;background:#fff;border-radius:16px;"><p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#a40134;font-weight:700;">FIS Crew Center</p><h1 style="font-size:30px;line-height:1.2;">You're approved, ${escapeEmailHtml(name)}.</h1><p style="font-size:16px;line-height:1.6;">${escapeEmailHtml(message)}</p><p><a href="${signInUrl}" style="display:inline-block;padding:13px 19px;border-radius:9px;background:#a40134;color:#fff;text-decoration:none;font-weight:700;">Sign in to the Crew Center</a></p></main></body></html>`;
  const text = `Hi ${name},\n\n${message}\n\n${signInUrl}`;
  return { subject, html, text };
};

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
  const { data: reviewerMember } = await adminClient.from("members").select("id, role").ilike("email", user.email || "").maybeSingle();
  const memberRole = String(reviewerMember?.role || "").toLowerCase().trim().replaceAll(" ", "-");

  const { applicationId, decision, reason = "", confirmDelete = false } = await request.json();
  if (!applicationId || !["approve", "reject", "delete"].includes(decision)) return json({ error: "Invalid review request." }, 400);
  if (decision === "delete" && confirmDelete !== true) return json({ error: "Confirm permanent deletion before submitting." }, 400);
  const rejectionReason = String(reason).trim();
  if (decision === "reject" && !rejectionReason) return json({ error: "A rejection reason is required." }, 400);
  if (decision === "reject" && rejectionReason.length > 1500) return json({ error: "Keep the rejection reason to 1,500 characters or fewer." }, 400);

  const { data: application, error: applicationError } = await adminClient
    .from("join_applications")
    .select("*")
    .eq("id", applicationId)
    .eq("status", "pending")
    .is("reviewed_at", null)
    .maybeSingle();
  if (applicationError || !application) return json({ error: "This application is no longer pending." }, 409);
  application.name = studentDisplayName(application.name);
  const target = String(application.application_target || "media_club");
  const includesSac = target === "sac" || target === "both";
  const includesMedia = target === "media_club" || target === "both";
  if (!includesSac && !includesMedia) return json({ error: "This application has an invalid target." }, 400);
  let sacPresident = false;
  if (reviewerMember?.id && target === "sac") {
    const { data: reviewerSac } = await adminClient.from("member_team_memberships")
      .select("team_role")
      .eq("member_id", reviewerMember.id)
      .eq("team_key", "sac")
      .maybeSingle();
    sacPresident = reviewerSac?.team_role === "president";
  }
  const mayReview = authAdmin || (target === "media_club" && memberRole === "faculty") || (target === "sac" && sacPresident);
  if (!mayReview) return json({ error: "You do not have permission to review this application." }, 403);
  if (includesSac && decision === "reject") return json({ error: "SAC requests can only be approved or deleted without an email." }, 400);
  if (!includesSac && decision === "delete") return json({ error: "Media Club applications use the rejection review flow." }, 400);

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

  if (decision === "delete") {
    const { error: deleteError } = await adminClient.from("join_applications")
      .delete().eq("id", applicationId).eq("status", "pending").eq("reviewed_by", user.id);
    if (deleteError) {
      await releaseApplication();
      return json({ error: `The SAC request could not be deleted: ${deleteError.message}` }, 500);
    }
    return json({ ok: true, deleted: true });
  }

  if (decision === "approve") {
    const normalizedEmail = String(application.email).trim().toLowerCase();
    const validEmail = application.year_group === "Adult" ? isFisSchoolEmail(normalizedEmail) : isFisAliasEmail(normalizedEmail);
    if (!validEmail || (includesSac && (!['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].includes(application.year_group) || !application.current_sac_member))) {
      await releaseApplication();
      return json({ error: "The applicant's FIS email or SAC eligibility is invalid." }, 400);
    }
    const { data: existingMember, error: existingMemberError } = await adminClient
      .from("members")
      .select("id, name, role")
      .ilike("email", normalizedEmail)
      .maybeSingle();
    if (existingMemberError) {
      await releaseApplication();
      return json({ error: `Member lookup failed: ${existingMemberError.message}` }, 500);
    }

    let existingAuthAccount = false;
    let authLookupComplete = false;
    for (let page = 1; page <= 20; page += 1) {
      const { data: accounts, error: accountsError } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (accountsError) {
        await releaseApplication();
        return json({ error: `Account lookup failed: ${accountsError.message}` }, 500);
      }
      const users = accounts?.users || [];
      if (users.some(account => String(account.email || "").toLowerCase() === normalizedEmail)) {
        existingAuthAccount = true;
        authLookupComplete = true;
        break;
      }
      if (users.length < 1000) { authLookupComplete = true; break; }
    }
    if (!authLookupComplete) {
      await releaseApplication();
      return json({ error: "Account lookup exceeded its safe page limit. Review the account manually before approving." }, 503);
    }

    let invitedUserId = "";
    if (!existingAuthAccount) {
      const siteUrl = Deno.env.get("SITE_URL") || "https://fismediaclub.org";
      const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo: siteUrl,
        data: { full_name: existingMember?.role === "Faculty" ? existingMember.name : studentDisplayName(existingMember?.name || application.name), role: "Member" },
      });
      if (inviteError) {
        await releaseApplication();
        const accountExists = /already|registered|exists/i.test(inviteError.message);
        return json({ error: accountExists
          ? "This email already has a sign-in account. Link its member record before approving."
          : `Invitation was not sent: ${inviteError.message}` }, 400);
      }
      invitedUserId = invite.user?.id || "";
      if (!invitedUserId) {
        await releaseApplication();
        return json({ error: "Invitation returned no account. Check the Auth log before retrying." }, 500);
      }
      const { error: metadataError } = await adminClient.auth.admin.updateUserById(invitedUserId, { app_metadata: { role: "member" } });
      if (metadataError) {
        await releaseApplication();
        return json({ error: `An invitation may already be in the applicant's inbox, but account setup failed: ${metadataError.message}. Retry the pending application after resolving the error.` }, 500);
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
        await releaseApplication();
        return json({ error: `Member record failed: ${memberError.message}. The invitation may already have been sent; retry after resolving the error.` }, 500);
      }
      createdMemberId = createdMember.id;
    }

    const memberId = existingMember?.id || createdMemberId;
    const desiredTeams = [includesMedia ? "media_club" : "", includesSac ? "sac" : ""].filter(Boolean);
    const { data: currentTeams, error: teamsReadError } = await adminClient.from("member_team_memberships")
      .select("team_key").eq("member_id", memberId);
    const missingTeams = desiredTeams.filter(team => !currentTeams?.some(row => row.team_key === team));
    let insertedTeams: string[] = [];
    const rollback = async () => {
      if (createdMemberId) await adminClient.from("members").delete().eq("id", createdMemberId);
      else {
        if (insertedTeams.includes("sac")) await callerClient.rpc("set_sac_membership", { p_member_id: memberId, p_enabled: false });
        if (insertedTeams.includes("media_club")) await adminClient.from("member_team_memberships").delete().eq("member_id", memberId).eq("team_key", "media_club");
      }
      // Keep an invited Auth account so an already-sent invitation link remains valid.
      // It has no member access until a later retry completes the application.
      await releaseApplication();
    };
    if (teamsReadError) {
      await rollback();
      return json({ error: `Membership lookup failed: ${teamsReadError.message}` }, 500);
    }
    if (missingTeams.includes("media_club")) {
      const { error: mediaTeamError } = await adminClient.from("member_team_memberships")
        .insert({ member_id: memberId, team_key: "media_club" });
      if (mediaTeamError) {
        await rollback();
        return json({ error: `Media Club membership setup failed: ${mediaTeamError.message}` }, 500);
      }
      insertedTeams.push("media_club");
    }
    if (missingTeams.includes("sac")) {
      const { error: sacTeamError } = await callerClient.rpc("set_sac_membership", {
        p_member_id: memberId,
        p_enabled: true,
      });
      if (sacTeamError) {
        await rollback();
        return json({ error: `SAC membership setup failed: ${sacTeamError.message}` }, 500);
      }
      insertedTeams.push("sac");
    }

    const { error: updateError } = await adminClient.from("join_applications").update({
      status: "approved",
      rejection_reason: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq("id", applicationId).eq("status", "pending");
    if (updateError) {
      await rollback();
      return json({ error: updateError.message }, 500);
    }
    const deliveryWarnings: string[] = [];
    const { error: notificationError } = await adminClient.from("notifications").insert({
      member_id: memberId,
      notification_type: "application_approved",
      title: `${target === "both" ? "Media Club and SAC" : target === "sac" ? "SAC" : "Media Club"} access approved`,
      message: includesSac ? "Your SAC membership is active. Open the SAC workspace with the workspace switcher." : "Your Media Club membership is active.",
      page: "home",
    });
    if (notificationError) deliveryWarnings.push("The in-app notification could not be saved.");

    let approvalEmailSent = false;
    if (existingAuthAccount) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
      if (!resendApiKey) deliveryWarnings.push("Approval email is not configured.");
      else {
        const rendered = renderApprovalEmail(application.name, target);
        const from = Deno.env.get("APPLICATION_FROM_EMAIL")
          || Deno.env.get("NOTIFICATION_FROM_EMAIL")
          || "FIS Media Club <notifications@auth.fismediaclub.org>";
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `application-approval-${applicationId}`,
            },
            body: JSON.stringify({ from, to: [normalizedEmail], subject: rendered.subject, html: rendered.html, text: rendered.text }),
            signal: AbortSignal.timeout(10_000),
          });
          const responseBody = await response.json().catch(() => null);
          approvalEmailSent = response.ok && typeof responseBody?.id === "string" && Boolean(responseBody.id.trim());
        } catch {
          approvalEmailSent = false;
        }
        if (!approvalEmailSent) deliveryWarnings.push("Approval email could not be sent; access is already active.");
      }
    }
    return json({ ok: true, invitationSent: Boolean(invitedUserId), approvalEmailSent, existingMember: Boolean(existingMember), existingAuthAccount, applicationTarget: target, deliveryWarnings });
  }

  const recipientEmail = String(application.email || "").trim().toLowerCase();
  if (!isFisSchoolEmail(recipientEmail)) {
    await releaseApplication();
    return json({ error: "The applicant does not have a valid FIS email address, so the rejection email was not sent." }, 400);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!resendApiKey) {
    await releaseApplication();
    return json({ error: "Rejection email delivery is not configured. Add RESEND_API_KEY to the Edge Function secrets." }, 503);
  }

  const infoUrl = Deno.env.get("PUBLIC_INFO_URL") || "https://info.fismediaclub.org";
  const from = Deno.env.get("APPLICATION_FROM_EMAIL")
    || Deno.env.get("NOTIFICATION_FROM_EMAIL")
    || "FIS Media Club <notifications@auth.fismediaclub.org>";
  const rendered = renderRejectionEmail({ applicantName: application.name, reason: rejectionReason, infoUrl });
  const emailPayload = {
    from,
    to: [recipientEmail],
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: [
      { name: "message_type", value: "application_rejected" },
      { name: "application_id", value: applicationId },
    ],
  };

  let emailResponse: Response;
  let emailResponseBody: Record<string, unknown> = {};
  try {
    emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `application-rejection-${applicationId}`,
      },
      body: JSON.stringify(emailPayload),
      signal: AbortSignal.timeout(10_000),
    });
    emailResponseBody = await emailResponse.json().catch(() => ({}));
  } catch (error) {
    await releaseApplication();
    const message = error instanceof Error ? error.message : "The email provider could not be reached.";
    return json({ error: `Rejection email was not sent: ${message}` }, 502);
  }

  if (!emailResponse.ok || typeof emailResponseBody?.id !== "string" || !emailResponseBody.id.trim()) {
    await releaseApplication();
    const message = String(emailResponseBody?.message || emailResponseBody?.error || `Resend returned ${emailResponse.status}`);
    return json({ error: `Rejection email was not sent: ${message}` }, 502);
  }

  const { error: updateError } = await adminClient.from("join_applications").update({
    status: "rejected",
    rejection_reason: rejectionReason,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  }).eq("id", applicationId);
  if (updateError) {
    await releaseApplication();
    return json({ error: `The email was sent, but the application could not be marked rejected: ${updateError.message}. Retry promptly; the delivery request is protected from duplicates for 24 hours.` }, 500);
  }
  return json({ ok: true, applicantEmail: recipientEmail, emailSent: true, providerMessageId: emailResponseBody.id });
});
