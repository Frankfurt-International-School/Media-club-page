// ══════════════════════════════
// CAS ATTENDANCE
// ══════════════════════════════
const casAttendanceDefaults = {
  id: 1,
  schoolYearLabel: '2026–2027',
  yearStart: '2026-09-30',
  yearEnd: '2027-05-31',
  fallStart: '2026-09-30',
  fallEnd: '2026-11-15',
  winterStart: '',
  winterEnd: '',
  springStart: '',
  springEnd: '',
};

let casAttendanceSettings = { ...casAttendanceDefaults };
let casAttendanceSettingsLoaded = false;
let casAttendanceSettingsLoading = null;
let casAttendanceSettingsError = '';
let casAttendanceRangeInitialized = false;
let casAttendanceMemberUpdate = '';

function normalizeCasAttendanceSettings(row = {}) {
  return {
    id: 1,
    schoolYearLabel: row.school_year_label || casAttendanceDefaults.schoolYearLabel,
    yearStart: row.school_year_start || casAttendanceDefaults.yearStart,
    yearEnd: row.school_year_end || casAttendanceDefaults.yearEnd,
    fallStart: row.fall_start || casAttendanceDefaults.fallStart,
    fallEnd: row.fall_end || casAttendanceDefaults.fallEnd,
    winterStart: row.winter_start || '',
    winterEnd: row.winter_end || '',
    springStart: row.spring_start || '',
    springEnd: row.spring_end || '',
  };
}

function memberHasCas(member) {
  return Array.isArray(member?.teamKeys) && member.teamKeys.includes('cas');
}

function casAttendanceAllEvents() {
  const unique = new Map();
  [...state.events, ...state.archivedEvents].forEach(event => unique.set(event.id, event));
  return [...unique.values()];
}

function casAttendanceStats(member, events, range, now = Date.now()) {
  if (!range?.start || !range?.end || range.end < range.start) return { attendedDays: 0, eventDays: 0, rate: null };
  const memberStart = member?.joined_date && member.joined_date > range.start ? member.joined_date : range.start;
  const eligibleEvents = events.filter(event => (
    event.date >= memberStart
    && event.date <= range.end
    && isPastEvent(event, now)
  ));
  const eventDates = new Set(eligibleEvents.map(event => event.date));
  const attendedDates = new Set(eligibleEvents
    .filter(event => event.signups.some(signup => signup.memberId === member.id && ['present', 'late'].includes(signup.attendanceStatus)))
    .map(event => event.date));
  const eventDays = eventDates.size;
  const attendedDays = attendedDates.size;
  return {
    attendedDays,
    eventDays,
    rate: eventDays ? Math.round((attendedDays / eventDays) * 100) : null,
  };
}

function casAttendancePeriodRange(period = 'year') {
  const settingRanges = {
    year: { start: casAttendanceSettings.yearStart, end: casAttendanceSettings.yearEnd },
    fall: { start: casAttendanceSettings.fallStart, end: casAttendanceSettings.fallEnd },
    winter: { start: casAttendanceSettings.winterStart, end: casAttendanceSettings.winterEnd },
    spring: { start: casAttendanceSettings.springStart, end: casAttendanceSettings.springEnd },
  };
  if (period === 'custom') {
    return {
      start: document.getElementById('cas-range-start')?.value || '',
      end: document.getElementById('cas-range-end')?.value || '',
    };
  }
  return settingRanges[period] || settingRanges.year;
}

function casAttendancePeriodLabel(period = 'year') {
  return ({ year: `Full school year ${casAttendanceSettings.schoolYearLabel}`, fall: 'Fall season', winter: 'Winter season', spring: 'Spring season', custom: 'Custom period' })[period] || 'Selected period';
}

