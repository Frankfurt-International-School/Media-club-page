// The anon key is safe to expose in frontend code when your tables are protected
// by Row Level Security policies. Never put the service_role key in this file.
window.CREW_CENTER_SUPABASE = {
  url: "https://prswuqzzgordywowbwtc.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByc3d1cXp6Z29yZHl3b3did3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDU0ODIsImV4cCI6MjA5ODkyMTQ4Mn0.N7eRfvik6PsAj4IDa6jA_gGbUV3bqee8oRBz7shWIsM",
};

const fisAliasEmailPattern = /^[a-z]{2}\d{4,}@fis\.edu$/i;
const fisSchoolEmailPattern = /^[^\s@]+@fis\.edu$/i;
const fisAliasEmailMessage = "Use your school alias email: exactly 2 letters followed by at least 4 numbers, ending in @fis.edu (for example, XX12345@fis.edu).";
// The hashes are checked against the published HTML by tests. Change either document,
// update its date and hash here, and existing members will see the new agreement.
const legalDocumentVersions = Object.freeze({ terms: "2026-09-28-831101336107", privacy: "2026-10-13-2ff7a4ddb941" });
const authEntryIsSac = window.location.hostname === "sac.fismediaclub.org"
  || /^\/sac(?:\/|$)/.test(window.location.pathname)
  || new URLSearchParams(window.location.search).get("workspace") === "sac";
window.isFisAliasEmail = email => fisAliasEmailPattern.test(String(email || "").trim());
window.isFisSchoolEmail = email => fisSchoolEmailPattern.test(String(email || "").trim());
window.FIS_ALIAS_EMAIL_MESSAGE = fisAliasEmailMessage;

document.body.classList.add("auth-locked");

