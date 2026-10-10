import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../scripts/updates.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function harness(reduced = false) {
  const timers = new Map(); let nextId = 0; let observed; let active = true;
  const text = { dataset: { typeText:'A little clearer. A little smoother.' }, textContent:'A little clearer. A little smoother.' };
  const motion = { matches:reduced, addEventListener(_name, callback) { this.changed = callback; } };
  const document = { hidden:false, getElementById: id => id === 'crew-updates-type' ? text : id === 'page-profile' ? { classList:{contains:()=>active} } : {}, addEventListener(name,callback) { this[name] = callback; } };
  const context = vm.createContext({ window:{matchMedia:()=>motion}, document,
    setTimeout(callback) { timers.set(++nextId,callback); return nextId; }, clearTimeout: id => timers.delete(id),
    IntersectionObserver: class { constructor(callback) { observed = callback; } observe() {} disconnect() {} },
  });
  vm.runInContext(source,context);
  const tick = () => { const [id,callback] = timers.entries().next().value || []; if (callback) { timers.delete(id); callback(); } };
  return { context, text, timers, document, motion, tick, active: value => {active=value;}, show:()=>observed([{isIntersecting:true}]) };
}

test('the introduction types once when Settings is visible, then retains the complete text',()=>{
  const h = harness(); assert.equal(h.timers.size,0);h.active(false);h.show();assert.equal(h.timers.size,0);
  h.active(true);h.show();assert.equal(h.text.textContent,'');h.tick();assert.equal(h.text.textContent,'A');
  while(h.timers.size)h.tick();assert.equal(h.text.textContent,h.text.dataset.typeText);
  assert.equal(h.text.dataset.typing,'false');h.context.startCrewUpdatesIntro();assert.equal(h.timers.size,0);
});

test('reduced motion and leaving Settings finish the text and cancel outstanding typing',()=>{
  const reduced = harness(true);reduced.show();assert.equal(reduced.timers.size,0);assert.equal(reduced.text.textContent,reduced.text.dataset.typeText);
  for(const change of [h=>h.active(false),h=>{h.document.hidden=true;},h=>{h.motion.matches=true;h.motion.changed();}]){
    const h = harness();h.show();h.tick();change(h);h.tick();
    assert.equal(h.timers.size,0);assert.equal(h.text.textContent,h.text.dataset.typeText);
  }
});

test('changelog is an in-page Settings section with native disclosure and a complete accessible tagline',()=>{
  assert.doesNotMatch(html,/data-settings-tab="updates"|data-settings-section="updates"/);
  assert.match(html,/<section class="crew-updates" aria-labelledby="crew-updates-title">/);
  assert.match(html,/<details class="crew-update-history" id="crew-full-changelog"><summary>/);
  assert.match(html,/<span class="visually-hidden">A little clearer\. A little smoother\.<\/span><span id="crew-updates-type" aria-hidden="true"/);
  assert.doesNotMatch(html,/Released on|v\d+\.\d+\.\d+/);
});
