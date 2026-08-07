(function initializeCrewCenterTutorial() {
  'use strict';

  const TUTORIAL_VERSION = 1;
  const TUTORIAL_IDS = [
    'full', 'home', 'events', 'signup', 'members', 'gallery', 'equipment',
    'role-guide', 'crew-deployment', 'equipment-status', 'about', 'join',
    'profile', 'admin',
  ];
  const FULL_TOUR_ORDER = [
    'home', 'events', 'signup', 'members', 'gallery', 'equipment', 'role-guide',
    'crew-deployment', 'equipment-status', 'about', 'join', 'profile', 'admin',
  ];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const guides = {
    home: {
      title: 'Dashboard',
      summary: 'Your personalised operational overview.',
      steps: [
        { target: '#page-home .dashboard-header', title: 'Your Crew Center dashboard', body: 'This is your starting point. It brings together the information most useful for your role and account.' },
        { target: '#dashboard-focus', title: 'What needs attention next', body: 'The first card prioritises your nearest assignment, confirmation, reservation, or other useful next action.' },
        { target: '#dashboard-modules', title: 'Your chosen information', body: 'These sections show upcoming work and club information. You can choose and reorder them from Settings.' },
      ],
    },
    events: {
      title: 'Events',
      summary: 'Browse the Media Club production calendar.',
      steps: [
        { target: '#page-events .page-hero-copy', title: 'The production calendar', body: 'Events contains upcoming livestreams, recordings, activities, and other Media Club work.' },
        { target: '#event-filters', title: 'Find the right event', body: 'Filter by production type or reveal past events without losing the upcoming calendar.' },
        { target: '#events-list', title: 'Event information', body: 'Each event card shows its schedule, location, category, signup availability, and relevant production details.' },
      ],
    },
    signup: {
      title: 'Sign-up Sheets',
      summary: 'Choose an event and claim an available role.',
      steps: [
        { target: '#sheet-event-select', title: 'Choose an event', body: 'Start by selecting the event you want to work on. Ended or archived events are kept out of active signup sheets.' },
        { target: '.signup-sheet-card', title: 'Check the current crew', body: 'The sheet shows filled roles, attendance windows, active Student Supervisor assignments, and remaining capacity.' },
        { target: '#signup-entry-card', title: 'Claim your role', body: 'Choose an available production role, how long you will attend, and whether your attendance is confirmed or still Maybe.' },
      ],
    },
    members: {
      title: 'Members',
      summary: 'Find approved members and their club roles.',
      steps: [
        { target: '#page-members .page-hero-copy', title: 'The member directory', body: 'This page lists approved Media Club members using the names and roles stored in the club directory.' },
        { target: '#member-search', title: 'Search and filter', body: 'Search by name or filter the directory by Faculty, leadership, Moderator, or Member roles.' },
      ],
    },
    gallery: {
      title: 'Project Gallery',
      summary: 'Browse and submit Media Club work.',
      steps: [
        { target: '#page-gallery .tab-row', title: 'Explore club projects', body: 'Switch between photography, video, podcast, and design work, or keep All selected to browse everything.' },
        { target: '#gallery-grid', title: 'Open a project', body: 'Project cards show the creator and production information. Approved members can also submit their own work.' },
      ],
    },
    equipment: {
      title: 'Equipment',
      summary: 'Check availability and arrange reservations.',
      steps: [
        { target: '#page-equipment .page-hero-copy', title: 'Production equipment', body: 'Browse the cameras, audio equipment, tripods, accessories, and other items available through Media Club.' },
        { target: '#equipment-filters', title: 'Search the inventory', body: 'Filter by name, category, or current status to quickly find equipment that fits your production.' },
        { target: '#equipment-grid', title: 'Availability and reservations', body: 'Equipment cards show current availability and the actions your role is allowed to perform. Reservation rules are checked before anything is saved.' },
      ],
    },
    'role-guide': {
      title: 'Media Role Guide',
      summary: 'Understand expectations before joining a crew.',
      steps: [
        { target: '.role-guide-hero', title: 'Choose a role with confidence', body: 'The guide explains what each position does, what equipment it uses, and how it contributes to the production.' },
        { target: '#stream-expectations', title: 'Expectations for every stream', body: 'Read the preparation, live-production, safety, communication, and wrap-up rules that apply to every student role.' },
        { target: '.role-guide-section', title: 'Responsibilities by role', body: 'The role cards cover supervision, control-room positions, camera work, photography, and the experience expected for each job.' },
      ],
    },
    'crew-deployment': {
      title: 'Crew Schedule',
      summary: 'Follow assignments, handoffs, and attendance.',
      steps: [
        { target: '.deployment-hero', title: 'Daily production schedule', body: 'Choose a production date and review the crew coverage, timing, locations, and handoffs for that day.' },
        { target: '#crew-deployment-grid', title: 'Manage the working crew', body: 'Authorised leaders can follow assignments and record attendance while preserving the original signup information.' },
      ],
    },
    'equipment-status': {
      title: 'Equipment Status',
      summary: 'Operate the live checkout and return register.',
      steps: [
        { target: '.equipment-status-hero', title: 'Live equipment operations', body: 'This restricted page summarises scheduled, checked-out, returned, and unresolved equipment records.' },
        { target: '#equipment-status-grid', title: 'What is currently in use', body: 'The status cards identify active loans and the equipment that still needs a confirmed return.' },
        { target: '.equipment-register-card', title: 'Checkout and return history', body: 'Use the register to confirm returns and inspect scheduled or unresolved records. Returned history stays hidden until requested.' },
      ],
    },
    about: {
      title: 'About Media Club',
      summary: 'See what the club makes and how students learn.',
      steps: [
        { target: '.about-hero', title: 'Discover Media Club', body: 'This introduction explains what the club creates and how students participate in photography, film, and live production.' },
        { target: '.about-story-list', title: 'See how productions work', body: 'These stories show the teamwork behind the camera, in the control room, and throughout a real event.' },
      ],
    },
    join: {
      title: 'Join the Club',
      summary: 'Understand the application page.',
      steps: [
        { target: '#page-join .page-title', title: 'The application page', body: 'Prospective students use this page to apply with their FIS alias email. Existing approved members do not need to apply again.' },
        { target: '#join-form-card', title: 'What an application contains', body: 'Applicants provide their grade, experience, interests, and reason for joining before a faculty or authorised reviewer checks the submission.' },
      ],
    },
    profile: {
      title: 'Settings',
      summary: 'Personalise your account and Crew Center.',
      steps: [
        { target: '#page-profile .settings-nav', title: 'Your account settings', body: 'Move between profile, appearance, dashboard, sidebar, and notification settings from this menu.' },
        { target: '#page-profile .settings-content', title: 'Preferences that follow you', body: 'Profile, dashboard, sidebar, and notification changes are saved with the appropriate account controls. Theme choice stays on this browser.' },
      ],
    },
    admin: {
      title: 'Admin Panel',
      summary: 'Review applications and manage club information.',
      steps: [
        { target: '#page-admin > .tab-row', title: 'Administrative sections', body: 'Switch between pending applications, event management, and club announcements from these tabs.' },
        { target: '#admin-tab-pending', title: 'Review applications', body: 'Authorised reviewers can inspect an application before approving it and sending the account invitation, or rejecting it with a recorded reason.' },
        { target: '#admin-tab-button-announcements', title: 'Publish announcements', body: 'The Announcements section creates messages that appear live in the Crew Center for members.' },
      ],
    },
  };

  const runtime = {
    progress: defaultProgress(),
    tourId: null,
    steps: [],
    index: 0,
    moving: false,
    target: null,
    returnFocus: null,
    libraryWelcome: false,
    ready: false,
  };

  function defaultProgress() {
    return {
      version: TUTORIAL_VERSION,
      completed: [],
      dismissed_welcome: false,
      active_tour: null,
      active_step: 0,
    };
  }

  function sanitizeProgress(value) {
    const source = value && typeof value === 'object' ? value : {};
    const completed = Array.isArray(source.completed)
      ? [...new Set(source.completed.filter(item => TUTORIAL_IDS.includes(item)))]
      : [];
    const activeTour = TUTORIAL_IDS.includes(source.active_tour) ? source.active_tour : null;
    const activeStep = Number.isInteger(Number(source.active_step))
      ? Math.max(0, Math.min(100, Number(source.active_step)))
      : 0;
    return {
      version: TUTORIAL_VERSION,
      completed,
      dismissed_welcome: source.dismissed_welcome === true,
      active_tour: activeTour,
      active_step: activeStep,
    };
  }

  function localProgressKey() {
    const accountId = window.CREW_CENTER_AUTH_USER?.id || 'member';
    return `crew-center-tutorial-progress-v${TUTORIAL_VERSION}-${accountId}`;
  }

  function readLocalProgress() {
    try {
      return sanitizeProgress(JSON.parse(localStorage.getItem(localProgressKey()) || 'null'));
    } catch {
      return defaultProgress();
    }
  }

  function writeLocalProgress() {
    localStorage.setItem(localProgressKey(), JSON.stringify(runtime.progress));
  }

  async function loadTutorialProgress() {
    runtime.progress = readLocalProgress();
    const email = window.CREW_CENTER_AUTH_USER?.email;
    if (!email || typeof supabaseClient === 'undefined' || !supabaseClient) return;
    const { data, error } = await supabaseClient
      .from('members')
      .select('tutorial_progress')
      .ilike('email', email)
      .maybeSingle();
    if (!error && data?.tutorial_progress) {
      runtime.progress = sanitizeProgress(data.tutorial_progress);
      writeLocalProgress();
    }
  }

  async function saveTutorialProgress() {
    runtime.progress = sanitizeProgress(runtime.progress);
    writeLocalProgress();
    if (typeof supabaseClient === 'undefined' || !supabaseClient || !window.CREW_CENTER_AUTH_USER?.email) return;
    const { error } = await supabaseClient.rpc('update_own_tutorial_progress', { p_progress: runtime.progress });
    if (error && !/update_own_tutorial_progress|tutorial_progress/i.test(error.message || '')) {
      console.warn('Tutorial progress could not be synced.', error);
    }
  }

  function availableGuideIds() {
    if (typeof sidebarPageAvailable !== 'function') return FULL_TOUR_ORDER.filter(id => !['crew-deployment', 'equipment-status', 'admin'].includes(id));
    return FULL_TOUR_ORDER.filter(id => id === 'profile' || sidebarPageAvailable(id));
  }

  function guideTitle(id) {
    return guides[id]?.title || (typeof pageTitles !== 'undefined' ? pageTitles[id] : id);
  }

  function buildTourSteps(tourId) {
    const pages = tourId === 'full' ? availableGuideIds() : [tourId];
    return pages.flatMap(page => (guides[page]?.steps || []).map(step => ({ ...step, page })));
  }

  function injectTutorialInterface() {
    const footer = document.querySelector('.sidebar-footer');
    if (!footer || document.getElementById('tutorial-launch-button')) return;
    footer.insertAdjacentHTML('afterbegin', `
      <button type="button" class="tutorial-launch" id="tutorial-launch-button" aria-haspopup="dialog" aria-controls="tutorial-library-backdrop" title="Learn Crew Center">
        <span class="tutorial-launch-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 014.86.83c0 1.67-2.36 1.84-2.36 3.67"/><path d="M12 17h.01"/></svg></span>
        <span class="tutorial-launch-copy"><strong>Learn Crew Center</strong><span>Guides for every page</span></span>
      </button>
    `);
    document.body.insertAdjacentHTML('beforeend', `
      <div class="tutorial-library-backdrop" id="tutorial-library-backdrop" hidden>
        <section class="tutorial-library" role="dialog" aria-modal="true" aria-labelledby="tutorial-library-title">
          <header class="tutorial-library-head">
            <div><div class="tutorial-library-eyebrow" id="tutorial-library-eyebrow">Crew Center guides</div><h2 id="tutorial-library-title">Learn Crew Center</h2><p id="tutorial-library-subtitle">Choose the complete walkthrough or focus on one page.</p></div>
            <button type="button" class="tutorial-icon-button" id="tutorial-library-close" aria-label="Close tutorial library"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </header>
          <div class="tutorial-library-body">
            <div class="tutorial-library-intro"><div><h3 id="tutorial-intro-title">Take the complete tour</h3><p id="tutorial-intro-copy">A smooth walkthrough of every page available to your account. You can pause at any time.</p></div><button type="button" class="tutorial-primary" id="tutorial-full-start">Start full tour</button></div>
            <div class="tutorial-library-section-head"><strong>Page guides</strong><span id="tutorial-guide-count"></span></div>
            <div class="tutorial-guide-grid" id="tutorial-guide-grid"></div>
            <div class="tutorial-library-foot"><button type="button" class="tutorial-quiet" id="tutorial-library-later">Not now</button></div>
          </div>
        </section>
      </div>
      <div class="tutorial-overlay" id="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-step-title" hidden>
        <div class="tutorial-spotlight" id="tutorial-spotlight" aria-hidden="true"></div>
        <section class="tutorial-card" id="tutorial-card">
          <div class="tutorial-card-copy"><div class="tutorial-card-eyebrow" id="tutorial-step-page"></div><h2 id="tutorial-step-title"></h2><p id="tutorial-step-copy"></p></div>
          <div class="tutorial-progress-row"><span id="tutorial-step-progress"></span><span id="tutorial-step-count"></span></div>
          <div class="tutorial-progress-track"><div class="tutorial-progress-fill" id="tutorial-progress-fill"></div></div>
          <div class="tutorial-card-actions"><button type="button" class="tutorial-quiet" id="tutorial-pause">Pause tour</button><button type="button" class="tutorial-secondary" id="tutorial-back">Back</button><button type="button" class="tutorial-primary" id="tutorial-next">Next</button></div>
        </section>
        <div class="tutorial-transition-label" id="tutorial-transition-label" aria-live="polite"></div>
      </div>
    `);

    document.getElementById('tutorial-launch-button').addEventListener('click', () => openTutorialLibrary(false));
    document.getElementById('tutorial-library-close').addEventListener('click', closeTutorialLibrary);
    document.getElementById('tutorial-library-later').addEventListener('click', closeTutorialLibrary);
    document.getElementById('tutorial-library-backdrop').addEventListener('click', event => {
      if (event.target.id === 'tutorial-library-backdrop') closeTutorialLibrary();
    });
    document.getElementById('tutorial-full-start').addEventListener('click', () => {
      const active = runtime.progress.active_tour;
      startTutorial(active || 'full', active ? runtime.progress.active_step : 0);
    });
    document.getElementById('tutorial-guide-grid').addEventListener('click', event => {
      const button = event.target.closest('[data-tutorial-guide]');
      if (button) startTutorial(button.dataset.tutorialGuide, 0);
    });
    document.getElementById('tutorial-back').addEventListener('click', previousTutorialStep);
    document.getElementById('tutorial-next').addEventListener('click', nextTutorialStep);
    document.getElementById('tutorial-pause').addEventListener('click', pauseTutorial);
    document.addEventListener('keydown', handleTutorialKeydown);
    window.addEventListener('resize', repositionTutorial);
    window.addEventListener('scroll', repositionTutorial, true);
  }

  function renderTutorialLibrary() {
    const available = availableGuideIds();
    const completed = new Set(runtime.progress.completed);
    let activeTour = runtime.progress.active_tour;
    if (activeTour && activeTour !== 'full' && !available.includes(activeTour)) {
      runtime.progress.active_tour = null;
      runtime.progress.active_step = 0;
      activeTour = null;
      writeLocalProgress();
    }
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
    const fullButton = document.getElementById('tutorial-full-start');
    document.getElementById('tutorial-guide-count').textContent = `${available.length} available`;
    document.getElementById('tutorial-guide-grid').innerHTML = available.map((id, index) => `
      <button type="button" class="tutorial-guide-button" data-tutorial-guide="${id}">
        <span class="tutorial-guide-number">${String(index + 1).padStart(2, '0')}</span>
        <span class="tutorial-guide-label">${guideTitle(id)}</span>
        <span class="tutorial-guide-status${completed.has(id) ? ' complete' : ''}">${completed.has(id) ? 'Completed' : id === activePage ? 'This page' : 'Start'}</span>
      </button>
    `).join('');
    if (activeTour) {
      document.getElementById('tutorial-intro-title').textContent = `Continue ${activeTour === 'full' ? 'the complete tour' : guideTitle(activeTour)}`;
      document.getElementById('tutorial-intro-copy').textContent = 'Your place was saved when you paused. Continue from where you left off.';
      fullButton.textContent = 'Continue tour';
    } else {
      document.getElementById('tutorial-intro-title').textContent = completed.has('full') ? 'Take the complete tour again' : 'Take the complete tour';
      document.getElementById('tutorial-intro-copy').textContent = 'A smooth walkthrough of every page available to your account. You can pause at any time.';
      fullButton.textContent = completed.has('full') ? 'Restart full tour' : 'Start full tour';
    }
  }

  function openTutorialLibrary(welcome = false) {
    if (!runtime.ready || state.currentUser.isVisitor) return;
    runtime.returnFocus = document.activeElement;
    runtime.libraryWelcome = welcome;
    renderTutorialLibrary();
    document.getElementById('tutorial-library-eyebrow').textContent = welcome ? 'Welcome to Media Club' : 'Crew Center guides';
    document.getElementById('tutorial-library-title').textContent = welcome ? 'Welcome to the Crew Center' : 'Learn Crew Center';
    document.getElementById('tutorial-library-subtitle').textContent = welcome
      ? 'Learn what every page available to your account can do.'
      : 'Choose the complete walkthrough or focus on one page.';
    document.getElementById('tutorial-library-later').textContent = welcome ? 'Maybe later' : 'Close';
    const backdrop = document.getElementById('tutorial-library-backdrop');
    backdrop.hidden = false;
    document.getElementById('tutorial-full-start').focus({ preventScroll: true });
  }

  function closeTutorialLibrary() {
    const backdrop = document.getElementById('tutorial-library-backdrop');
    if (!backdrop || backdrop.hidden) return;
    backdrop.hidden = true;
    if (runtime.libraryWelcome) {
      runtime.progress.dismissed_welcome = true;
      saveTutorialProgress();
    }
    runtime.libraryWelcome = false;
    runtime.returnFocus?.focus?.({ preventScroll: true });
  }

  async function startTutorial(tourId, startIndex = 0) {
    if (!guides[tourId] && tourId !== 'full') return;
    const steps = buildTourSteps(tourId);
    if (!steps.length) return;
    document.getElementById('tutorial-library-backdrop').hidden = true;
    runtime.libraryWelcome = false;
    runtime.tourId = tourId;
    runtime.steps = steps;
    runtime.index = Math.min(Math.max(0, Number(startIndex) || 0), steps.length - 1);
    runtime.progress.dismissed_welcome = true;
    runtime.progress.active_tour = tourId;
    runtime.progress.active_step = runtime.index;
    writeLocalProgress();
    document.body.classList.add('tutorial-running');
    document.getElementById('tutorial-overlay').hidden = false;
    await showTutorialStep(runtime.index);
  }

  function activePageId() {
    return document.querySelector('.page.active')?.id?.replace('page-', '') || 'home';
  }

  function isVisibleTarget(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
  }

  async function waitForTarget(selector, timeout = 2400) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      const element = document.querySelector(selector);
      if (isVisibleTarget(element)) return element;
      await delay(50);
    }
    return null;
  }

  function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  async function showTutorialStep(index) {
    if (runtime.moving) return;
    if (index < 0) return;
    if (index >= runtime.steps.length) {
      await finishTutorial();
      return;
    }
    runtime.moving = true;
    const step = runtime.steps[index];
    const overlay = document.getElementById('tutorial-overlay');
    const pageChanged = activePageId() !== step.page;
    overlay.classList.toggle('is-moving', pageChanged);
    if (pageChanged) {
      document.getElementById('tutorial-transition-label').textContent = `Opening ${guideTitle(step.page)}…`;
      navigate(step.page, navItemForPage(step.page));
      await delay(reduceMotion.matches ? 40 : 240);
    }
    const target = await waitForTarget(step.target);
    if (!target) {
      runtime.moving = false;
      overlay.classList.remove('is-moving');
      await showTutorialStep(index + 1);
      return;
    }
    runtime.index = index;
    runtime.target = target;
    runtime.progress.active_tour = runtime.tourId;
    runtime.progress.active_step = index;
    writeLocalProgress();

    document.getElementById('tutorial-step-page').textContent = guideTitle(step.page);
    document.getElementById('tutorial-step-title').textContent = step.title;
    document.getElementById('tutorial-step-copy').textContent = step.body;
    document.getElementById('tutorial-step-progress').textContent = runtime.tourId === 'full' ? 'Complete Crew Center tour' : `${guideTitle(step.page)} guide`;
    document.getElementById('tutorial-step-count').textContent = `${index + 1} of ${runtime.steps.length}`;
    document.getElementById('tutorial-progress-fill').style.width = `${((index + 1) / runtime.steps.length) * 100}%`;
    document.getElementById('tutorial-back').disabled = index === 0;
    document.getElementById('tutorial-next').textContent = index === runtime.steps.length - 1 ? 'Finish' : 'Next';

    const rect = target.getBoundingClientRect();
    const safeTop = 86;
    const safeBottom = window.innerHeight - (window.innerWidth <= 700 ? 270 : 90);
    if (rect.top < safeTop || rect.bottom > safeBottom) {
      target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: window.innerWidth <= 700 ? 'start' : 'center' });
      await delay(reduceMotion.matches ? 20 : 360);
    }
    positionTutorial(target);
    overlay.classList.remove('is-moving');
    runtime.moving = false;
    document.getElementById('tutorial-next').focus({ preventScroll: true });
  }

  function positionTutorial(target = runtime.target) {
    if (!target || document.getElementById('tutorial-overlay')?.hidden) return;
    const rect = target.getBoundingClientRect();
    const padding = window.innerWidth <= 700 ? 6 : 9;
    const left = Math.max(5, rect.left - padding);
    const top = Math.max(5, rect.top - padding);
    const right = Math.min(window.innerWidth - 5, rect.right + padding);
    const bottom = Math.min(window.innerHeight - 5, rect.bottom + padding);
    const spotlight = document.getElementById('tutorial-spotlight');
    spotlight.style.left = `${left}px`;
    spotlight.style.top = `${top}px`;
    spotlight.style.width = `${Math.max(8, right - left)}px`;
    spotlight.style.height = `${Math.max(8, bottom - top)}px`;
    spotlight.style.borderRadius = `${Math.min(18, Math.max(11, parseFloat(getComputedStyle(target).borderRadius) || 12))}px`;

    if (window.innerWidth <= 700) return;
    const card = document.getElementById('tutorial-card');
    const cardRect = card.getBoundingClientRect();
    const gap = 20;
    const margin = 14;
    let cardLeft;
    let cardTop;
    if (window.innerWidth - right >= cardRect.width + gap + margin) {
      cardLeft = right + gap;
      cardTop = top + Math.min(20, Math.max(0, (bottom - top - cardRect.height) / 2));
    } else if (left >= cardRect.width + gap + margin) {
      cardLeft = left - cardRect.width - gap;
      cardTop = top + Math.min(20, Math.max(0, (bottom - top - cardRect.height) / 2));
    } else if (window.innerHeight - bottom >= cardRect.height + gap + margin) {
      cardLeft = Math.min(window.innerWidth - cardRect.width - margin, Math.max(margin, left));
      cardTop = bottom + gap;
    } else {
      cardLeft = Math.min(window.innerWidth - cardRect.width - margin, Math.max(margin, left));
      cardTop = Math.max(margin, top - cardRect.height - gap);
    }
    card.style.left = `${Math.max(margin, Math.min(window.innerWidth - cardRect.width - margin, cardLeft))}px`;
    card.style.top = `${Math.max(margin, Math.min(window.innerHeight - cardRect.height - margin, cardTop))}px`;
    card.style.right = 'auto';
    card.style.bottom = 'auto';
  }

  function repositionTutorial() {
    if (!runtime.target || runtime.moving) return;
    window.requestAnimationFrame(() => positionTutorial(runtime.target));
  }

  async function nextTutorialStep() {
    if (!runtime.moving) await showTutorialStep(runtime.index + 1);
  }

  async function previousTutorialStep() {
    if (!runtime.moving && runtime.index > 0) await showTutorialStep(runtime.index - 1);
  }

  async function pauseTutorial() {
    if (!runtime.tourId) return;
    runtime.progress.active_tour = runtime.tourId;
    runtime.progress.active_step = runtime.index;
    await saveTutorialProgress();
    closeRunningTutorial();
    if (typeof showToast === 'function') showToast('Tutorial paused. Continue it from Learn Crew Center.');
  }

  async function finishTutorial() {
    const completed = new Set(runtime.progress.completed);
    completed.add(runtime.tourId);
    if (runtime.tourId === 'full') availableGuideIds().forEach(id => completed.add(id));
    runtime.progress.completed = [...completed];
    runtime.progress.active_tour = null;
    runtime.progress.active_step = 0;
    await saveTutorialProgress();
    closeRunningTutorial();
    if (typeof showToast === 'function') showToast('Tutorial complete. You can replay any guide from Learn Crew Center.', 'success', 5000);
  }

  function closeRunningTutorial() {
    document.getElementById('tutorial-overlay').hidden = true;
    document.getElementById('tutorial-overlay').classList.remove('is-moving');
    document.body.classList.remove('tutorial-running');
    runtime.target = null;
    runtime.steps = [];
    runtime.tourId = null;
    runtime.moving = false;
    document.getElementById('tutorial-launch-button')?.focus({ preventScroll: true });
  }

  function trapFocus(container, event) {
    const focusable = [...container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(element => isVisibleTarget(element));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleTutorialKeydown(event) {
    const overlay = document.getElementById('tutorial-overlay');
    const library = document.getElementById('tutorial-library-backdrop');
    if (overlay && !overlay.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        pauseTutorial();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextTutorialStep();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previousTutorialStep();
      } else if (event.key === 'Tab') {
        trapFocus(document.getElementById('tutorial-card'), event);
      }
      return;
    }
    if (library && !library.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTutorialLibrary();
      } else if (event.key === 'Tab') {
        trapFocus(library.querySelector('.tutorial-library'), event);
      }
    }
  }

  async function waitUntilApplicationReady() {
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const signedInMember = document.body.classList.contains('auth-ready')
        && typeof state !== 'undefined'
        && !state.currentUser.isVisitor
        && typeof currentMemberRecord === 'function'
        && currentMemberRecord();
      if (window.CREW_CENTER_DATA_LOADED && signedInMember) return true;
      await delay(100);
    }
    return false;
  }

  async function bootTutorial() {
    injectTutorialInterface();
    const ready = await waitUntilApplicationReady();
    if (!ready) return;
    runtime.ready = true;
    await loadTutorialProgress();
    if (!runtime.progress.dismissed_welcome && !runtime.progress.completed.includes('full')) {
      await delay(500);
      openTutorialLibrary(true);
    }
  }

  bootTutorial();
})();