const authStyle = document.createElement("style");
authStyle.textContent = `
  body.auth-locked .sidebar,
  body.auth-locked .main {
    display: none !important;
  }

  body.auth-ready .auth-gate {
    display: none !important;
  }

  .auth-gate [hidden] {
    display: none !important;
  }

  .auth-gate {
    min-height: 100vh;
    width: 100%;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      linear-gradient(135deg, rgba(234,122,244,0.13), transparent 34%),
      linear-gradient(315deg, rgba(78,240,196,0.10), transparent 30%),
      #ffffff;
    color: #212529;
    font-family: 'Space Grotesk', sans-serif;
  }

  .auth-gate-card {
    width: min(100%, 420px);
    background: rgba(248,249,250,0.92);
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px;
    padding: 28px;
    backdrop-filter: blur(10px);
  }

  .auth-gate-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
  }

  .auth-gate-logo {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(176,5,43,0.2);
  }

  .auth-gate-name,
  .auth-gate-title {
    font-family: 'Bebas Neue', sans-serif;
    letter-spacing: 1px;
    font-weight: normal;
  }

  .auth-gate-name {
    font-size: 22px;
    line-height: 1;
  }

  .auth-gate-kicker {
    color: #6c757d;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .auth-gate-title {
    font-size: 34px;
    line-height: 1;
    margin-bottom: 6px;
  }

  .auth-gate-title[tabindex="-1"]:focus { outline: none; }

  .auth-gate-sub {
    color: #495057;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 22px;
  }

  .auth-gate-label {
    display: block;
    color: #495057;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .auth-gate-field {
    margin-bottom: 16px;
  }

  .auth-password-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
  }

  .auth-password-heading .auth-gate-label {
    margin-bottom: 0;
  }

  .auth-password-reset {
    appearance: none;
    background: transparent;
    border: 0;
    color: #7e176f;
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 0;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .auth-password-reset:hover {
    color: #a40134;
  }

  .auth-password-reset:focus-visible {
    border-radius: 4px;
    outline: 3px solid rgba(234,122,244,0.22);
    outline-offset: 2px;
  }

  .auth-password-reset:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .auth-remember {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: -2px 0 16px;
    color: #495057;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
  }

  .auth-remember input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: #EA7AF4;
  }

  .auth-gate-input {
    width: 100%;
    background: #f1f3f5;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 8px;
    color: #212529;
    font: inherit;
    font-size: 13px;
    outline: none;
    padding: 10px 12px;
  }

  .auth-gate-input:focus {
    border-color: rgba(234,122,244,0.55);
    box-shadow: 0 0 0 3px rgba(234,122,244,0.09);
  }

  .auth-gate-button,
  .auth-secondary-button,
  .auth-signout {
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    font-family: 'Bebas Neue', sans-serif;
    letter-spacing: 1px;
  }

  .auth-gate-button {
    width: 100%;
    min-height: 40px;
    background: #EA7AF4;
    color: #0d0d0f;
    font-size: 14px;
  }

  .auth-gate-button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .auth-secondary-button {
    width: 100%;
    min-height: 40px;
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.12);
    color: #212529;
    font-size: 14px;
  }

  .auth-secondary-button:hover {
    border-color: rgba(234,122,244,0.7);
    background: rgba(234,122,244,0.05);
  }

  .auth-public-option {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid rgba(0,0,0,0.08);
  }

  .auth-public-option p {
    margin: 0 0 10px;
    color: #6c757d;
    font-size: 11px;
    line-height: 1.5;
  }

  .auth-public-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
    padding: 10px 12px;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 8px;
    background: #ffffff;
    color: #212529;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
  }

  .auth-public-link:hover { border-color: rgba(234,122,244,0.7); }
  .auth-public-link span { color: #a40134; }

  .auth-gate-error {
    display: none;
    background: rgba(255,123,94,0.12);
    border: 1px solid rgba(255,123,94,0.22);
    border-radius: 8px;
    color: #ff7b5e;
    font-size: 12px;
    padding: 10px 12px;
    margin-bottom: 14px;
  }

  .auth-gate-error.visible {
    display: block;
  }

  .auth-gate-error.success {
    background: rgba(24,162,120,0.12);
    border-color: rgba(24,162,120,0.24);
    color: #116b51;
  }

  .auth-gate-note {
    color: #6c757d;
    font-size: 12px;
    margin-top: 14px;
  }

  .auth-legal {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 5px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid rgba(0,0,0,0.08);
    color: #777b84;
    font-size: 10px;
    line-height: 1.5;
    text-align: center;
  }

  .auth-legal a {
    color: #7e176f;
    font-weight: 600;
    text-underline-offset: 2px;
  }

  .auth-legal a:hover { color: #a40134; }

  .auth-legal a:focus-visible {
    border-radius: 3px;
    outline: 3px solid rgba(234,122,244,0.22);
    outline-offset: 2px;
  }

  .auth-signout {
    display: none;
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 180;
    background: #f1f3f5;
    border: 1px solid rgba(0,0,0,0.08);
    color: #495057;
    padding: 9px 14px;
  }

  .auth-signout.visible {
    display: block;
  }

  body.auth-locked .auth-signout {
    display: none;
  }

  .auth-lookup-actions { display: none; gap: 8px; margin: 10px 0 16px; }
  .auth-lookup-actions.visible { display: flex; }
  .auth-lookup-actions button { flex: 1; }

  .auth-expired-actions {
    display: none;
    flex-direction: column;
    gap: 8px;
  }

  .auth-expired-actions.visible {
    display: flex;
  }

  .auth-setup-recovery {
    margin-top: 16px;
  }

  .auth-setup-recovery p {
    color: #6c757d;
    font-size: 12px;
    line-height: 1.5;
    margin: 0 0 8px;
  }

  .auth-gate-card.legal-step {
    width: min(100%, 520px);
    padding: clamp(24px, 5vw, 38px);
    border-radius: 28px;
    background: rgba(255,255,255,0.86);
    border-color: rgba(255,255,255,0.9);
    box-shadow: 0 28px 90px rgba(31,28,52,0.13), 0 1px 8px rgba(31,28,52,0.05);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .legal-step .auth-gate-brand { margin-bottom: 30px; }
  .legal-step .auth-gate-title {
    font: 700 clamp(27px, 5vw, 34px)/1.13 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    letter-spacing: -0.04em;
    margin-bottom: 10px;
  }
  .legal-step .auth-gate-sub { font-size: 14px; line-height: 1.6; margin-bottom: 22px; }
  .auth-legal-agreement { display: grid; gap: 16px; }
  .auth-legal-kicker {
    display: inline-flex;
    width: max-content;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(164,1,52,0.08);
    color: #8e1240;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .auth-legal-docs { display: grid; gap: 9px; }
  .auth-legal-doc {
    display: flex;
    align-items: center;
    gap: 13px;
    min-height: 68px;
    padding: 12px 14px;
    border: 1px solid rgba(33,37,41,0.09);
    border-radius: 17px;
    background: rgba(255,255,255,0.78);
    color: #20232c;
    text-decoration: none;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }
  .auth-legal-doc:hover {
    transform: translateY(-2px);
    border-color: rgba(164,1,52,0.33);
    box-shadow: 0 8px 24px rgba(31,28,52,0.08);
  }
  .auth-legal-doc:focus-visible,
  .auth-legal-actions button:focus-visible {
    outline: 3px solid rgba(164,1,52,0.32);
    outline-offset: 3px;
  }
  .auth-legal-doc-icon {
    display: grid;
    place-items: center;
    width: 39px;
    height: 39px;
    flex: none;
    border-radius: 12px;
    background: #f3e7ec;
    color: #9a1741;
    font-size: 19px;
  }
  .auth-legal-doc-copy { display: grid; gap: 2px; min-width: 0; }
  .auth-legal-doc-copy strong { font-size: 13px; letter-spacing: -0.01em; }
  .auth-legal-doc-copy small { color: #69707b; font-size: 11px; }
  .auth-legal-doc-arrow { margin-left: auto; color: #7a7f88; font-size: 18px; }
  .auth-legal-meaning { margin: 0; color: #535a65; font-size: 12px; line-height: 1.55; }
  .auth-legal-actions { display: grid; gap: 9px; }
  .auth-legal-accept {
    min-height: 52px;
    border: 0;
    border-radius: 14px;
    background: #a40134;
    color: #fff;
    cursor: pointer;
    font: 700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 8px 19px rgba(164,1,52,0.17);
    transition: transform 160ms ease, box-shadow 160ms ease;
  }
  .auth-legal-accept:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(164,1,52,0.22); }
  .auth-legal-accept:disabled { cursor: wait; opacity: 0.62; transform: none; }
  .auth-legal-secondary { display: flex; justify-content: center; gap: 14px; }
  .auth-legal-secondary button {
    padding: 8px;
    border: 0;
    background: transparent;
    color: #686e78;
    cursor: pointer;
    font: 600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .auth-legal-secondary button:hover { color: #a40134; }
  @media (max-width: 520px) {
    .auth-gate { padding: 14px; }
    .auth-gate-card.legal-step { border-radius: 24px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .auth-legal-doc, .auth-legal-accept { transition: none; }
  }

  :root[data-theme="dark"] .auth-gate {
    background:
      linear-gradient(135deg, rgba(164,1,52,0.22), transparent 36%),
      linear-gradient(315deg, rgba(94,170,255,0.10), transparent 32%),
      #101116;
    color: #f2f3f5;
  }
  :root[data-theme="dark"] .auth-gate-card {
    background: rgba(23,24,31,0.94);
    border-color: rgba(255,255,255,0.10);
    box-shadow: 0 24px 70px rgba(0,0,0,0.28);
  }
  :root[data-theme="dark"] .auth-gate-logo { background: #f8f9fa; }
  :root[data-theme="dark"] .auth-gate-kicker,
  :root[data-theme="dark"] .auth-public-option p,
  :root[data-theme="dark"] .auth-gate-note,
  :root[data-theme="dark"] .auth-setup-recovery p,
  :root[data-theme="dark"] .auth-legal { color: #858a97; }
  :root[data-theme="dark"] .auth-gate-sub,
  :root[data-theme="dark"] .auth-gate-label,
  :root[data-theme="dark"] .auth-remember { color: #b9bdc7; }
  :root[data-theme="dark"] .auth-password-reset { color: #f0a8f7; }
  :root[data-theme="dark"] .auth-password-reset:hover { color: #ffffff; }
  :root[data-theme="dark"] .auth-gate-error.success { color: #70dfba; }
  :root[data-theme="dark"] .auth-gate-input {
    background: #20212a;
    border-color: rgba(255,255,255,0.10);
    color: #f2f3f5;
  }
  :root[data-theme="dark"] .auth-public-option { border-color: rgba(255,255,255,0.10); }
  :root[data-theme="dark"] .auth-legal { border-color: rgba(255,255,255,0.10); }
  :root[data-theme="dark"] .auth-legal a { color: #f0a8f7; }
  :root[data-theme="dark"] .auth-legal a:hover { color: #ffffff; }
  :root[data-theme="dark"] .auth-secondary-button,
  :root[data-theme="dark"] .auth-public-link {
    background: #20212a;
    border-color: rgba(255,255,255,0.12);
    color: #f2f3f5;
  }
  :root[data-theme="dark"] .auth-secondary-button:hover,
  :root[data-theme="dark"] .auth-public-link:hover { background: rgba(164,1,52,0.18); }
  :root[data-theme="dark"] .auth-signout {
    background: #20212a;
    border-color: rgba(255,255,255,0.10);
    color: #b9bdc7;
  }
  :root[data-theme="dark"] .auth-gate-card.legal-step {
    background: rgba(25,26,34,0.92);
    border-color: rgba(255,255,255,0.11);
  }
  :root[data-theme="dark"] .auth-legal-kicker { background: rgba(234,122,244,0.14); color: #f0a8f7; }
  :root[data-theme="dark"] .auth-legal-doc { background: rgba(255,255,255,0.045); border-color: rgba(255,255,255,0.12); color: #f2f3f5; }
  :root[data-theme="dark"] .auth-legal-doc:hover { border-color: rgba(240,168,247,0.45); }
  :root[data-theme="dark"] .auth-legal-doc-icon { background: rgba(234,122,244,0.13); color: #f0a8f7; }
  :root[data-theme="dark"] .auth-legal-doc-copy small,
  :root[data-theme="dark"] .auth-legal-meaning,
  :root[data-theme="dark"] .auth-legal-secondary button { color: #b9bdc7; }
  :root[data-theme="dark"] .auth-legal-accept { background: #c41b57; }
`;
document.head.appendChild(authStyle);

