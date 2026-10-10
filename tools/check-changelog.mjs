import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const startMarker = '<!-- CREW CHANGELOG:START -->';
export const endMarker = '<!-- CREW CHANGELOG:END -->';
export const minorIssuesBullet = 'Fixed minor issues and improved user experience.';

export function berlinWorkday(value) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = name => parts.find(item => item.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)
    && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}

export function validateChangelog(log, today) {
  if (!validDay(log.since) || !Array.isArray(log.entries) || !log.entries.length) {
    throw new Error('Changelog needs a coverage start date and at least one daily entry.');
  }
  let previous = '9999-12-31';
  for (const entry of log.entries) {
    if (!validDay(entry.date) || entry.date < log.since || entry.date > today || entry.date >= previous) {
      throw new Error('Changelog dates must be unique, newest first, within coverage, and not in the future.');
    }
    if (typeof entry.summary !== 'string' || !entry.summary.trim() || entry.summary !== entry.summary.trim()
        || entry.summary.length > 180 || /[\r\n]/.test(entry.summary) || entry.summary === minorIssuesBullet) {
      throw new Error(`Write one concise improvement summary (at most 180 characters) for ${entry.date}.`);
    }
    previous = entry.date;
  }
}

export function auditWorkdays(log, commitDates, today) {
  const worked = new Set(commitDates.map(berlinWorkday).filter(day => day >= log.since && day < today));
  const logged = new Set(log.entries.map(entry => entry.date));
  return {
    missing: [...worked].filter(day => !logged.has(day)).sort(),
    empty: [...logged].filter(day => day < today && !worked.has(day)).sort(),
  };
}

const escapeHtml = value => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const dateLabel = day => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(`${day}T12:00:00Z`));
const bullets = entry => `<ul class="crew-update-list"><li>${escapeHtml(entry.summary)}</li><li>${minorIssuesBullet}</li></ul>`;

export function renderChangelog(log) {
  const [latest, ...earlier] = log.entries;
  const edition = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(new Date(`${latest.date}T12:00:00Z`));
  const history = earlier.length ? `
        <details class="crew-update-history" id="crew-full-changelog"><summary><span>View full changelog</span><span class="crew-update-history-hint">${earlier.length} earlier ${earlier.length === 1 ? 'update' : 'updates'}</span></summary>
          <div class="crew-update-history-content"><div class="crew-update-timeline">
${earlier.map(entry => `            <article><header><span class="crew-update-tag">Daily update</span><time datetime="${entry.date}">${dateLabel(entry.date)}</time></header>${bullets(entry)}</article>`).join('\n')}
          </div></div>
        </details>` : '';
  return `${startMarker}
    <section class="crew-updates" aria-labelledby="crew-updates-title">
      <div class="crew-updates-hero" id="crew-updates-hero">
        <img src="assets/media-club-logo.png" width="128" height="128" alt="" class="crew-updates-mark">
        <span class="page-kicker">Media Club</span><h2 id="crew-updates-title">Crew Center</h2>
        <p class="crew-updates-tagline"><span class="visually-hidden">A little clearer. A little smoother.</span><span id="crew-updates-type" aria-hidden="true" data-type-text="A little clearer. A little smoother.">A little clearer. A little smoother.</span></p>
        <span class="crew-update-edition">${edition} update</span><time datetime="${latest.date}">${dateLabel(latest.date)}</time>
      </div>
      <div class="crew-updates-body"><div class="crew-updates-heading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/></svg><h3>What’s new</h3></div>
        ${bullets(latest)}${history}
      </div>
    </section>
    ${endMarker}`;
}

export function syncChangelog(html, log) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start < 0 || end < start) throw new Error('Missing changelog markers in index.html.');
  return html.slice(0, start) + renderChangelog(log) + html.slice(end + endMarker.length);
}

function main() {
  const today = berlinWorkday(new Date());
  const log = JSON.parse(readFileSync(new URL('../changelog.json', import.meta.url), 'utf8'));
  validateChangelog(log, today);
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  if (git(['rev-parse', '--is-shallow-repository']) === 'true') {
    throw new Error('Daily changelog check needs full Git history. Fetch it with git fetch --unshallow.');
  }
  // First-parent commit dates represent work integrated into this checkout, including merges.
  const commits = git(['log', '--first-parent', '--format=%cI', 'HEAD']).split('\n').filter(Boolean);
  const audit = auditWorkdays(log, commits, today);
  if (audit.missing.length) throw new Error(`Missing daily summaries: ${audit.missing.join(', ')}. Review those commits and update changelog.json.`);
  if (audit.empty.length) throw new Error(`Remove entries for days without commits: ${audit.empty.join(', ')}.`);
  const htmlPath = new URL('../index.html', import.meta.url);
  const html = readFileSync(htmlPath, 'utf8');
  const rendered = syncChangelog(html, log);
  if (process.argv.includes('--write')) {
    if (rendered !== html) writeFileSync(htmlPath, rendered);
  } else if (rendered !== html) {
    throw new Error('Settings changelog is out of sync. Run npm run changelog:sync.');
  }
  console.log(`Daily changelog ${process.argv.includes('--write') ? 'synced' : 'checked'}: ${log.entries.length} entries; completed Berlin workdays covered since ${log.since}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
