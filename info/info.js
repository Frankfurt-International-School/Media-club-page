(function () {
  const config = window.FIS_MEDIA_INFO || {};
  const form = document.getElementById('join-form');
  const submitButton = document.getElementById('submit-application');
  const status = document.getElementById('form-status');
  const success = document.getElementById('join-success');
  const siteKey = String(config.turnstileSiteKey || '');
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

  renderTurnstile();
})();