document.body.insertAdjacentHTML("afterbegin", `
  <section class="auth-gate" aria-labelledby="auth-gate-title">
    <div class="auth-gate-card">
      <div class="auth-gate-brand">
        <img class="auth-gate-logo" src="${authEntryIsSac ? "assets/sac-warriors-mark.png" : "assets/media-club-logo.png"}" width="128" height="128" alt="${authEntryIsSac ? "Frankfurt Warriors" : "Media Club"} logo">
        <div>
          <div class="auth-gate-name">${authEntryIsSac ? "SAC" : "Media Club"}</div>
          <div class="auth-gate-kicker">${authEntryIsSac ? "Student Athletic Council" : "FIS Student Media Club"}</div>
        </div>
      </div>
      <h1 class="auth-gate-title" id="auth-gate-title" tabindex="-1">Sign in</h1>
      <p class="auth-gate-sub">Use your approved Crew Center account to sign in.</p>
      <div class="auth-gate-error" id="auth-gate-error" role="alert" aria-live="polite"></div>
      <div class="auth-lookup-actions" id="auth-lookup-actions">
        <button class="auth-gate-button" id="auth-lookup-retry" type="button">Retry account check</button>
        <button class="auth-secondary-button" id="auth-lookup-signout" type="button">Sign out</button>
      </div>
      <form id="auth-gate-form">
        <div class="auth-gate-field">
          <label class="auth-gate-label" for="auth-gate-email">Email</label>
          <input class="auth-gate-input" id="auth-gate-email" type="email" autocomplete="email" inputmode="email" placeholder="Your account email" required>
        </div>
        <div class="auth-gate-field" id="auth-password-field">
          <div class="auth-password-heading">
            <label class="auth-gate-label" for="auth-gate-password">Password</label>
            <button class="auth-password-reset" id="auth-password-reset" type="button">Forgot password?</button>
          </div>
          <input class="auth-gate-input" id="auth-gate-password" type="password" autocomplete="current-password" placeholder="Password" required>
        </div>
        <label class="auth-remember" id="auth-remember-row" for="auth-remember-browser">
          <input id="auth-remember-browser" type="checkbox" checked>
          <span>Remember me on this browser</span>
        </label>
        <button class="auth-gate-button" id="auth-gate-submit" type="submit">Sign in</button>
        <div class="auth-expired-actions" id="auth-expired-actions">
          <button class="auth-gate-button" id="auth-expired-resend" type="button">Email me a new password link</button>
          <button class="auth-secondary-button" id="auth-expired-back" type="button">Back to sign in</button>
        </div>
      </form>
      <div class="auth-legal-agreement" id="auth-legal-agreement" hidden>
        <span class="auth-legal-kicker">One clear step · Your choice</span>
        <div class="auth-legal-docs" aria-label="Documents to review">
          <a class="auth-legal-doc" href="/terms" target="_blank" rel="noopener noreferrer">
            <span class="auth-legal-doc-icon" aria-hidden="true">§</span>
            <span class="auth-legal-doc-copy"><strong>Terms of Use</strong><small>Rules for using Crew Center</small></span>
            <span class="auth-legal-doc-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="auth-legal-doc" href="/privacy" target="_blank" rel="noopener noreferrer">
            <span class="auth-legal-doc-icon" aria-hidden="true">◈</span>
            <span class="auth-legal-doc-copy"><strong>Privacy &amp; Data</strong><small>What information is used and why</small></span>
            <span class="auth-legal-doc-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
        <p class="auth-legal-meaning">By continuing, you agree to the Terms of Use and acknowledge that you have been given the Privacy &amp; Data notice. This is not consent to optional data uses.</p>
        <div class="auth-legal-actions">
          <button class="auth-legal-accept" id="auth-legal-accept" type="button">Agree &amp; continue <span aria-hidden="true">→</span></button>
          <div class="auth-legal-secondary">
            <button id="auth-legal-retry" type="button" hidden>Retry check</button>
            <button id="auth-legal-signout" type="button">Sign out</button>
          </div>
        </div>
      </div>
      <div class="auth-public-option" id="auth-public-option">
        <p>Not a member yet? Learn about Media Club, see a sample dashboard, and apply without creating a visitor account.</p>
        <a class="auth-public-link" href="https://info.fismediaclub.org/">Open the public Media Club site <span aria-hidden="true">→</span></a>
      </div>
      <form id="auth-password-setup-form" style="display:none;">
        <div class="auth-gate-field">
          <label class="auth-gate-label" for="auth-new-password">New password</label>
          <input class="auth-gate-input" id="auth-new-password" type="password" autocomplete="new-password" minlength="8" required>
        </div>
        <div class="auth-gate-field">
          <label class="auth-gate-label" for="auth-confirm-password">Confirm password</label>
          <input class="auth-gate-input" id="auth-confirm-password" type="password" autocomplete="new-password" minlength="8" required>
        </div>
        <button class="auth-gate-button" id="auth-password-setup-submit" type="submit">Set password</button>
        <div class="auth-setup-recovery">
          <p>Link expired or not working? Get another password link. You do not need to apply again.</p>
          <button class="auth-secondary-button" id="auth-setup-recovery" type="button">Get another password link</button>
        </div>
      </form>
      <p class="auth-gate-note">Please submit an application for an account.</p>
      <div class="auth-legal" aria-label="Privacy and legal information">
        <span>Voluntary student club system.</span>
        <a href="/privacy">Privacy &amp; data</a>
        <span aria-hidden="true">·</span>
        <a href="/terms">Terms</a>
        <span aria-hidden="true">·</span>
        <a href="/impressum">Impressum</a>
      </div>
    </div>
  </section>
  <button class="auth-signout" id="auth-signout" type="button">Sign out</button>
`);

const authError = document.getElementById("auth-gate-error");
const authForm = document.getElementById("auth-gate-form");
const authSubmit = document.getElementById("auth-gate-submit");
const authEmail = document.getElementById("auth-gate-email");
const authPassword = document.getElementById("auth-gate-password");
const authRemember = document.getElementById("auth-remember-browser");
const authPasswordReset = document.getElementById("auth-password-reset");
const authPasswordField = document.getElementById("auth-password-field");
const authRememberRow = document.getElementById("auth-remember-row");
const authExpiredActions = document.getElementById("auth-expired-actions");
const authExpiredResend = document.getElementById("auth-expired-resend");
const authExpiredBack = document.getElementById("auth-expired-back");
const passwordSetupForm = document.getElementById("auth-password-setup-form");
const authSetupRecovery = document.getElementById("auth-setup-recovery");
const authLookupActions = document.getElementById("auth-lookup-actions");
const authLookupRetry = document.getElementById("auth-lookup-retry");
const authGateCard = document.querySelector(".auth-gate-card");
const legalAgreement = document.getElementById("auth-legal-agreement");
const legalAccept = document.getElementById("auth-legal-accept");
const legalRetry = document.getElementById("auth-legal-retry");
let pendingLegalUser = null;
let pendingApprovalCheckUser = null;
const pendingPasswordSetupKey = "crew-center-pending-password-setup";
const normalizePasswordSetupMode = mode => ["invite", "recovery"].includes(String(mode || "").toLowerCase())
  ? String(mode).toLowerCase()
  : "";
const authHashParams = new URLSearchParams(window.location.hash.slice(1));
const authSearchParams = new URLSearchParams(window.location.search);
const authCallbackHasCredentials = Boolean(
  authHashParams.get("access_token") || authHashParams.get("refresh_token")
  || authHashParams.get("token_hash") || authSearchParams.get("code")
);
const authLinkErrorCode = authHashParams.get("error_code") || authSearchParams.get("error_code") || "";
const authLinkErrorDescription = authHashParams.get("error_description") || authSearchParams.get("error_description") || "";
const authLinkFailure = Boolean(
  authLinkErrorCode
  || authHashParams.get("error")
  || authSearchParams.get("error")
);
const authLinkExpired = authLinkErrorCode === "otp_expired"
  || /expired|invalid/i.test(authLinkErrorDescription);
