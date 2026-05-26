// Sizing design constants — single source of truth.
//
// Values are sourced from config/pricing.json (so they can be retuned
// without a component rebuild) with hardcoded canonical defaults as
// fallback. Imported by sizing/caps.js and exported for EstimateScreen.
//
// CommonJS because this module is consumed by both the React bundle
// (transparently handled by esbuild's CJS↔ESM interop) and the Node
// test runner (which uses CommonJS by default with no package.json
// `"type": "module"` declaration).

const pricing = require('../../config/pricing.json');

const DEFAULT_DC_AC_RATIO        = 1.2;   // PV DC nameplate ÷ inverter AC nameplate
const DEFAULT_DEMAND_MULTIPLIER  = 1.5;   // LUMA-accepted commercial oversizing factor

const DC_AC_RATIO        = pricing?.solar?.dcAcRatio        ?? DEFAULT_DC_AC_RATIO;
const DEMAND_MULTIPLIER  = pricing?.solar?.demandMultiplier ?? DEFAULT_DEMAND_MULTIPLIER;

module.exports = { DC_AC_RATIO, DEMAND_MULTIPLIER };
