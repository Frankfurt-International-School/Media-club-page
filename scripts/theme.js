// Apply the browser preference before the stylesheet renders, including device mode.
const crewThemeModes = ['light', 'dark', 'system'];
const crewThemeDevice = window.matchMedia('(prefers-color-scheme: dark)');
const crewThemeMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let crewThemePreference = 'light';
let crewThemeStorageAvailable = true;
let crewThemeTransitionTimer = null;
try {
  const saved = localStorage.getItem('crew-center-theme');
  if (crewThemeModes.includes(saved)) crewThemePreference = saved;
} catch (_error) { crewThemeStorageAvailable = false; }

function updateThemeChoices() {
  crewThemeModes.forEach(mode => {
    const button = document.getElementById(`theme-${mode}`);
    button?.classList.toggle('active', crewThemePreference === mode);
    button?.setAttribute('aria-pressed', String(crewThemePreference === mode));
  });
  const status = document.getElementById('theme-choice-status');
  const resolved = document.documentElement.dataset.theme === 'dark' ? 'Dark' : 'Light';
  if (status) status.textContent = `${crewThemePreference === 'system' ? `Following your device · ${resolved}` : `${resolved} theme selected`}. ${crewThemeStorageAvailable ? 'Remembered on this browser.' : 'Applied for this session; browser storage is unavailable.'}`;
}

function applyCrewCenterTheme(animate = false) {
  if (crewThemeTransitionTimer) clearTimeout(crewThemeTransitionTimer);
  document.documentElement.classList.toggle('theme-switching', animate && !crewThemeMotion.matches);
  const theme = crewThemePreference === 'system' ? crewThemeDevice.matches ? 'dark' : 'light' : crewThemePreference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = crewThemePreference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1020' : '#fbfafc');
  updateThemeChoices();
  if (animate && !crewThemeMotion.matches) crewThemeTransitionTimer = setTimeout(() => {
    document.documentElement.classList.remove('theme-switching');
    crewThemeTransitionTimer = null;
  }, 260);
}

function setCrewCenterTheme(mode) {
  if (!crewThemeModes.includes(mode)) return;
  crewThemePreference = mode;
  try { localStorage.setItem('crew-center-theme', mode); crewThemeStorageAvailable = true; }
  catch (_error) { crewThemeStorageAvailable = false; }
  applyCrewCenterTheme(true);
}

crewThemeDevice.addEventListener('change', () => {
  if (crewThemePreference === 'system') applyCrewCenterTheme(true);
});
crewThemeMotion.addEventListener('change', () => {
  if (crewThemeMotion.matches) document.documentElement.classList.remove('theme-switching');
});
window.addEventListener('storage', event => {
  if (event.key !== 'crew-center-theme' && event.key !== null) return;
  crewThemePreference = crewThemeModes.includes(event.newValue) ? event.newValue : 'light';
  applyCrewCenterTheme(true);
});
applyCrewCenterTheme();
