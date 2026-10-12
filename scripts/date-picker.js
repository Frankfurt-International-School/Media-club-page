// Keep native date values/validation; enhance only the calendar presentation.
const crewDatePicker = { input: null, trigger: null, dialog: null, month: '', focus: '', closing: false, timer: null };
const crewDateMonthFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const crewDateLabelFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function crewDateParse(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || value.startsWith('0000')) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function crewDateShift(value, days = 0, months = 0) {
  const date = crewDateParse(value);
  if (!date) return '';
  if (months) {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);
    const end = new Date(date);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(day, end.getUTCDate()));
  }
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  return crewDateParse(result) ? result : '';
}

function crewDateAllowed(input, value) {
  if (!crewDateParse(value)) return false;
  const probe = document.createElement('input');
  probe.type = 'date';
  for (const key of ['min', 'max', 'step']) if (input.getAttribute(key)) probe.setAttribute(key, input.getAttribute(key));
  // Native date steps use the value attribute as the base when no minimum is specified.
  if (input.getAttribute('value')) probe.setAttribute('value', input.getAttribute('value'));
  probe.value = value;
  return probe.validity.valid;
}

function crewDateGrid(month) {
  const first = crewDateParse(`${month}-01`);
  if (!first) return [];
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = crewDateShift(`${month}-01`, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => crewDateShift(start, index));
}

function crewDateInputLabel(input) {
  return (input.labels?.[0]?.textContent || input.getAttribute('aria-label') || 'date').replace(/\*/g, '').trim();
}

function crewDateFocus(value) {
  const picker = crewDatePicker;
  if (!crewDateAllowed(picker.input, value)) return;
  picker.focus = value;
  if (picker.month !== value.slice(0, 7)) { picker.month = value.slice(0, 7); renderCrewDatePicker(); }
  picker.dialog.querySelectorAll('[data-crew-date]').forEach(button => { button.tabIndex = button.dataset.crewDate === value ? 0 : -1; });
  picker.dialog.querySelector(`[data-crew-date="${value}"]`)?.focus({ preventScroll: true });
}

function crewDateMonthAvailable(month) {
  const first = `${month}-01`;
  const next = crewDateShift(first, 0, 1);
  const last = crewDateShift(next, -1);
  const input = crewDatePicker.input;
  return crewDateParse(first) && (!input.min || !crewDateParse(input.min) || last >= input.min)
    && (!input.max || !crewDateParse(input.max) || first <= input.max);
}