const authLinkType = authLinkFailure ? "" : normalizePasswordSetupMode(
  authHashParams.get("type") || authSearchParams.get("type")
);
if (authLinkFailure) {
  sessionStorage.removeItem(pendingPasswordSetupKey);
  localStorage.removeItem(pendingPasswordSetupKey);
  history.replaceState({ page: "signin" }, "", "/signin");
}
const storedPasswordSetupMode = normalizePasswordSetupMode(
  authLinkFailure ? "" : sessionStorage.getItem(pendingPasswordSetupKey) || localStorage.getItem(pendingPasswordSetupKey)
);
let passwordSetupMode = authLinkType || storedPasswordSetupMode;
let passwordSetupComplete = false;
let pendingAuthLinkFailure = authLinkFailure ? { expired: authLinkExpired } : null;
const rememberPreferenceKey = "crew-center-remember-session";
const shouldRememberSession = () => localStorage.getItem(rememberPreferenceKey) !== "false";
const authStorage = {
  getItem(key) {
    return sessionStorage.getItem(key) || (shouldRememberSession() ? localStorage.getItem(key) : null);
  },
  setItem(key, value) {
    const preferredStorage = shouldRememberSession() ? localStorage : sessionStorage;
    const otherStorage = shouldRememberSession() ? sessionStorage : localStorage;
    preferredStorage.setItem(key, value);
    otherStorage.removeItem(key);
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

authRemember.checked = shouldRememberSession();
authRemember.addEventListener("change", () => {
  localStorage.setItem(rememberPreferenceKey, String(authRemember.checked));
});

function passwordSetupRequired() {
  return Boolean(passwordSetupMode && !passwordSetupComplete);
}

function rememberPendingPasswordSetup(mode) {
  passwordSetupMode = normalizePasswordSetupMode(mode) || "invite";
  sessionStorage.setItem(pendingPasswordSetupKey, passwordSetupMode);
  localStorage.setItem(pendingPasswordSetupKey, passwordSetupMode);
}

function clearPendingPasswordSetup() {
  passwordSetupMode = "";
  sessionStorage.removeItem(pendingPasswordSetupKey);
  localStorage.removeItem(pendingPasswordSetupKey);
}

function passwordSetupSubmitLabel() {
  return passwordSetupMode === "recovery" ? "Save new password" : "Set password";
}

window.crewCenterSupabase = window.supabase?.createClient(
  window.CREW_CENTER_SUPABASE.url,
  window.CREW_CENTER_SUPABASE.anonKey,
  { auth: { persistSession: true, storage: authStorage } }
);

const authStartupTimeoutMs = 8000;
const authOperationTimeoutMs = 8000;
const memberApprovalTimeoutMs = 3000;
let authActivationPromise = null;
let authActivationUserId = "";
let authActivationSequence = 0;
let authStartupSettled = false;
let signOutRequested = false;
let initialDataEpoch = -1;
window.CREW_CENTER_AUTH_EPOCH = Number(window.CREW_CENTER_AUTH_EPOCH || 0);

function withCrewCenterTimeout(operation, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message);
      error.name = "CrewCenterTimeoutError";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve(operation), timeout]).finally(() => clearTimeout(timer));
}

function clearStoredCrewCenterSession() {
  let projectRef = "";
  try {
    projectRef = new URL(window.CREW_CENTER_SUPABASE.url).hostname.split(".")[0];
  } catch (error) {
    console.warn("Couldn't resolve the Supabase project storage key.", error);
  }
  if (!projectRef) return;
  const authKey = `sb-${projectRef}-auth-token`;
  [localStorage, sessionStorage].forEach(storage => {
    const matchingKeys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key === authKey || key?.startsWith(`${authKey}-`)) matchingKeys.push(key);
    }
    matchingKeys.forEach(key => storage.removeItem(key));
  });
}

function setAuthMessage(message = "", type = "error") {
  authError.textContent = message;
  authError.classList.toggle("visible", Boolean(message));
  authError.classList.toggle("success", type === "success");
  authError.setAttribute("role", type === "success" ? "status" : "alert");
}

function setAuthError(message = "") {
  setAuthMessage(message, "error");
}

function setAuthBusy(isBusy) {
  authSubmit.disabled = isBusy;
  authSubmit.textContent = isBusy ? "Signing in..." : "Sign in";
  authPasswordReset.disabled = isBusy;
}

function setPasswordResetBusy(isBusy) {
  authPasswordReset.disabled = isBusy;
  authPasswordReset.textContent = isBusy ? "Sending..." : "Forgot password?";
  authExpiredResend.disabled = isBusy;
  authExpiredResend.textContent = isBusy ? "Sending..." : "Email me a new password link";
  authEmail.disabled = isBusy;
  authSubmit.disabled = isBusy;
}

function applyAdminControls() {
  const hasAdminPanelAccess = Boolean(window.CREW_CENTER_IS_ADMIN || window.canAccessCrewCenterAdminPanel?.());
  const hasCrewOperationsAccess = Boolean(hasAdminPanelAccess || window.canManageCrewOperations?.());
  const hasMeetingCreationAccess = Boolean(window.canCreateCrewCenterMeetings?.());
  const hasEquipmentStatusAccess = Boolean(window.canAccessCrewCenterEquipmentStatus?.());
  const isVisitor = Boolean(window.CREW_CENTER_IS_VISITOR);
  const canAddMembers = Boolean(window.CREW_CENTER_IS_ADMIN || window.canAddCrewCenterMembers?.());
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = hasAdminPanelAccess && !isVisitor ? "flex" : "none";
  });
  const adminSelectors = [
    '.nav-item[data-page="admin"]',
    'button[onclick*="removeMember"]',
    'button[onclick*="renderManageEvents"]',
  ];
  const crewOperationsSelectors = [
    'button[onclick*="openEventEditor"]',
    'button[onclick*="equip-add-modal"]',
    'button[onclick*="addEquipment"]',
    'button[onclick*="addEvent"]',
    'button[onclick*="requestArchiveEvent"]',
    'button[onclick*="restoreArchivedEvent"]',
    'button[onclick*="requestArchiveEquipment"]',
    'button[onclick*="restoreArchivedEquipment"]',
  ];

  adminSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (el.classList.contains("admin-only")) {
        el.style.display = hasAdminPanelAccess && !isVisitor ? "flex" : "none";
      } else {
        el.style.display = hasAdminPanelAccess ? "" : "none";
      }
    });
  });

  document.querySelectorAll('button[onclick*="member-modal"], button[onclick*="addMember"]').forEach(el => {
    el.style.display = canAddMembers && !isVisitor ? "" : "none";
  });

  crewOperationsSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.style.display = hasCrewOperationsAccess && !isVisitor ? "" : "none";
    });
  });
  document.querySelectorAll('.meeting-creation-only').forEach(el => {
    el.style.display = hasMeetingCreationAccess && !isVisitor ? "flex" : "none";
  });
  document.querySelectorAll('.equipment-status-only').forEach(el => {
    el.style.display = hasEquipmentStatusAccess && !isVisitor ? "flex" : "none";
  });
  const hasCrewScheduleAccess = Boolean(window.CREW_CENTER_IS_ADMIN || window.canAccessCrewSchedule?.());
  document.querySelectorAll('.crew-schedule-only').forEach(el => {
    el.style.display = hasCrewScheduleAccess && !isVisitor ? "flex" : "none";
  });
  const visitorHiddenSelectors = [
    '.nav-item[data-page="meetings"]',
    '.nav-item[data-page="signup"]',
    '.nav-item[data-page="my-crew-schedule"]',
    '.nav-item[data-page="members"]',
    '.sidebar-footer',
  ];
  visitorHiddenSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.style.display = isVisitor ? "none" : "";
    });
  });
  enforceVisitorPageAccess();
}

window.applyCrewCenterAdminControls = applyAdminControls;

