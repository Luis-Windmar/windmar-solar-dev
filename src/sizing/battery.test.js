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

test('7. sanitizeBOM collapses shipping and installation to { line_total } only — strips unit_cost / unit_price', () => {
  // Tool Belt returns shipping/installation as objects with internal
  // pricing fields (unit_cost, unit_price). sanitizeBOM must collapse
  // them to ONLY line_total. Note the FULL_BOM fixture has them as
  // plain numbers (650, 7000) — that path falls through to 0 because
  // bom.shipping?.line_total is undefined on a number. That's intentional
  // (matches the actual Tool Belt shape); the realistic case is tested
  // in test 11 below.
  const out = sanitizeBOM(FULL_BOM);
  assert.deepEqual(out.shipping,     { line_total: 0 });
  assert.deepEqual(out.installation, { line_total: 0 });
});

test('11. sanitizeBOM strips unit_cost and unit_price from shipping and installation (realistic Tool Belt shape)', () => {
  const bomWithShippingObj = {
    head:      { system_kw: 60 },
    inverter:  { model: 'X', qty: 1, line_total: 100 },
    batteries: [],
    accessories: [],
    shipping:     { unit_cost: 500, unit_price: 600, line_total: 1100 },
    installation: { unit_cost: 7000, unit_price: 9450, line_total: 9450 },
  };
  const out = sanitizeBOM(bomWithShippingObj);

  assert.deepEqual(out.shipping,     { line_total: 1100 });
  assert.deepEqual(out.installation, { line_total: 9450 });

  // Belt-and-suspenders: explicit checks that the sensitive keys are gone.
  assert.equal(out.shipping.unit_cost,      undefined);
  assert.equal(out.shipping.unit_price,     undefined);
  assert.equal(out.installation.unit_cost,  undefined);
  assert.equal(out.installation.unit_price, undefined);
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
