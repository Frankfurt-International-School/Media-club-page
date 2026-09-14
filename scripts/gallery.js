// ══════════════════════════════
// GALLERY
// ══════════════════════════════
const galleryColors = { Photo: ['#EEEDFE','#b49dff'], Video: ['#FAECE7','#ff7b5e'], Podcast: ['#E1F5EE','#4ef0c4'], Design: ['#FAEEDA','#ffb547'] };
const galleryTabFilters = { all: 'all', photo: 'Photo', video: 'Video', podcast: 'Podcast', design: 'Design' };
const galleryIcons = {
  Photo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  Video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
  Podcast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  Design: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
};

function galleryViewFromUrl() {
  return new URLSearchParams(window.location.search).get('view') === 'athletics' ? 'athletics' : 'showcase';
}

function canAccessAthleticsGallery() {
  if (isVisitorSession()) return false;
  const member = currentMemberRecord();
  const hasAthleticsTag = memberDirectoryTags(member?.spec, member?.teamKeys).hasAthletics;
  return Boolean(
    canAccessAdminPanel()
    || normalizeRoleName(member?.role || '') === 'leader'
    || hasAthleticsTag
    || state.gallery.some(project => project.scope === 'athletics' && project.memberId === member?.id)
  );
}

async function hydrateRestrictedGalleryMedia() {
  const projects = state.gallery.filter(project => project.scope === 'athletics' && project.storagePath && !project.image_url && !project.mediaHydrationPending);
  if (!projects.length || !supabaseClient || isVisitorSession()) return;
  await Promise.all(projects.map(async project => {
    project.mediaHydrationPending = true;
    const { data, error } = await supabaseClient.storage.from('gallery-athletics').createSignedUrl(project.storagePath, 3600);
    project.mediaHydrationPending = false;
    if (!error && data?.signedUrl && state.gallery.includes(project)) project.image_url = data.signedUrl;
  }));
  if (pageFromPath() === 'gallery') renderGallery();
}

function renderGalleryAuthorField() {
  const input = document.getElementById('gal-author');
  if (!input) return;
  input.disabled = true;
  input.value = currentMemberRecord()?.name || state.currentUser.name || '';
}

function renderGalleryEventOptions() {
  const select = document.getElementById('gal-event');
  const eventGroup = document.getElementById('gal-event-group');
  const eventNote = document.getElementById('gallery-event-note');
  const productionDate = document.getElementById('gal-produced-on')?.value || '';
  const athletics = document.getElementById('gal-scope')?.value === 'athletics';
  if (!select || !eventGroup) return;
  const selected = select.value;
  const events = [...state.events, ...state.archivedEvents]
    .filter(event => event.date === productionDate)
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
  eventGroup.hidden = !athletics || !productionDate;
  if (eventGroup.hidden) {
    select.value = '';
    return;
  }
  select.disabled = events.length === 0;
  select.innerHTML = events.length
    ? `<option value="">No linked event</option>${events.map(event => `<option value="${event.id}">${escapeHtml(event.time)} · ${escapeHtml(event.title)}${event.archivedAt ? ' · Archived' : ''}</option>`).join('')}`
    : '<option value="">No events on this date</option>';
  if (events.some(event => event.id === selected)) select.value = selected;
  if (eventNote) eventNote.innerHTML = events.length
    ? `<strong>${events.length} event${events.length === 1 ? '' : 's'} on this date:</strong> choose one to connect the upload, or leave it unlinked.`
    : '<strong>No events on this date.</strong> You can still publish the project without linking an event.';
}

function openGalleryProject(card) {
  const url = safeExternalUrl(card?.dataset?.projectUrl);
  if (url) window.open(url, '_blank', 'noopener');
}

function applyGalleryBackgrounds(grid) {
  grid.querySelectorAll('[data-image-url]').forEach(card => {
    const url = safeExternalUrl(card.dataset.imageUrl);
    if (url) card.style.backgroundImage = `url(${JSON.stringify(url)})`;
  });
}

