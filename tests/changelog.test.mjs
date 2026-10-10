import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { auditWorkdays, berlinWorkday, minorIssuesBullet, renderChangelog, syncChangelog, validateChangelog } from '../tools/check-changelog.mjs';

const log = JSON.parse(readFileSync(new URL('../changelog.json', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sample = {since:'2026-10-09',entries:[{date:'2026-10-12',summary:'Clearer planning controls.'},{date:'2026-10-09',summary:'A daily agenda.'}]};

test('daily data and static Settings markup agree, with exactly two bullets per day',()=>{
  validateChangelog(log,log.entries[0].date);
  assert.equal(syncChangelog(html,log),html);
  const rendered=renderChangelog(log);
  assert.equal((rendered.match(/<li>/g)||[]).length,log.entries.length*2);
  assert.equal((rendered.match(/Fixed minor issues and improved user experience\./g)||[]).length,log.entries.length);
  assert.equal((rendered.match(/datetime="2026-10-09"/g)||[]).length,1);
});

test('coverage catches multiple missing completed days, ignores the current day and quiet days',()=>{
  const commits=['2026-10-09T13:00:00Z','2026-10-09T16:00:00Z','2026-10-12T09:00:00Z','2026-10-13T10:00:00Z','2026-10-14T11:00:00Z'];
  assert.deepEqual(auditWorkdays(sample,commits,'2026-10-14'),{missing:['2026-10-13'],empty:[]});
  assert.deepEqual(auditWorkdays(sample,commits,'2026-10-15'),{missing:['2026-10-13','2026-10-14'],empty:[]});
  assert.deepEqual(auditWorkdays(sample,commits,'2026-10-12'),{missing:[],empty:[]});
  const withQuietDay={...sample,entries:[...sample.entries,{date:'2026-10-10',summary:'Should not exist.'}]};
  assert.deepEqual(auditWorkdays(withQuietDay,commits,'2026-10-14').empty,['2026-10-10']);
});

test('workdays use Berlin dates around midnight and daylight-saving changes',()=>{
  assert.equal(berlinWorkday('2026-10-09T22:15:00Z'),'2026-10-10');
  assert.equal(berlinWorkday('2026-01-09T23:15:00Z'),'2026-01-10');
  assert.equal(berlinWorkday('2026-10-25T22:15:00Z'),'2026-10-25');
});

test('daily entries reject duplicate, invalid, future, unordered and overlong dates or summaries',()=>{
  const rejects = [
    {...sample,entries:[sample.entries[0],sample.entries[0]]},
    {...sample,entries:[...sample.entries].reverse()},
    {...sample,entries:[{date:'2026-02-30',summary:'Invalid date.'}]},
    {...sample,entries:[{date:'2026-10-15',summary:'Future date.'}]},
    {...sample,entries:[{date:'2026-10-08',summary:'Before coverage.'}]},
    {...sample,entries:[{date:'2026-10-12',summary:'x'.repeat(181)}]},
    {...sample,entries:[{date:'2026-10-12',summary:minorIssuesBullet}]},
    {...sample,entries:[]},
  ];
  for(const invalid of rejects) assert.throws(()=>validateChangelog(invalid,'2026-10-14'));
});

test('rendering escapes summaries and only replaces the marked Settings section',()=>{
  const unsafe={since:'2026-10-09',entries:[{date:'2026-10-09',summary:'A <script> & "clearer" interface.'}]};
  const rendered=renderChangelog(unsafe);assert.doesNotMatch(rendered,/<script>/);assert.match(rendered,/&lt;script&gt; &amp; &quot;clearer&quot;/);
  assert.equal(syncChangelog(`before${renderChangelog(log)}after`,unsafe),`before${rendered}after`);
  assert.throws(()=>syncChangelog('<main></main>',log),/markers/);
});
