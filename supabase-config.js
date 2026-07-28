// The anon key is safe to expose in frontend code when your tables are protected
// by Row Level Security policies. Never put the service_role key in this file.
window.CREW_CENTER_SUPABASE = {
  url: "https://prswuqzzgordywowbwtc.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByc3d1cXp6Z29yZHl3b3did3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDU0ODIsImV4cCI6MjA5ODkyMTQ4Mn0.N7eRfvik6PsAj4IDa6jA_gGbUV3bqee8oRBz7shWIsM",
};

const fisAliasEmailPattern = /^[a-z]{2}\d{4,}@fis\.edu$/i;
const fisSchoolEmailPattern = /^[^\s@]+@fis\.edu$/i;
const fisAliasEmailMessage = "Use your school alias email: exactly 2 letters followed by at least 4 numbers, ending in @fis.edu (for example, XX12345@fis.edu).";
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
  .auth-visitor-button,
  .auth-visitor-exit,
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

  .auth-visitor-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #6c757d;
    font-size: 11px;
    margin: 18px 0;
    text-transform: uppercase;
  }

  .auth-visitor-divider::before,
  .auth-visitor-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgba(0,0,0,0.08);
  }

  .auth-visitor-button {
    width: 100%;
    min-height: 52px;
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.12);
    color: #212529;
    font-size: 15px;
  }

  .auth-visitor-button span {
    display: block;
    color: #6c757d;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0;
    margin-top: 1px;
  }

  .auth-visitor-button:hover {
    border-color: rgba(234,122,244,0.7);
    background: rgba(234,122,244,0.05);
  }

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

  .auth-gate-note {
    color: #6c757d;
    font-size: 12px;
    margin-top: 14px;
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

  .auth-visitor-exit {
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

  .auth-visitor-exit.visible {
    display: block;
  }

  body.auth-locked .auth-signout {
    display: none;
  }

  .auth-lookup-actions { display: none; gap: 8px; margin: 10px 0 16px; }
  .auth-lookup-actions.visible { display: flex; }
  .auth-lookup-actions button { flex: 1; }
`;
document.head.appendChild(authStyle);

document.body.insertAdjacentHTML("afterbegin", `
  <section class="auth-gate" aria-labelledby="auth-gate-title">
    <div class="auth-gate-card">
      <div class="auth-gate-brand">
        <img class="auth-gate-logo" src="assets/media-club-logo.svg" alt="Media Club logo">
        <div>
          <div class="auth-gate-name">Media Club</div>
          <div class="auth-gate-kicker">FIS Student Media Club</div>
        </div>
      </div>
      <h1 class="auth-gate-title" id="auth-gate-title">Sign in</h1>
      <p class="auth-gate-sub">Use the account created for you in Supabase to open the Media Club dashboard.</p>
      <div class="auth-gate-error" id="auth-gate-error"></div>
      <div class="auth-lookup-actions" id="auth-lookup-actions">
        <button class="auth-gate-button" id="auth-lookup-retry" type="button">Retry account check</button>
        <button class="auth-visitor-button" id="auth-lookup-signout" type="button">Sign out</button>
      </div>
      <form id="auth-gate-form">
        <div class="auth-gate-field">
          <label class="auth-gate-label" for="auth-gate-email">Email</label>
          <input class="auth-gate-input" id="auth-gate-email" type="email" autocomplete="email" inputmode="email" placeholder="Your account email" required>
        </div>
        <div class="auth-gate-field">
          <label class="auth-gate-label" for="auth-gate-password">Password</label>
          <input class="auth-gate-input" id="auth-gate-password" type="password" autocomplete="current-password" placeholder="Password" required>
        </div>
        <label class="auth-remember" for="auth-remember-browser">
          <input id="auth-remember-browser" type="checkbox" checked>
          <span>Remember me on this browser</span>
        </label>
        <button class="auth-gate-button" id="auth-gate-submit" type="submit">Sign in</button>
      </form>
      <div id="auth-visitor-option">
        <div class="auth-visitor-divider">or</div>
        <button class="auth-visitor-button" id="auth-visitor-submit" type="button">
          First time here?
          <span>Explore the fantastic Crew Center!</span>
        </button>
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
      </form>
      <p class="auth-gate-note">Please submit an application for an account.</p>
    </div>
  </section>
  <button class="auth-signout" id="auth-signout" type="button">Sign out</button>
  <button class="auth-visitor-exit" id="auth-visitor-exit" type="button">Member sign in</button>
`);

const authError = document.getElementById("auth-gate-error");
const authForm = document.getElementById("auth-gate-form");
const authSubmit = document.getElementById("auth-gate-submit");
const authPassword = document.getElementById("auth-gate-password");
const authRemember = document.getElementById("auth-remember-browser");
const visitorSubmit = document.getElementById("auth-visitor-submit");
const passwordSetupForm = document.getElementById("auth-password-setup-form");
const authLookupActions = document.getElementById("auth-lookup-actions");
const authLookupRetry = document.getElementById("auth-lookup-retry");
let pendingApprovalCheckUser = null;
const inviteFlow = new URLSearchParams(window.location.hash.slice(1)).get("type") === "invite";
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

window.crewCenterSupabase = window.supabase?.createClient(
  window.CREW_CENTER_SUPABASE.url,
  window.CREW_CENTER_SUPABASE.anonKey,
  { auth: { persistSession: true, storage: authStorage } }
);

function setAuthError(message = "") {
  authError.textContent = message;
  authError.classList.toggle("visible", Boolean(message));
}

function setAuthBusy(isBusy) {
  authSubmit.disabled = isBusy;
  authSubmit.textContent = isBusy ? "Signing in..." : "Sign in";
  visitorSubmit.disabled = isBusy;
}

function applyAdminControls() {
  const hasAdminPanelAccess = Boolean(window.CREW_CENTER_IS_ADMIN || window.canAccessCrewCenterAdminPanel?.());
  const hasCrewOperationsAccess = Boolean(hasAdminPanelAccess || window.canManageCrewOperations?.());
  const isVisitor = Boolean(window.CREW_CENTER_IS_VISITOR);
  const canAddMembers = Boolean(window.CREW_CENTER_IS_ADMIN || window.canAddCrewCenterMembers?.());
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = hasAdminPanelAccess && !isVisitor ? "flex" : "none";
  });
  const adminSelectors = [
    '.nav-item[onclick*="admin"]',
    'button[onclick*="removeMember"]',
    'button[onclick*="renderManageEvents"]',
  ];
  const crewOperationsSelectors = [
    'button[onclick*="event-modal"]',
    'button[onclick*="equip-add-modal"]',
    'button[onclick*="addEquipment"]',
    'button[onclick*="addEvent"]',
    'button[onclick*="requestArchiveEvent"]',
    'button[onclick*="restoreArchivedEvent"]',
    'button[onclick*="requestArchiveEquipment"]',
    'button[onclick*="restoreArchivedEquipment"]',
    'button[onclick*="toggleEquipmentAvailability"]',
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
  document.querySelectorAll('.crew-operations-only').forEach(el => {
    el.style.display = hasCrewOperationsAccess && !isVisitor ? "flex" : "none";
  });
  const hasCrewScheduleAccess = Boolean(hasAdminPanelAccess || window.canAccessCrewSchedule?.());
  document.querySelectorAll('.crew-schedule-only').forEach(el => {
    el.style.display = hasCrewScheduleAccess && !isVisitor ? "flex" : "none";
  });

  const visitorHiddenSelectors = [
    '.nav-item[onclick*="signup"]',
    '.nav-item[onclick*="members"]',
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
  const allowedPages = new Set(["home", "events", "gallery", "equipment", "role-guide", "join"]);
  const activePage = document.querySelector(".page.active")?.id?.replace("page-", "") || "home";
  if (!allowedPages.has(activePage) && typeof window.navigate === "function") {
    window.navigate("home");
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
    addEvent: "add events",
    addEquipment: "add equipment",
    requestArchiveEvent: "archive events",
    restoreArchivedEvent: "restore events",
    requestArchiveEquipment: "archive equipment",
    restoreArchivedEquipment: "restore equipment",
    toggleEquipmentAvailability: "change equipment availability",
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
    const visitorAllowedPages = new Set(["home", "events", "gallery", "equipment", "role-guide", "join"]);
    window.navigate = function(id, ...args) {
      const hasAdminPanelAccess = Boolean(window.CREW_CENTER_IS_ADMIN || window.canAccessCrewCenterAdminPanel?.());
      if (id === "admin" && !hasAdminPanelAccess) {
        return originalNavigate.call(this, "home");
      }
      if (id === "equipment-status" && !Boolean(window.CREW_CENTER_IS_ADMIN || window.canManageCrewOperations?.())) {
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
  const name = memberRecord?.name || metadata.full_name || metadata.name || metadata.display_name || user.email?.split("@")[0] || (isVisitor ? "Visitor" : "Media Club member");
  window.CREW_CENTER_IS_ADMIN = (appMetadata.role || "").toLowerCase() === "admin";
  window.CREW_CENTER_IS_VISITOR = isVisitor;
  const role = isVisitor ? "Visitor" : window.CREW_CENTER_IS_ADMIN ? "Admin" : "Member";
  const initials = metadata.initials || name.split(/\s+/).map(part => part[0]).join("").slice(0, 3).toUpperCase() || "MC";
  const avatarUrl = memberRecord ? memberRecord.avatarUrl : metadata.avatar_url || "";
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
    ["sidebar-user-role", role],
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
  document.getElementById("auth-visitor-exit")?.classList.toggle("visible", window.CREW_CENTER_IS_VISITOR);
  applyAdminControls();
}

async function revealDashboard(user) {
  applySignedInUser(user);
  document.body.classList.remove("auth-locked");
  document.body.classList.add("auth-ready");
  setTimeout(() => applySignedInUser(user), 0);
  setTimeout(() => applySignedInUser(user), 250);
  if (typeof window.loadCrewCenterData === "function") {
    await window.loadCrewCenterData();
  }
  const startLiveUpdates = () => {
    if (typeof window.subscribeToCrewCenterChanges === "function") {
      window.subscribeToCrewCenterChanges();
    }
  };
  startLiveUpdates();
  setTimeout(startLiveUpdates, 0);
}

async function allowCrewCenterUser(user) {
  if (user?.is_anonymous) return true;
  if (String(user?.app_metadata?.role || "").toLowerCase() === "admin") return true;
  const normalizedEmail = String(user?.email || "").trim().toLowerCase();
  if (normalizedEmail) {
    let lastError = null;
    for (const delay of [0, 350, 900]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      const { data: approvedMember, error } = await window.crewCenterSupabase
        .from("members")
        .select("id")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle();
      if (!error) {
        pendingApprovalCheckUser = null;
        authLookupActions.classList.remove("visible");
        if (approvedMember) return true;
        await window.crewCenterSupabase.auth.signOut();
        showSignIn();
        setAuthError("This email is not linked to an approved Media Club account. New students must apply with their school alias email.");
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
  await window.crewCenterSupabase.auth.signOut();
  showSignIn();
  setAuthError("This email is not linked to an approved Media Club account. New students must apply with their school alias email.");
  return false;
}

function showSignIn() {
  window.CREW_CENTER_AUTH_USER = null;
  window.CREW_CENTER_IS_ADMIN = false;
  window.CREW_CENTER_IS_VISITOR = false;
  document.body.classList.add("auth-locked");
  document.body.classList.remove("auth-ready");
  document.getElementById("auth-visitor-exit")?.classList.remove("visible");
  document.getElementById("auth-visitor-option").style.display = "block";
  setAuthBusy(false);
}

authLookupRetry.addEventListener("click", async () => {
  if (!pendingApprovalCheckUser) return;
  authLookupRetry.disabled = true;
  authLookupRetry.textContent = "Checking...";
  setAuthError("");
  const user = pendingApprovalCheckUser;
  if (await allowCrewCenterUser(user)) await revealDashboard(user);
  authLookupRetry.disabled = false;
  authLookupRetry.textContent = "Retry account check";
});

document.getElementById("auth-lookup-signout").addEventListener("click", async () => {
  pendingApprovalCheckUser = null;
  authLookupActions.classList.remove("visible");
  await window.crewCenterSupabase?.auth.signOut();
  showSignIn();
});

function showPasswordSetup() {
  document.body.classList.add("auth-locked");
  document.body.classList.remove("auth-ready");
  authForm.style.display = "none";
  document.getElementById("auth-visitor-option").style.display = "none";
  passwordSetupForm.style.display = "block";
  document.getElementById("auth-gate-title").textContent = "Set your password";
  document.querySelector(".auth-gate-sub").textContent = "Choose a password to finish creating your Media Club account.";
  document.querySelector(".auth-gate-note").textContent = "Use at least 8 characters.";
}

passwordSetupForm.addEventListener("submit", async event => {
  event.preventDefault();
  setAuthError("");
  const password = document.getElementById("auth-new-password").value;
  const confirmation = document.getElementById("auth-confirm-password").value;
  if (password !== confirmation) { setAuthError("The passwords do not match."); return; }
  const button = document.getElementById("auth-password-setup-submit");
  button.disabled = true;
  button.textContent = "Saving...";
  const { data, error } = await window.crewCenterSupabase.auth.updateUser({ password });
  if (error) {
    button.disabled = false;
    button.textContent = "Set password";
    setAuthError(error.message || "Could not set the password.");
    return;
  }
  history.replaceState({}, "", window.location.pathname);
  passwordSetupForm.style.display = "none";
  await revealDashboard(data.user);
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  pendingApprovalCheckUser = null;
  authLookupActions.classList.remove("visible");
  setAuthError("");
  if (!window.crewCenterSupabase) {
    setAuthError("Supabase is not available yet. Check the connection and try again.");
    return;
  }
  setAuthBusy(true);

  const email = document.getElementById("auth-gate-email").value.trim().toLowerCase();
  const password = authPassword.value;
  const { data, error } = await window.crewCenterSupabase.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthBusy(false);
    setAuthError(error.message || "Sign in failed. Check the email and password.");
    return;
  }

  if (!await allowCrewCenterUser(data.user)) return;
  await revealDashboard(data.user);
  setAuthBusy(false);
});

visitorSubmit.addEventListener("click", async () => {
  setAuthError("");
  if (!window.crewCenterSupabase) {
    setAuthError("Supabase is not available yet. Check the connection and try again.");
    return;
  }
  setAuthBusy(true);
  visitorSubmit.innerHTML = 'Opening visitor access...<span>Please wait</span>';
  const { data, error } = await window.crewCenterSupabase.auth.signInAnonymously();
  if (error) {
    setAuthBusy(false);
    visitorSubmit.innerHTML = 'First time here?<span>Explore the Crew Center with limited access</span>';
    setAuthError(error.message || "Visitor access is not available right now.");
    return;
  }
  await revealDashboard(data.user);
  setAuthBusy(false);
  visitorSubmit.innerHTML = 'First time here?<span>Explore the Crew Center with limited access</span>';
});

document.getElementById("auth-signout").addEventListener("click", async () => {
  if (!window.crewCenterSupabase) return;
  await window.crewCenterSupabase.auth.signOut();
  pendingApprovalCheckUser = null;
  authLookupActions.classList.remove("visible");
  authPassword.value = "";
  showSignIn();
});

document.getElementById("auth-visitor-exit").addEventListener("click", async () => {
  if (!window.crewCenterSupabase) return;
  await window.crewCenterSupabase.auth.signOut();
  showSignIn();
});

if (window.crewCenterSupabase) {
  window.crewCenterSupabase.auth.getSession().then(async ({ data }) => {
    const user = data.session?.user;
    if (user) {
      if (await allowCrewCenterUser(user)) {
        if (inviteFlow) showPasswordSetup();
        else revealDashboard(user);
      }
    } else {
      showSignIn();
    }
  });
} else {
  showSignIn();
  setAuthError("Supabase is not available yet. Check the connection and try again.");
}

document.addEventListener("click", () => {
  if (window.CREW_CENTER_AUTH_USER && document.body.classList.contains("auth-ready")) {
    setTimeout(() => applySignedInUser(window.CREW_CENTER_AUTH_USER), 80);
  }
});

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
