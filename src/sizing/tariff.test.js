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
