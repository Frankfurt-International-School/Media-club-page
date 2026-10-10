// The full tagline remains available to assistive technology throughout the animation.
let crewUpdatesTypeTimer = null;
let crewUpdatesIntroPlayed = false;
const crewUpdatesMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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
  text.dataset.typing = 'true';
  const typeNext = () => {
    if (crewUpdatesMotion.matches || document.hidden || !document.getElementById('page-profile')?.classList.contains('active')) {
      finishCrewUpdatesIntro(); return;
    }
    text.textContent = letters.slice(0, ++length).join('');
    if (length < letters.length) crewUpdatesTypeTimer = setTimeout(typeNext, 32);
    else finishCrewUpdatesIntro();
  };
  crewUpdatesTypeTimer = setTimeout(typeNext, 120);
}

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