function setCasAttendanceRangeInputs(range, editable) {
  const start = document.getElementById('cas-range-start');
  const end = document.getElementById('cas-range-end');
  if (!start || !end) return;
  start.value = range?.start || '';
  end.value = range?.end || '';
  start.readOnly = !editable;
  end.readOnly = !editable;
  start.toggleAttribute('aria-readonly', !editable);
  end.toggleAttribute('aria-readonly', !editable);
}

function fillCasAttendanceSettingsForm() {
  const fields = {
    'cas-school-year-label': casAttendanceSettings.schoolYearLabel,
    'cas-year-start': casAttendanceSettings.yearStart,
    'cas-year-end': casAttendanceSettings.yearEnd,
    'cas-fall-start': casAttendanceSettings.fallStart,
    'cas-fall-end': casAttendanceSettings.fallEnd,
    'cas-winter-start': casAttendanceSettings.winterStart,
    'cas-winter-end': casAttendanceSettings.winterEnd,
    'cas-spring-start': casAttendanceSettings.springStart,
    'cas-spring-end': casAttendanceSettings.springEnd,
  };
  Object.entries(fields).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value;
  });
}

async function loadCasAttendanceSettings() {
  if (!canAccessAdminPanel() || casAttendanceSettingsLoaded) return;
  if (casAttendanceSettingsLoading) return casAttendanceSettingsLoading;
  casAttendanceSettingsLoading = (async () => {
    const { data, error } = await supabaseClient.from('cas_attendance_settings').select('*').eq('id', 1).maybeSingle();
    casAttendanceSettingsLoaded = true;
    casAttendanceSettingsError = error ? "Season settings are using local defaults until the latest Supabase SQL is installed." : '';
    if (data) casAttendanceSettings = normalizeCasAttendanceSettings(data);
    fillCasAttendanceSettingsForm();
    casAttendanceRangeInitialized = false;
    renderCasAttendanceTracker();
  })().finally(() => { casAttendanceSettingsLoading = null; });
  return casAttendanceSettingsLoading;
}

function changeCasAttendancePeriod(render = true) {
  const period = document.getElementById('cas-period')?.value || 'year';
  const editable = period === 'custom';
  let range = casAttendancePeriodRange(period);
  if (editable && (!range.start || !range.end)) range = casAttendancePeriodRange('year');
  setCasAttendanceRangeInputs(range, editable);
  casAttendanceRangeInitialized = true;
  if (render) renderCasAttendanceTracker();
}

function changeCasCustomRange() {
  if (document.getElementById('cas-period')?.value !== 'custom') return;
  renderCasAttendanceTracker();
}

function casAttendanceRateMarkup(stats, contextLabel) {
  if (stats.rate === null) return '<span class="cas-rate-empty">No completed event days</span>';
  const risk = stats.rate < 50;
  return `<div class="cas-rate${risk ? ' is-risk' : ' is-on-track'}"><div class="cas-rate-value"><strong>${stats.rate}%</strong><span>${stats.attendedDays} / ${stats.eventDays} days</span></div><div class="cas-rate-bar" aria-label="${escapeHtml(contextLabel)} attendance ${stats.rate}%"><span style="width:${stats.rate}%"></span></div>${risk ? '<span class="cas-rate-warning">Below 50%</span>' : '<span class="cas-rate-pass">On track</span>'}</div>`;
}

