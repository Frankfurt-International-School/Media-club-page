import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../scripts/updates.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function harness(reduced = false) {
  const timers = new Map(); let nextId = 0; let observed; let active = true;
  const text = { dataset: { typeText:'A little clearer. A little smoother.' }, textContent:'A little clearer. A little smoother.' };
  const motionCallbacks = [];
  const motion = { matches:reduced, addEventListener(_name, callback) { motionCallbacks.push(callback); }, changed() { motionCallbacks.forEach(callback=>callback()); } };
  const animations = [];
  const content = { style:{}, scrollHeight:200, height:0, opacity:1,
    getBoundingClientRect:()=>({height:content.height}),
    animate(frames,options) { const animation={frames,options,cancelled:false,cancel(){this.cancelled=true;}};animations.push(animation);return animation; },
  };
  const summary = { addEventListener(_name,callback) { this.click=callback; } };
  const details = { open:false, dataset:{}, querySelector:selector=>selector==='summary'?summary:content };
  const document = { hidden:false, getElementById: id => id === 'crew-updates-type' ? text : id === 'page-profile' ? { classList:{contains:()=>active} } : id==='crew-full-changelog'?details:{}, addEventListener(name,callback) { this[name] = callback; } };
  const context = vm.createContext({ window:{matchMedia:()=>motion}, document,
    getComputedStyle:()=>({opacity:String(content.opacity)}),
    setTimeout(callback,delay) { timers.set(++nextId,{callback,delay}); return nextId; }, clearTimeout: id => timers.delete(id),
    IntersectionObserver: class { constructor(callback) { observed = callback; } observe() {} disconnect() {} },
  });
  vm.runInContext(source,context);
  const tick = () => { const [id,timer] = timers.entries().next().value || []; if (timer) { timers.delete(id); timer.callback(); } };
  const click = () => { const event={prevented:false,preventDefault(){this.prevented=true;}};summary.click(event);if(!event.prevented)details.open=!details.open;return event; };
  return { context, text, timers, document, motion, tick, click, details, content, animations, active: value => {active=value;}, show:()=>observed([{isIntersecting:true}]) };
}

test('the introduction types once when Settings is visible, then retains the complete text',()=>{
  const h = harness(); assert.equal(h.timers.size,0);h.active(false);h.show();assert.equal(h.timers.size,0);
  h.active(true);h.show();assert.equal(h.text.textContent,'');assert.equal(h.text.dataset.typing,'false');
  assert.equal([...h.timers.values()][0].delay,2200);h.tick();assert.equal(h.text.textContent,'A');
  assert.equal([...h.timers.values()][0].delay,32);
  while(h.timers.size)h.tick();assert.equal(h.text.textContent,h.text.dataset.typeText);
  assert.equal(h.text.dataset.typing,'false');h.context.startCrewUpdatesIntro();assert.equal(h.timers.size,0);
});

test('history opens and closes smoothly and reverses from its current size on rapid toggles',()=>{
  const h=harness();assert.equal(h.click().prevented,true);assert.equal(h.details.open,true);
  const opening=h.animations.at(-1);assert.equal(opening.frames[0].height,'0px');assert.equal(opening.frames[1].height,'200px');
  h.content.height=80;h.content.opacity=.4;h.click();
  const closing=h.animations.at(-1);assert.equal(opening.cancelled,true);assert.equal(closing.frames[0].height,'80px');assert.equal(closing.frames[0].opacity,.4);assert.equal(closing.frames[1].height,'0px');
  assert.equal(h.details.open,true);assert.equal(h.details.dataset.expanded,'false');
  // An old completion cannot overwrite the newer target.
  opening.onfinish();assert.equal(h.details.dataset.expanded,'false');
  h.content.height=35;h.click();const reopened=h.animations.at(-1);assert.equal(closing.cancelled,true);assert.equal(reopened.frames[0].height,'35px');
  reopened.onfinish();assert.equal(h.details.open,true);assert.equal(h.content.style.height,'');assert.equal(h.content.style.opacity,'');
  h.click();h.animations.at(-1).onfinish();assert.equal(h.details.open,false);
});

test('reduced motion uses native history and a preference change settles an in-flight disclosure',()=>{
  const reduced=harness(true);assert.equal(reduced.click().prevented,false);assert.equal(reduced.details.open,true);assert.equal(reduced.animations.length,0);
  reduced.click();assert.equal(reduced.details.open,false);
  const h=harness();h.click();h.motion.matches=true;h.motion.changed();assert.equal(h.details.open,true);assert.equal(h.animations[0].cancelled,true);assert.equal(h.content.style.height,'');
  h.click();assert.equal(h.details.open,false);
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
  assert.match(html,/<span class="page-kicker">Media Club<\/span><h2 id="crew-updates-title">/);
  assert.doesNotMatch(html,/Released on|v\d+\.\d+\.\d+/);
});