function renderAboutRecentProjects() {
  const grid = document.getElementById('about-recent-projects');
  if (!grid) return;
  const projects = state.gallery.filter(project => project.scope === 'showcase').slice(0, 3);
  if (!projects.length) {
    grid.innerHTML = '<div class="about-project-empty"><strong>No projects are published yet.</strong><div class="text-muted" style="margin-top:5px;">Check back soon—the latest member work will appear here automatically.</div></div>';
    return;
  }
  grid.innerHTML = projects.map(project => {
    const imageUrl = safeExternalUrl(project.image_url);
    const producedLabel = project.producedOn ? ` · ${formatBerlinCalendarDate(project.producedOn, { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
    return `<article class="about-project-card">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Cover image for ${escapeHtml(project.title)}" loading="lazy">` : ''}
      <a class="about-project-open" href="${escapeHtml(pageUrl('gallery', { tab: String(project.type || '').toLowerCase() }))}" aria-label="View ${escapeHtml(project.title)} in the Project Gallery"></a>
      <div class="about-project-meta"><div class="about-project-title">${escapeHtml(project.title)}</div><div class="about-project-detail">${escapeHtml(project.author)} · ${escapeHtml(project.type)}${escapeHtml(producedLabel)}</div></div>
    </article>`;
  }).join('');
}

function renderGallery() {
  const athleticsAvailable = canAccessAthleticsGallery();
  const requestedView = galleryViewFromUrl();
  const view = requestedView === 'athletics' && athleticsAvailable ? 'athletics' : 'showcase';
  state.galleryView = view;
  document.querySelector('#page-gallery .gallery-view-row')?.classList.toggle('single', !athleticsAvailable);
  const selectedTab = tabValueFromUrl(Object.keys(galleryTabFilters), 'all');
  if (requestedView === 'athletics' && !athleticsAvailable) {
    window.history.replaceState({ page: 'gallery' }, '', pageUrl('gallery', { tab: selectedTab === 'all' ? '' : selectedTab }));
  }
  state.galleryFilter = galleryTabFilters[selectedTab];
  document.querySelectorAll('#page-gallery [data-gallery-tab]').forEach(tab => {
    const active = tab.dataset.galleryTab === selectedTab;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    tab.href = pageUrl('gallery', { view: view === 'athletics' ? 'athletics' : '', tab: tab.dataset.galleryTab === 'all' ? '' : tab.dataset.galleryTab });
  });
  document.querySelectorAll('#page-gallery [data-gallery-view]').forEach(tab => {
    const tabView = tab.dataset.galleryView;
    const visible = tabView !== 'athletics' || athleticsAvailable;
    const active = tabView === view;
    tab.hidden = !visible;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    tab.href = pageUrl('gallery', { view: tabView === 'athletics' ? 'athletics' : '', tab: selectedTab === 'all' ? '' : selectedTab });
  });
  const galleryKicker = document.getElementById('gallery-kicker');
  const gallerySub = document.getElementById('gallery-page-sub');
  const accessNote = document.getElementById('gallery-access-note');
  if (galleryKicker) galleryKicker.textContent = view === 'athletics' ? 'Department delivery / restricted archive' : 'Crew output / visual archive';
  if (gallerySub) gallerySub.textContent = view === 'athletics'
    ? 'Photos and project links for the Athletics department, grouped by production date.'
    : 'Public showcase of films, photos, podcasts, and designs by club members.';
  if (accessNote) {
    accessNote.hidden = view !== 'athletics';
    accessNote.innerHTML = view === 'athletics'
      ? '<strong>Restricted collection.</strong> Only Athletics-tagged members, the uploader, Faculty, and Leaders can open these records. Uploaded files use expiring links.'
      : '';
  }
  updateSlidingTab(document.querySelector('#page-gallery .tab-row'));
  const canSubmit = !isVisitorSession() && Boolean(currentMemberRecord());
  const submitButton = document.getElementById('gallery-submit-open');
  if (submitButton) submitButton.style.display = canSubmit ? '' : 'none';
  if (!canSubmit && document.getElementById('gallery-modal')?.classList.contains('open')) closeModal('gallery-modal');
  const f = state.galleryFilter;
  const viewProjects = state.gallery.filter(project => project.scope === view);
  const list = f === 'all' ? viewProjects : viewProjects.filter(g => g.type === f);
  const grid = document.getElementById('gallery-grid');
  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <p>${view === 'athletics' ? 'No Athletics projects are available yet.' : 'No showcase projects have been submitted yet.'}</p>
        ${canSubmit ? '<button class="btn btn-accent btn-sm" style="margin-top:14px;" onclick="openModal(\'gallery-modal\')">Submit project</button>' : '<div class="text-muted" style="margin-top:10px;">Approved members can submit projects after signing in.</div>'}
      </div>`;
    return;
  }
  const currentMemberId = currentMemberRecord()?.id;
  const galleryCard = g => {
    const [gbg, gfg] = galleryColors[g.type] || ['#1a1a1d','#a09eb8'];
    const canDelete = state.currentUser.isAdmin || (currentMemberId && g.memberId === currentMemberId);
    const imageUrl = safeExternalUrl(g.image_url);
    const projectUrl = safeExternalUrl(g.link) || imageUrl;
    const producedLabel = g.producedOn ? formatBerlinCalendarDate(g.producedOn, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const eventLabel = g.eventTitle ? `${g.eventDate ? `${formatEventDate(g.eventDate)} · ` : ''}${g.eventTitle}` : '';
    return `
      <article class="gallery-item${imageUrl ? ' has-img' : ''}" style="${imageUrl ? '' : `background:linear-gradient(145deg,${gbg},var(--bg3));`}" data-project-url="${escapeHtml(projectUrl)}"${imageUrl ? ` data-image-url="${escapeHtml(imageUrl)}"` : ''}>
        <button type="button" class="gallery-open-target" aria-label="Open ${escapeHtml(g.title)}" onclick="openGalleryProject(this.parentElement)"><span class="visually-hidden">Open ${escapeHtml(g.title)}</span></button>
        ${g.scope === 'athletics' ? '<span class="gallery-scope-badge">Athletics · private</span>' : ''}
        ${canDelete ? `<button class="btn btn-danger btn-sm gallery-delete" onclick="event.stopPropagation();requestDeleteGalleryProject('${g.id}')">Delete</button>` : ''}
        ${imageUrl ? '' : `<div style="color:${gfg};opacity:0.6;">${galleryIcons[g.type] || ''}</div>`}
        <div class="gallery-overlay"><div class="gallery-card-meta"><div class="gallery-card-title">${escapeHtml(g.title)}</div><div class="gallery-card-author">${escapeHtml(g.author)} · ${escapeHtml(g.type)}</div>${eventLabel ? `<div class="gallery-card-event"><span>Linked event</span>${escapeHtml(eventLabel)}</div>` : ''}${producedLabel ? `<div class="gallery-card-date">Produced ${escapeHtml(producedLabel)}</div>` : ''}${g.desc ? `<div class="gallery-overlay-title">${escapeHtml(g.desc)}</div>` : ''}</div></div>
      </article>`;
  };
  if (view === 'athletics') {
    const dateForProject = project => project.producedOn || project.eventDate || '';
    const dates = [...new Set(list.map(dateForProject))].sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return b.localeCompare(a);
    });
    grid.innerHTML = dates.map(date => {
      const projects = list.filter(project => dateForProject(project) === date);
      const label = date
        ? formatBerlinCalendarDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : 'Date not set';
      return `<section class="gallery-category-section gallery-date-section">
        <div class="member-section-head"><span class="member-section-title">${escapeHtml(label)}</span><span class="badge badge-athletics">${projects.length}</span><span class="member-section-line"></span></div>
        <div class="gallery-category-items">${projects.map(galleryCard).join('')}</div>
      </section>`;
    }).join('');
    applyGalleryBackgrounds(grid);
    return;
  }
  if (f !== 'all') {
    grid.innerHTML = list.map(galleryCard).join('');
    applyGalleryBackgrounds(grid);
    return;
  }
  const categoryOrder = ['Photo', 'Video', 'Podcast', 'Design'];
  const categories = [...new Set(list.map(project => project.type))].sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    return (indexA < 0 ? categoryOrder.length : indexA) - (indexB < 0 ? categoryOrder.length : indexB) || a.localeCompare(b);
  });
  grid.innerHTML = categories.map(category => {
    const projects = list.filter(project => project.type === category);
    return `<section class="gallery-category-section">
      <div class="member-section-head"><span class="member-section-title">${escapeHtml(category)}</span><span class="badge" style="background:${(galleryColors[category] || ['#1a1a1d'])[0]};">${projects.length}</span><span class="member-section-line"></span></div>
      <div class="gallery-category-items">${projects.map(galleryCard).join('')}</div>
    </section>`;
  }).join('');
  applyGalleryBackgrounds(grid);
}

