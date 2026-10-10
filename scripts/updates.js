// The full tagline remains available to assistive technology throughout the animation.
let crewUpdatesTypeTimer = null;
let crewUpdatesIntroPlayed = false;
const crewUpdatesMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const crewUpdatesText = document.getElementById('crew-updates-type');
// Reserve the tagline's space while keeping the complete screen-reader text in the markup.
if (crewUpdatesText && !crewUpdatesMotion.matches) crewUpdatesText.textContent = '';

function finishCrewUpdatesIntro() {
  if (crewUpdatesTypeTimer) clearTimeout(crewUpdatesTypeTimer);
  crewUpdatesTypeTimer = null;
  const text = document.getElementById('crew-updates-type');
  if (text) { text.textContent = text.dataset.typeText; text.dataset.typing = 'false'; }
}

function startCrewUpdatesIntro() {
  const text = document.getElementById('crew-updates-type');
  if (!text || crewUpdatesIntroPlayed) return;
  crewUpdatesIntroPlayed = true;
  if (crewUpdatesMotion.matches || document.hidden) { finishCrewUpdatesIntro(); return; }
  const letters = Array.from(text.dataset.typeText);
  let length = 0;
  text.textContent = '';
  text.dataset.typing = 'false';
  const typeNext = () => {
    if (crewUpdatesMotion.matches || document.hidden || !document.getElementById('page-profile')?.classList.contains('active')) {
      finishCrewUpdatesIntro(); return;
    }
    text.dataset.typing = 'true';
    text.textContent = letters.slice(0, ++length).join('');
    if (length < letters.length) crewUpdatesTypeTimer = setTimeout(typeNext, 32);
    else finishCrewUpdatesIntro();
  };
  crewUpdatesTypeTimer = setTimeout(typeNext, 2200);
}

function installCrewUpdateHistory() {
  const details = document.getElementById('crew-full-changelog');
  const summary = details?.querySelector('summary');
  const content = details?.querySelector('.crew-update-history-content');
  if (!summary || !content || typeof content.animate !== 'function') return;
  let animation = null;
  let expanded = details.open;
  const finish = () => {
    animation?.cancel();
    animation = null;
    details.open = expanded;
    content.style.height = '';
    content.style.opacity = '';
    delete details.dataset.expanded;
  };
  summary.addEventListener('click', event => {
    if (crewUpdatesMotion.matches) return; // Keep native keyboard and disclosure behavior.
    event.preventDefault();
    if (!animation) expanded = details.open;
    const height = details.open ? content.getBoundingClientRect().height : 0;
    const opacity = details.open ? Number.parseFloat(getComputedStyle(content).opacity) : 0;
    animation?.cancel();
    expanded = !expanded;
    details.open = true;
    details.dataset.expanded = String(expanded);
    content.style.height = 'auto';
    const targetHeight = expanded ? content.scrollHeight : 0;
    content.style.height = `${height}px`;
    content.style.opacity = String(opacity);
    const current = content.animate([
      { height: `${height}px`, opacity },
      { height: `${targetHeight}px`, opacity: expanded ? 1 : 0 },
    ], { duration: 340, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' });
    animation = current;
    current.onfinish = () => { if (animation === current) finish(); };
  });
  crewUpdatesMotion.addEventListener('change', () => {
    if (crewUpdatesMotion.matches && animation) finish();
  });
}
installCrewUpdateHistory();

const crewUpdatesHero = document.getElementById('crew-updates-hero');
if (crewUpdatesHero && typeof IntersectionObserver === 'function') {
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && document.getElementById('page-profile')?.classList.contains('active')) {
      startCrewUpdatesIntro(); observer.disconnect();
    }
  }, { threshold: 0.35 });
  observer.observe(crewUpdatesHero);
}
crewUpdatesMotion.addEventListener('change', () => { if (crewUpdatesMotion.matches) finishCrewUpdatesIntro(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) finishCrewUpdatesIntro(); });