function enforceVisitorPageAccess() {
  if (!window.CREW_CENTER_IS_VISITOR) return;
  const allowedPages = new Set(["about", "home", "events", "gallery", "equipment", "role-guide", "join"]);
  const activePage = document.querySelector(".page.active")?.id?.replace("page-", "") || "home";
  if (!allowedPages.has(activePage) && typeof window.navigate === "function") {
    window.navigate("about");
  }
}

function showNotAuthorized(action = "do that") {
  if (typeof window.showToast === "function") {
    window.showToast(`Not authorized: you cannot ${action}.`, "error");
  } else {
    setAuthError(`Not authorized: you cannot ${action}.`);
  }
}

function installAdminFunctionGuards() {
  const adminGuarded = {
    removeMember: "remove members",
    postAnnouncement: "post announcements",
    requestDeleteAnnouncement: "delete announcements",
    deleteAnn: "delete announcements",
    renderAdmin: "open the admin panel",
  };
  const authAdminGuarded = {
    addMember: "add members",
    requestPermanentDeleteEvent: "permanently delete events",
    requestPermanentDeleteEquipment: "permanently delete equipment",
  };
  const crewOperationsGuarded = {
    openEventEditor: "manage events",
    addEvent: "save events",
    addEquipment: "add equipment",
    requestArchiveEvent: "archive events",
    restoreArchivedEvent: "restore events",
    requestArchiveEquipment: "archive equipment",
    restoreArchivedEquipment: "restore equipment",
  };

  Object.entries(adminGuarded).forEach(([name, action]) => {
    if (typeof window[name] !== "function" || window[name].__adminGuarded) return;
    const original = window[name];
    window[name] = function(...args) {
      const allowed = Boolean(window.CREW_CENTER_IS_ADMIN || window.canAccessCrewCenterAdminPanel?.());
      if (!allowed) {
        showNotAuthorized(action);
        return undefined;
      }
      return original.apply(this, args);
    };
    window[name].__adminGuarded = true;
  });

  Object.entries(authAdminGuarded).forEach(([name, action]) => {
    if (typeof window[name] !== "function" || window[name].__adminGuarded) return;
    const original = window[name];
    window[name] = function(...args) {
      if (!window.CREW_CENTER_IS_ADMIN) {
        showNotAuthorized(action);
        return undefined;
      }
      return original.apply(this, args);
    };
    window[name].__adminGuarded = true;
  });

  Object.entries(crewOperationsGuarded).forEach(([name, action]) => {
    if (typeof window[name] !== "function" || window[name].__adminGuarded) return;
    const original = window[name];
    window[name] = function(...args) {
      const allowed = Boolean(window.CREW_CENTER_IS_ADMIN || window.canManageCrewOperations?.());
      if (!allowed) {
        showNotAuthorized(action);
        return undefined;
      }
      return original.apply(this, args);
    };
    window[name].__adminGuarded = true;
  });

  if (typeof window.navigate === "function" && !window.navigate.__adminGuarded) {
    const originalNavigate = window.navigate;
    const visitorAllowedPages = new Set(["about", "home", "events", "gallery", "equipment", "role-guide", "join"]);
    window.navigate = function(id, ...args) {
      const hasAdminPanelAccess = Boolean(window.CREW_CENTER_IS_ADMIN || window.canAccessCrewCenterAdminPanel?.());
      if (id === "admin" && !hasAdminPanelAccess) {
        return originalNavigate.call(this, "home");
      }
      if (id === "equipment-status" && !Boolean(window.canAccessCrewCenterEquipmentStatus?.())) {
        showNotAuthorized("open Equipment Status");
        return originalNavigate.call(this, "home");
      }
      if (id === "crew-deployment" && !Boolean(window.CREW_CENTER_IS_ADMIN || window.canAccessCrewSchedule?.())) {
        showNotAuthorized("open Crew Schedule");
        return originalNavigate.call(this, "home");
      }
      if (window.CREW_CENTER_IS_VISITOR && !visitorAllowedPages.has(id)) {
        showNotAuthorized("open that page");
        return undefined;
      }
      return originalNavigate.call(this, id, ...args);
    };
    window.navigate.__adminGuarded = true;
  }

  if (typeof window.openModal === "function" && !window.openModal.__adminGuarded) {
    const originalOpenModal = window.openModal;
    window.openModal = function(id, ...args) {
      const adminModalIds = ["member-modal"];
      const crewOperationsModalIds = ["event-modal", "equip-add-modal"];
      if (id === "gallery-modal" && window.CREW_CENTER_IS_VISITOR) {
        showNotAuthorized("submit gallery projects");
        return undefined;
      }
      if (adminModalIds.includes(id) && !Boolean(window.CREW_CENTER_IS_ADMIN || window.canAccessCrewCenterAdminPanel?.())) {
        showNotAuthorized("manage club content");
        return undefined;
      }
      if (crewOperationsModalIds.includes(id) && !Boolean(window.CREW_CENTER_IS_ADMIN || window.canManageCrewOperations?.())) {
        showNotAuthorized("manage production content");
        return undefined;
      }
      return originalOpenModal.call(this, id, ...args);
    };
    window.openModal.__adminGuarded = true;
  }
}

function applySignedInUser(user) {
  window.CREW_CENTER_AUTH_USER = user;
  if (typeof window.applyCrewCenterAuthUser === "function") {
    window.applyCrewCenterAuthUser(user);
  }
  const metadata = user.user_metadata || {};
  const appMetadata = user.app_metadata || {};
  const isVisitor = Boolean(user.is_anonymous) || (appMetadata.role || metadata.role || "").toLowerCase() === "visitor";
  const memberRecord = window.currentMemberRecord?.();
  const name = memberRecord?.name || (isVisitor ? "Visitor" : "Media Club member");
  window.CREW_CENTER_IS_ADMIN = (appMetadata.role || "").toLowerCase() === "admin";
  window.CREW_CENTER_IS_VISITOR = isVisitor;
  const role = isVisitor ? "Visitor" : window.CREW_CENTER_IS_ADMIN ? "Admin" : "Member";
  const initials = memberRecord ? name.split(/\s+/).map(part => part[0]).join("").slice(0, 3).toUpperCase() || "MC" : isVisitor ? "V" : "MC";
  const avatarUrl = memberRecord?.avatarUrl || "";
  const palette = {
    green: ["rgba(234,122,244,0.15)", "#EA7AF4"],
    purple: ["rgba(180,157,255,0.12)", "#b49dff"],
    coral: ["rgba(255,123,94,0.12)", "#ff7b5e"],
    teal: ["rgba(78,240,196,0.1)", "#4ef0c4"],
    amber: ["rgba(255,181,71,0.1)", "#ffb547"],
    blue: ["rgba(94,170,255,0.1)", "#5eaaff"],
  };
  const colorNames = Object.keys(palette);
  const colorSeed = [...(metadata.color || user.id || user.email || name)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const colorName = palette[metadata.color] ? metadata.color : colorNames[colorSeed % colorNames.length];
  const [avatarBg, avatarFg] = palette[colorName];
  const surfaces = [
    ["sidebar-user-name", name],
    ["sidebar-user-avatar", initials],
    ["profile-preview-name", name],
    ["profile-preview-role", role],
    ["profile-preview-email", ""],
    ["profile-preview-avatar", initials],
  ];

  surfaces.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
  ["sidebar-user-avatar", "profile-preview-avatar"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = avatarUrl ? "" : initials;
    el.style.background = avatarUrl ? `url("${avatarUrl}") center/cover` : avatarBg;
    el.style.color = avatarFg;
  });
  applyAdminControls();
}

