// ══════════════════════════════
// EQUIPMENT
// ══════════════════════════════
function reservationLifecycleStatus(reservation, now = Date.now()) {
  if (reservation.returnedAt || reservation.status === 'returned') return 'returned';
  if (reservation.autoReleasedAt || reservation.status === 'auto_released' || now >= new Date(reservation.endsAt).getTime() + 15 * 60 * 1000) return 'auto_released';
  if (now >= new Date(reservation.startsAt).getTime()) return 'checked_out';
  return 'scheduled';
}

function activeEquipmentReservation(item, now = Date.now()) {
  return item.reservations
    .filter(reservation => reservationLifecycleStatus(reservation, now) === 'checked_out')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] || null;
}

function equipmentDisplayStatus(item, now = Date.now()) {
  if (activeEquipmentReservation(item, now)) return 'checked_out';
  return item.status === 'checked_out' ? 'available' : item.status;
}

function equipmentStatusLabel(status) {
  return { available: 'Available', checked_out: 'Checked out', unavailable: 'Unavailable' }[status] || status;
}

function equipmentStatusColor(status) {
  return status === 'available' ? 'green' : status === 'checked_out' ? 'coral' : 'amber';
}

let equipmentStatusRefreshTimer = null;
function scheduleEquipmentStatusRefresh() {
  if (equipmentStatusRefreshTimer) clearTimeout(equipmentStatusRefreshTimer);
  equipmentStatusRefreshTimer = setTimeout(() => {
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (activePage === 'equipment') renderEquipment();
    if (activePage === 'equipment-status') renderEquipmentStatus();
  }, 30000);
}

function equipmentById(id) {
  return [...state.equipment, ...state.archivedEquipment].find(item => item.id === id);
}

function equipmentDeviceVisual(item) {
  const catalog = [
    { slug: 'canon-r6', brand: 'Canon', brandKey: 'canon', model: 'EOS R6', src: 'assets/equipment/canon-r6.webp', width: 419, height: 303, match: /\b(?:canon\s+)?(?:eos\s+)?r\s*6\b/i },
    { slug: 'canon-700d', brand: 'Canon', brandKey: 'canon', model: 'EOS 700D', src: 'assets/equipment/canon-700d.webp', width: 652, height: 517, match: /\b(?:canon\s+)?(?:eos\s+)?700\s*d\b/i },
    { slug: 'canon-70d', brand: 'Canon', brandKey: 'canon', model: 'EOS 70D', src: 'assets/equipment/canon-70d.webp', width: 645, height: 505, match: /\b(?:canon\s+)?(?:eos\s+)?70\s*d\b/i },
    { slug: 'canon-600d', brand: 'Canon', brandKey: 'canon', model: 'EOS 600D', src: 'assets/equipment/canon-600d.webp', width: 364, height: 279, match: /\b(?:canon\s+)?(?:eos\s+)?600\s*d\b/i },
    { slug: 'canon-450d', brand: 'Canon', brandKey: 'canon', model: 'EOS 450D', src: 'assets/equipment/canon-450d.webp', width: 420, height: 395, match: /\b(?:canon\s+)?(?:eos\s+)?450\s*d\b/i },
    { slug: 'lumix-gh6', brand: 'Lumix', brandKey: 'lumix', model: 'GH6', src: 'assets/equipment/lumix-gh6.webp', width: 534, height: 370, match: /\b(?:(?:panasonic|lumix)\s+)?gh\s*6\b/i },
  ];
  const normalize = value => String(value || '').normalize('NFKC').replace(/[™®©]/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const name = normalize(item?.name);
  const directMatch = catalog.find(device => device.match.test(name));
  if (directMatch) return directMatch;
  const detailMatches = catalog.filter(device => device.match.test(normalize(item?.detail)));
  return detailMatches.length === 1 ? detailMatches[0] : null;
}

function renderArchivedEquipment() {
  const panel = document.getElementById('archived-equipment-panel');
  const list = document.getElementById('archived-equipment-list');
  if (!panel || !list) return;
  panel.hidden = !canManageCrewOperations() || !state.archivedEquipment.length;
  if (panel.hidden) { list.innerHTML = ''; return; }
  list.innerHTML = state.archivedEquipment
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => `<div class="archived-row">
      <div><strong>${escapeHtml(item.name)}</strong><div class="text-muted">${escapeHtml(item.category)} · ${item.reservations.length} preserved reservation record(s)</div></div>
      <div class="archived-row-actions">
        <button type="button" class="btn btn-ghost btn-sm" onclick="restoreArchivedEquipment('${item.id}')">Restore</button>
        ${canAddMembers() ? `<button type="button" class="btn btn-danger btn-sm" onclick="requestPermanentDeleteEquipment('${item.id}')">Delete everything</button>` : ''}
      </div>
    </div>`).join('');
}