function renderCasAttendanceTracker() {
  const table = document.getElementById('cas-attendance-table-wrap');
  if (!table || !canAccessAdminPanel()) return;
  if (!casAttendanceSettingsLoaded && !casAttendanceSettingsLoading) loadCasAttendanceSettings();
  if (!casAttendanceRangeInitialized) changeCasAttendancePeriod(false);

  const period = document.getElementById('cas-period')?.value || 'year';
  const range = casAttendancePeriodRange(period);
  const yearRange = casAttendancePeriodRange('year');
  const status = document.getElementById('cas-tracker-status');
  const validRange = Boolean(range.start && range.end && range.start <= range.end);
  if (status) {
    status.classList.toggle('has-warning', Boolean(casAttendanceSettingsError || !validRange));
    status.textContent = casAttendanceSettingsError || (!validRange ? `Add both ${casAttendancePeriodLabel(period)} dates in Season date settings.` : `${casAttendancePeriodLabel(period)} · ${formatBerlinCalendarDate(range.start, { day: 'numeric', month: 'short', year: 'numeric' })}–${formatBerlinCalendarDate(range.end, { day: 'numeric', month: 'short', year: 'numeric' })}`);
  }
  if (!validRange) {
    document.getElementById('cas-tracker-summary').innerHTML = '';
    table.innerHTML = '<div class="empty-state"><p>This period needs confirmed start and end dates before attendance can be calculated.</p></div>';
    return;
  }

  const events = casAttendanceAllEvents();
  const q = (document.getElementById('cas-member-search')?.value || '').trim().toLowerCase();
  const casOnly = Boolean(document.getElementById('cas-only-filter')?.checked);
  const members = state.members
    .filter(member => (!casOnly || memberHasCas(member)) && (!q || `${member.name} ${member.gradeLevel} ${member.role}`.toLowerCase().includes(q)))
    .sort((a, b) => Number(memberHasCas(b)) - Number(memberHasCas(a)) || a.name.localeCompare(b.name));
  const selectedRows = members.map(member => ({ member, stats: casAttendanceStats(member, events, range), yearStats: casAttendanceStats(member, events, yearRange) }));
  const allPeriodDates = new Set(events.filter(event => event.date >= range.start && event.date <= range.end && isPastEvent(event)).map(event => event.date));
  const allYearDates = new Set(events.filter(event => event.date >= yearRange.start && event.date <= yearRange.end && isPastEvent(event)).map(event => event.date));
  const casMembers = state.members.filter(memberHasCas);
  const casAtRisk = casMembers.filter(member => {
    const stats = casAttendanceStats(member, events, range);
    return stats.rate !== null && stats.rate < 50;
  }).length;
  document.getElementById('cas-tracker-summary').innerHTML = `
    <div><span>Completed event days</span><strong>${allPeriodDates.size}</strong><small>Multiple events on one date count once</small></div>
    <div><span>CAS members</span><strong>${casMembers.length}</strong><small>${casAtRisk} currently below 50%</small></div>
    <div><span>Full-year event days</span><strong>${allYearDates.size}</strong><small>${escapeHtml(casAttendanceSettings.schoolYearLabel)}</small></div>`;

  if (!members.length) {
    table.innerHTML = '<div class="empty-state"><p>No members match these filters.</p></div>';
    return;
  }
  table.innerHTML = `<table class="cas-attendance-table"><thead><tr><th>Member</th><th>${escapeHtml(casAttendancePeriodLabel(period))}</th><th>Full year</th><th>CAS status</th></tr></thead><tbody>${selectedRows.map(({ member, stats, yearStats }) => {
    const cas = memberHasCas(member);
    return `<tr><td data-label="Member"><div class="cas-member-cell"><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml([member.gradeLevel, member.role].filter(Boolean).join(' · '))}</span>${cas ? '<span class="badge badge-cas">CAS</span>' : ''}</div></td><td data-label="Selected period">${casAttendanceRateMarkup(stats, casAttendancePeriodLabel(period))}</td><td data-label="Full year">${casAttendanceRateMarkup(yearStats, 'Full school year')}</td><td data-label="CAS status"><button type="button" class="cas-status-toggle${cas ? ' active' : ''}" aria-pressed="${cas}" ${casAttendanceMemberUpdate ? 'disabled' : ''} onclick="toggleCasMember('${member.id}', ${!cas})"><span></span>${cas ? 'Tracked for CAS' : 'Not CAS'}</button></td></tr>`;
  }).join('')}</tbody></table>`;
}

