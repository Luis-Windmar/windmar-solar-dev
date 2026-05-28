// Run with: node --test src/sizing/tariff.test.js
//
// Helper-only test surface. `caps.test.js` covers the cap math + the
// normalizeLumaTariff / defaultDemandKva surface (kept there because those
// two also feed the cap computation directly). This file covers helpers
// that are NOT part of the cap math — currently just resolveVoltagePhases.

const test   = require('node:test');
const assert = require('node:assert/strict');

const { resolveVoltagePhases } = require('./tariff.js');

test('1. resolveVoltagePhases(no_se) defaults to 240V / 2-phase', () => {
  assert.deepEqual(resolveVoltagePhases('no_se'), { voltage: 240, phases: 2 });
});

test('2. resolveVoltagePhases(bifasico_240)', () => {
  assert.deepEqual(resolveVoltagePhases('bifasico_240'), { voltage: 240, phases: 2 });
});

test('3. resolveVoltagePhases(trifasico_208)', () => {
  assert.deepEqual(resolveVoltagePhases('trifasico_208'), { voltage: 208, phases: 3 });
});

test('4. resolveVoltagePhases(trifasico_480)', () => {
  assert.deepEqual(resolveVoltagePhases('trifasico_480'), { voltage: 480, phases: 3 });
});

test('5. resolveVoltagePhases(undefined) falls through to default (240V / 2-phase)', () => {
  assert.deepEqual(resolveVoltagePhases(undefined), { voltage: 240, phases: 2 });
});

test('6. resolveVoltagePhases(null) also defaults', () => {
  assert.deepEqual(resolveVoltagePhases(null), { voltage: 240, phases: 2 });
});

test('7. resolveVoltagePhases("") also defaults', () => {
  assert.deepEqual(resolveVoltagePhases(""), { voltage: 240, phases: 2 });
});

// ── Smart-default tests (serviceType = 'no_se' picks voltage by tariff) ──

test('8. resolveVoltagePhases(no_se, primaria) → 480V / 3-phase', () => {
  assert.deepEqual(resolveVoltagePhases('no_se', 'primaria'), { voltage: 480, phases: 3 });
});

test('9. resolveVoltagePhases(no_se, secundaria) → 208V / 3-phase', () => {
  assert.deepEqual(resolveVoltagePhases('no_se', 'secundaria'), { voltage: 208, phases: 3 });
});

test('10. resolveVoltagePhases(no_se, residencial) → 240V / 2-phase', () => {
  assert.deepEqual(resolveVoltagePhases('no_se', 'residencial'), { voltage: 240, phases: 2 });
});

test('11. resolveVoltagePhases(no_se, null) → 240V / 2-phase', () => {
  assert.deepEqual(resolveVoltagePhases('no_se', null), { voltage: 240, phases: 2 });
});

test('12. resolveVoltagePhases(trifasico_480, secundaria) → 480V / 3-phase (explicit overrides tariff default)', () => {
  assert.deepEqual(resolveVoltagePhases('trifasico_480', 'secundaria'), { voltage: 480, phases: 3 });
});