function updateSlidingTab(row) {
  if (!row) return;
  let indicator = row.querySelector('.tab-indicator');
  if (!indicator) { indicator = document.createElement('span'); indicator.className = 'tab-indicator'; row.prepend(indicator); }
  const active = row.querySelector('.tab.active');
  if (!active) return;
  indicator.style.width = `${active.offsetWidth}px`;
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}

function updateGalleryScopeHelp() {
  const scope = document.getElementById('gal-scope')?.value === 'athletics' ? 'athletics' : 'showcase';
  const help = document.getElementById('gallery-scope-help');
  const uploadNote = document.getElementById('gallery-upload-note');
  const linkNote = document.getElementById('gallery-link-note');
  const dateNote = document.getElementById('gallery-date-note');
  const eventGroup = document.getElementById('gal-event-group');
  if (help) help.innerHTML = scope === 'athletics'
    ? '<strong>Athletics library:</strong> hidden from visitors and non-Athletics members. The uploader, Faculty, and Leaders retain access.'
    : '<strong>Member showcase:</strong> visible to visitors on the public gallery and About page.';
  if (uploadNote) uploadNote.textContent = scope === 'athletics'
    ? 'The uploaded image is stored privately and opened through an expiring link.'
    : 'Preview happens locally before the file is uploaded to the public showcase.';
  if (linkNote) linkNote.innerHTML = scope === 'athletics'
    ? '<strong>External links:</strong> restrict sharing to the Athletics department or FIS accounts in Google Drive; the Crew Center cannot override permissions on another service.'
    : '<strong>Public showcase:</strong> use a link that visitors are allowed to open.';
  if (dateNote) dateNote.innerHTML = scope === 'athletics'
    ? '<strong>Choose the production date first.</strong> The event selector will then show only events held on that date.'
    : 'Add the date the project was produced.';
  if (scope !== 'athletics' && eventGroup) eventGroup.hidden = true;
  renderGalleryEventOptions();
}