async function toggleCasMember(memberId, enabled) {
  if (!canAccessAdminPanel() || casAttendanceMemberUpdate) return;
  const member = state.members.find(item => item.id === memberId);
  if (!member) return;
  casAttendanceMemberUpdate = memberId;
  renderCasAttendanceTracker();
  const request = enabled
    ? supabaseClient.from('member_team_memberships').insert({ member_id: memberId, team_key: 'cas' })
    : supabaseClient.from('member_team_memberships').delete().eq('member_id', memberId).eq('team_key', 'cas');
  const { error } = await request;
  casAttendanceMemberUpdate = '';
  if (error && !(enabled && error.code === '23505')) {
    showToast("Couldn't update the CAS tag. Run the latest Supabase SQL files first.", 'error', 7000);
    renderCasAttendanceTracker();
    return;
  }
  const keys = new Set(member.teamKeys || []);
  if (enabled) keys.add('cas'); else keys.delete('cas');
  member.teamKeys = [...keys];
  renderCasAttendanceTracker();
  renderMembers();
  showToast(`${member.name} is ${enabled ? 'now' : 'no longer'} tracked for CAS.`);
}

function readCasSettingsForm() {
  const value = id => document.getElementById(id)?.value.trim() || '';
  return {
    schoolYearLabel: value('cas-school-year-label'),
    yearStart: value('cas-year-start'),
    yearEnd: value('cas-year-end'),
    fallStart: value('cas-fall-start'),
    fallEnd: value('cas-fall-end'),
    winterStart: value('cas-winter-start'),
    winterEnd: value('cas-winter-end'),
    springStart: value('cas-spring-start'),
    springEnd: value('cas-spring-end'),
  };
}

function casSettingsValidationError(settings) {
  if (!settings.schoolYearLabel || !settings.yearStart || !settings.yearEnd || !settings.fallStart || !settings.fallEnd) return 'Add the school year and Fall date ranges.';
  const pairs = [
    ['school year', settings.yearStart, settings.yearEnd, true],
    ['Fall season', settings.fallStart, settings.fallEnd, true],
    ['Winter season', settings.winterStart, settings.winterEnd, false],
    ['Spring season', settings.springStart, settings.springEnd, false],
  ];
  for (const [label, start, end, required] of pairs) {
    if (!required && !start && !end) continue;
    if (!start || !end) return `Add both dates for the ${label}.`;
    if (end < start) return `The ${label} end date must be on or after its start date.`;
    if (label !== 'school year' && (start < settings.yearStart || end > settings.yearEnd)) return `Keep the ${label} inside the school year.`;
  }
  return '';
}

async function saveCasAttendanceSettings() {
  if (!canAccessAdminPanel()) return;
  const settings = readCasSettingsForm();
  const validationError = casSettingsValidationError(settings);
  if (validationError) { showToast(validationError, 'error', 7000); return; }
  const button = document.getElementById('cas-season-save');
  button.disabled = true;
  button.textContent = 'Saving…';
  const payload = {
    id: 1,
    school_year_label: settings.schoolYearLabel,
    school_year_start: settings.yearStart,
    school_year_end: settings.yearEnd,
    fall_start: settings.fallStart,
    fall_end: settings.fallEnd,
    winter_start: settings.winterStart || null,
    winter_end: settings.winterEnd || null,
    spring_start: settings.springStart || null,
    spring_end: settings.springEnd || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseClient.from('cas_attendance_settings').upsert(payload).select('*').single();
  button.disabled = false;
  button.textContent = 'Save date ranges';
  if (error || !data) {
    showToast("Couldn't save the CAS season dates. Run the latest Supabase SQL files first.", 'error', 7000);
    return;
  }
  casAttendanceSettings = normalizeCasAttendanceSettings(data);
  casAttendanceSettingsLoaded = true;
  casAttendanceSettingsError = '';
  fillCasAttendanceSettingsForm();
  changeCasAttendancePeriod(false);
  renderCasAttendanceTracker();
  showToast('CAS season dates saved.');
}
