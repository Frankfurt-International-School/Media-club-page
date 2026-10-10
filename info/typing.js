// Decorative typing only: the complete heading stays readable to assistive technology.
(function () {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || typeof IntersectionObserver !== 'function') return;
  const pending = new Map();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = pending.get(entry.target);
      if (!item) continue;
      if (!entry.isIntersecting || document.hidden) {
        if (item.started) finish(entry.target);
        continue;
      }
      if (item.started) continue;
      item.started = true;
      const letters = Array.from(item.source.textContent);
      let length = 0;
      const typeNext = () => {
        if (motion.matches || document.hidden) { finish(entry.target); return; }
        entry.target.dataset.typeState = 'typing';
        item.visual.textContent = letters.slice(0, ++length).join('');
        if (length < letters.length) item.timer = window.setTimeout(typeNext, 32);
        else finish(entry.target);
      };
      item.timer = window.setTimeout(typeNext, 2200);
    }
  }, { threshold: 0.5 });

  function finish(heading) {
    const item = pending.get(heading);
    if (!item) return;
    window.clearTimeout(item.timer);
    item.visual.remove();
    delete heading.dataset.typeState;
    pending.delete(heading);
    observer.unobserve(heading);
  }

  for (const heading of document.querySelectorAll('[data-type-heading]')) {
    const source = heading.querySelector('.typed-heading-source');
    if (!source) continue;
    const visual = document.createElement('span');
    visual.className = 'typed-heading-visual';
    visual.setAttribute('aria-hidden', 'true');
    heading.appendChild(visual);
    heading.dataset.typeState = 'waiting';
    pending.set(heading, { source, visual, started: false, timer: null });
    observer.observe(heading);
  }
  motion.addEventListener('change', () => {
    if (motion.matches) [...pending.keys()].forEach(finish);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) [...pending.keys()].forEach(finish);
  });
})();