function initSlidingTabs() { document.querySelectorAll('.tab-row').forEach(updateSlidingTab); }

function handleTabKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...event.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]')]
    .filter(tab => !tab.hidden && getComputedStyle(tab).display !== 'none');
  const currentIndex = tabs.indexOf(event.currentTarget);
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? tabs.length - 1
      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[nextIndex].focus();
}

let pendingGalleryDeleteId = null;
let lastGallerySubmissionAt = 0;
let gallerySubmissionInFlight = false;
let galleryPreviewUrl = '';
const GALLERY_MAX_FILE_SIZE = 20 * 1024 * 1024;
const GALLERY_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function clearGalleryFile() {
  const input = document.getElementById('gal-file');
  if (input) input.value = '';
  if (galleryPreviewUrl) URL.revokeObjectURL(galleryPreviewUrl);
  galleryPreviewUrl = '';
  const preview = document.getElementById('gallery-image-preview');
  preview.removeAttribute('src');
  preview.style.display = 'none';
  document.getElementById('gallery-preview-bar').style.display = 'none';
  document.getElementById('gallery-upload-prompt').style.display = '';
}

function handleGalleryFile(event) {
  const file = event.target.files?.[0];
  if (!file) { clearGalleryFile(); return; }
  if (!GALLERY_ALLOWED_TYPES.has(file.type)) {
    clearGalleryFile();
    showToast('Choose a JPG, PNG, or WebP image.', 'error');
    return;
  }
  if (file.size > GALLERY_MAX_FILE_SIZE) {
    clearGalleryFile();
    showToast('The cover image must be 20 MB or smaller.', 'error');
    return;
  }
  if (galleryPreviewUrl) URL.revokeObjectURL(galleryPreviewUrl);
  galleryPreviewUrl = URL.createObjectURL(file);
  const preview = document.getElementById('gallery-image-preview');
  preview.src = galleryPreviewUrl;
  preview.style.display = 'block';
  document.getElementById('gallery-upload-prompt').style.display = 'none';
  document.getElementById('gallery-file-meta').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  document.getElementById('gallery-preview-bar').style.display = 'flex';
}

