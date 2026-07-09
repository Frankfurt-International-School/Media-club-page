// The anon key is safe to expose in frontend code when your tables are protected
// by Row Level Security policies. Never put the service_role key in this file.
window.CREW_CENTER_SUPABASE = {
  url: "https://prswuqzzgordywowbwtc.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByc3d1cXp6Z29yZHl3b3did3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDU0ODIsImV4cCI6MjA5ODkyMTQ4Mn0.N7eRfvik6PsAj4IDa6jA_gGbUV3bqee8oRBz7shWIsM",
};

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
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 180;
    background: #f1f3f5;
    border: 1px solid rgba(0,0,0,0.08);
    color: #495057;
    padding: 9px 14px;
  }

  body.auth-locked .auth-signout {
    display: none;
  }
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
      <form id="auth-gate-form">
        <div class="auth-gate-field">
          <label class="auth-gate-label" for="auth-gate-email">Email</label>
          <input class="auth-gate-input" id="auth-gate-email" type="email" autocomplete="email" placeholder="name@school.edu" required>
        </div>
        <div class="auth-gate-field">
          <label class="auth-gate-label" for="auth-gate-password">Password</label>
          <input class="auth-gate-input" id="auth-gate-password" type="password" autocomplete="current-password" placeholder="Password" required>
        </div>
        <button class="auth-gate-button" id="auth-gate-submit" type="submit">Sign in</button>
      </form>
      <p class="auth-gate-note">Accounts are created manually by the club admin.</p>
    </div>
  </section>
  <button class="auth-signout" id="auth-signout" type="button">Sign out</button>
