// Canonical PV system-sizing cap computation.
//
// Mirrors the Tool Belt's calculadora-superficie.html `calcLeft()` and
// calculadora-almacenamiento.html `computeInverterCapKwac()` for the
// consumption / transformer / tariff caps, and extends with a fourth
// Wizard-specific cap — roof area — because the Wizard flow goes
// sqft → system (not system → sqft like the Tool Belt calculator).
//
// Returns the smallest applicable cap plus the binding-constraint name
// (for the warning banner) and the full set of intermediate caps (for
// debugging / future inspection).

const { normalizeLumaTariff } = require('./tariff.js');
const { DC_AC_RATIO, DEMAND_MULTIPLIER } = require('./constants.js');

function computeSystemKwCaps({
  monthly_kwh,
  tarifa,
  carga_contratada_kva,
  exceso_de_demanda_kva,
  transformer_kva,
  roof_kw_cap,                            // Wizard-specific extension
  municipio_yield,
  dcAcRatio        = DC_AC_RATIO,
  demandMultiplier = DEMAND_MULTIPLIER,
}) {
  const tariff = normalizeLumaTariff(tarifa);

  // Cap A — consumption (always applied when inputs are available)
  const capConsumption = (monthly_kwh > 0 && municipio_yield > 0)
    ? (monthly_kwh * 12) / municipio_yield
    : Infinity;

  // Cap B — transformer (only when provided)
  const capTransformer = (transformer_kva != null && transformer_kva > 0)
    ? transformer_kva * dcAcRatio
    : Infinity;

  // Cap C — roof area (Wizard-only; not part of the Tool Belt canonical)
  const capRoof = (roof_kw_cap != null && roof_kw_cap > 0)
    ? roof_kw_cap
    : Infinity;

  // Cap D — tariff-specific
  let capTariff    = Infinity;
  let tariffCapKva = null;
  let demandaMaxima = null;

  if (tariff === 'residencial') {
    tariffCapKva = 25;
    capTariff    = 25 * dcAcRatio;                                 // 30 kWdc @ 1.2
  } else if (tariff === 'secundaria') {
    tariffCapKva = 50;
    capTariff    = 50 * dcAcRatio;                                 // 60 kWdc @ 1.2
  } else if (tariff === 'primaria' || tariff === 'transmision') {
    const exceso = exceso_de_demanda_kva ?? 0;
    demandaMaxima = (carga_contratada_kva != null && carga_contratada_kva > 0)
      ? carga_contratada_kva + exceso
      : null;
    if (demandaMaxima > 0) {
      capTariff = demandaMaxima * demandMultiplier * dcAcRatio;
    }
    // Else: no demand provided for Primaria/Transmisión → no tariff cap.
  }
  // Else (unknown / null tariff): no tariff cap.

  const systemKwDc = Math.min(capConsumption, capTransformer, capRoof, capTariff);

  // Binding-constraint identification. Constraint is null when the
  // consumption cap is the active one (the "ideal" outcome — the system
  // matches the customer's consumption exactly).
  let constraint = null;
  if (systemKwDc < capConsumption) {
    const tariffName = (tariff === 'residencial' || tariff === 'secundaria')
      ? 'tarifa'      // hard regulatory cap
      : 'demanda';    // demand-derived cap (Primaria / Transmisión)
    const candidates = [
      { name: 'techo',         value: capRoof },
      { name: 'transformador', value: capTransformer },
      { name: tariffName,      value: capTariff },
    ];
    constraint = candidates.reduce((min, c) => (c.value < min.value ? c : min)).name;
  }

  return {
    systemKwDc,
    constraint,            // null | 'tarifa' | 'demanda' | 'transformador' | 'techo'
    tariff,                // normalized form ('primaria' / null / etc.)
    capConsumption,
    capTransformer,
    capRoof,
    capTariff,
    tariffCapKva,
    demandaMaxima,
    transformerKva: transformer_kva ?? null,
    unconstrainedKwDc: capConsumption,
  };
}

module.exports = { computeSystemKwCaps };