function renderEquipment() {
  scheduleEquipmentStatusRefresh();
  renderArchivedEquipment();
  const ownReservationsPanel = document.getElementById('my-equipment-reservations');
  const currentMemberId = currentMemberRecord()?.id;
  const ownReservations = state.equipment.flatMap(item => item.reservations.map(reservation => ({ item, reservation })))
    .filter(({ reservation }) => reservation.memberId === currentMemberId && reservationLifecycleStatus(reservation) === 'scheduled' && new Date(reservation.startsAt).getTime() > Date.now())
    .sort((a, b) => a.reservation.startsAt.localeCompare(b.reservation.startsAt));
  if (ownReservationsPanel) {
    ownReservationsPanel.style.display = ownReservations.length ? '' : 'none';
    ownReservationsPanel.innerHTML = ownReservations.length ? `<div class="section-head" style="margin:0 0 12px;">My upcoming reservations</div>${ownReservations.map(({ item, reservation }) => `<div class="my-equipment-reservation"><div><strong>${escapeHtml(item.name)}</strong><div class="text-muted">${escapeHtml(reservation.eventTitle || reservation.purpose || 'No purpose recorded')} · ${escapeHtml(formatBerlinDateTime(reservation.startsAt, { dateStyle: 'medium', timeStyle: 'short' }))}–${escapeHtml(berlinTimeLabel(reservation.endsAt))} Berlin time</div></div><button class="btn btn-danger btn-sm" onclick="requestCancelEquipmentReservation('${reservation.id}')">Cancel reservation</button></div>`).join('')}` : '';
  }
  const search = document.getElementById('equipment-search')?.value.trim().toLowerCase() || '';
  const categorySelect = document.getElementById('equipment-category-filter');
  const currentCategory = categorySelect?.value || 'all';
  if (categorySelect) {
    const categories = [...new Set(state.equipment.map(item => item.category))].sort();
    categorySelect.innerHTML = '<option value="all">All categories</option>' + categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    categorySelect.value = categories.includes(currentCategory) ? currentCategory : 'all';
  }
  const category = categorySelect?.value || 'all';
  const status = document.getElementById('equipment-status-filter')?.value || 'all';
  const equip = state.equipment.filter(item =>
    (!search || `${item.name} ${item.category} ${item.detail}`.toLowerCase().includes(search))
    && (category === 'all' || item.category === category)
    && (status === 'all' || equipmentDisplayStatus(item) === status)
  );
  const grid = document.getElementById('equipment-grid');
  if (!equip.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
        <p>${state.equipment.length ? 'No equipment matches these filters.' : 'No equipment has been added yet.'}</p>
        ${!state.equipment.length && canManageCrewOperations() ? "<button class=\"btn btn-accent btn-sm\" style=\"margin-top:14px;\" onclick=\"openModal('equip-add-modal')\">Add equipment</button>" : !state.equipment.length ? '<div class="text-muted" style="margin-top:10px;">Equipment can be added by production staff.</div>' : ''}
      </div>`;
    return;
  }
  const equipmentCard = e => {
    const liveStatus = equipmentDisplayStatus(e);
    const device = equipmentDeviceVisual(e);
    const activeReservation = activeEquipmentReservation(e);
    const reservations = e.reservations
      .filter(reservation => reservationLifecycleStatus(reservation) === 'scheduled')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return `
      <div class="equipment-card equipment-catalog-card${device ? ' has-device-visual' : ''}">
        ${device ? `<button type="button" class="equipment-device-visual brand-${device.brandKey}" onclick="openEquipmentDeviceView('${e.id}')" aria-label="Open the ${escapeHtml(e.name)} device view">
          <span class="equipment-device-scanline" aria-hidden="true"></span>
          <span class="equipment-device-visual-label"><span class="equipment-device-signal-dot"></span>Inventory visual</span>
          <img src="${device.src}" width="${device.width}" height="${device.height}" alt="${escapeHtml(e.name)} camera" loading="lazy" decoding="async">
          <span class="equipment-device-brand"><strong>${device.brand}</strong><small>${device.model}</small></span>
          <span class="equipment-device-open">View device <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>
        </button>` : ''}
        <div class="equipment-card-content">
        ${device ? '' : `<div class="equip-icon" style="background:var(--accent-dim);">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" style="width:20px;height:20px;">
            <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </div>`}
        <div class="equip-name">${escapeHtml(e.name)}</div>
        <div class="equip-detail">${escapeHtml(e.category)} · ${escapeHtml(e.detail)}</div>
        <div class="equip-status">
          <span class="badge badge-${equipmentStatusColor(liveStatus)}">${escapeHtml(equipmentStatusLabel(liveStatus))}</span>
          <span class="text-muted">${reservations.length} upcoming</span>
        </div>
        ${activeReservation ? `<div class="text-muted" style="margin-top:6px;"><strong>With ${escapeHtml(activeReservation.memberName)}</strong> · until ${escapeHtml(berlinTimeLabel(activeReservation.endsAt))}${activeReservation.eventTitle ? ` · ${escapeHtml(activeReservation.eventTitle)}` : activeReservation.purpose ? ` · ${escapeHtml(activeReservation.purpose)}` : ''}</div>` : ''}
        ${reservations.slice(0, 2).map(reservation => `<div class="text-muted" style="margin-top:6px;">${escapeHtml(reservation.memberName)} · ${escapeHtml(formatBerlinDateTime(reservation.startsAt, { dateStyle: 'medium', timeStyle: 'short' }))}–${escapeHtml(berlinTimeLabel(reservation.endsAt))}${reservation.eventTitle ? ` · ${escapeHtml(reservation.eventTitle)}` : ''}</div>`).join('')}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">
          <button class="btn btn-accent btn-sm" ${liveStatus !== 'available' ? 'disabled' : ''} onclick="openEquipmentReservation('${e.id}')">Reserve</button>
          ${canManageCrewOperations() ? `${liveStatus === 'checked_out' && canAccessEquipmentStatus() ? '<span class="text-muted">Manage return through Equipment Status</span>' : ''}<button class="btn btn-ghost btn-sm" onclick="requestArchiveEquipment('${e.id}')">Archive</button>` : ''}
          ${canAddMembers() ? `<button class="btn btn-danger btn-sm" onclick="requestPermanentDeleteEquipment('${e.id}')">Delete everything</button>` : ''}
        </div>
        </div>
      </div>`;
  };
  const equipmentCategoryOrder = ['Recording Cameras', 'Camera', 'Tripod', 'Microphone', 'Accessories', 'Other'];
  const categories = [...new Set(equip.map(item => item.category))].sort((a, b) => {
    const indexA = equipmentCategoryOrder.indexOf(a);
    const indexB = equipmentCategoryOrder.indexOf(b);
    return (indexA < 0 ? equipmentCategoryOrder.length : indexA) - (indexB < 0 ? equipmentCategoryOrder.length : indexB) || a.localeCompare(b);
  });
  grid.innerHTML = categories.map(category => {
    const items = equip.filter(item => item.category === category).sort((a, b) => a.name.localeCompare(b.name));
    return `<section class="catalog-section">
      <div class="catalog-section-head"><span class="catalog-section-title">${escapeHtml(category)}</span><span class="badge badge-gray catalog-section-count">${items.length}</span></div>
      <div class="catalog-equipment-grid">${items.map(equipmentCard).join('')}</div>
    </section>`;
  }).join('');
}

let equipmentDeviceViewId = null;

function openEquipmentDeviceView(id) {
  const item = state.equipment.find(equipment => equipment.id === id);
  const device = equipmentDeviceVisual(item);
  if (!item || !device) return;
  equipmentDeviceViewId = id;
  const liveStatus = equipmentDisplayStatus(item);
  const upcomingReservations = item.reservations.filter(reservation => reservationLifecycleStatus(reservation) === 'scheduled').length;
  const modal = document.getElementById('equipment-device-modal');
  const image = document.getElementById('equipment-device-image');
  modal.dataset.brand = device.brandKey;
  image.src = device.src;
  image.width = device.width;
  image.height = device.height;
  image.alt = `${item.name} camera`;
  document.getElementById('equipment-device-brand').textContent = device.brand;
  document.getElementById('equipment-device-model').textContent = device.model;
  document.getElementById('equipment-device-title').textContent = item.name;
  document.getElementById('equipment-device-subtitle').textContent = `Inventory profile for ${item.name}. Confirm the device before reserving it.`;
  document.getElementById('equipment-device-category').textContent = item.category;
  document.getElementById('equipment-device-status').textContent = equipmentStatusLabel(liveStatus);
  document.getElementById('equipment-device-upcoming').textContent = String(upcomingReservations).padStart(2, '0');
  document.getElementById('equipment-device-notes').textContent = item.detail || 'No equipment notes added.';
  const signal = document.getElementById('equipment-device-signal');
  signal.className = `equipment-device-console-signal status-${liveStatus}`;
  signal.querySelector('span:last-child').textContent = equipmentStatusLabel(liveStatus);
  const reserveButton = document.getElementById('equipment-device-reserve');
  reserveButton.disabled = liveStatus !== 'available' || isVisitorSession();
  reserveButton.textContent = isVisitorSession() ? 'Member sign-in required' : liveStatus === 'available' ? 'Reserve this device' : 'Currently unavailable';
  openModal('equipment-device-modal');
}

function reserveEquipmentFromDeviceView() {
  const id = equipmentDeviceViewId;
  if (!id) return;
  closeModal('equipment-device-modal');
  openEquipmentReservation(id);
}

function renderEquipmentStatus() {
  if (!canAccessEquipmentStatus()) return;
  scheduleEquipmentStatusRefresh();
  const grid = document.getElementById('equipment-status-grid');
  const register = document.getElementById('equipment-register-table');
  const summary = document.getElementById('equipment-status-summary');
  if (!grid || !register) return;
  const counts = state.equipment.reduce((result, item) => {
    const status = equipmentDisplayStatus(item);
    result[status] = (result[status] || 0) + 1;
    return result;
  }, { available: 0, checked_out: 0, unavailable: 0 });
  if (summary) summary.innerHTML = `<span class="equipment-status-stat"><strong>${counts.available}</strong> available</span><span class="equipment-status-stat"><strong>${counts.checked_out}</strong> checked out</span><span class="equipment-status-stat"><strong>${counts.unavailable}</strong> unavailable</span>`;
  const equipmentStatusCard = item => {
    const liveStatus = equipmentDisplayStatus(item);
    const active = activeEquipmentReservation(item);
    return `<div class="equipment-card equipment-status-card status-${liveStatus}">
      <div class="flex-between mb8"><div class="equip-name">${escapeHtml(item.name)}</div><span class="badge badge-${equipmentStatusColor(liveStatus)}">${escapeHtml(equipmentStatusLabel(liveStatus))}</span></div>
      <div class="equipment-status-detail">${escapeHtml(item.detail || 'No equipment details added.')}</div>
      ${active ? `<div class="equipment-holder"><strong>With ${escapeHtml(active.memberName)}</strong><div class="text-muted">${escapeHtml(active.eventTitle || active.purpose || 'No purpose recorded')} · ${escapeHtml(formatBerlinDateTime(active.startsAt, { dateStyle: 'medium', timeStyle: 'short' }))}–${escapeHtml(berlinTimeLabel(active.endsAt))}</div></div><div class="equipment-status-actions"><button class="btn btn-accent btn-sm" onclick="markEquipmentReturned('${active.id}')">Mark returned</button></div>` : `<div class="equipment-status-idle">${liveStatus === 'unavailable' ? 'Temporarily unavailable for reservations.' : 'Ready to reserve.'}</div><div class="equipment-status-actions"><button class="btn ${liveStatus === 'unavailable' ? 'btn-accent' : 'btn-ghost'} btn-sm" onclick="setEquipmentStatus('${item.id}', '${liveStatus === 'unavailable' ? 'available' : 'unavailable'}')">${liveStatus === 'unavailable' ? 'Make available' : 'Mark unavailable'}</button></div>`}
    </div>`;
  };
  const equipmentCategoryOrder = ['Recording Cameras', 'Camera', 'Tripod', 'Microphone', 'Accessories', 'Other'];
  const statusCategories = [...new Set(state.equipment.map(item => item.category))].sort((a, b) => {
    const indexA = equipmentCategoryOrder.indexOf(a);
    const indexB = equipmentCategoryOrder.indexOf(b);
    return (indexA < 0 ? equipmentCategoryOrder.length : indexA) - (indexB < 0 ? equipmentCategoryOrder.length : indexB) || a.localeCompare(b);
  });
  grid.innerHTML = state.equipment.length ? statusCategories.map(category => {
    const items = state.equipment.filter(item => item.category === category).sort((a, b) => a.name.localeCompare(b.name));
    return `<section class="equipment-status-section"><div class="catalog-section-head"><span class="catalog-section-title">${escapeHtml(category)}</span><span class="badge badge-gray catalog-section-count">${items.length}</span></div><div class="equipment-status-card-grid">${items.map(equipmentStatusCard).join('')}</div></section>`;
  }).join('') : '<div class="empty-state"><p>No equipment has been added yet.</p></div>';

  const showReturned = Boolean(document.getElementById('show-returned-equipment')?.checked);
  const rows = state.equipment.flatMap(item => item.reservations.map(reservation => ({ item, reservation })))
    .filter(({ reservation }) => showReturned || reservationLifecycleStatus(reservation) !== 'returned')
    .sort((a, b) => b.reservation.startsAt.localeCompare(a.reservation.startsAt));
  register.innerHTML = `<thead><tr><th>Equipment</th><th>Person</th><th>Session / purpose</th><th>Time</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.length ? rows.map(({ item, reservation }) => {
    const status = reservationLifecycleStatus(reservation);
    const lifecycleTime = value => value ? formatBerlinDateTime(value, { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const statusLabel = status === 'returned'
      ? `Returned${reservation.returnedByName ? ` by ${reservation.returnedByName}` : ''}${reservation.returnedAt ? ` · ${lifecycleTime(reservation.returnedAt)}` : ''}`
      : status === 'checked_out'
        ? `Checked out · ${lifecycleTime(reservation.checkedOutAt || reservation.startsAt)}`
        : status === 'auto_released'
          ? `Auto-released · return unconfirmed · ${lifecycleTime(reservation.autoReleasedAt || new Date(new Date(reservation.endsAt).getTime() + 15 * 60 * 1000).toISOString())}`
          : 'Scheduled';
    const canCancel = status === 'scheduled' && new Date(reservation.startsAt).getTime() > Date.now() && (reservation.memberId === currentMemberRecord()?.id || canAddMembers());
    const action = ['checked_out', 'auto_released'].includes(status)
      ? `<button class="btn btn-accent btn-sm" onclick="markEquipmentReturned('${reservation.id}')">${status === 'auto_released' ? 'Confirm returned' : 'Returned'}</button>`
      : canCancel ? `<button class="btn btn-danger btn-sm" onclick="requestCancelEquipmentReservation('${reservation.id}')">Cancel</button>` : '';
    return `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(reservation.memberName)}</td><td>${escapeHtml(reservation.eventTitle || reservation.purpose || '—')}</td><td>${escapeHtml(formatBerlinDateTime(reservation.startsAt, { dateStyle: 'medium', timeStyle: 'short' }))}–${escapeHtml(berlinTimeLabel(reservation.endsAt))}</td><td>${escapeHtml(statusLabel)}</td><td>${action}</td></tr>`;
  }).join('') : `<tr><td colspan="6">${showReturned ? 'No reservations recorded.' : 'No active or upcoming reservations. Turn on Show returned to view completed loans.'}</td></tr>`}</tbody>`;
}

function requestCancelEquipmentReservation(reservationId) {
  const item = state.equipment.find(equipment => equipment.reservations.some(reservation => reservation.id === reservationId));
  const reservation = item?.reservations.find(entry => entry.id === reservationId);
  const ownsReservation = reservation?.memberId === currentMemberRecord()?.id;
  if (!reservation || reservationLifecycleStatus(reservation) !== 'scheduled' || new Date(reservation.startsAt).getTime() <= Date.now() || (!ownsReservation && !canAddMembers())) {
    showToast('You can only cancel your own upcoming reservation.', 'error');
    return;
  }
  openActionConfirmation({
    kind: 'cancel-equipment-reservation',
    title: `Cancel reservation for ${item.name}?`,
    copy: ownsReservation
      ? 'This equipment will immediately become available for someone else during this time.'
      : `You are cancelling ${reservation.memberName}'s reservation as an Auth Admin.`,
    impact: [
      reservation.eventTitle || reservation.purpose || 'No event or purpose recorded',
      `${formatBerlinDateTime(reservation.startsAt, { dateStyle: 'medium', timeStyle: 'short' })}–${berlinTimeLabel(reservation.endsAt)} Berlin time`,
    ],
    danger: true,
    confirmLabel: 'Cancel reservation',
    busyLabel: 'Cancelling...',
    execute: () => cancelEquipmentReservation(reservationId),
  });
}

