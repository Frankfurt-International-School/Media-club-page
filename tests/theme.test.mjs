import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../scripts/theme.js', import.meta.url), 'utf8');

function harness({ saved = null, dark = false, reduced = false, blocked = false } = {}) {
  const storage = new Map(saved === null ? [] : [['crew-center-theme', saved]]); const nodes = new Map(); const listeners = {};
  const element = id => {
    if (!nodes.has(id)) { const classes = new Set(); nodes.set(id, { dataset: {}, attrs: {}, textContent: '', classList: { toggle: (key,on) => on ? classes.add(key) : classes.delete(key), remove: key => classes.delete(key), contains: key => classes.has(key) }, setAttribute(key,value) { this.attrs[key] = value; } }); }
    return nodes.get(id);
  };
  const media = matches => ({ matches, addEventListener(_name, callback) { this.changed = callback; } });
  const device = media(dark); const motion = media(reduced);
  const context = vm.createContext({ window: { matchMedia: query => query.includes('color-scheme') ? device : motion, addEventListener: (name,callback) => { listeners[name] = callback; } },
    document: { documentElement: element('root'), getElementById: element, querySelector: () => element('meta') },
    localStorage: { getItem: key => { if (blocked) throw new Error('Blocked'); return storage.get(key) || null; }, setItem: (key,value) => { if (blocked) throw new Error('Blocked'); storage.set(key,value); } },
    setTimeout: () => 1, clearTimeout() {},
  });
  vm.runInContext(source, context);
  return { context, element, storage, device, motion, listeners };
}

test('theme startup preserves explicit choices and resolves saved device mode before rendering', () => {
  assert.equal(harness({ saved:'dark' }).element('root').dataset.theme, 'dark');
  assert.equal(harness({ saved:'light', dark:true }).element('root').dataset.theme, 'light');
  assert.equal(harness({ saved:'system', dark:true }).element('root').dataset.theme, 'dark');
  assert.equal(harness({ saved:'unexpected', dark:true }).element('root').dataset.theme, 'light');
});

test('device mode follows system changes while explicit modes remain stable', () => {
  const h = harness(); h.context.setCrewCenterTheme('system');
  assert.equal(h.storage.get('crew-center-theme'), 'system');
  h.device.matches = true; h.device.changed();
  assert.equal(h.element('root').dataset.theme, 'dark');
  assert.equal(h.element('theme-system').attrs['aria-pressed'], 'true');
  assert.equal(h.element('theme-dark').attrs['aria-pressed'], 'false');
  assert.match(h.element('theme-choice-status').textContent, /Following your device · Dark/);
  h.context.setCrewCenterTheme('light'); h.device.changed();
  assert.equal(h.element('root').dataset.theme, 'light');
  assert.equal(h.element('meta').attrs.content, '#fbfafc');
});

test('blocked storage still allows theme preview and reports session-only persistence', () => {
  const h = harness({ blocked:true });
  assert.doesNotThrow(() => h.context.setCrewCenterTheme('dark'));
  assert.equal(h.element('root').dataset.theme, 'dark');
  assert.match(h.element('theme-choice-status').textContent, /session.*storage is unavailable/);
  assert.equal(h.storage.size, 0);
});

test('theme changes synchronize between browser tabs and respect reduced motion', () => {
  const h = harness({ reduced:true });
  h.listeners.storage({ key:'crew-center-theme', newValue:'dark' });
  assert.equal(h.element('root').dataset.theme, 'dark');
  assert.equal(h.element('root').classList.contains('theme-switching'), false);
  h.listeners.storage({ key:'unrelated', newValue:'light' });
  assert.equal(h.element('root').dataset.theme, 'dark');
  h.listeners.storage({ key:null, newValue:null });
  assert.equal(h.element('root').dataset.theme, 'light');
  h.context.setCrewCenterTheme('invalid'); assert.equal(h.element('root').dataset.theme, 'light');
});
