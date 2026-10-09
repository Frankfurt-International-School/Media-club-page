import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/ui.js', import.meta.url), 'utf8');

function harness() {
  const elements = new Map(); const handlers = {}; const frames = [];
  let document;
  class Element {
    constructor(id, { tag = 'BUTTON', hidden = false, disabled = false } = {}) {
      this.id = id; this.tagName = tag; this.hidden = hidden; this.disabled = disabled;
      this.style = {}; this.dataset = {}; this.attributes = new Map(); this.children = [];
      this.isConnected = true; this.inert = false; this.offsetParent = hidden ? null : {};
      const classes = new Set();
      this.classList = { add: key => classes.add(key), remove: key => classes.delete(key), contains: key => classes.has(key), toggle: (key, value) => value ? classes.add(key) : classes.delete(key) };
    }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    hasAttribute(key) { return this.attributes.has(key); }
    removeAttribute(key) { this.attributes.delete(key); }
    getClientRects() { return this.hidden ? [] : [{}]; }
    closest(selector) { return selector === '[inert]' && (this.inert || this.parent?.inert) ? this : null; }
    contains(element) { return this === element || this.children.includes(element); }
    focus() { if (!this.hidden && !this.disabled) document.activeElement = this; }
    querySelectorAll() { return this.children.filter(child => !child.disabled); }
    querySelector(selector) { return selector === '.modal-title' ? null : this.querySelectorAll()[0] || null; }
    addEventListener(type, handler) { this[type] = handler; }
    replaceChildren() { this.children = []; }
    appendChild(child) { this.children.push(child); }
  }
  const element = (id, options) => {
    if (!elements.has(id)) elements.set(id, new Element(id, options));
    return elements.get(id);
  };
  const opener = element('opener'); const originalInert = element('original-inert'); originalInert.inert = true;
  const parent = element('parent-modal'); const child = element('action-confirmation-modal');
  const link = element('link', { tag: 'A' }); const hidden = element('hidden', { hidden: true });
  const dismiss = element('action-confirmation-dismiss'); const submit = element('action-confirmation-submit');
  parent.children = [link]; link.parent = parent;
  child.children = [hidden, dismiss, submit]; child.children.forEach(item => { item.parent = child; });
  [parent, child].forEach(item => item.classList.add('modal-backdrop'));
  document = { activeElement: opener, body: element('body'), getElementById: element,
    querySelectorAll: () => [parent, child], querySelector: () => [parent, child].find(item => item.classList.contains('open')),
    addEventListener: (type, handler) => { handlers[type] = handler; }, createElement: () => new Element('created') };
  document.body.children = [opener, originalInert, parent, child];
  const context = vm.createContext({ window: {}, document, requestAnimationFrame: callback => frames.push(callback), HTMLElement: Element,
    getComputedStyle: () => ({ visibility: 'visible' }), showToast() {} });
  vm.runInContext(source.slice(0, source.indexOf('// TOAST')), context);
  const flush = () => { while (frames.length) frames.shift()(); };
  const key = (value, shiftKey = false) => { let prevented = false; handlers.keydown({ key: value, shiftKey, preventDefault: () => { prevented = true; } }); return prevented; };
  return { context, document, element, parent, child, opener, hidden, dismiss, submit, link, originalInert, flush, key };
}

test('nested dialogs close the top dialog and restore each opener while preserving existing inert state', () => {
  const h = harness();
  h.context.openModal('parent-modal'); h.flush();
  assert.equal(h.document.activeElement, h.link);
  assert.equal(h.opener.inert, true);
  h.context.openActionConfirmation({ title: 'Review action' }); h.flush();
  assert.equal(h.document.activeElement, h.dismiss, 'hidden confirmation fields must not receive initial focus');
  assert.equal(h.parent.inert, true);
  h.key('Escape');
  assert.equal(h.parent.classList.contains('open'), true);
  assert.equal(h.child.classList.contains('open'), false);
  assert.equal(h.document.activeElement, h.link);
  h.key('Escape');
  assert.equal(h.document.activeElement, h.opener);
  assert.equal(h.opener.inert, false);
  assert.equal(h.originalInert.inert, true);
});

test('Tab includes links, skips hidden fields and recovers focus from outside the top dialog', () => {
  const h = harness(); h.context.openActionConfirmation({ title: 'Review action' }); h.flush();
  h.dismiss.focus(); assert.equal(h.key('Tab', true), true); assert.equal(h.document.activeElement, h.submit);
  h.submit.focus(); assert.equal(h.key('Tab'), true); assert.equal(h.document.activeElement, h.dismiss);
  h.document.activeElement = h.opener;
  assert.equal(h.key('Tab'), true); assert.equal(h.document.activeElement, h.dismiss);
  h.context.closeActionConfirmation(); h.context.openModal('parent-modal'); h.flush();
  assert.equal(h.key('Tab'), true); assert.equal(h.document.activeElement, h.link);
});

test('stale animation frames and reopening the same dialog cannot lose the original opener', () => {
  const h = harness(); h.context.openModal('parent-modal'); h.context.closeModal('parent-modal'); h.flush();
  assert.equal(h.document.activeElement, h.opener);
  h.context.openModal('parent-modal'); h.flush();
  h.context.openModal('parent-modal'); h.flush(); h.context.closeModal('parent-modal');
  assert.equal(h.document.activeElement, h.opener);
});

test('backdrop dismissal clears the confirmation so a hidden action cannot execute', async () => {
  const h = harness(); let writes = 0;
  h.context.openActionConfirmation({ title: 'Review action', execute: () => { writes += 1; } }); h.flush();
  h.child.click({ target: h.child });
  await h.context.submitActionConfirmation();
  assert.equal(writes, 0);
});

test('duplicate confirmation submission and field changes cannot re-enable a pending action', async () => {
  const h = harness(); let writes = 0; let finish;
  h.context.openActionConfirmation({ title: 'Review action', execute: () => { writes += 1; return new Promise(resolve => { finish = resolve; }); } });
  const pending = h.context.submitActionConfirmation(); h.context.syncActionConfirmationButton();
  assert.equal(h.submit.disabled, true);
  await h.context.submitActionConfirmation(); assert.equal(writes, 1);
  finish(false); await pending; assert.equal(h.submit.disabled, false);
});

test('session reset closes all dialogs and restores background access for the sign-in gate', () => {
  const h = harness(); h.context.openModal('parent-modal'); h.flush();
  h.context.openActionConfirmation({ title: 'Review action' }); h.flush();
  h.context.window.closeCrewCenterModals();
  assert.equal(h.parent.classList.contains('open'), false);
  assert.equal(h.child.classList.contains('open'), false);
  assert.equal(h.opener.inert, false);
  assert.equal(h.document.body.classList.contains('modal-open'), false);
  assert.match(readFileSync(new URL('../scripts/workspaces.js', import.meta.url), 'utf8'), /function resetCrewCenterWorkspace\(\) \{\s*window\.closeCrewCenterModals\?\.\(\)/);
});