function galleryCooldownRemaining() {
  return Math.max(0, 20000 - (Date.now() - lastGallerySubmissionAt));
}

function updateGallerySubmitCooldown() {
  const button = document.getElementById('gallery-submit-button');
  if (!button) return;
  const remaining = galleryCooldownRemaining();
  button.disabled = gallerySubmissionInFlight || remaining > 0;
  button.textContent = gallerySubmissionInFlight
    ? 'Submitting...'
    : remaining > 0
      ? `Submit again in ${Math.ceil(remaining / 1000)}s`
      : 'Submit project';
  if (remaining > 0) setTimeout(updateGallerySubmitCooldown, Math.min(1000, remaining));
}

function requestDeleteGalleryProject(id) {
  const project = state.gallery.find(item => item.id === id);
  const currentMemberId = currentMemberRecord()?.id;
  const ownsProject = Boolean(currentMemberId && project?.memberId === currentMemberId);
  if (!project || (!state.currentUser.isAdmin && !ownsProject)) {
    showToast('You can only delete your own gallery projects.', 'error');
    return;
  }
  pendingGalleryDeleteId = id;
  document.getElementById('gallery-delete-project-name').textContent = `Permanently delete “${project.title}”? This cannot be undone.`;
  document.getElementById('gallery-delete-admin-warning').style.display = state.currentUser.isAdmin && !ownsProject ? '' : 'none';
  openModal('gallery-delete-modal');
}

async function confirmDeleteGalleryProject() {
  const project = state.gallery.find(item => item.id === pendingGalleryDeleteId);
  if (!project) return;
  if (project.storagePath) {
    const bucket = project.scope === 'athletics' ? 'gallery-athletics' : 'gallery-media';
    const { error: storageError } = await supabaseClient.storage.from(bucket).remove([project.storagePath]);
    if (storageError) { showToast("Couldn't delete the uploaded image.", 'error'); return; }
  }
  const { error } = await supabaseClient.from('gallery').delete().eq('id', project.id);
  if (error) { showToast("Couldn't delete this project.", 'error'); return; }
  state.gallery = state.gallery.filter(item => item.id !== project.id);
  pendingGalleryDeleteId = null;
  closeModal('gallery-delete-modal');
  renderGallery();
  renderDashboard();
  showToast(`Project “${project.title}” deleted.`, 'error');
}