function finishCrewCenterStartup() {
  const user = window.CREW_CENTER_AUTH_USER;
  if (!user || signOutRequested || !document.body.classList.contains("auth-ready")) return false;
  applySignedInUser(user);
  const authEpoch = Number(window.CREW_CENTER_AUTH_EPOCH || 0);
  const loadInitialData = window.loadCrewCenterInitialData || window.loadCrewCenterData;
  if (typeof loadInitialData === "function" && initialDataEpoch !== authEpoch) {
    initialDataEpoch = authEpoch;
    Promise.resolve(loadInitialData()).catch(error => {
      if (initialDataEpoch === authEpoch) initialDataEpoch = -1;
      console.error("Couldn't finish the initial Crew Center refresh.", error);
    });
  }
  if (typeof window.subscribeToCrewCenterChanges === "function") {
    window.subscribeToCrewCenterChanges();
  }
  return true;
}

window.finishCrewCenterStartup = finishCrewCenterStartup;

function releasePendingSidebar(authEpoch) {
  setTimeout(() => {
    if (authEpoch !== Number(window.CREW_CENTER_AUTH_EPOCH || 0)) return;
    if (!document.body.classList.contains("auth-ready")) return;
    if (!document.documentElement.classList.contains("sidebar-pending")) return;
    if (typeof window.applySidebarPreferences === "function") window.applySidebarPreferences();
    else document.documentElement.classList.remove("sidebar-pending");
  }, 2500);
}

function revealDashboard(user) {
  pendingLegalUser = null;
  legalAgreement.hidden = true;
  authGateCard.classList.remove("legal-step");
  const previousUserId = window.CREW_CENTER_AUTH_USER?.id || "";
  applySignedInUser(user);
  if (previousUserId !== user.id) window.CREW_CENTER_AUTH_EPOCH += 1;
  window.syncSidebarCollapsePreference?.();
  if (window.location.pathname === "/signin") {
    const defaultPage = window.CREW_CENTER_IS_VISITOR ? "about" : "home";
    const defaultRoute = window.CREW_CENTER_IS_VISITOR ? "/about" : "/dashboard";
    history.replaceState({ page: defaultPage }, "", defaultRoute);
    window.navigate?.(defaultPage, window.navItemForPage?.(defaultPage), { skipUrl: true });
  }
  document.body.classList.remove("auth-locked");
  document.body.classList.add("auth-ready");
  setTimeout(() => applySignedInUser(user), 0);
  setTimeout(() => applySignedInUser(user), 250);
  const authEpoch = Number(window.CREW_CENTER_AUTH_EPOCH || 0);
  finishCrewCenterStartup();
  releasePendingSidebar(authEpoch);
}

async function allowCrewCenterUser(user) {
  if (user?.is_anonymous) return true;
  if (String(user?.app_metadata?.role || "").toLowerCase() === "admin") return true;
  const normalizedEmail = String(user?.email || "").trim().toLowerCase();
  if (normalizedEmail) {
    let lastError = null;
    for (const delay of [0, 250]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      let approvedMember;
      let error;
      try {
        ({ data: approvedMember, error } = await withCrewCenterTimeout(
          window.crewCenterSupabase.rpc("get_own_member_id"),
          memberApprovalTimeoutMs,
          "The approved-member check timed out."
        ));
      } catch (requestError) {
        error = requestError;
      }
      if (!error) {
        pendingApprovalCheckUser = null;
        authLookupActions.classList.remove("visible");
        if (approvedMember) return true;
        await signOutCrewCenterSession();
        setAuthError("This email is not linked to an approved Crew Center account. New students must apply with their school alias email.");
        return false;
      }
      lastError = error;
    }
    pendingApprovalCheckUser = user;
    showSignIn();
    authLookupActions.classList.add("visible");
    setAuthError(`We couldn't verify your approved member record because the connection failed. Your session is still active. Retry when the connection is available.${lastError?.message ? ` (${lastError.message})` : ""}`);
    return false;
  }
  await signOutCrewCenterSession();
  setAuthError("This email is not linked to an approved Crew Center account. New students must apply with their school alias email.");
  return false;
}

function applySignInPresentation() {
  const recoveringExpiredLink = Boolean(pendingAuthLinkFailure);
  document.getElementById("auth-gate-title").textContent = recoveringExpiredLink ? "Invitation link not working?" : "Sign in";
  document.querySelector(".auth-gate-sub").textContent = recoveringExpiredLink
    ? "Enter the FIS email from your approved application to get a new password setup link. You do not need to apply again."
    : "Use your approved Crew Center account to sign in.";
  document.querySelector(".auth-gate-note").textContent = recoveringExpiredLink
    ? "Check your inbox and spam folder for the reset-password email. Open only the newest link; each link works once."
    : "Please submit an application for an account.";
  authPasswordField.hidden = recoveringExpiredLink;
  authPassword.disabled = recoveringExpiredLink;
  authRememberRow.hidden = recoveringExpiredLink;
  authRemember.disabled = recoveringExpiredLink;
  authSubmit.hidden = recoveringExpiredLink;
  authExpiredActions.classList.toggle("visible", recoveringExpiredLink);
  document.getElementById("auth-public-option").style.display = recoveringExpiredLink ? "none" : "block";
  if (recoveringExpiredLink) {
    setAuthError(pendingAuthLinkFailure.expired
      ? "That invitation or password link expired or was already used. Request a new password link below."
      : "That invitation or password link could not be used. Request a new password link below.");
    setTimeout(() => authEmail.focus(), 0);
  }
}

function showSignIn() {
  pendingLegalUser = null;
  legalAgreement.hidden = true;
  authGateCard.classList.remove("legal-step");
  if (window.CREW_CENTER_AUTH_USER) window.CREW_CENTER_AUTH_EPOCH += 1;
  window.CREW_CENTER_AUTH_USER = null;
  window.CREW_CENTER_IS_ADMIN = false;
  window.CREW_CENTER_IS_VISITOR = false;
  window.resetCrewCenterWorkspace?.();
  document.body.classList.add("auth-locked");
  document.body.classList.remove("auth-ready");
  authForm.style.display = "block";
  passwordSetupForm.style.display = "none";
  document.querySelector(".auth-gate-note").hidden = false;
  window.stopCrewCenterLiveUpdates?.();
  if (!passwordSetupRequired() && window.location.pathname !== "/signin") {
    history.replaceState({ page: "signin" }, "", "/signin");
  }
  setAuthBusy(false);
  applySignInPresentation();
}

function needsLegalAgreement(record) {
  return record?.terms_version !== legalDocumentVersions.terms
    || record?.privacy_version !== legalDocumentVersions.privacy;
}

function showLegalAgreement(user, checkFailed = false) {
  pendingLegalUser = user;
  document.body.classList.add("auth-locked");
  document.body.classList.remove("auth-ready");
  authGateCard.classList.add("legal-step");
  authForm.style.display = "none";
  passwordSetupForm.style.display = "none";
  document.getElementById("auth-public-option").style.display = "none";
  document.querySelector(".auth-gate-note").hidden = true;
  document.getElementById("auth-gate-title").textContent = "Before you continue";
  document.querySelector(".auth-gate-sub").textContent = "Please review the current documents for Media Club and SAC. You will only see this again if either document changes.";
  legalAgreement.hidden = false;
  legalAccept.disabled = checkFailed;
  legalRetry.hidden = !checkFailed;
  if (!checkFailed) setAuthError("");
  document.getElementById("auth-gate-title").focus();
}

