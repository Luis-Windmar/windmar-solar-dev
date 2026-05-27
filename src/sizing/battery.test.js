// Run with: node --test src/sizing/battery.test.js
//
// Tests sanitizeBOM — the server-side helper that strips internal
// pricing fields from the Tool Belt /api/v1/battery-sizing ?detail=full
// response before it leaves /api/battery-sizing for the React client.
//
// Real upstream shape (verified 2026-05-27 via direct curl):
//   {
//     dc_ac_ratio,
//     system_kwac,
//     inverter:    { model, quantity, unit_cost, unit_price, line_total },
//     batteries:   [] | { model, quantity, total_kwh, ... } | [...],
//     accessories: [{ name, quantity, unit_cost, unit_price, line_total }, ...],
//     shipping:     { unit_cost, unit_price, line_total },
//     installation: { unit_cost, unit_price, line_total },
//     gm_pct_applied, multiplier_applied,
//   }

const test   = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeBOM } = require('../../server.js');

// Sol-Ark catalog response — batteries as a single object (not an array).
const FULL_BOM = {
  dc_ac_ratio: 1.2,
  system_kwac: 62.5,
  inverter: {
    model:      'Sol-Ark Sol-Ark 60K 480V 3-Phase',
    quantity:   2,
    unit_cost:  3094,
    unit_price: 6188,
    line_total: 12375,
  },
  batteries: {
    model:      'Sol-Ark L3-HVR 60kWh Outdoor',
    quantity:   4,
    kwh_per_unit: 61.44,
    total_kwh:  245.8,
    unit_cost:  27700,
    unit_price: 55400,
    line_total: 221600,
  },
  accessories: [
    {
      name:       'BOS / wiring',
      quantity:   1,
      unit_cost:  500,
      unit_price: 600,
      line_total: 600,
    },
  ],
  shipping:           { unit_cost: 400, unit_price: 800, line_total: 800 },
  installation:       { unit_cost: 100, unit_price: 200, line_total: 200 },
  gm_pct_applied:     0.5,
  multiplier_applied: 2,
};

test('1. sanitizeBOM strips unit_cost / unit_price from inverter', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.inverter.unit_cost,  undefined, "inverter.unit_cost must not be forwarded");
  assert.equal(out.inverter.unit_price, undefined, "inverter.unit_price must not be forwarded");
});

test('2. sanitizeBOM strips gm_pct_applied + multiplier_applied from the bom root', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.gm_pct_applied,     undefined);
  assert.equal(out.multiplier_applied, undefined);
});

test('3. sanitizeBOM strips unit_cost / unit_price / gm_pct_applied / multiplier_applied from every BOM item', () => {
  const out = sanitizeBOM(FULL_BOM);
  for (const obj of [out.inverter, ...out.batteries, ...out.accessories]) {
    assert.equal(obj.unit_cost,           undefined, `unit_cost leaked on ${JSON.stringify(obj)}`);
    assert.equal(obj.unit_price,          undefined, `unit_price leaked on ${JSON.stringify(obj)}`);
    assert.equal(obj.gm_pct_applied,      undefined, `gm_pct_applied leaked on ${JSON.stringify(obj)}`);
    assert.equal(obj.multiplier_applied,  undefined, `multiplier_applied leaked on ${JSON.stringify(obj)}`);
  }
});

test('4. sanitizeBOM preserves model, quantity, line_total on inverter', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.inverter.model,      'Sol-Ark Sol-Ark 60K 480V 3-Phase');
  assert.equal(out.inverter.quantity,    2);
  assert.equal(out.inverter.line_total,  12375);
});

test('5. sanitizeBOM normalizes batteries-as-single-object into a one-element array (Sol-Ark catalog)', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.ok(Array.isArray(out.batteries), 'batteries should be normalized to an array');
  assert.equal(out.batteries.length, 1);
  assert.equal(out.batteries[0].model,      'Sol-Ark L3-HVR 60kWh Outdoor');
  assert.equal(out.batteries[0].quantity,    4);
  assert.equal(out.batteries[0].total_kwh,   245.8);
  assert.equal(out.batteries[0].line_total,  221600);
});

test('6. sanitizeBOM passes through batteries-as-empty-array (Tesla Powerwall catalog)', () => {
  const out = sanitizeBOM({ ...FULL_BOM, batteries: [] });
  assert.deepEqual(out.batteries, []);
});

test('7. sanitizeBOM passes through batteries-as-array (future multi-model)', () => {
  const batteriesArr = [
    { model: 'A', quantity: 1, total_kwh: 10, unit_cost: 1, line_total: 10 },
    { model: 'B', quantity: 2, total_kwh: 20, unit_cost: 2, line_total: 40 },
  ];
  const out = sanitizeBOM({ ...FULL_BOM, batteries: batteriesArr });
  assert.equal(out.batteries.length, 2);
  assert.equal(out.batteries[0].model, 'A');
  assert.equal(out.batteries[1].model, 'B');
  assert.equal(out.batteries[0].unit_cost, undefined, "unit_cost must be stripped from each battery");
});

test('8. sanitizeBOM preserves accessory name, quantity, line_total', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.accessories[0].name,       'BOS / wiring');
  assert.equal(out.accessories[0].quantity,    1);
  assert.equal(out.accessories[0].line_total,  600);
  assert.equal(out.accessories[0].unit_cost,   undefined);
  assert.equal(out.accessories[0].unit_price,  undefined);
});

test('9. sanitizeBOM exposes dc_ac_ratio and system_kwac at the bom root', () => {
  // These were on bom.head in the Step 3 whitelist — but bom.head does
  // not exist upstream. Fields are exposed at the root of the sanitized
  // bom so the client can read batteryResult.bom.system_kwac directly.
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.dc_ac_ratio, 1.2);
  assert.equal(out.system_kwac, 62.5);
});

test('10. sanitizeBOM does NOT wrap fields in a head object (bom.head should not exist on output)', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.equal(out.head, undefined, "no bom.head wrapper — fields live at bom root");
});

test('11. sanitizeBOM collapses shipping and installation to { line_total } only — strips unit_cost / unit_price', () => {
  const out = sanitizeBOM(FULL_BOM);
  assert.deepEqual(out.shipping,     { line_total: 800 });
  assert.deepEqual(out.installation, { line_total: 200 });
  assert.equal(out.shipping.unit_cost,      undefined);
  assert.equal(out.shipping.unit_price,     undefined);
  assert.equal(out.installation.unit_cost,  undefined);
  assert.equal(out.installation.unit_price, undefined);
});

test('12. sanitizeBOM(null) returns null', () => {
  assert.equal(sanitizeBOM(null),      null);
  assert.equal(sanitizeBOM(undefined), null);
});

test('13. sanitizeBOM with missing batteries / accessories produces empty arrays', () => {
  const minimal = {
    dc_ac_ratio: 1.2,
    system_kwac: 30,
    inverter:    { model: 'X', quantity: 0, line_total: 0 },
    // no batteries or accessories keys at all
    shipping:    { line_total: 0 },
    installation:{ line_total: 0 },
  };
  const out = sanitizeBOM(minimal);
  assert.deepEqual(out.batteries,   []);
  assert.deepEqual(out.accessories, []);
});
