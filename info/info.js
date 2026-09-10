(function () {
  const config = window.FIS_MEDIA_INFO || {};
  const form = document.getElementById('join-form');
  const submitButton = document.getElementById('submit-application');
  const status = document.getElementById('form-status');
  const success = document.getElementById('join-success');
  const siteKey = String(config.turnstileSiteKey || '');
  const emailInput = document.getElementById('join-email');
  const yearGroupInput = document.getElementById('join-year-group');
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
    const payload = {
      firstName: String(data.get('firstName') || '').trim(),
      lastName: String(data.get('lastName') || '').trim(),
      email: String(data.get('email') || '').trim().toLowerCase(),
      yearGroup: String(data.get('yearGroup') || ''),
      experienceLevel: String(data.get('experienceLevel') || ''),
      interests: data.getAll('interests').map(String),
      why: String(data.get('why') || '').trim(),
      workLink: String(data.get('workLink') || '').trim(),
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
  yearGroupInput.addEventListener('change', syncApplicationEmailRules);
  syncApplicationEmailRules();
  renderTurnstile();
})();
