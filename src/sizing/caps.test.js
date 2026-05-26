// Run with: node --test src/sizing/caps.test.js
//
// Uses node:test (built-in since Node 18). No external test runner.

const test   = require('node:test');
const assert = require('node:assert/strict');

const { computeSystemKwCaps } = require('./caps.js');
const { normalizeLumaTariff } = require('./tariff.js');
const { DC_AC_RATIO, DEMAND_MULTIPLIER } = require('./constants.js');

// Sanity — constants loaded from pricing.json or defaults
test('constants — DC_AC_RATIO and DEMAND_MULTIPLIER loaded', () => {
  assert.equal(DC_AC_RATIO,        1.2);
  assert.equal(DEMAND_MULTIPLIER,  1.5);
});

test('1. Residencial tariff — hard cap at 30 kWdc, constraint = tarifa', () => {
  // 1242 kWh/mo × 12 = 14,904 kWh/yr ÷ 1530 kWh/kWp/yr ≈ 9.74 kWp consumption
  // Residencial hard cap: 25 × 1.2 = 30 kWdc
  // Consumption (9.74) < tariff (30) → consumption binds → constraint = null
  //
  // The prompt's stated expectation (systemKwDc=30, constraint='tarifa')
  // only holds if monthly_kwh is large enough to exceed 30/12*1530/1242 ≈
  // 3,825 — at 1242 kWh/mo the consumption cap actually binds. Re-pick
  // a kWh value that makes the tariff cap bind, per the test description.
  const r = computeSystemKwCaps({
    monthly_kwh:      5000,           // consumption cap = 5000*12/1530 ≈ 39.2 kWp
    tarifa:           'residencial',
    municipio_yield:  1530,
  });
  assert.equal(r.systemKwDc, 30);
  assert.equal(r.constraint, 'tarifa');
  assert.equal(r.tariffCapKva, 25);
});

test('2. Secundaria tariff — hard cap at 60 kWdc, constraint = tarifa', () => {
  // 4782 kWh/mo × 12 ÷ 1530 ≈ 37.5 kWp — consumption binds, not tariff.
  // Re-pick a higher kWh so tariff binds.
  const r = computeSystemKwCaps({
    monthly_kwh:      10000,          // consumption cap = 10000*12/1530 ≈ 78.4 kWp
    tarifa:           'secundaria',
    municipio_yield:  1530,
  });
  assert.equal(r.systemKwDc, 60);
  assert.equal(r.constraint, 'tarifa');
  assert.equal(r.tariffCapKva, 50);
});

test('3. Primaria, demand-bound — systemKwDc = 180, constraint = demanda', () => {
  // 26955 kWh/mo × 12 ÷ 1530 = 211.41... kWp consumption cap
  // Demand cap: (100 + 0) × 1.5 × 1.2 = 180 kWdc
  // Min(211.41, 180) = 180 → constraint = demanda
  const r = computeSystemKwCaps({
    monthly_kwh:           26955,
    tarifa:                'primaria',
    carga_contratada_kva:  100,
    exceso_de_demanda_kva: 0,
    municipio_yield:       1530,
  });
  assert.equal(r.systemKwDc, 180);
  assert.equal(r.constraint, 'demanda');
  assert.equal(r.demandaMaxima, 100);
});

test('4. Primaria, transformer-bound — systemKwDc = 90, constraint = transformador', () => {
  // Consumption: 20790*12/1530 ≈ 163.06 kWp
  // Transformer: 75 × 1.2 = 90 kWdc
  // Demand: (100 + 0) × 1.5 × 1.2 = 180 kWdc
  // Min = 90, transformer binds
  const r = computeSystemKwCaps({
    monthly_kwh:           20790,
    tarifa:                'primaria',
    carga_contratada_kva:  100,
    exceso_de_demanda_kva: 0,
    transformer_kva:       75,
    municipio_yield:       1530,
  });
  assert.equal(r.systemKwDc, 90);
  assert.equal(r.constraint, 'transformador');
  assert.equal(r.transformerKva, 75);
});

test('5. Primaria, consumption-bound — constraint = null', () => {
  // 500 kWh/mo × 12 ÷ 1530 ≈ 3.92 kWp consumption cap
  // Demand cap: 500 × 1.5 × 1.2 = 900 kWdc — much higher
  // Consumption binds → constraint is null
  const r = computeSystemKwCaps({
    monthly_kwh:           500,
    tarifa:                'primaria',
    carga_contratada_kva:  500,
    municipio_yield:       1530,
  });
  assert.equal(r.constraint, null);
  assert.ok(Math.abs(r.systemKwDc - (500 * 12 / 1530)) < 1e-9);
});

test('6. Edge — Primaria with demanda_maxima = 0 → capTariff is Infinity', () => {
  const r = computeSystemKwCaps({
    monthly_kwh:           5000,
    tarifa:                'primaria',
    carga_contratada_kva:  0,
    exceso_de_demanda_kva: 0,
    municipio_yield:       1530,
  });
  assert.equal(r.capTariff, Infinity);
  // Consumption cap is the only constraint now → constraint = null
  assert.equal(r.constraint, null);
});

test('7. Edge — null tariff → only consumption cap applies', () => {
  const r = computeSystemKwCaps({
    monthly_kwh:      5000,
    tarifa:           null,
    municipio_yield:  1530,
  });
  assert.equal(r.tariff, null);
  assert.equal(r.capTariff, Infinity);
  assert.equal(r.constraint, null);
});

// ─── normalizeLumaTariff coverage ───────────────────────────────────────────

test('8a. normalizeLumaTariff — friendly Spanish names', () => {
  assert.equal(normalizeLumaTariff('Servicio Residencial General'), 'residencial');
  assert.equal(normalizeLumaTariff('Tarifa Secundaria'),            'secundaria');
  assert.equal(normalizeLumaTariff('Tarifa Primaria'),              'primaria');
  assert.equal(normalizeLumaTariff('Transmisión'),                  'transmision');
  assert.equal(normalizeLumaTariff('Transmision'),                  'transmision');
});

test('8b. normalizeLumaTariff — GSD contract codes', () => {
  assert.equal(normalizeLumaTariff('gsd-t'),  'secundaria');
  assert.equal(normalizeLumaTariff('gsd-p'),  'primaria');
  assert.equal(normalizeLumaTariff('gsd-tr'), 'transmision');
  assert.equal(normalizeLumaTariff('lrs'),    'secundaria');
});

test('8c. normalizeLumaTariff — null/empty/unrecognized', () => {
  assert.equal(normalizeLumaTariff(null),       null);
  assert.equal(normalizeLumaTariff(undefined),  null);
  assert.equal(normalizeLumaTariff(''),         null);
  assert.equal(normalizeLumaTariff('unknown'),  null);
  assert.equal(normalizeLumaTariff('asdf'),     null);
});

test('8d. normalizeLumaTariff — case insensitive', () => {
  assert.equal(normalizeLumaTariff('PRIMARIA'),  'primaria');
  assert.equal(normalizeLumaTariff('SeCuNdArIa'), 'secundaria');
});
