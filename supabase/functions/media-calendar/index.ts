import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { createCalendarHandler } from "./calendar.mjs";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// Custom authentication: 256-bit link secrets are hashed, checked by a service-only
// RPC, and tied to a current Media Club member. No JWT is exposed in subscription URLs.
Deno.serve(createCalendarHandler(async (hash: string) => {
  const { data, error } = await admin.rpc("read_media_calendar_feed", { p_token_hash: hash });
  if (error) throw new Error("Calendar lookup failed");
  return data;
}));
