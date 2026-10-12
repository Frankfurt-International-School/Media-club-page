import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/date-picker.js', import.meta.url), 'utf8');
const context = vm.createContext({ Date, Intl, document: { addEventListener() {} }, window: { addEventListener() {} } });
vm.runInContext(source, context);

test('date parsing rejects invalid and normalized dates instead of silently booking another day', () => {
  for (const value of ['', '2026-02-29', '2026-04-31', '2026-13-01', '2026-1-02', '0000-01-01', 'not-a-date']) assert.equal(context.crewDateParse(value), null, value);
  assert.equal(context.crewDateParse('2028-02-29').toISOString(), '2028-02-29T12:00:00.000Z');
});

test('month navigation clamps the day across leap years and short months', () => {
  for (const [date, months, expected] of [
    ['2028-01-31', 1, '2028-02-29'], ['2026-03-31', -1, '2026-02-28'],
    ['2028-02-29', 12, '2029-02-28'], ['2026-12-31', 1, '2027-01-31'],
  ]) assert.equal(context.crewDateShift(date, 0, months), expected);
});

test('day navigation preserves calendar dates through Berlin daylight-saving transitions', () => {
  assert.equal(context.crewDateShift('2026-03-28', 1), '2026-03-29');
  assert.equal(context.crewDateShift('2026-03-29', 1), '2026-03-30');
  assert.equal(context.crewDateShift('2026-10-25', -1), '2026-10-24');
  assert.equal(context.crewDateShift('2026-12-31', 1), '2027-01-01');
});

test('the calendar has six stable weeks starting Monday, including adjacent-month days', () => {
  for (const month of ['2026-02', '2026-10', '2028-02', '2027-01']) {
    const days = Array.from(context.crewDateGrid(month));
    assert.equal(days.length, 42);
    assert.equal(context.crewDateParse(days[0]).getUTCDay(), 1);
    assert.equal(context.crewDateParse(days.at(-1)).getUTCDay(), 0);
    assert.equal(new Set(days).size, 42);
    assert.ok(days.includes(`${month}-01`));
  }
  assert.equal(context.crewDateGrid('invalid').length, 0);
});