async function cancelEquipmentReservation(reservationId) {
  const item = state.equipment.find(equipment => equipment.reservations.some(reservation => reservation.id === reservationId));
  const reservation = item?.reservations.find(entry => entry.id === reservationId);
  const ownsReservation = reservation?.memberId === currentMemberRecord()?.id;
  if (!reservation || reservationLifecycleStatus(reservation) !== 'scheduled' || new Date(reservation.startsAt).getTime() <= Date.now() || (!ownsReservation && !canAddMembers())) {
    showToast('This reservation can no longer be cancelled.', 'error');
    return false;
  }
  const { error } = await supabaseClient.from('equipment_reservations').delete().eq('id', reservationId);
  if (error) { showToast(error.message || "Couldn't cancel the reservation.", 'error', 6000); return false; }
  item.reservations = item.reservations.filter(entry => entry.id !== reservationId);
  renderEquipment();
  renderEquipmentStatus();
  renderDashboard();
  showToast('Equipment reservation cancelled.');
  return true;
}

async function setEquipmentStatus(id, status) {
  if (!canAccessEquipmentStatus() || !['available', 'unavailable'].includes(status)) return;
  const item = state.equipment.find(equipment => equipment.id === id);
  if (!item || activeEquipmentReservation(item)) { showToast('Return checked-out equipment before changing its status.', 'error'); renderEquipmentStatus(); return; }
  const { data: updated, error } = await supabaseClient.rpc('set_equipment_operational_status', { p_equipment_id: id, p_status: status });
  if (error || !updated) { showToast(error?.message || "Couldn't update equipment status.", 'error', 6000); renderEquipmentStatus(); return; }
  item.status = status;
  renderEquipmentStatus();
  showToast(`${item.name} marked ${equipmentStatusLabel(status).toLowerCase()}.`);
}

