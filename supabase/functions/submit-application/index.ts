import { createClient } from "npm:@supabase/supabase-js@2";

type TurnstileVerification = {
  success?: boolean;
  hostname?: string;
  action?: string;
};

const defaultAllowedOrigins = [
  "https://info.fismediaclub.org",
  "https://media-club-info.pages.dev",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];
const allowedOrigins = new Set(
  (Deno.env.get("PUBLIC_PORTAL_ORIGINS") || defaultAllowedOrigins.join(","))
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean),
);
const allowedHostnames = new Set(
  [...allowedOrigins]
    .map(origin => {
      try { return new URL(origin).hostname; } catch { return ""; }
    })
    .filter(Boolean),
);
const yearGroups = new Set(["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "Adult"]);
const experienceLevels = new Set(["Beginner", "Intermediate", "Proficient", "Advanced"]);
const interestOptions = new Set(["Photography", "Videography", "Podcasting", "Editing", "Writing"]);
const fisAliasEmailPattern = /^[a-z]{2}\d{4,}@fis\.edu$/i;
const fisSchoolEmailPattern = /^[^\s@]+@fis\.edu$/i;

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});

const json = (body: unknown, status: number, origin: string) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const text = (value: unknown, maximum: number) => String(value || "").trim().replace(/\s+/g, " ").slice(0, maximum);

function adminApiKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      if (parsed.default) return String(parsed.default);
    } catch {
      // Older projects expose only SUPABASE_SERVICE_ROLE_KEY below.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function validHttpsUrl(value: string) {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

async function verifyTurnstile(token: string, remoteIp: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return false;
    const result = await response.json() as TurnstileVerification;
    const hostnameAllowed = result.hostname === "dummy-key-pass" || Boolean(result.hostname && allowedHostnames.has(result.hostname));
    return result.success === true && result.action === "join_application" && hostnameAllowed;
  } catch {
    return false;
  }
}

Deno.serve(async request => {
  const origin = request.headers.get("Origin") || "";
  if (!allowedOrigins.has(origin)) return new Response("Forbidden", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Send the application as JSON." }, 415, origin);
  }

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json({ error: "The application was not valid JSON." }, 400, origin); }

  // Quietly accept the honeypot so automated submissions do not learn how they were detected.
  if (text(input.website, 200)) return json({ ok: true }, 201, origin);

  const firstName = text(input.firstName, 60);
  const lastName = text(input.lastName, 60);
  const email = text(input.email, 120).toLowerCase();
  const yearGroup = text(input.yearGroup, 20);
  const experienceLevel = text(input.experienceLevel, 30);
  const why = String(input.why || "").trim().slice(0, 1500);
  const workLink = text(input.workLink, 500);
  const turnstileToken = text(input.turnstileToken, 2048);
  const interests = Array.isArray(input.interests)
    ? [...new Set(input.interests.map(value => text(value, 40)).filter(value => interestOptions.has(value)))].slice(0, interestOptions.size)
    : [];

  if (!yearGroups.has(yearGroup) || !experienceLevels.has(experienceLevel)) {
    return json({ error: "Choose a valid year group and experience level." }, 400, origin);
  }
  const validEmail = yearGroup === "Adult" ? fisSchoolEmailPattern.test(email) : fisAliasEmailPattern.test(email);
  if (!firstName || !lastName || !validEmail || why.length < 20) {
    return json({ error: "Complete every required field and use the correct FIS email for the selected year group." }, 400, origin);
  }
  if (!validHttpsUrl(workLink)) return json({ error: "Previous work links must start with https://." }, 400, origin);

  const remoteIp = (request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || "").split(",")[0].trim();
  if (!turnstileToken || !await verifyTurnstile(turnstileToken, remoteIp)) {
    return json({ error: "Human verification expired or failed. Please try again." }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = adminApiKey();
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Applications are temporarily unavailable." }, 503, origin);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { error } = await adminClient.from("join_applications").insert({
    name: `${firstName} ${lastName}`,
    email,
    year_group: yearGroup,
    experience_level: experienceLevel,
    interests,
    why,
    work_link: workLink || null,
  });
  if (error?.code === "23505") return json({ error: "An application with this email is already awaiting review." }, 409, origin);
  if (error) {
    console.error("Public application insert failed", { code: error.code });
    return json({ error: "Your application could not be submitted. Please try again later." }, 500, origin);
  }
  return json({ ok: true }, 201, origin);
});
