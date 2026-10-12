(function () {
  const config = window.FIS_MEDIA_INFO || {};
  const form = document.getElementById('join-form');
  const submitButton = document.getElementById('submit-application');
  const status = document.getElementById('form-status');
  const success = document.getElementById('join-success');
  const siteKey = String(config.turnstileSiteKey || '');
  const emailInput = document.getElementById('join-email');
  const yearGroupInput = document.getElementById('join-year-group');
  const sacNote = document.getElementById('sac-application-note');
  const currentSacMemberInput = document.getElementById('current-sac-member');
  const whyInput = form.elements.why;
  const studentAliasPattern = /^[a-z]{2}\d{4,}@fis\.edu$/i;
  const schoolEmailPattern = /^[^\s@]+@fis\.edu$/i;
  let turnstileToken = '';
  let widgetId;

  function setStatus(message = '', type = 'error') {
    status.textContent = message;
    status.classList.toggle('visible', Boolean(message));
    status.classList.toggle('success', type === 'success');
  }

  function isConfigured() {
    return Boolean(siteKey && siteKey !== '__TURNSTILE_SITE_KEY__' && config.submitApplicationUrl);
  }

  function syncApplicationEmailRules() {
    const adult = yearGroupInput.value === 'Adult';
    document.getElementById('join-email-help').textContent = adult
      ? 'Adults may use their normal staff address ending in @fis.edu.'
      : 'Students: exactly 2 letters followed by at least 4 numbers, ending in @fis.edu.';
    emailInput.placeholder = adult ? 'name@fis.edu' : 'XX12345@fis.edu';
    emailInput.setCustomValidity('');
  }

  function validateApplicationEmail() {
    const email = emailInput.value.trim();
    const adult = yearGroupInput.value === 'Adult';
    const valid = adult ? schoolEmailPattern.test(email) : studentAliasPattern.test(email);
    emailInput.setCustomValidity(valid || !email
      ? ''
      : adult
        ? 'Use your FIS staff email ending in @fis.edu.'
        : 'Use your student alias: 2 letters, at least 4 numbers, then @fis.edu.');
    return valid;
  }

  function syncApplicationTarget() {
    const target = form.elements.applicationTarget.value;
    const includesSac = target !== 'media_club';
    const sacOnly = target === 'sac';
    sacNote.hidden = !includesSac;
    currentSacMemberInput.required = includesSac;
    form.classList.toggle('sac-only', sacOnly);
    for (const id of ['media-experience-field', 'media-interests-field', 'media-why-field', 'media-sensitive-note', 'media-work-field']) {
      document.getElementById(id).hidden = sacOnly;
    }
    whyInput.required = !sacOnly;
    yearGroupInput.setCustomValidity(includesSac && !/^Grade (9|10|11|12)$/.test(yearGroupInput.value)
      ? 'SAC applications are open only to current SAC members in Grades 9–12.'
      : '');
    document.getElementById('join-success-message').textContent = includesSac
      ? 'We will review your application. SAC sign-ups stay locked until your account is approved and tagged as an SAC member.'
      : 'We will review it and contact you at your FIS alias email. You do not need to create an account now.';
  }

  function renderTurnstile(attempt = 0) {
    if (!isConfigured()) {
      setStatus('Applications are being configured. Please check back shortly.');
      submitButton.disabled = true;
      return;
    }
    if (!window.turnstile) {
      if (attempt < 30) window.setTimeout(() => renderTurnstile(attempt + 1), 200);
      else {
        setStatus('Human verification could not load. Check your connection and refresh this page.');
        submitButton.disabled = true;
      }
      return;
    }
    widgetId = window.turnstile.render('#turnstile-widget', {
      sitekey: siteKey,
      action: 'join_application',
      size: window.matchMedia('(max-width: 360px)').matches ? 'compact' : 'normal',
      callback: token => {
        turnstileToken = token;
        setStatus('');
      },
      'expired-callback': () => { turnstileToken = ''; },
      'error-callback': () => {
        turnstileToken = '';
        setStatus('Human verification failed to load. Refresh the page and try again.');
      },
    });
  }

  function resetTurnstile() {
    turnstileToken = '';
    if (window.turnstile && widgetId !== undefined) window.turnstile.reset(widgetId);
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus('');
    validateApplicationEmail();
    if (!form.reportValidity()) return;
    if (!turnstileToken) {
      setStatus('Please complete the human verification before submitting.');
      return;
    }

    const data = new FormData(form);
    const applicationTarget = String(data.get('applicationTarget') || 'media_club');
    const payload = {
      firstName: String(data.get('firstName') || '').trim(),
      lastName: Array.from(String(data.get('lastName') || '').trim())[0]?.toUpperCase() || '',
      email: String(data.get('email') || '').trim().toLowerCase(),
      yearGroup: String(data.get('yearGroup') || ''),
      applicationTarget,
      currentSacMember: data.get('currentSacMember') === 'on',
      existingMember: data.get('existingMember') === 'on',
      experienceLevel: applicationTarget === 'sac' ? '' : String(data.get('experienceLevel') || ''),
      interests: applicationTarget === 'sac' ? [] : data.getAll('interests').map(String),
      why: applicationTarget === 'sac' ? '' : String(data.get('why') || '').trim(),
      workLink: applicationTarget === 'sac' ? '' : String(data.get('workLink') || '').trim(),
      website: String(data.get('website') || ''),
      turnstileToken,
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Sending application…';
    try {
      const response = await fetch(config.submitApplicationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Your application could not be submitted. Please try again.');
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch (error) {
      setStatus(error.message || 'Your application could not be submitted. Please try again.');
      resetTurnstile();
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit application';
    }
  });

  emailInput.addEventListener('input', validateApplicationEmail);
  yearGroupInput.addEventListener('change', () => { syncApplicationEmailRules(); syncApplicationTarget(); });
  form.querySelectorAll('input[name="applicationTarget"]').forEach(input => input.addEventListener('change', syncApplicationTarget));
  syncApplicationEmailRules();
  syncApplicationTarget();
  renderTurnstile();
})();