async function markEquipmentReturned(reservationId) {
  if (!canAccessEquipmentStatus()) return;
  const { data: updated, error } = await supabaseClient.rpc('mark_equipment_reservation_returned', { p_reservation_id: reservationId });
  if (error || !updated) { showToast(error?.message || "Couldn't register the return.", 'error', 6000); return; }
  state.equipment.forEach(item => {
    const reservation = item.reservations.find(entry => entry.id === reservationId);
    if (!reservation) return;
    const wasActivelyCheckedOut = reservationLifecycleStatus(reservation) === 'checked_out';
    reservation.status = 'returned';
    reservation.returnedAt = new Date().toISOString();
    reservation.returnedByName = currentMemberRecord()?.name || state.currentUser.name || '';
    if (wasActivelyCheckedOut) item.status = 'available';
  });
  renderEquipmentStatus();
  renderDashboard();
  showToast('Equipment return registered.');
}

function updateEquipmentOtherCategory() {
  document.getElementById('equip-other-category-group').style.display = document.getElementById('equip-cat').value === 'Other' ? '' : 'none';
}

async function addEquipment() {
  if (!canManageCrewOperations()) {
    showToast('Only production staff can add equipment.', 'error');
    return;
  }
  const name = document.getElementById('equip-name').value.trim();
  const selectedCategory = document.getElementById('equip-cat').value;
  const category = selectedCategory === 'Other' ? document.getElementById('equip-other-category').value.trim() : selectedCategory;
  if (!name) {
    showToast('Please enter an equipment name.', 'error');
    return;
  }
  if (!category) { showToast('Please enter the other equipment category.', 'error'); return; }
  const { data, error } = await supabaseClient
    .from('equipment')
    .insert({
      name,
      category,
      status: 'available',
      notes: document.getElementById('equip-detail').value.trim() || 'Details pending',
    })
    .select('*, members(name)')
    .single();
  if (error) { showToast("Couldn't add equipment.", 'error'); return; }
  state.equipment.push(normalizeEquipment(data));
  closeModal('equip-add-modal');
  ['equip-name','equip-detail','equip-other-category'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('equip-cat').value = 'Recording Cameras';
  updateEquipmentOtherCategory();
  showToast(`${name} added to equipment.`);
  renderEquipment();
  renderDashboard();
}

function requestArchiveEquipment(id) {
  if (!canManageCrewOperations()) return;
  const item = equipmentById(id);
  if (!item || item.archivedAt) return;
  const activeReservations = item.reservations.filter(reservation => reservationLifecycleStatus(reservation) !== 'returned');
  openActionConfirmation({
    kind: 'archive-equipment',
    title: `Archive “${item.name}”?`,
    copy: 'The item will disappear from equipment browsing and reservations, while its completed loan history remains recoverable.',
    impact: [
      `${item.reservations.length} reservation record(s) will be preserved.`,
      activeReservations.length ? `${activeReservations.length} active or upcoming reservation(s) must be completed or cancelled first.` : 'No active reservations block archiving.',
    ],
    confirmLabel: 'Archive equipment',
    execute: async () => {
      const { data, error } = await supabaseClient.rpc('set_equipment_archived', { p_equipment_id: id, p_archived: true });
      if (error || !data) { showToast(error?.message || "Couldn't archive the equipment.", 'error', 7000); return false; }
      await loadCrewCenterData();
      showToast(`“${item.name}” archived.`);
      return true;
    },
  });
}

async function restoreArchivedEquipment(id) {
  if (!canManageCrewOperations()) return;
  const item = equipmentById(id);
  const { data, error } = await supabaseClient.rpc('set_equipment_archived', { p_equipment_id: id, p_archived: false });
  if (error || !data) { showToast(error?.message || "Couldn't restore the equipment.", 'error', 7000); return; }
  await loadCrewCenterData();
  showToast(`“${item?.name || 'Equipment'}” restored.`);
}

async function requestPermanentDeleteEquipment(id) {
  if (!canAddMembers()) { showToast('Only an Auth Admin can permanently delete equipment.', 'error'); return; }
  const item = equipmentById(id);
  if (!item) return;
  const { data: impact, error } = await supabaseClient.rpc('get_equipment_delete_impact', { p_equipment_id: id });
  if (error || !impact) { showToast(error?.message || "Couldn't calculate the deletion impact.", 'error', 7000); return; }
  openActionConfirmation({
    kind: 'permanent-equipment-delete',
    title: `Permanently delete “${item.name}”?`,
    copy: 'Archiving is safer. Permanent deletion is restricted to Auth Admins because PostgreSQL will cascade into reservation history.',
    impact: [`${impact.reservations || 0} equipment reservation record(s) will be erased.`],
    danger: true,
    requiresAcknowledgement: true,
    acknowledgementCopy: 'I understand that this permanently erases the equipment and its reservation history.',
    expectedName: item.name,
    multipleWarnings: true,
    confirmLabel: 'Permanently delete everything',
    busyLabel: 'Deleting everything...',
    execute: async () => {
      const { data, error: deleteError } = await supabaseClient.rpc('permanently_delete_equipment', { p_equipment_id: id, p_expected_name: item.name });
      if (deleteError || !data?.deleted) { showToast(deleteError?.message || "Couldn't permanently delete the equipment.", 'error', 8000); return false; }
      await loadCrewCenterData();
      showToast(`“${item.name}” and its reservation history were permanently deleted.`, 'error', 7000);
      return true;
    },
  });
}

let reservingEquipmentId = null;

function openEquipmentReservation(id) {
  if (isVisitorSession()) { showToast('Visitors cannot reserve equipment.', 'error'); return; }
  const item = state.equipment.find(equipment => equipment.id === id);
  if (!item || equipmentDisplayStatus(item) !== 'available') { showToast('This equipment is unavailable.', 'error'); return; }
  const member = currentMemberRecord();
  const outsideEventAllowed = canReserveOutsideEvent(item, member);
  const reservableEvents = state.events.filter(event => !isPastEvent(event));
  if (!outsideEventAllowed && !reservableEvents.length) {
    showToast('Only Grade 11 and Grade 12 members can borrow cameras outside an event.', 'error', 6000);
    return;
  }
  reservingEquipmentId = id;
  document.getElementById('reserve-equipment-name').textContent = `${item.name} · ${item.category}`;
  document.getElementById('reserve-event').innerHTML = reservableEvents.map(event => `<option value="${event.id}">${escapeHtml(event.title)} — ${escapeHtml(fmtDate(event.date))}</option>`).join('');
  const reservationType = document.getElementById('reserve-type');
  reservationType.innerHTML = `${reservableEvents.length ? '<option value="event">During an event</option>' : ''}${outsideEventAllowed ? '<option value="non_event">Not during an event</option>' : ''}`;
  reservationType.value = reservableEvents.length ? 'event' : 'non_event';
  document.getElementById('reserve-purpose').value = '';
  updateReservationFields();
  openModal('equip-reserve-modal');
}

function updateReservationFields() {
  const duringEvent = document.getElementById('reserve-type').value === 'event';
  document.getElementById('reserve-event-group').style.display = duringEvent ? '' : 'none';
  document.getElementById('reserve-date-group').style.display = duringEvent ? 'none' : '';
  document.getElementById('reserve-purpose-group').style.display = duringEvent ? 'none' : '';
  if (duringEvent) prefillEventReservationTimes();
}

function localTimeFromIso(value) {
  return value ? berlinTimeLabel(value) : '';
}

function prefillEventReservationTimes() {
  const event = state.events.find(item => item.id === document.getElementById('reserve-event').value);
  if (!event) return;
  const member = currentMemberRecord();
  const item = state.equipment.find(equipment => equipment.id === reservingEquipmentId);
  const photographerSignup = event.signups.find(signup => signup.memberId === member?.id && signup.role === 'Photographer');
  const useSignupWindow = item && ['Camera', 'Recording Cameras'].includes(item.category) && !canAccessAdminPanel() && photographerSignup;
  document.getElementById('reserve-start').value = useSignupWindow ? localTimeFromIso(photographerSignup.attendanceStart) : event.game1Start || event.time;
  document.getElementById('reserve-end').value = useSignupWindow ? localTimeFromIso(photographerSignup.attendanceEnd) : event.game4End || event.game3End || event.game2End || localTimeFromIso(event.endsAt) || '23:59';
}

function reservationOverlaps(start, end, otherStart, otherEnd) {
  return start < new Date(otherEnd).getTime() && end > new Date(otherStart).getTime();
}

function memberGradeNumber(member) {
  const match = String(member?.gradeLevel || '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function canReserveOutsideEvent(item, member) {
  const grade = memberGradeNumber(member);
  const isCamera = ['Camera', 'Recording Cameras'].includes(item?.category);
  return !isCamera || [11, 12].includes(grade);
}

async function reserveEquipment() {
  const item = state.equipment.find(equipment => equipment.id === reservingEquipmentId);
  const member = currentMemberRecord();
  if (!item || !member) { showToast("Couldn't match your account to an equipment or member record.", 'error'); return; }
  if (equipmentDisplayStatus(item) !== 'available') { showToast('This equipment is unavailable.', 'error'); return; }
  const type = document.getElementById('reserve-type').value;
  if (type === 'non_event' && !canReserveOutsideEvent(item, member)) {
    showToast('Only Grade 11 and Grade 12 members can borrow cameras outside an event.', 'error', 6000);
    return;
  }
  const purpose = type === 'non_event' ? document.getElementById('reserve-purpose').value.trim() : '';
  if (type === 'non_event' && !purpose) { showToast('Please explain the purpose of this non-event reservation.', 'error'); return; }
  const event = type === 'event' ? state.events.find(item => item.id === document.getElementById('reserve-event').value) : null;
  const date = event?.date || document.getElementById('reserve-date').value;
  const startTime = document.getElementById('reserve-start').value;
  const endTime = document.getElementById('reserve-end').value;
  if (!date || !startTime || !endTime) { showToast('Please choose a date, start time, and end time.', 'error'); return; }
  const start = timeValue(date, startTime);
  const end = timeValue(date, endTime);
  if (start === null || end === null) { showToast('This Berlin date/time is invalid.', 'error'); return; }
  if (end <= start) { showToast('The reservation end time must be after its start time.', 'error'); return; }
  if (item.reservations.some(reservation => reservationOverlaps(start, end, reservation.startsAt, reservation.endsAt))) {
    showToast('This equipment is already reserved during that time.', 'error');
    return;
  }
  const camera = ['Camera', 'Recording Cameras'].includes(item.category);
  const overlappingRestrictedEvent = state.events.find(candidate => {
    if (!candidate.isFestival && !['Livestream', 'Event'].includes(candidate.cat)) return false;
    const eventStart = timeValue(candidate.date, candidate.game1Start || candidate.time);
    const eventEnd = candidate.endsAt ? new Date(candidate.endsAt).getTime() : timeValue(candidate.date, '23:59');
    return start < eventEnd && end > eventStart;
  });
  if (camera && overlappingRestrictedEvent && !canAccessAdminPanel()) {
    const photographerSignup = overlappingRestrictedEvent.signups.find(signup => signup.memberId === member.id && signup.role === 'Photographer');
    const covered = photographerSignup && new Date(photographerSignup.attendanceStart).getTime() <= start && new Date(photographerSignup.attendanceEnd).getTime() >= end;
    if (!covered) {
      showToast('This time is during an event. To use a camera, sign up as Photographer and reserve only within your signup time.', 'error', 6000);
      return;
    }
  }
  const { data, error } = await supabaseClient.from('equipment_reservations').insert({
    equipment_id: item.id,
    member_id: member.id,
    event_id: event?.id || null,
    reservation_type: type,
    purpose: purpose || null,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(end).toISOString(),
  }).select('id, member_id, event_id, reservation_type, purpose, starts_at, ends_at, reservation_status, checked_out_at, returned_at, returned_by, returned_by_name, auto_released_at, members(name), events(title)').single();
  if (error) {
    showToast(error.code === '23P01' ? 'This equipment is already reserved during that time.' : "Couldn't reserve equipment. Check your event signup and requested time.", 'error', 6000);
    return;
  }
  item.reservations.push({ id: data.id, memberId: data.member_id, memberName: data.members?.name || member.name, eventId: data.event_id, eventTitle: data.events?.title || '', type: data.reservation_type, purpose: data.purpose || '', startsAt: data.starts_at, endsAt: data.ends_at, status: data.reservation_status || 'scheduled', checkedOutAt: data.checked_out_at || '', returnedAt: data.returned_at || '', returnedBy: data.returned_by || '', returnedByName: data.returned_by_name || '', autoReleasedAt: data.auto_released_at || '' });
  closeModal('equip-reserve-modal');
  renderEquipment();
  showToast(`${item.name} reserved.`);
}
