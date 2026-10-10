import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../info/typing.js', import.meta.url), 'utf8');
function harness({ reduced=false, observerSupported=true }={}) {
  const timers=new Map();let nextId=0;let observed;const unobserved=[];
  const headings=['Make the moments people remember.','See how members coordinate a production.'].map(text=>({
    dataset:{}, source:{textContent:text}, querySelector(){return this.source;}, appendChild(node){this.visual=node;},
  }));
  const motion={matches:reduced,addEventListener(_name,callback){this.change=callback;}};
  const document={hidden:false,querySelectorAll:()=>headings,addEventListener(name,callback){this[name]=callback;},
    createElement:()=>({textContent:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;},remove(){this.removed=true;}}),
  };
  const context={document,window:{matchMedia:()=>motion,setTimeout(callback,delay){timers.set(++nextId,{callback,delay});return nextId;},clearTimeout:id=>timers.delete(id)}};
  if(observerSupported)context.IntersectionObserver=class {
    constructor(callback){observed=callback;}observe(){}unobserve(heading){unobserved.push(heading);}
  };
  vm.runInNewContext(source,context);
  const show=(index,visible=true)=>observed([{target:headings[index],isIntersecting:visible}]);
  const tick=()=>{const [id,timer]=timers.entries().next().value||[];if(timer){timers.delete(id);timer.callback();}};
  return {headings,motion,document,timers,unobserved,show,tick};
}

test('public introductions type once after 2.2 seconds in view while retaining accessible complete headings',()=>{
  const h=harness();assert.equal(h.timers.size,0);h.show(0);
  assert.equal([...h.timers.values()][0].delay,2200);assert.equal(h.headings[0].dataset.typeState,'waiting');
  assert.equal(h.headings[0].source.textContent,'Make the moments people remember.');
  assert.equal(h.headings[0].visual.attributes['aria-hidden'],'true');
  h.tick();assert.equal(h.headings[0].visual.textContent,'M');assert.equal([...h.timers.values()][0].delay,32);
  while(h.timers.size)h.tick();assert.equal(h.headings[0].visual.removed,true);assert.equal(h.headings[0].dataset.typeState,undefined);
  h.show(0);assert.equal(h.timers.size,0);assert.deepEqual(h.unobserved,[h.headings[0]]);
  assert.equal(h.headings[1].dataset.typeState,'waiting');h.show(1);assert.equal(h.timers.size,1);
});

test('reduced motion and unavailable observation preserve the static headings',()=>{
  for(const options of [{reduced:true},{observerSupported:false}]) {
    const h=harness(options);assert.equal(h.timers.size,0);assert.equal(h.headings[0].visual,undefined);assert.equal(h.headings[0].dataset.typeState,undefined);
  }
});

test('scrolling away cancels a pending intro, and motion or visibility changes restore all headings',()=>{
  const h=harness();h.show(0);h.show(0,false);assert.equal(h.timers.size,0);assert.equal(h.headings[0].visual.removed,true);
  for(const finish of [h=>{h.motion.matches=true;h.motion.change();},h=>{h.document.hidden=true;h.document.visibilitychange();}]) {
    const h=harness();h.show(0);h.tick();finish(h);
    assert.equal(h.timers.size,0);assert.ok(h.headings.every(heading=>heading.visual.removed&&heading.dataset.typeState===undefined));
  }
});

test('typing remains limited to two introductory headings and loads before the application scripts',()=>{
  const html=readFileSync(new URL('../info/index.html',import.meta.url),'utf8');
  assert.equal((html.match(/data-type-heading/g)||[]).length,2);
  assert.match(html,/<h1 id="hero-title"[^>]*data-type-heading>/);
  assert.match(html,/<h2 id="preview-title"[^>]*data-type-heading>/);
  assert.match(html,/<script src="typing\.js" defer><\/script>[\s\S]*?<script src="https:\/\/challenges\.cloudflare\.com/);
});
