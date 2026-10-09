import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/ui.js', import.meta.url), 'utf8');

function harness() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', value: '', checked: false, dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return true; } }, setAttribute() {}, replaceChildren() {}, appendChild() {}, querySelector() { return null; } });
    const result = elements.get(id);
    result.style ||= {};
    result.querySelectorAll ||= () => [];
    result.hasAttribute ||= () => false;
    result.removeAttribute ||= () => {};
    result.focus ||= () => {};
    return result;
  };
  const context = vm.createContext({
    window: {},
    document: { body: { children: [], classList: { toggle() {} } }, getElementById: element, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({}), activeElement: null },
    requestAnimationFrame: callback => callback(), HTMLElement: class {}, showToast() {},
  });
  vm.runInContext(source.slice(0, source.indexOf('// TOAST')), context);
  return { context, element, current: () => vm.runInContext('actionConfirmation', context) };
}

test('custom dismissal labels reset when another action is opened', () => {
  const h = harness();
  h.context.openActionConfirmation({ title: 'Cancel shift?', cancelLabel: 'Keep shift' });
  assert.equal(h.element('action-confirmation-dismiss').textContent, 'Keep shift');
  h.context.openActionConfirmation({ title: 'Archive event?' });
  assert.equal(h.element('action-confirmation-dismiss').textContent, 'Cancel');
});

test('a completed request cannot close or relabel a newer confirmation', async () => {
  const h = harness(); let finish;
  h.context.openActionConfirmation({ title: 'Cancel shift?', execute: () => new Promise(resolve => { finish = resolve; }) });
  const request = h.context.submitActionConfirmation();
  h.context.closeActionConfirmation();
  h.context.openActionConfirmation({ title: 'Archive event?', confirmLabel: 'Archive event' });
  const newer = h.current();
  finish(true); await request;
  assert.equal(h.current(), newer);
  assert.equal(h.element('action-confirmation-submit').textContent, 'Archive event');
});
