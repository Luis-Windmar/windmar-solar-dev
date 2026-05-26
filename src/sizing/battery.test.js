// Run with: node --test src/sizing/battery.test.js
//
// Tests sanitizeBOM, the server-side helper that strips internal pricing
// fields from the Tool Belt /api/v1/battery-sizing ?detail=full response
// before it leaves /api/battery-sizing for the React client.
//
// sanitizeBOM is exported from server.js as a named export
// (module.exports.sanitizeBOM). Importing server.js runs its module-level
// initialization (dotenv, Express app creation) but does not call
// app.listen — that only happens when run via `node server.js` directly.

const test   = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeBOM } = require('../../server.js');

// Sample Tool Belt BOM with sensitive fields populated. Mirrors what the
// upstream /api/v1/battery-sizing?detail=full would return.
const FULL_BOM = {
  head: {
    system_kw:           60,
    system_kwac:         50,
    battery_hours:       8,
    voltage:             240,
    phases:              2,
    gm_pct_applied:      0.35,
    multiplier_applied:  1.35,
  },
  inverter: {
    model:               'Sol-Ark 60K-3P-480V',
    qty:                 1,
    unit_cost:           12900,
    line_total:          17415,
    gm_pct_applied:      0.35,
    multiplier_applied:  1.35,
  },
  batteries: [
    {
      model:               'L3-HVR-60KWH',
      qty:                 1,
      unit_cost:           27700,
      line_total:          37395,
      gm_pct_applied:      0.35,
      multiplier_applied:  1.35,
    },
  ],
  accessories: [
    {
      name:                'BOS / wiring',
      qty:                 1,
      unit_cost:           500,
      line_total:          675,
      gm_pct_applied:      0.35,
      multiplier_applied:  1.35,
    },
  ],
  shipping:     650,
  installation: 7000,
};

test('1. sanitizeBOM strips unit_cost from inverter', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.inverter.unit_cost, undefined, "unit_cost must NOT be forwarded");
});

test('2. sanitizeBOM strips gm_pct_applied from head', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.head.gm_pct_applied,     undefined);
  assert.equal(out.head.multiplier_applied, undefined);
});

test('3. sanitizeBOM strips gm_pct_applied + multiplier_applied + unit_cost from every BOM item', () => {
  const out = sanitizeBOM(FULL_BOM);
  for (const obj of [out.inverter, ...out.batteries, ...out.accessories]) {
    assert.equal(obj.unit_cost,           undefined, `unit_cost leaked on ${JSON.stringify(obj)}`);
    assert.equal(obj.gm_pct_applied,      undefined, `gm_pct_applied leaked on ${JSON.stringify(obj)}`);
    assert.equal(obj.multiplier_applied,  undefined, `multiplier_applied leaked on ${JSON.stringify(obj)}`);
  }
});

test('4. sanitizeBOM preserves model, qty, line_total on inverter', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.inverter.model,      'Sol-Ark 60K-3P-480V');
  assert.equal(out.inverter.qty,         1);
  assert.equal(out.inverter.line_total,  17415);
});

test('5. sanitizeBOM preserves model, qty, line_total on each battery', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.batteries[0].model,       'L3-HVR-60KWH');
  assert.equal(out.batteries[0].qty,         1);
  assert.equal(out.batteries[0].line_total,  37395);
});

test('6. sanitizeBOM preserves accessory name, qty, line_total', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.accessories[0].name,       'BOS / wiring');
  assert.equal(out.accessories[0].qty,         1);
  assert.equal(out.accessories[0].line_total,  675);
});

test('7. sanitizeBOM preserves shipping and installation', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.shipping,     650);
  assert.equal(out.installation, 7000);
});

test('8. sanitizeBOM preserves head non-sensitive fields', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.head.system_kw,      60);
  assert.equal(out.head.system_kwac,    50);
  assert.equal(out.head.battery_hours,  8);
  assert.equal(out.head.voltage,        240);
  assert.equal(out.head.phases,         2);
});

test('9. sanitizeBOM(null) returns null', () => {
  assert.equal(sanitizeBOM(null),      null);
  assert.equal(sanitizeBOM(undefined), null);
});

test('10. sanitizeBOM with empty batteries / accessories arrays produces empty arrays', () => {
  const minimal = {
    head:     { system_kw: 0, voltage: 240, phases: 2 },
    inverter: { model: 'X', qty: 0, line_total: 0 },
    // no batteries or accessories keys at all
    shipping: 0, installation: 0,
  };
  const out = sanitizeBOM(minimal);
  assert.deepEqual(out.batteries,   []);
  assert.deepEqual(out.accessories, []);
});