`);

const authError = document.getElementById("auth-gate-error");
const authForm = document.getElementById("auth-gate-form");
const authSubmit = document.getElementById("auth-gate-submit");
const authPassword = document.getElementById("auth-gate-password");

window.crewCenterSupabase = window.supabase?.createClient(
  window.CREW_CENTER_SUPABASE.url,
  window.CREW_CENTER_SUPABASE.anonKey
);

function setAuthError(message = "") {
  authError.textContent = message;
  authError.classList.toggle("visible", Boolean(message));
}

function setAuthBusy(isBusy) {
  authSubmit.disabled = isBusy;
  authSubmit.textContent = isBusy ? "Signing in..." : "Sign in";
}

function applyAdminControls() {
  const isAdmin = Boolean(window.CREW_CENTER_IS_ADMIN);
  const isVisitor = Boolean(window.CREW_CENTER_IS_VISITOR);
  const adminSelectors = [
    '.admin-only',
    '.nav-item[onclick*="admin"]',
    'button[onclick*="event-modal"]',
    'button[onclick*="member-modal"]',
    'button[onclick*="gallery-modal"]',
    'button[onclick*="equip-add-modal"]',
    'button[onclick*="deleteEvent"]',
    'button[onclick*="removeMember"]',
    'button[onclick*="addEquipment"]',
    'button[onclick*="addMember"]',
    'button[onclick*="addEvent"]',
    'button[onclick*="submitProject"]',
    'button[onclick*="renderManageEvents"]',
  ];

  adminSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.style.display = isAdmin ? "" : "none";
    });
  });

  const visitorHiddenSelectors = [
    '.nav-item[onclick*="signup"]',
    '.nav-item[onclick*="members"]',
    '.nav-item[onclick*="admin"]',
    '.sidebar-footer',
  ];
  visitorHiddenSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.style.display = isVisitor ? "none" : "";
    });
  });
  enforceVisitorPageAccess();
}

function enforceVisitorPageAccess() {
  if (!window.CREW_CENTER_IS_VISITOR) return;
  const allowedPages = new Set(["home", "events", "gallery", "equipment", "join"]);
  const activePage = document.querySelector(".page.active")?.id?.replace("page-", "") || "home";
  if (!allowedPages.has(activePage) && typeof window.navigate === "function") {
    window.navigate("home");
  }
}

function showNotAuthorized(action = "do that") {
  if (typeof window.showToast === "function") {
    window.showToast(`Not authorized: only admins can ${action}.`, "error");
  } else {
    setAuthError(`Not authorized: only admins can ${action}.`);
  }
}

function installAdminFunctionGuards() {
  const guarded = {
    addEvent: "add events",
    deleteEvent: "delete events",
    addMember: "add members",
    removeMember: "remove members",
    submitProject: "add gallery projects",
    addEquipment: "add equipment",
    postAnnouncement: "post announcements",
    deleteAnn: "delete announcements",
    renderAdmin: "open the admin panel",
  };

  Object.entries(guarded).forEach(([name, action]) => {
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

  if (typeof window.navigate === "function" && !window.navigate.__adminGuarded) {
    const originalNavigate = window.navigate;
    const visitorAllowedPages = new Set(["home", "events", "gallery", "equipment", "join"]);
    window.navigate = function(id, ...args) {
      if (id === "admin" && !window.CREW_CENTER_IS_ADMIN) {
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
      const adminModalIds = ["event-modal", "member-modal", "gallery-modal", "equip-add-modal"];
      if (adminModalIds.includes(id) && !window.CREW_CENTER_IS_ADMIN) {
        showNotAuthorized("manage club content");
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
  const name = metadata.full_name || metadata.name || metadata.display_name || user.email.split("@")[0] || "Media Club member";
  const role = appMetadata.role || metadata.role || "Member";
  window.CREW_CENTER_IS_ADMIN = (appMetadata.role || "").toLowerCase() === "admin";
  window.CREW_CENTER_IS_VISITOR = (appMetadata.role || metadata.role || "").toLowerCase() === "visitor";
  const initials = metadata.initials || name.split(/\s+/).map(part => part[0]).join("").slice(0, 3).toUpperCase() || "MC";
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
    ["profile-preview-email", user.email || ""],
    ["profile-preview-avatar", initials],
  ];

  surfaces.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
  ["sidebar-user-avatar", "profile-preview-avatar"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.background = avatarBg;
    el.style.color = avatarFg;
  });
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

function showSignIn() {
  window.CREW_CENTER_IS_ADMIN = false;
  window.CREW_CENTER_IS_VISITOR = false;
  document.body.classList.add("auth-locked");
  document.body.classList.remove("auth-ready");
  setAuthBusy(false);
}

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  setAuthError("");
  if (!window.crewCenterSupabase) {
    setAuthError("Supabase is not available yet. Check the connection and try again.");
    return;
  }
  setAuthBusy(true);

  const email = document.getElementById("auth-gate-email").value.trim();
  const password = authPassword.value;
  const { data, error } = await window.crewCenterSupabase.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthBusy(false);
    setAuthError(error.message || "Sign in failed. Check the email and password.");
    return;
  }

  await revealDashboard(data.user);
  setAuthBusy(false);
});

document.getElementById("auth-signout").addEventListener("click", async () => {
  if (!window.crewCenterSupabase) return;
  await window.crewCenterSupabase.auth.signOut();
  authPassword.value = "";
  showSignIn();
});

if (window.crewCenterSupabase) {
  window.crewCenterSupabase.auth.getSession().then(({ data }) => {
    const user = data.session?.user;
    if (user) {
      revealDashboard(user);
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
  colorMemberRoleTags();
  updateEventsBadge();
}

function hideProfileAccountDetails() {
  const profilePage = document.getElementById("page-profile");
  if (!profilePage) return;
  const cards = profilePage.querySelectorAll(".grid2 > .card");
  const accountCard = [...cards].find(card => card.textContent.includes("Account details"));
  if (accountCard && accountCard.style.display !== "none") accountCard.style.display = "none";

  const profileSub = profilePage.querySelector(".page-sub");
  if (profileSub && profileSub.textContent !== "Your signed-in profile is shown in the bottom-left sidebar.") {
    profileSub.textContent = "Your signed-in profile is shown in the bottom-left sidebar.";
  }
}

function colorMemberRoleTags() {
  document.querySelectorAll("#members-grid .member-tags .badge").forEach(badge => {
    const label = badge.textContent.trim().toLowerCase();
    if (label === "leader" || label === "co-leader") {
      badge.style.background = "rgba(255,123,94,0.12)";
      badge.style.color = "#ff7b5e";
      badge.style.borderColor = "rgba(255,123,94,0.28)";
    } else if (label === "moderator" || label === "moderators") {
      badge.style.background = "rgba(255,181,71,0.16)";
      badge.style.color = "#b87900";
      badge.style.borderColor = "rgba(255,181,71,0.34)";
    } else if (label === "member" || label === "trainee") {
      badge.style.background = "rgba(255, 160, 253, 0.12)";
      badge.style.color = "#be95c4" ; 
      badge.style.borderColor = "rgba(255, 160, 253, 0.28)"; 
    }
  });
}

function updateEventsBadge() {
  const eventsNav = document.querySelector('.nav-item[onclick*="events"]');
  if (!eventsNav) return;
  const badge = eventsNav.querySelector(".nav-badge");
  if (!badge) return;

  const stat = document.getElementById("stat-events");
  const countFromStat = Number.parseInt(stat?.textContent || "", 10);
  const visibleEventCards = document.querySelectorAll("#events-list .event-card").length;
  const count = Number.isFinite(countFromStat) ? countFromStat : visibleEventCards;

  if (count > 0) {
    badge.textContent = String(count);
    badge.style.display = "";
  } else {
    badge.style.display = "none";
  }
}

setInterval(polishDashboardUi, 1000);
setInterval(applyAdminControls, 1000);
polishDashboardUi();