async function submitProject() {
  if (isVisitorSession()) {
    showToast('Visitors cannot submit gallery projects.', 'error');
    return;
  }
  if (gallerySubmissionInFlight) return;
  const cooldown = galleryCooldownRemaining();
  if (cooldown > 0) {
    showToast(`Please wait ${Math.ceil(cooldown / 1000)} seconds before submitting another project.`, 'error');
    updateGallerySubmitCooldown();
    return;
  }
  const title = document.getElementById('gal-title').value.trim();
  const link = document.getElementById('gal-link').value.trim();
  const producedOn = document.getElementById('gal-produced-on').value || null;
  const projectScope = document.getElementById('gal-scope').value === 'athletics' ? 'athletics' : 'showcase';
  const eventId = projectScope === 'athletics' ? document.getElementById('gal-event').value || null : null;
  const file = document.getElementById('gal-file').files?.[0] || null;
  const member = currentMemberRecord();
  if (!title) { showToast('Project title required.', 'error'); return; }
  if (!link && !file) { showToast('Add a cover image or project link.', 'error'); return; }
  if (link) {
    try {
      const url = new URL(link);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL');
    } catch {
      showToast('Enter a valid project URL beginning with http:// or https://.', 'error');
      return;
    }
  }
  if (!member) {
    showToast("Couldn't match your signed-in email to a member record.", 'error');
    return;
  }
  const projectType = document.getElementById('gal-type').value;
  gallerySubmissionInFlight = true;
  updateGallerySubmitCooldown();
  let imageUrl = link || null;
  let storagePath = null;
  const storageBucket = projectScope === 'athletics' ? 'gallery-athletics' : 'gallery-media';
  if (projectScope === 'athletics') imageUrl = null;
  if (file) {
    if (!GALLERY_ALLOWED_TYPES.has(file.type) || file.size > GALLERY_MAX_FILE_SIZE) {
      gallerySubmissionInFlight = false;
      updateGallerySubmitCooldown();
      showToast('Choose a JPG, PNG, or WebP image no larger than 20 MB.', 'error');
      return;
    }
    const { data: authData } = await supabaseClient.auth.getUser();
    const authUser = authData?.user;
    if (!authUser) {
      gallerySubmissionInFlight = false;
      updateGallerySubmitCooldown();
      showToast('Sign in again before uploading.', 'error');
      return;
    }
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    storagePath = `${authUser.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseClient.storage
      .from(storageBucket)
      .upload(storagePath, file, { contentType: file.type, cacheControl: '3600', upsert: false });
    if (uploadError) {
      gallerySubmissionInFlight = false;
      updateGallerySubmitCooldown();
      showToast("Couldn't upload the cover image. Check the Storage setup.", 'error');
      return;
    }
    if (projectScope === 'showcase') imageUrl = supabaseClient.storage.from(storageBucket).getPublicUrl(storagePath).data.publicUrl;
  }
  const { data, error } = await supabaseClient
    .from('gallery')
    .insert({
      project_name: title,
      project_type: projectType,
      project_scope: projectScope,
      member_id: member.id,
      event_id: eventId,
      description: document.getElementById('gal-desc').value.trim() || null,
      image_url: imageUrl,
      project_url: link || imageUrl,
      storage_path: storagePath,
      produced_on: producedOn,
    })
    .select('*, members(name), events(id, title, date, archived_at)')
    .single();
  gallerySubmissionInFlight = false;
  if (error) {
    if (storagePath) await supabaseClient.storage.from(storageBucket).remove([storagePath]);
    updateGallerySubmitCooldown();
    showToast("Couldn't submit project.", 'error');
    return;
  }
  lastGallerySubmissionAt = Date.now();
  updateGallerySubmitCooldown();
  state.gallery.unshift(normalizeGallery(data));
  hydrateRestrictedGalleryMedia();
  closeModal('gallery-modal');
  ['gal-title','gal-desc','gal-link','gal-produced-on','gal-event'].forEach(id => document.getElementById(id).value = '');
  clearGalleryFile();
  document.getElementById('gal-type').value = 'Photo';
  document.getElementById('gal-scope').value = 'showcase';
  updateGalleryScopeHelp();
  if (projectScope === 'athletics') window.history.replaceState({}, '', pageUrl('gallery', { view: 'athletics' }));
  renderGalleryAuthorField();
  showToast(`Project "${title}" submitted!`);
  renderGallery();
  renderDashboard();
}