async function checkLegalAgreement(user, activationSequence) {
  let data;
  let error;
  try {
    ({ data, error } = await withCrewCenterTimeout(
      window.crewCenterSupabase.from("user_legal_agreements").select("terms_version, privacy_version")
        .eq("auth_user_id", user.id)
        .eq("terms_version", legalDocumentVersions.terms)
        .eq("privacy_version", legalDocumentVersions.privacy)
        .maybeSingle(),
      authOperationTimeoutMs,
      "The agreement check timed out."
    ));
  } catch (requestError) {
    error = requestError;
  }
  if (signOutRequested || activationSequence !== authActivationSequence) return false;
  if (error) {
    showLegalAgreement(user, true);
    setAuthError("We couldn't check your agreement right now. Retry when the connection is available.");
    console.warn("The legal agreement check failed.", error);
    return false;
  }
  if (needsLegalAgreement(data)) {
    showLegalAgreement(user);
    return false;
  }
  return true;
}

async function activateCrewCenterUser(user, options = {}) {
  if (!user || signOutRequested) return false;
  const requirePasswordSetup = options.requirePasswordSetup === true || passwordSetupRequired();
  const requestedPasswordSetupMode = normalizePasswordSetupMode(options.passwordSetupMode) || passwordSetupMode;
  const force = options.force === true;
  if (!force && authActivationUserId === user.id && authActivationPromise) return authActivationPromise;
  if (!force && !requirePasswordSetup && authActivationUserId === user.id && document.body.classList.contains("auth-ready")) {
    applySignedInUser(user);
    return true;
  }

  const activationSequence = ++authActivationSequence;
  authActivationUserId = user.id;
  authActivationPromise = (async () => {
    if (!await allowCrewCenterUser(user)) return false;
    if (signOutRequested || activationSequence !== authActivationSequence) return false;
    if (requirePasswordSetup) showPasswordSetup(requestedPasswordSetupMode, user.email);
    else if (await checkLegalAgreement(user, activationSequence)) revealDashboard(user);
    return true;
  })();
  try {
    return await authActivationPromise;
  } finally {
    if (activationSequence === authActivationSequence) authActivationPromise = null;
  }
}

async function signOutCrewCenterSession() {
  signOutRequested = true;
  authStartupSettled = true;
  authActivationSequence += 1;
  authActivationPromise = null;
  authActivationUserId = "";
  pendingLegalUser = null;
  pendingApprovalCheckUser = null;
  authLookupActions.classList.remove("visible");
  authPassword.value = "";
  passwordSetupComplete = false;
  clearPendingPasswordSetup();
  showSignIn();
  if (!window.crewCenterSupabase) {
    clearStoredCrewCenterSession();
    return false;
  }
  try {
    const { error } = await withCrewCenterTimeout(
      window.crewCenterSupabase.auth.signOut({ scope: "local" }),
      4000,
      "Local sign-out timed out."
    );
    if (error) throw error;
    return true;
  } catch (error) {
    clearStoredCrewCenterSession();
    console.warn("Supabase sign-out did not finish; the stored browser session was cleared.", error);
    setAuthError("You have been signed out on this browser. Refresh once if the sign-in form does not respond.");
    return false;
  }
}

authLookupRetry.addEventListener("click", async () => {
  if (!pendingApprovalCheckUser) return;
  authLookupRetry.disabled = true;
  authLookupRetry.textContent = "Checking...";
  setAuthError("");
  const user = pendingApprovalCheckUser;
  signOutRequested = false;
  await activateCrewCenterUser(user, { force: true });
  authLookupRetry.disabled = false;
  authLookupRetry.textContent = "Retry account check";
});

document.getElementById("auth-lookup-signout").addEventListener("click", async () => {
  await signOutCrewCenterSession();
});

legalAccept.addEventListener("click", async () => {
  const user = pendingLegalUser;
  if (!user || legalAccept.disabled) return;
  const sequence = authActivationSequence;
  legalAccept.disabled = true;
  legalAccept.textContent = "Saving your choice…";
  setAuthError("");
  try {
    const { error } = await withCrewCenterTimeout(
      window.crewCenterSupabase.from("user_legal_agreements").insert({
        auth_user_id: user.id,
        terms_version: legalDocumentVersions.terms,
        privacy_version: legalDocumentVersions.privacy,
      }),
      authOperationTimeoutMs,
      "Saving the agreement timed out."
    );
    if (error && error.code !== "23505") throw error;
    if (signOutRequested || sequence !== authActivationSequence || pendingLegalUser?.id !== user.id) return;
    if (await checkLegalAgreement(user, sequence)) revealDashboard(user);
  } catch (error) {
    if (signOutRequested || sequence !== authActivationSequence) return;
    console.warn("The legal agreement could not be saved.", error);
    setAuthError("Your choice could not be saved. Please retry; the dashboard will stay locked until it is confirmed.");
  } finally {
    legalAccept.disabled = !legalRetry.hidden;
    legalAccept.innerHTML = 'Agree &amp; continue <span aria-hidden="true">→</span>';
  }
});

legalRetry.addEventListener("click", async () => {
  if (!pendingLegalUser) return;
  const user = pendingLegalUser;
  legalRetry.disabled = true;
  legalRetry.textContent = "Checking…";
  signOutRequested = false;
  try {
    await activateCrewCenterUser(user, { force: true });
  } catch (error) {
    console.warn("The legal agreement retry failed.", error);
    setAuthError("We couldn't check your agreement right now. Please try again.");
  } finally {
    legalRetry.disabled = false;
    legalRetry.textContent = "Retry check";
  }
});

document.getElementById("auth-legal-signout").addEventListener("click", signOutCrewCenterSession);

function showPasswordSetup(mode = passwordSetupMode || "invite", accountEmail = "") {
  pendingLegalUser = null;
  legalAgreement.hidden = true;
  authGateCard.classList.remove("legal-step");
  document.querySelector(".auth-gate-note").hidden = false;
  const normalizedMode = normalizePasswordSetupMode(mode) || "invite";
  pendingAuthLinkFailure = null;
  rememberPendingPasswordSetup(normalizedMode);
  if (accountEmail) authEmail.value = accountEmail;
  document.body.classList.add("auth-locked");
  document.body.classList.remove("auth-ready");
  authForm.style.display = "none";
  document.getElementById("auth-public-option").style.display = "none";
  passwordSetupForm.style.display = "block";
  const isRecovery = normalizedMode === "recovery";
  document.getElementById("auth-gate-title").textContent = isRecovery ? "Reset your password" : "Set your password";
  document.querySelector(".auth-gate-sub").textContent = isRecovery
    ? "Choose a new password for your Crew Center account."
    : "Choose a password to finish creating your Crew Center account.";
  document.querySelector(".auth-gate-note").textContent = "Use at least 8 characters. You will use this password the next time you sign in.";
  document.getElementById("auth-password-setup-submit").textContent = passwordSetupSubmitLabel();
}

function showMissingPasswordLinkRecovery() {
  clearPendingPasswordSetup();
  pendingAuthLinkFailure = { expired: true };
  history.replaceState({ page: "signin" }, "", "/signin");
  showSignIn();
}

async function returnToPasswordLinkRecovery() {
  const email = authEmail.value;
  await signOutCrewCenterSession();
  authEmail.value = email;
  showMissingPasswordLinkRecovery();
}

