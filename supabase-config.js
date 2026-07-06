// The anon key is safe to expose in frontend code when your tables are protected
// by Row Level Security policies. Never put the service_role key in this file.
window.CREW_CENTER_SUPABASE = {
  url: "https://prswuqzzgordywowbwtc.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByc3d1cXp6Z29yZHl3b3did3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDU0ODIsImV4cCI6MjA5ODkyMTQ4Mn0.N7eRfvik6PsAj4IDa6jA_gGbUV3bqee8oRBz7shWIsM",
};

window.crewCenterSupabase = window.supabase.createClient(
  window.CREW_CENTER_SUPABASE.url,
  window.CREW_CENTER_SUPABASE.anonKey
);
