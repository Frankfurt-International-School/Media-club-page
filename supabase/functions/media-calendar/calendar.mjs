const encoder = new TextEncoder();
export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
const text = value => String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  .replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
function fold(line) {
  let result = ''; let length = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) { result += '\r\n '; length = 1; }
    result += char; length += bytes;
  }
  return result;
}
export function buildMediaCalendar(feed) {
  if (!['personal', 'events'].includes(feed?.kind) || !Array.isArray(feed.entries)) throw new Error('Invalid calendar data');
  const personal = feed.kind === 'personal';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FIS Media Club//Calendar Subscription//EN', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:FIS Media Club - ${personal ? 'My signed-up events' : 'All events'}`, 'X-WR-TIMEZONE:Europe/Berlin',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const ids = new Set();
  for (const entry of feed.entries) {
    if (!/^[a-f0-9-]{36}$/i.test(entry.id) || ids.has(entry.id)
      || !Number.isFinite(Date.parse(entry.start)) || !Number.isFinite(Date.parse(entry.end))
      || Date.parse(entry.end) <= Date.parse(entry.start) || !Number.isFinite(Date.parse(entry.updated))) {
      throw new Error('Invalid calendar entry'); // Never send a partial feed that could remove valid subscriptions.
    }
    ids.add(entry.id);
    const description = personal
      ? `${entry.role ? `Your crew role: ${entry.role}.\n` : ''}${entry.tentative ? 'Tentative: confirm your signup in Crew Center.\n' : ''}Your booked time. Check Crew Center before the event.`
      : 'Media Club event. Sign up in Crew Center to join the crew.';
    lines.push('BEGIN:VEVENT', `UID:media-${feed.kind}-${entry.id}@fismediaclub.org`, `DTSTAMP:${stamp(entry.updated)}`,
      `DTSTART:${stamp(entry.start)}`, `DTEND:${stamp(entry.end)}`, `STATUS:${entry.tentative ? 'TENTATIVE' : 'CONFIRMED'}`,
      'CLASS:PRIVATE', `TRANSP:${personal ? 'OPAQUE' : 'TRANSPARENT'}`, `SUMMARY:${text(entry.title)}`, `LOCATION:${text(entry.location)}`,
      `DESCRIPTION:${text(description)}`, `URL:https://fismediaclub.org/signups?event=${encodeURIComponent(entry.id)}`, 'END:VEVENT');
  }
  return [...lines, 'END:VCALENDAR', ''].map(fold).join('\r\n');
}
// Dependency injection keeps the exact deployed HTTP/security behavior testable offline.
export function createCalendarHandler(readFeed) {
  return async request => {
    const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
    const reply = (body, status, extras = {}) => new Response(request.method === 'HEAD' ? null : body, { status, headers: { ...headers, ...extras } });
    if (!['GET', 'HEAD'].includes(request.method)) return reply('Method not allowed', 405, { Allow: 'GET, HEAD' });
    const url = new URL(request.url);
    const tokens = url.searchParams.getAll('token');
    if (tokens.length !== 1 || !/^[a-f0-9]{64}$/.test(tokens[0])) return reply('Calendar link unavailable', 404);
    try {
      const feed = await readFeed(await sha256(tokens[0]));
      if (!feed) return reply('Calendar link unavailable', 404);
      const calendar = buildMediaCalendar(feed);
      const etag = `"${await sha256(calendar)}"`;
      // Authenticate before checking ETag: revoked links must never get a 304.
      if (request.headers.get('if-none-match') === etag) return reply(null, 304, { ETag: etag });
      return reply(calendar, 200, { 'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="media-club-${feed.kind}.ics"`, ETag: etag });
    } catch {
      return reply('Calendar temporarily unavailable. Try again later.', 503, { 'Retry-After': '300' });
    }
  };
}