function isUnusablePasswordLinkError(error) {
  return error?.name === "AuthSessionMissingError"
    || ["session_not_found", "session_expired", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt", "invite_not_found", "otp_expired"].includes(error?.code);
}

authSetupRecovery.addEventListener("click", returnToPasswordLinkRecovery);

passwordSetupForm.addEventListener("submit", async event => {
  event.preventDefault();
  setAuthError("");
  const password = document.getElementById("auth-new-password").value;
  const confirmation = document.getElementById("auth-confirm-password").value;
  if (password !== confirmation) { setAuthError("The passwords do not match."); return; }
  const button = document.getElementById("auth-password-setup-submit");
  button.disabled = true;
  button.textContent = "Saving...";
  signOutRequested = false;
  try {
    const { data, error } = await withCrewCenterTimeout(
      window.crewCenterSupabase.auth.updateUser({ password }),
      authOperationTimeoutMs,
      "Password setup timed out."
    );
    if (error) throw error;
    passwordSetupComplete = true;
    clearPendingPasswordSetup();
    history.replaceState({}, "", window.location.pathname);
    passwordSetupForm.style.display = "none";
    await activateCrewCenterUser(data.user, { force: true });
  } catch (error) {
    if (isUnusablePasswordLinkError(error)) {
      await returnToPasswordLinkRecovery();
      return;
    }
    setAuthError(error.name === "CrewCenterTimeoutError"
      ? "Password setup is taking too long because authentication is temporarily unavailable. Please try again."
      : error.message || "Could not set the password.");
  } finally {
    button.disabled = false;
    button.textContent = passwordSetupSubmitLabel();
  }
});

async function requestPasswordReset() {
  setAuthError("");
  if (!window.crewCenterSupabase) {
    setAuthError("Supabase is not available yet. Check the connection and try again.");
    return;
  }

  const email = authEmail.value.trim().toLowerCase();
  authEmail.value = email;
  if (!authEmail.checkValidity()) {
    authEmail.reportValidity();
    return;
  }

  setPasswordResetBusy(true);
  try {
    const redirectTo = new URL("/signin", window.location.origin).toString();
    const { error } = await withCrewCenterTimeout(
      window.crewCenterSupabase.auth.resetPasswordForEmail(email, { redirectTo }),
      authOperationTimeoutMs,
      "Password reset email timed out."
    );
    if (error) throw error;
    setAuthMessage(
      "If an approved Crew Center account uses that email, a fresh password link has been sent. Check your inbox and spam folder, then open the newest reset-password email; older links will not work.",
      "success"
    );
  } catch (error) {
    console.warn("The password reset email could not be requested.", error);
    setAuthError(error.name === "CrewCenterTimeoutError"
      ? "The reset request is taking too long. Please check your connection and try again."
      : "The reset email could not be requested right now. Please wait a moment and try again.");
  } finally {
    setPasswordResetBusy(false);
  }
}

authPasswordReset.addEventListener("click", requestPasswordReset);
authExpiredResend.addEventListener("click", requestPasswordReset);
authExpiredBack.addEventListener("click", () => {
  pendingAuthLinkFailure = null;
  history.replaceState({ page: "signin" }, "", "/signin");
  showSignIn();
  setAuthError("");
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (pendingAuthLinkFailure) {
    await requestPasswordReset();
    return;
  }
  pendingApprovalCheckUser = null;
  authLookupActions.classList.remove("visible");
  setAuthError("");
  if (!window.crewCenterSupabase) {
    setAuthError("Supabase is not available yet. Check the connection and try again.");
    return;
  }
  setAuthBusy(true);
  signOutRequested = false;

  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value;
  try {
    const { data, error } = await withCrewCenterTimeout(
      window.crewCenterSupabase.auth.signInWithPassword({ email, password }),
      authOperationTimeoutMs,
      "Sign-in timed out."
    );
    if (error) throw error;
    passwordSetupComplete = false;
    clearPendingPasswordSetup();
    await activateCrewCenterUser(data.user);
  } catch (error) {
    setAuthError(error.name === "CrewCenterTimeoutError"
      ? "Authentication is taking too long. Supabase Auth may be temporarily unavailable; please try again."
      : error.message || "Sign in failed. Check the email and password.");
  } finally {
    setAuthBusy(false);
  }
});

document.getElementById("auth-signout").addEventListener("click", async () => {
  await signOutCrewCenterSession();
});

if (window.crewCenterSupabase) {
  window.crewCenterSupabase.auth.onAuthStateChange((event, session) => {
    setTimeout(() => {
      authStartupSettled = true;
      const user = session?.user;
      if (event === "SIGNED_OUT" || !user) {
        if (!pendingAuthLinkFailure && passwordSetupRequired() && !authCallbackHasCredentials) showMissingPasswordLinkRecovery();
        else showSignIn();
        return;
      }
      if (signOutRequested) return;
      if (event === "PASSWORD_RECOVERY") {
        passwordSetupComplete = false;
        rememberPendingPasswordSetup("recovery");
        activateCrewCenterUser(user, {
          force: true,
          requirePasswordSetup: true,
          passwordSetupMode: "recovery",
        }).catch(error => {
          console.error("Couldn't open the password recovery form.", error);
          showSignIn();
          setAuthError("Your recovery link was accepted, but the password form could not finish opening. Please try again.");
        });
        return;
      }
      if (["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
        activateCrewCenterUser(user, {
          requirePasswordSetup: passwordSetupRequired(),
          passwordSetupMode,
        }).catch(error => {
          console.error("Couldn't apply the authentication state.", error);
          showSignIn();
          setAuthError("Your session was found, but the Crew Center could not finish opening. Please try again.");
        });
      }
    }, 0);
  });

  withCrewCenterTimeout(
    window.crewCenterSupabase.auth.getSession(),
    authStartupTimeoutMs,
    "Session startup timed out."
  ).then(({ data, error }) => {
    if (authStartupSettled) return;
    if (error) throw error;
    authStartupSettled = true;
    const user = data.session?.user;
    if (user) activateCrewCenterUser(user, {
      requirePasswordSetup: passwordSetupRequired(),
      passwordSetupMode,
    });
    else if (!pendingAuthLinkFailure && passwordSetupRequired() && !authCallbackHasCredentials) showMissingPasswordLinkRecovery();
    else showSignIn();
  }).catch(error => {
    if (authStartupSettled) return;
    authStartupSettled = true;
    showSignIn();
    setAuthError(error.name === "CrewCenterTimeoutError"
      ? "Authentication is taking longer than expected. You can retry signing in while the connection recovers."
      : "The saved session could not be restored. Please sign in again.");
  });
} else {
  showSignIn();
  setAuthError("Supabase is not available yet. Check the connection and try again.");
}

setTimeout(() => {
  installAdminFunctionGuards();
  applyAdminControls();
}, 0);

function polishDashboardUi() {
  hideProfileAccountDetails();
  updateEventsBadge();
}

function hideProfileAccountDetails() {
  const profilePage = document.getElementById("page-profile");
  if (!profilePage) return;
  const cards = profilePage.querySelectorAll(".grid2 > .card");
  const accountCard = [...cards].find(card => card.textContent.includes("Account details"));
  if (accountCard && accountCard.style.display !== "none") accountCard.style.display = "none";

}

function updateEventsBadge() {
  const eventsNav = document.querySelector('.nav-item[onclick*="events"]');
  if (!eventsNav) return;
  const badge = eventsNav.querySelector(".nav-badge");
  if (!badge) return;

  if (!window.CREW_CENTER_DATA_LOADED) {
    badge.style.display = "none";
    return;
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const count = Array.isArray(window.state?.events)
    ? window.state.events.filter(event => event.date >= today).length
    : Number.parseInt(document.getElementById("stat-events")?.textContent || "0", 10);

  if (count > 0) {
    badge.textContent = String(count);
    badge.style.display = "";
  } else {
    badge.style.display = "none";
  }
}

window.updateCrewCenterEventsBadge = updateEventsBadge;

setInterval(polishDashboardUi, 1000);
setInterval(applyAdminControls, 1000);
polishDashboardUi();
