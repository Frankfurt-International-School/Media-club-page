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

function isCameraEquipment(item) {
  return ['Camera', 'Recording Cameras'].includes(item?.category);
}

function equipmentCompatibilityLabel(group) {
  return {
    'canon-r6': 'Canon R6 system',
    'lumix-gh6': 'Lumix GH6 system',
    'canon-aps-c': 'Canon APS-C DSLR system',
  }[group] || 'Compatibility not configured';
}

function equipmentReservationKitEntries(reservation) {
  if (!reservation) return [];
  const entries = state.equipment.flatMap(item => item.reservations.map(entry => ({ item, reservation: entry })));
  return reservation.groupId
    ? entries.filter(entry => entry.reservation.groupId === reservation.groupId)
    : entries.filter(entry => entry.reservation.id === reservation.id);
}

function equipmentReservationKitName(reservation) {
  return equipmentReservationKitEntries(reservation)
    .sort((a, b) => Number(a.item.category === 'Lens') - Number(b.item.category === 'Lens'))
    .map(entry => entry.item.name)
    .join(' + ');
}

function equipmentDeviceVisual(item) {
  const catalog = [
    { slug: 'canon-r6', kind: 'camera', brand: 'Canon', brandKey: 'canon', model: 'EOS R6', src: 'assets/equipment/canon-r6.webp', width: 419, height: 303, match: /\b(?:canon\s+)?(?:eos\s+)?r\s*6\b/i },
    { slug: 'canon-700d', kind: 'camera', brand: 'Canon', brandKey: 'canon', model: 'EOS 700D', src: 'assets/equipment/canon-700d.webp', width: 652, height: 517, match: /\b(?:canon\s+)?(?:eos\s+)?700\s*d\b/i },
    { slug: 'canon-70d', kind: 'camera', brand: 'Canon', brandKey: 'canon', model: 'EOS 70D', src: 'assets/equipment/canon-70d.webp', width: 645, height: 505, match: /\b(?:canon\s+)?(?:eos\s+)?70\s*d\b/i },
    { slug: 'canon-600d', kind: 'camera', brand: 'Canon', brandKey: 'canon', model: 'EOS 600D', src: 'assets/equipment/canon-600d.webp', width: 364, height: 279, match: /\b(?:canon\s+)?(?:eos\s+)?600\s*d\b/i },
    { slug: 'canon-450d', kind: 'camera', brand: 'Canon', brandKey: 'canon', model: 'EOS 450D', src: 'assets/equipment/canon-450d.webp', width: 420, height: 395, match: /\b(?:canon\s+)?(?:eos\s+)?450\s*d\b/i },
    { slug: 'lumix-gh6', kind: 'camera', brand: 'Lumix', brandKey: 'lumix', model: 'GH6', src: 'assets/equipment/lumix-gh6.webp', width: 534, height: 370, match: /\b(?:(?:panasonic|lumix)\s+)?gh\s*6\b/i },
    { slug: 'canon-ef-s-18-135', kind: 'lens', brand: 'Canon', brandKey: 'canon', model: 'EF-S 18–135mm', src: 'assets/equipment/lenses/canon-ef-s-18-135.webp', width: 800, height: 800, match: /\b18[\s–-]*135\s*mm\b/i },
    { slug: 'canon-ef-s-18-55', kind: 'lens', brand: 'Canon', brandKey: 'canon', model: 'EF-S 18–55mm', src: 'assets/equipment/lenses/canon-ef-s-18-55.webp', width: 800, height: 800, match: /\b18[\s–-]*55\s*mm\b/i },
    { slug: 'canon-ef-s-24', kind: 'lens', brand: 'Canon', brandKey: 'canon', model: 'EF-S 24mm', src: 'assets/equipment/lenses/canon-ef-s-24.webp', width: 800, height: 589, match: /\b(?:ef\s*s\s+)?24\s*mm\b/i },
    { slug: 'canon-ef-50', kind: 'lens', brand: 'Canon', brandKey: 'canon', model: 'EF-S 50mm', src: 'assets/equipment/lenses/canon-ef-50.webp', width: 800, height: 685, match: /\b(?:ef[\s-]*s\s+)?50\s*mm\b/i },
    { slug: 'canon-ef-s-55-250', kind: 'lens', brand: 'Canon', brandKey: 'canon', model: 'EF-S 55–250mm', src: 'assets/equipment/lenses/canon-ef-s-55-250.webp', width: 400, height: 400, match: /\b55[\s–-]*250\s*mm\b/i },
    { slug: 'sigma-24-70', kind: 'lens', brand: 'Sigma', brandKey: 'sigma', model: '24–70mm F2.8 Art', src: 'assets/equipment/lenses/sigma-24-70.webp', width: 546, height: 800, match: /\bsigma\b[\s\S]*\b24[\s–-]*70\s*mm\b/i },
    { slug: 'leica-dg-12-60', kind: 'lens', brand: 'Leica DG', brandKey: 'leica', model: '12–60mm F2.8–4', src: 'assets/equipment/lenses/leica-dg-12-60.webp', width: 484, height: 484, match: /\bleica\b[\s\S]*\b12[\s–-]*60\s*mm\b/i },
    { slug: 'olympus-40-150', kind: 'lens', brand: 'Olympus', brandKey: 'olympus', model: '40–150mm F2.8 PRO', src: 'assets/equipment/lenses/olympus-40-150.webp', width: 392, height: 800, match: /\bolympus\b[\s\S]*\b40[\s–-]*150\s*mm\b/i },
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
  const ownReservationEntries = state.equipment.flatMap(item => item.reservations.map(reservation => ({ item, reservation })))
    .filter(({ reservation }) => reservation.memberId === currentMemberId && reservationLifecycleStatus(reservation) === 'scheduled' && new Date(reservation.startsAt).getTime() > Date.now())
    .sort((a, b) => a.reservation.startsAt.localeCompare(b.reservation.startsAt));
  const ownReservations = [...ownReservationEntries.reduce((groups, entry) => {
    const key = entry.reservation.groupId || entry.reservation.id;
    if (!groups.has(key)) groups.set(key, entry);
    return groups;
  }, new Map()).values()];
  if (ownReservationsPanel) {
    ownReservationsPanel.style.display = ownReservations.length ? '' : 'none';
    ownReservationsPanel.innerHTML = ownReservations.length ? `<div class="section-head" style="margin:0 0 12px;">My upcoming reservations</div>${ownReservations.map(({ item, reservation }) => `<div class="my-equipment-reservation"><div><strong>${escapeHtml(equipmentReservationKitName(reservation) || item.name)}</strong><div class="text-muted">${escapeHtml(reservation.eventTitle || reservation.purpose || 'No purpose recorded')} · ${escapeHtml(formatBerlinDateTime(reservation.startsAt, { dateStyle: 'medium', timeStyle: 'short' }))}–${escapeHtml(berlinTimeLabel(reservation.endsAt))} Berlin time</div></div><button class="btn btn-danger btn-sm" onclick="requestCancelEquipmentReservation('${reservation.id}')">Cancel reservation</button></div>`).join('')}` : '';
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
      <div class="equipment-card equipment-catalog-card${device ? ' has-device-visual' : ''}${device?.kind === 'lens' ? ' is-lens' : ''}">
        ${device ? `<button type="button" class="equipment-device-visual brand-${device.brandKey}${device.kind === 'lens' ? ' is-lens' : ''}" onclick="openEquipmentDeviceView('${e.id}')" aria-label="Open the ${escapeHtml(e.name)} device view">
          <span class="equipment-device-scanline" aria-hidden="true"></span>
          <span class="equipment-device-visual-label"><span class="equipment-device-signal-dot"></span>${device.kind === 'lens' ? 'Optics profile' : 'Inventory visual'}</span>
          <img src="${device.src}" width="${device.width}" height="${device.height}" alt="${escapeHtml(e.name)} ${device.kind}" loading="lazy" decoding="async">
          <span class="equipment-device-brand"><strong>${device.brand}</strong><small>${device.model}</small></span>
          <span class="equipment-device-open">View ${device.kind === 'lens' ? 'lens' : 'device'} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>
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
          ${e.category === 'Lens' ? '<span class="equipment-lens-lock">Paired with camera reservations</span>' : `<button class="btn btn-accent btn-sm" ${liveStatus !== 'available' ? 'disabled' : ''} onclick="openEquipmentReservation('${e.id}')">Reserve</button>`}
          ${canManageCrewOperations() ? `${liveStatus === 'checked_out' && canAccessEquipmentStatus() ? '<span class="text-muted">Manage return through Equipment Status</span>' : ''}<button class="btn btn-ghost btn-sm" onclick="requestArchiveEquipment('${e.id}')">Archive</button>` : ''}
          ${canAddMembers() ? `<button class="btn btn-danger btn-sm" onclick="requestPermanentDeleteEquipment('${e.id}')">Delete everything</button>` : ''}
        </div>
        </div>
      </div>`;
  };
  const equipmentCategoryOrder = ['Recording Cameras', 'Camera', 'Lens', 'Tripod', 'Microphone', 'Accessories', 'Other'];
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
  modal.dataset.deviceKind = device.kind;
  image.src = device.src;
  image.width = device.width;
  image.height = device.height;
  image.alt = `${item.name} ${device.kind}`;
  document.getElementById('equipment-device-brand').textContent = device.brand;
  document.getElementById('equipment-device-model').textContent = device.model;
  document.getElementById('equipment-device-title').textContent = item.name;
  document.getElementById('equipment-device-subtitle').textContent = device.kind === 'lens'
    ? `Optics profile for ${item.name}. This lens is selected as part of a compatible camera kit.`
    : `Inventory profile for ${item.name}. Confirm the device before reserving it.`;
  document.getElementById('equipment-device-category').textContent = item.category;
  document.getElementById('equipment-device-status').textContent = equipmentStatusLabel(liveStatus);
  document.getElementById('equipment-device-upcoming').textContent = String(upcomingReservations).padStart(2, '0');
  document.getElementById('equipment-device-notes').textContent = item.detail || 'No equipment notes added.';
  const signal = document.getElementById('equipment-device-signal');
  signal.className = `equipment-device-console-signal status-${liveStatus}`;
  signal.querySelector('span:last-child').textContent = equipmentStatusLabel(liveStatus);
  const reserveButton = document.getElementById('equipment-device-reserve');
  reserveButton.disabled = device.kind === 'lens' || liveStatus !== 'available' || isVisitorSession();
  reserveButton.textContent = isVisitorSession()
    ? 'Member sign-in required'
    : device.kind === 'lens'
      ? 'Select with a compatible camera'
      : liveStatus === 'available' ? 'Reserve this device' : 'Currently unavailable';
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
  const equipmentCategoryOrder = ['Recording Cameras', 'Camera', 'Lens', 'Tripod', 'Microphone', 'Accessories', 'Other'];
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
  const kitEntries = equipmentReservationKitEntries(reservation);
  const isKit = kitEntries.length > 1;
  openActionConfirmation({
    kind: 'cancel-equipment-reservation',
    title: `Cancel reservation for ${equipmentReservationKitName(reservation) || item.name}?`,
    copy: ownsReservation
      ? isKit ? 'The complete camera-and-lens kit will immediately become available for someone else during this time.' : 'This equipment will immediately become available for someone else during this time.'
      : `You are cancelling ${reservation.memberName}'s reservation as an Auth Admin.`,
    impact: [
      ...(isKit ? [`Kit: ${kitEntries.map(entry => entry.item.name).join(' + ')}`] : []),
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
  const groupId = reservation.groupId;
  const { data: cancelled, error } = await supabaseClient.rpc('cancel_equipment_reservation_group', { p_reservation_id: reservationId });
  if (error || !cancelled) { showToast(error?.message || "Couldn't cancel the reservation.", 'error', 6000); return false; }
  state.equipment.forEach(equipment => {
    equipment.reservations = equipment.reservations.filter(entry => groupId ? entry.groupId !== groupId : entry.id !== reservationId);
  });
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
  const targetReservation = state.equipment.flatMap(item => item.reservations).find(reservation => reservation.id === reservationId);
  const targetGroupId = targetReservation?.groupId || '';
  const { data: updated, error } = await supabaseClient.rpc('mark_equipment_reservation_returned', { p_reservation_id: reservationId });
  if (error || !updated) { showToast(error?.message || "Couldn't register the return.", 'error', 6000); return; }
  state.equipment.forEach(item => {
    const returnedReservations = item.reservations.filter(entry => targetGroupId ? entry.groupId === targetGroupId : entry.id === reservationId);
    returnedReservations.forEach(reservation => {
      const wasActivelyCheckedOut = reservationLifecycleStatus(reservation) === 'checked_out';
      reservation.status = 'returned';
      reservation.returnedAt = new Date().toISOString();
      reservation.returnedByName = currentMemberRecord()?.name || state.currentUser.name || '';
      if (wasActivelyCheckedOut) item.status = 'available';
    });
  });
  renderEquipmentStatus();
  renderDashboard();
  showToast('Equipment return registered.');
}

function updateEquipmentOtherCategory() {
  const category = document.getElementById('equip-cat').value;
  document.getElementById('equip-other-category-group').style.display = category === 'Other' ? '' : 'none';
  document.getElementById('equip-compatibility-group').style.display = ['Camera', 'Recording Cameras', 'Lens'].includes(category) ? '' : 'none';
}

async function addEquipment() {
  if (!canManageCrewOperations()) {
    showToast('Only production staff can add equipment.', 'error');
    return;
  }
  const name = document.getElementById('equip-name').value.trim();
  const selectedCategory = document.getElementById('equip-cat').value;
  const category = selectedCategory === 'Other' ? document.getElementById('equip-other-category').value.trim() : selectedCategory;
  const compatibilityGroup = ['Camera', 'Recording Cameras', 'Lens'].includes(category) ? document.getElementById('equip-compatibility').value : '';
  if (!name) {
    showToast('Please enter an equipment name.', 'error');
    return;
  }
  if (!category) { showToast('Please enter the other equipment category.', 'error'); return; }
  if (category === 'Lens' && !compatibilityGroup) { showToast('Choose the camera system this lens supports.', 'error'); return; }
  const { data, error } = await supabaseClient
    .from('equipment')
    .insert({
      name,
      category,
      compatibility_group: compatibilityGroup || null,
      status: 'available',
      notes: document.getElementById('equip-detail').value.trim() || 'Details pending',
    })
    .select('*, members(name)')
    .single();
  if (error) { showToast("Couldn't add equipment.", 'error'); return; }
  state.equipment.push(normalizeEquipment(data));
  closeModal('equip-add-modal');
  ['equip-name','equip-detail','equip-other-category'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('equip-compatibility').value = '';
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

function currentEquipmentReservationWindow() {
  const item = state.equipment.find(equipment => equipment.id === reservingEquipmentId);
  const type = document.getElementById('reserve-type')?.value;
  const event = type === 'event' ? state.events.find(candidate => candidate.id === document.getElementById('reserve-event')?.value) : null;
  const date = event?.date || document.getElementById('reserve-date')?.value;
  const startTime = document.getElementById('reserve-start')?.value;
  const endTime = document.getElementById('reserve-end')?.value;
  const start = date && startTime ? timeValue(date, startTime) : null;
  const end = date && endTime ? timeValue(date, endTime) : null;
  return item && start !== null && end !== null && end > start ? { item, start, end } : { item, start: null, end: null };
}

function renderReservationLensOptions() {
  const panel = document.getElementById('reserve-lens-system');
  const grid = document.getElementById('reserve-lens-grid');
  const { item: camera, start, end } = currentEquipmentReservationWindow();
  if (!panel || !grid) return;
  if (!isCameraEquipment(camera)) {
    panel.hidden = true;
    grid.innerHTML = '';
    return;
  }
  panel.hidden = false;
  document.getElementById('reserve-lens-compatibility').textContent = equipmentCompatibilityLabel(camera.compatibilityGroup).toUpperCase();
  const selectedInput = document.querySelector('input[name="reserve-lens"]:checked');
  const previous = selectedInput ? selectedInput.value : null;
  const lenses = state.equipment
    .filter(item => item.category === 'Lens' && item.compatibilityGroup === camera.compatibilityGroup)
    .sort((a, b) => a.name.localeCompare(b.name));
  const options = lenses.map(lens => {
    const device = equipmentDeviceVisual(lens);
    const conflicts = start !== null && end !== null && lens.reservations.some(reservation => reservationOverlaps(start, end, reservation.startsAt, reservation.endsAt));
    const available = equipmentDisplayStatus(lens) === 'available' && !conflicts;
    const status = conflicts ? 'Reserved for this time' : equipmentDisplayStatus(lens) === 'available' ? 'Available' : equipmentStatusLabel(equipmentDisplayStatus(lens));
    return { lens, device, available, status };
  });
  const preferred = previous === '' && canAddMembers()
    ? ''
    : options.some(option => option.available && option.lens.id === previous)
      ? previous
      : options.find(option => option.available)?.lens.id || '';
  const adminNoLens = canAddMembers() ? `<label class="reservation-lens-choice no-lens${preferred === '' ? ' selected' : ''}">
    <input type="radio" name="reserve-lens" value="" ${preferred === '' ? 'checked' : ''} onchange="renderReservationLensOptions()">
    <span class="reservation-lens-admin">AUTH ADMIN EXCEPTION</span><strong>No lens</strong><small>Reserve the camera body only</small>
  </label>` : '';
  grid.innerHTML = options.length || adminNoLens ? `${options.map(({ lens, device, available, status }) => `<label class="reservation-lens-choice${lens.id === preferred ? ' selected' : ''}${available ? '' : ' unavailable'}">
    <input type="radio" name="reserve-lens" value="${lens.id}" ${lens.id === preferred ? 'checked' : ''} ${available ? '' : 'disabled'} onchange="renderReservationLensOptions()">
    ${device ? `<span class="reservation-lens-thumb brand-${device.brandKey}"><img src="${device.src}" width="${device.width}" height="${device.height}" alt="" loading="lazy" decoding="async"></span>` : ''}
    <span class="reservation-lens-copy"><strong>${escapeHtml(lens.name)}</strong><small>${escapeHtml(lens.detail)}</small><span class="${available ? 'available' : ''}">${escapeHtml(status)}</span></span>
  </label>`).join('')}${adminNoLens}` : '<div class="reservation-lens-empty">No compatible lenses are configured for this camera yet. Ask a production lead to check its lens system.</div>';
  const availableCount = options.filter(option => option.available).length;
  document.getElementById('reserve-lens-help').textContent = availableCount
    ? `Select one of ${availableCount} compatible ${availableCount === 1 ? 'lens' : 'lenses'} available for this time.`
    : canAddMembers() ? 'No compatible lens is available for this time. Auth Admins may use the body-only exception.' : 'No compatible lens is available for this time.';
}

function openEquipmentReservation(id) {
  if (isVisitorSession()) { showToast('Visitors cannot reserve equipment.', 'error'); return; }
  const item = state.equipment.find(equipment => equipment.id === id);
  if (!item || equipmentDisplayStatus(item) !== 'available') { showToast('This equipment is unavailable.', 'error'); return; }
  if (item.category === 'Lens') { showToast('Lenses are reserved as part of a compatible camera kit.', 'error', 5000); return; }
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
  document.getElementById('reserve-date').value = '';
  document.getElementById('reserve-lens-grid').innerHTML = '';
  updateReservationFields();
  openModal('equip-reserve-modal');
}

function updateReservationFields() {
  const duringEvent = document.getElementById('reserve-type').value === 'event';
  document.getElementById('reserve-event-group').style.display = duringEvent ? '' : 'none';
  document.getElementById('reserve-date-group').style.display = duringEvent ? 'none' : '';
  document.getElementById('reserve-purpose-group').style.display = duringEvent ? 'none' : '';
  if (duringEvent) prefillEventReservationTimes();
  renderReservationLensOptions();
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
  renderReservationLensOptions();
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
  const isCamera = isCameraEquipment(item);
  return !isCamera || [11, 12].includes(grade);
}

function addEquipmentReservationToState(data, fallbackMember, fallbackEvent) {
  const target = state.equipment.find(item => item.id === data.equipment_id);
  if (!target) return;
  target.reservations.push({
    id: data.id,
    groupId: data.reservation_group_id || '',
    memberId: data.member_id,
    memberName: data.member_name || data.members?.name || fallbackMember?.name || 'Unknown member',
    eventId: data.event_id,
    eventTitle: data.event_title || data.events?.title || fallbackEvent?.title || '',
    type: data.reservation_type,
    purpose: data.purpose || '',
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    status: data.reservation_status || 'scheduled',
    checkedOutAt: data.checked_out_at || '',
    returnedAt: data.returned_at || '',
    returnedBy: data.returned_by || '',
    returnedByName: data.returned_by_name || '',
    autoReleasedAt: data.auto_released_at || '',
  });
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
  const camera = isCameraEquipment(item);
  const selectedLensId = camera ? document.querySelector('input[name="reserve-lens"]:checked')?.value || '' : '';
  const lens = selectedLensId ? state.equipment.find(candidate => candidate.id === selectedLensId) : null;
  if (camera && !lens && !canAddMembers()) {
    showToast('Select an available compatible lens for this camera reservation.', 'error', 6000);
    renderReservationLensOptions();
    return;
  }
  if (lens && (lens.category !== 'Lens' || lens.compatibilityGroup !== item.compatibilityGroup)) {
    showToast('That lens is not compatible with the selected camera.', 'error');
    renderReservationLensOptions();
    return;
  }
  if (lens && (equipmentDisplayStatus(lens) !== 'available' || lens.reservations.some(reservation => reservationOverlaps(start, end, reservation.startsAt, reservation.endsAt)))) {
    showToast('That lens is unavailable during the selected time. Choose another lens.', 'error', 6000);
    renderReservationLensOptions();
    return;
  }
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
  const startsAt = new Date(start).toISOString();
  const endsAt = new Date(end).toISOString();
  const submitButton = document.getElementById('reserve-equipment-submit');
  submitButton.disabled = true;
  submitButton.textContent = camera ? 'Linking camera kit...' : 'Reserving...';
  const mutation = camera
    ? supabaseClient.rpc('create_camera_kit_reservation', {
        p_camera_id: item.id,
        p_lens_id: lens?.id || null,
        p_event_id: event?.id || null,
        p_reservation_type: type,
        p_purpose: purpose || null,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
      })
    : supabaseClient.from('equipment_reservations').insert({
        equipment_id: item.id,
        member_id: member.id,
        event_id: event?.id || null,
        reservation_type: type,
        purpose: purpose || null,
        starts_at: startsAt,
        ends_at: endsAt,
      }).select('id, reservation_group_id, equipment_id, member_id, event_id, reservation_type, purpose, starts_at, ends_at, reservation_status, checked_out_at, returned_at, returned_by, returned_by_name, auto_released_at, members(name), events(title)').single();
  const { data, error } = await mutation;
  submitButton.disabled = false;
  submitButton.textContent = 'Reserve';
  if (error) {
    const safeMessage = /compatible lens|required with every camera|currently unavailable|already reserved|Photographer|Grade 11|Grade 12|valid event|non-event purpose|lens compatibility/i.test(error.message || '')
      ? error.message
      : "Couldn't reserve equipment. Check your event signup and requested time.";
    showToast(error.code === '23P01' ? 'This equipment is already reserved during that time.' : safeMessage, 'error', 7000);
    renderReservationLensOptions();
    return;
  }
  const reservations = camera ? data?.reservations || [] : [data];
  reservations.forEach(reservation => addEquipmentReservationToState(reservation, member, event));
  closeModal('equip-reserve-modal');
  renderEquipment();
  showToast(camera && lens ? `${item.name} + ${lens.name} reserved as one kit.` : `${item.name} reserved.`);
}