function renderCrewDatePicker() {
  const picker = crewDatePicker;
  const today = berlinDateKey();
  const days = crewDateGrid(picker.month);
  const allowed = days.filter(value => value.slice(0, 7) === picker.month && crewDateAllowed(picker.input, value));
  if (!days.includes(picker.focus) || !crewDateAllowed(picker.input, picker.focus)) picker.focus = allowed[0] || '';
  const title = crewDateMonthFormat.format(crewDateParse(`${picker.month}-01`));
  const previous = crewDateShift(`${picker.month}-01`, 0, -1).slice(0, 7);
  const next = crewDateShift(`${picker.month}-01`, 0, 1).slice(0, 7);
  const rows = Array.from({ length: 6 }, (_, row) => `<tr>${days.slice(row * 7, row * 7 + 7).map(value => {
    if (!value) return '<td></td>';
    const selected = picker.input.value === value;
    const available = crewDateAllowed(picker.input, value);
    return `<td aria-selected="${selected}"><button type="button" data-crew-date="${value}" tabindex="${picker.focus === value && available ? 0 : -1}" class="crew-date-day${value.slice(0, 7) !== picker.month ? ' outside-month' : ''}${selected ? ' selected' : ''}" aria-label="${crewDateLabelFormat.format(crewDateParse(value))}"${value === today ? ' aria-current="date"' : ''}${available ? '' : ' disabled'}>${Number(value.slice(-2))}</button></td>`;
  }).join('')}</tr>`).join('');
  picker.dialog.innerHTML = `<div class="crew-date-picker-head"><span>Choose date</span><button type="button" class="crew-date-icon-button" data-date-action="close" aria-label="Close calendar">×</button></div>
    <div class="crew-date-month-nav"><button type="button" class="crew-date-icon-button" data-date-action="previous" aria-label="Previous month"${crewDateMonthAvailable(previous) ? '' : ' disabled'}>‹</button><h2 id="crew-date-month" aria-live="polite" aria-atomic="true">${title}</h2><button type="button" class="crew-date-icon-button" data-date-action="next" aria-label="Next month"${crewDateMonthAvailable(next) ? '' : ' disabled'}>›</button></div>
    <table class="crew-date-grid" role="grid" aria-labelledby="crew-date-month" aria-describedby="crew-date-keyboard-help"><thead><tr>${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => `<th scope="col" abbr="${day}">${day.slice(0, 2)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
    <div class="crew-date-picker-footer"><button type="button" data-date-action="today"${crewDateAllowed(picker.input, today) ? '' : ' disabled'}>Today</button>${picker.input.required ? '' : '<button type="button" data-date-action="clear">Clear</button>'}<span>${picker.input.value ? crewDateLabelFormat.format(crewDateParse(picker.input.value)).replace(/^[^,]+, /, '') : 'No date selected'}</span></div>
    <p class="visually-hidden" id="crew-date-keyboard-help">Use arrow keys to move by day or week, Page Up and Page Down to change month, and Enter to choose. Escape closes the calendar.</p>`;
  positionCrewDatePicker();
}

function positionCrewDatePicker() {
  const { input, dialog } = crewDatePicker;
  if (!dialog?.open || !input) return;
  if (!input.isConnected || !input.getClientRects().length || input.disabled || input.readOnly) { closeCrewDatePicker({ immediate: true, returnFocus: false }); return; }
  const anchor = input.getBoundingClientRect();
  const viewport = window.visualViewport;
  const topEdge = (viewport?.offsetTop || 0) + 12;
  const bottomEdge = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - 12;
  const leftEdge = (viewport?.offsetLeft || 0) + 12;
  const rightEdge = (viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth) - 12;
  dialog.style.maxHeight = `${bottomEdge - topEdge}px`;
  dialog.style.maxWidth = `${rightEdge - leftEdge}px`;
  // Layout dimensions stay stable while the opening animation scales the dialog.
  const width = dialog.offsetWidth;
  const height = dialog.offsetHeight;
  const below = anchor.bottom + 8;
  const above = anchor.top - height - 8;
  dialog.style.top = `${Math.max(topEdge, Math.min(below + height <= bottomEdge ? below : above, bottomEdge - height))}px`;
  dialog.style.left = `${Math.max(leftEdge, Math.min(anchor.left, rightEdge - width))}px`;
}

function finishCrewDatePickerClose(returnFocus) {
  const { trigger, dialog } = crewDatePicker;
  clearTimeout(crewDatePicker.timer);
  crewDatePicker.input = null; crewDatePicker.trigger = null; crewDatePicker.dialog = null; crewDatePicker.closing = false; crewDatePicker.timer = null;
  trigger?.setAttribute('aria-expanded', 'false');
  if (dialog?.open) dialog.close();
  dialog?.remove();
  if (returnFocus && trigger?.isConnected && !trigger.disabled && trigger.getClientRects().length && !trigger.closest('[inert]')) trigger.focus({ preventScroll: true });
}

function closeCrewDatePicker({ immediate = false, returnFocus = true } = {}) {
  if (!crewDatePicker.dialog) return;
  if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finishCrewDatePickerClose(returnFocus); return; }
  if (crewDatePicker.closing) return;
  crewDatePicker.closing = true;
  crewDatePicker.dialog.classList.add('closing');
  crewDatePicker.timer = setTimeout(() => finishCrewDatePickerClose(returnFocus), 120);
}
window.closeCrewDatePicker = closeCrewDatePicker;

function chooseCrewDate(value) {
  const input = crewDatePicker.input;
  if (!input || input.disabled || input.readOnly || value && !crewDateAllowed(input, value) || !value && input.required) return;
  const changed = input.value !== value;
  input.value = value;
  closeCrewDatePicker();
  if (changed) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function moveCrewDateMonth(direction, focusGrid = false) {
  const picker = crewDatePicker;
  const month = crewDateShift(`${picker.month}-01`, 0, direction).slice(0, 7);
  if (!crewDateMonthAvailable(month)) return;
  const preferred = crewDateShift(picker.focus || `${picker.month}-01`, 0, direction);
  picker.month = month; picker.focus = preferred;
  renderCrewDatePicker();
  if (focusGrid) crewDateFocus(picker.focus);
  else {
    const button = picker.dialog.querySelector(`[data-date-action="${direction < 0 ? 'previous' : 'next'}"]`);
    if (button && !button.disabled) button.focus({ preventScroll: true });
    else if (picker.focus) crewDateFocus(picker.focus);
    else picker.dialog.querySelector('[data-date-action="close"]').focus();
  }
}

function crewDatePickerKeydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeCrewDatePicker(); return; }
  if (event.key === 'Tab') { event.stopPropagation(); return; } // Native dialog contains focus, independently of the parent modal.
  if (!event.target.closest('[data-crew-date]')) return;
  const picker = crewDatePicker;
  if (event.key === 'PageUp' || event.key === 'PageDown') {
    event.preventDefault(); event.stopPropagation(); moveCrewDateMonth((event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1), true); return;
  }
  const weekday = (crewDateParse(picker.focus).getUTCDay() + 6) % 7;
  const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
  if (!(event.key in steps)) return;
  event.preventDefault(); event.stopPropagation();
  crewDateFocus(crewDateShift(picker.focus, steps[event.key]));
}

function openCrewDatePicker(input) {
  if (!input || input.disabled || input.readOnly || !input.getClientRects().length) return;
  closeCrewDatePicker({ immediate: true, returnFocus: false });
  const trigger = input.parentElement.querySelector('.crew-date-trigger');
  const dialog = document.createElement('dialog');
  dialog.id = 'crew-date-picker'; dialog.className = 'crew-date-picker';
  dialog.setAttribute('aria-label', `Choose ${crewDateInputLabel(input).toLowerCase()}`);
  const date = crewDateParse(input.value) ? input.value : berlinDateKey();
  const start = input.min && crewDateParse(input.min) && date < input.min ? input.min : input.max && crewDateParse(input.max) && date > input.max ? input.max : date;
  Object.assign(crewDatePicker, { input, trigger, dialog, month: start.slice(0, 7), focus: start });
  (input.closest('.modal-backdrop') || document.body).append(dialog);
  renderCrewDatePicker();
  dialog.addEventListener('keydown', crewDatePickerKeydown);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeCrewDatePicker(); });
  dialog.addEventListener('click', event => {
    if (crewDatePicker.closing) return;
    const day = event.target.closest('[data-crew-date]');
    if (day && !day.disabled) { chooseCrewDate(day.dataset.crewDate); return; }
    const action = event.target.closest('[data-date-action]')?.dataset.dateAction;
    if (action === 'previous' || action === 'next') moveCrewDateMonth(action === 'previous' ? -1 : 1);
    else if (action === 'today') chooseCrewDate(berlinDateKey());
    else if (action === 'clear') chooseCrewDate('');
    else if (action === 'close') closeCrewDatePicker();
    else if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeCrewDatePicker();
    }
  });
  dialog.showModal();
  trigger.setAttribute('aria-expanded', 'true');
  positionCrewDatePicker();
  if (crewDatePicker.focus) crewDateFocus(crewDatePicker.focus);
  else dialog.querySelector('[data-date-action="close"]').focus();
}

function initializeCrewDatePickers() {
  if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
  document.querySelectorAll('input.form-input[type="date"]').forEach(input => {
    if (input.closest('.crew-date-field')) return;
    const field = document.createElement('span'); field.className = 'crew-date-field';
    input.before(field); field.append(input); input.classList.add('crew-date-enhanced');
    const button = document.createElement('button'); button.type = 'button'; button.className = 'crew-date-trigger';
    button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', 'crew-date-picker');
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18"/></svg>';
    const sync = () => { button.disabled = input.disabled || input.readOnly; button.setAttribute('aria-label', `Choose ${crewDateInputLabel(input).toLowerCase()}`); };
    button.addEventListener('click', () => openCrewDatePicker(input));
    input.addEventListener('keydown', event => { if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); openCrewDatePicker(input); } });
    input.addEventListener('change', sync);
    new MutationObserver(() => {
      sync(); positionCrewDatePicker();
      if (crewDatePicker.input === input && !crewDatePicker.closing) renderCrewDatePicker();
    }).observe(input, { attributes: true, attributeFilter: ['disabled','readonly','min','max','step','required'] });
    field.append(button); sync();
  });
}
initializeCrewDatePickers();
window.addEventListener('resize', positionCrewDatePicker);
window.visualViewport?.addEventListener('resize', positionCrewDatePicker);
document.addEventListener('scroll', positionCrewDatePicker, true);
