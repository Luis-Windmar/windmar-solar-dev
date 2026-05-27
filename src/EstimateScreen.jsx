import { useState, useEffect } from "react";
import { Header, ProgressBar } from "./shared.jsx";
import { computeSystemKwCaps } from "./sizing/caps.js";
import { normalizeLumaTariff, defaultDemandKva, resolveVoltagePhases } from "./sizing/tariff.js";

// ─── Business logic (copied from PreQual_Solar_api.jsx) ────────────────────
const MUNICIPIO_YIELDS = {
  'Adjuntas':1530,'Aguada':1530,'Aguadilla':1530,'Aguas Buenas':1530,'Aibonito':1530,
  'Añasco':1530,'Arecibo':1530,'Arroyo':1650,'Barceloneta':1530,'Barranquitas':1530,
  'Bayamón':1530,'Cabo Rojo':1650,'Caguas':1530,'Camuy':1530,'Canóvanas':1530,
  'Carolina':1530,'Cataño':1530,'Cayey':1530,'Ceiba':1650,'Ciales':1400,
  'Cidra':1530,'Coamo':1530,'Comerío':1530,'Corozal':1530,'Culebra':1530,
  'Dorado':1530,'Fajardo':1650,'Florida':1530,'Guánica':1650,'Guayama':1750,
  'Guayanilla':1650,'Guaynabo':1530,'Gurabo':1530,'Hatillo':1530,'Hormigueros':1530,
  'Humacao':1650,'Isabela':1650,'Jayuya':1530,'Juana Díaz':1650,'Juncos':1650,
  'Lajas':1650,'Lares':1530,'Las Marías':1530,'Las Piedras':1530,'Loíza':1530,
  'Luquillo':1530,'Manatí':1530,'Maricao':1530,'Maunabo':1530,'Mayagüez':1530,
  'Moca':1530,'Morovis':1530,'Naguabo':1650,'Naranjito':1530,'Orocovis':1400,
  'Patillas':1530,'Peñuelas':1650,'Ponce':1650,'Quebradillas':1530,'Rincón':1530,
  'Río Grande':1530,'Sabana Grande':1530,'Salinas':1650,'San Germán':1530,
  'San Juan':1530,'San Lorenzo':1530,'San Sebastián':1530,'Santa Isabel':1650,
  'Toa Alta':1530,'Toa Baja':1530,'Trujillo Alto':1530,'Utuado':1530,
  'Vega Alta':1530,'Vega Baja':1530,'Vieques':1530,'Villalba':1530,
  'Yabucoa':1530,'Yauco':1650,
};
const getYield = (m) => MUNICIPIO_YIELDS[m] ?? 1530;

const CFG_DEFAULTS = {
  panel_watts: 410,
  kwp_per_2500sqft: 45,
  epc_table: [
    { from:     0, to:      5, epc: 3.20 },
    { from:     5, to:     35, epc: 2.90 },
    { from:    35, to:     50, epc: 2.80 },
    { from:    50, to:    100, epc: 2.70 },
    { from:   100, to:    500, epc: 2.50 },
    { from:   500, to:   1000, epc: 2.40 },
    { from:  1000, to:   2000, epc: 2.30 },
    { from:  2000, to:   6000, epc: 2.20 },
    { from:  6000, to:  12000, epc: 2.10 },
    { from: 12000, to:  24000, epc: 1.95 },
    { from: 24000, to: 100000, epc: 1.70 },
  ],
};

const getEPC = (kwp, epcTable) => {
  const table = epcTable || CFG_DEFAULTS.epc_table;
  // Tool Belt format: { kw_from, kw_to, effective_price_per_w }
  if (table[0]?.effective_price_per_w !== undefined) {
    const row = table.find(r => kwp >= r.kw_from && kwp < r.kw_to);
    return row ? row.effective_price_per_w : table[table.length - 1].effective_price_per_w;
  }
  // Legacy fallback format: { from, to, epc }
  const row = table.find(r => kwp >= r.from && kwp < r.to);
  return row ? row.epc : table[table.length - 1].epc;
};

const roundToPanels = (kwp) => {
  const panelKwp = CFG_DEFAULTS.panel_watts / 1000;
  return Math.ceil(kwp / panelKwp) * panelKwp;
};

const calcFinancing = (systemCost) => {
  const RATE = 0.09, AMORT = 180, BALLOON_MO = 83, DOC_FEE = 500;
  const base        = systemCost + DOC_FEE;
  const facilityFee = Math.round(((base / 0.95) * 0.02) * 100) / 100;
  const secDeposit  = Math.round(((base / 0.95) * 0.03) * 100) / 100;
  const financed    = systemCost + facilityFee + secDeposit + DOC_FEE;
  const r           = RATE / 12;
  const monthlyPmt  = Math.round((r * financed / (1 - Math.pow(1 + r, -AMORT))) * 100) / 100;
  const balloon     = Math.round((financed * Math.pow(1+r, BALLOON_MO+1)
                      + monthlyPmt * ((Math.pow(1+r, BALLOON_MO+1) - 1) / r)
                      - monthlyPmt) * (-1) * 100) / 100;
  return { facilityFee, secDeposit, financed, monthlyPmt, balloon };
};

const calcEstimate = async (consumoMensual, roofSqft, municipio, billData, annualYieldOverride, maxKwpRoofOverride) => {
  const { cargo_cliente = 0, cargo_demanda = 0, exceso_usd = 0, consumo_kwh = consumoMensual, costo_kwh = 0,
          tariff = "", demanda_kva = 0, exceso_kva = 0 } = billData;
  const annualYield   = annualYieldOverride || getYield(municipio);
  const annualConsump = consumoMensual * 12;
  const maxKwpRoof    = maxKwpRoofOverride  || (roofSqft / 2500) * CFG_DEFAULTS.kwp_per_2500sqft;

  // System size via the canonical sizing helper. Combines four caps:
  // consumption, transformer (not yet collected — null), roof area
  // (Wizard-specific extension), and the tariff-derived cap.
  const caps = computeSystemKwCaps({
    monthly_kwh:           consumoMensual,
    tarifa:                tariff,
    carga_contratada_kva:  demanda_kva,
    exceso_de_demanda_kva: exceso_kva,
    transformer_kva:       null,
    roof_kw_cap:           maxKwpRoof,
    municipio_yield:       annualYield,
  });

  const systemKwp     = roundToPanels(caps.systemKwDc);
  const annualGen     = systemKwp * annualYield;
  const coverage      = Math.min((annualGen / annualConsump) * 100, 100);

  // Pricing: prefer Tool Belt /api/price (which proxies the live
  // /api/v1/price endpoint). On 502 / network failure / null total_price,
  // fall back to the local getEPC() lookup against CFG_DEFAULTS.epc_table.
  // The fallback path will be removed in Step 4 once Tool Belt uptime is
  // verified in production.
  let systemCost    = null;
  let pricingSource = 'fallback';
  try {
    const priceRes = await fetch('/api/price', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        surfaces: [{ kw: systemKwp, surface_type: 'flat_roof' }],
      }),
    });
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      const tbPrice   = priceData?.surfaces?.[0]?.total_price;
      if (tbPrice != null) {
        systemCost    = tbPrice;
        pricingSource = 'toolbelt';
      }
    }
  } catch (e) {
    console.warn('⚠️ /api/price failed, falling back to getEPC():', e.message);
  }
  if (systemCost == null) {
    const epcPerW = getEPC(systemKwp);
    systemCost    = systemKwp * 1000 * epcPerW;
  }

  const avgMonthlyBill  = (costo_kwh * consumo_kwh) + cargo_cliente + cargo_demanda + exceso_usd;
  const solarKwhMonthly = Math.min(annualGen / 12, consumo_kwh);
  const savingsCash     = costo_kwh * solarKwhMonthly;
  const fin               = calcFinancing(systemCost);
  const savingsFinanced   = savingsCash - fin.monthlyPmt;
  const numPanels         = Math.round(systemKwp * 1000 / CFG_DEFAULTS.panel_watts);
  return {
    systemKwp: parseFloat(systemKwp.toFixed(1)),
    numPanels,
    coverage:        Math.round(coverage),
    systemCost:      Math.round(systemCost),
    avgMonthlyBill:  Math.round(avgMonthlyBill),
    savingsCash:     Math.round(savingsCash),
    monthlyPmt:      fin.monthlyPmt,
    savingsFinanced: Math.round(savingsFinanced),
    balloon:         Math.round(fin.balloon),
    caps,                       // for the binding-constraint banner
    pricingSource,              // 'toolbelt' | 'fallback' (Step 2 audit)
  };
};

// ─── Battery storage — sized via Tool Belt /api/v1/battery-sizing ─────────
// The old client-side calcBatterySystem / BAT_CFG_DEFAULTS / resolveBatCfg
// were removed in Step 3 of the migration. EstimateScreenInner now
// batch-precomputes the 5 non-zero slider positions in parallel against
// the Tool Belt proxy on mount and indexes into the resulting cache for
// instant slider response.

const SLIDER_HOURS              = [0, 4, 8, 12, 16, 24];
const BATTERY_HOURS_TO_PREFETCH = [4, 8, 12, 16, 24];

// Dollar threshold above which the wizard offers a financing breakdown.
// Below this, the financing card shows an ineligibility message but
// still renders so the EstimateScreen layout doesn't jump when the
// total moves across the boundary (e.g. when the rep changes the
// battery slider). Single hardcoded threshold today — backlog item 14
// flags that this may grow into a multi-factor eligibility rule later.
const FINANCING_THRESHOLD = 60000;

// Build a human-readable product name from the sanitized BOM.
// Upstream field name is `quantity` (not `qty`). For Tesla Powerwall the
// inverter and battery are the same unit and bom.batteries is empty —
// inverter.model alone is the right primary identifier. quantity is
// null-safe so a missing value renders without "×undefined".
const buildBatteryProductName = (batteryResult) => {
  const inv = batteryResult?.bom?.inverter;
  if (!inv?.model) return `Sistema ${batteryResult?.system_kwh ?? "?"} kWh`;
  const qty = inv.quantity;
  return `${inv.model}${qty ? ` ×${qty}` : ''} / ${batteryResult.system_kwh} kWh`;
};

// Per-position error copy shown next to the slider when the
// currently-selected backup-hours value returned an error from
// /api/v1/battery-sizing. capacity_exceeded_kwh shows a bare "—" so
// the rep notices THIS position is unavailable but other positions
// may still work — see batteryAllErroredMessage below for the case
// where every position errored.
const batteryErrorMessage = (code) => {
  switch (code) {
    case 'no_inverter_for_voltage':
      return 'Almacenamiento no disponible para este tipo de servicio eléctrico.';
    case 'capacity_exceeded_kw':
      return 'No hay opciones de almacenamiento disponibles para este tamaño de sistema. Verifica el tipo de servicio eléctrico para ver más opciones.';
    case 'capacity_exceeded_kwh':
      return '—';
    case 'no_legal_configuration':
      return 'No existe una configuración de almacenamiento válida para este sistema. Comunícate con el equipo técnico.';
    case 'timeout':
    default:
      return 'Estimado de baterías no disponible en este momento.';
  }
};

// Copy used ONLY when all 5 slider positions failed with the same
// error code. Differs from the per-position copy in one place:
// capacity_exceeded_kwh — at the position level this is "—" (try
// another position), but when ALL positions fail with that code the
// rep needs to be told why (the catalog's max storage can't cover
// any requested hours value for this consumption).
const batteryAllErroredMessage = (code) => {
  if (code === 'capacity_exceeded_kwh') {
    return 'La capacidad máxima de almacenamiento disponible no cubre las horas de respaldo seleccionadas.';
  }
  return batteryErrorMessage(code);
};

// Banner copy for each binding constraint. Returns null when the
// consumption cap is the active one (the customer's estimate matches
// their consumption — no banner needed).
const getConstraintBanner = (caps) => {
  if (!caps || !caps.constraint) return null;
  const detail = `Sistema sin restricciones: ${caps.unconstrainedKwDc.toFixed(1)} kWp → Sistema propuesto: ${caps.systemKwDc.toFixed(1)} kWp`;
  switch (caps.constraint) {
    case "tarifa": {
      const label = caps.tariff === "residencial" ? "Residencial" : "Secundaria";
      return {
        title:  `Sistema limitado por el cap regulatorio LUMA (tarifa ${label}, ${caps.tariffCapKva} kVA).`,
        detail,
      };
    }
    case "demanda":
      return {
        title:  `Sistema limitado por la demanda total (${caps.demandaMaxima} kVA).`,
        detail,
      };
    case "transformador":
      return {
        title:  `Sistema limitado por el transformador de servicio (${caps.transformerKva} kVA).`,
        detail,
      };
    case "techo":
      return {
        title:  `Sistema limitado por el área del techo disponible (${caps.capRoof.toFixed(1)} kWp).`,
        detail,
      };
    default:
      return null;
  }
};

// ─── Parse a formatted field value back to a number ────────────────────────
const parseNum = (s) => parseFloat(String(s ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, "")) || 0;

// ─── Formatters ─────────────────────────────────────────────────────────────
const fmtUSD = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ─── Styles ─────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#EBF1FF",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  content: {
    flex: 1,
    padding: "24px 24px 48px",
    maxWidth: "480px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  h1: {
    fontSize: "30px",
    fontWeight: "700",
    color: "#1B3F8B",
    marginBottom: "4px",
    marginTop: 0,
    textAlign: "center",
  },
  sub: {
    fontSize: "15px",
    color: "#6b7280",
    marginBottom: "20px",
    marginTop: 0,
    textAlign: "center",
  },
  constraintBanner: {
    backgroundColor: "#FFF7EC",
    borderLeft: "4px solid #F5A623",
    borderRadius: "8px",
    padding: "12px 14px",
    marginBottom: "14px",
    fontSize: "13px",
    color: "#1B3F8B",
    lineHeight: "1.4",
  },
  constraintTitle: {
    fontWeight: "700",
    marginBottom: "4px",
  },
  constraintDetail: {
    fontSize: "12px",
    color: "#6b7280",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "16px 20px",
    marginBottom: "12px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingBottom: "10px",
    marginBottom: "10px",
    borderBottom: "1px solid #f3f4f6",
  },
  rowLast: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  rowLabel: { fontSize: "15px", color: "#374151" },
  rowValue: { fontSize: "17px", fontWeight: "700", color: "#1B3F8B" },
  rowValueAccent: { fontSize: "17px", fontWeight: "700", color: "#059669" },
  highlight: {
    backgroundColor: "#1B3F8B",
    borderRadius: "16px",
    padding: "18px 24px",
    marginBottom: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  highlightLabel: { fontSize: "16px", fontWeight: "600", color: "#ffffff" },
  highlightFootnote: { fontSize: "12px", color: "rgba(255,255,255,0.7)", marginTop: "3px" },
  highlightValue: { fontSize: "32px", fontWeight: "800", color: "#F5A623" },
  financeDivider: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#1B3F8B",
    textAlign: "center",
    padding: "10px 0 6px",
    borderTop: "1px solid #f3f4f6",
    marginTop: "4px",
  },
  rowBold: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingTop: "6px",
  },
  rowBoldLabel: { fontSize: "15px", fontWeight: "700", color: "#111827" },
  rowBoldValue: { fontSize: "17px", fontWeight: "800", color: "#1B3F8B" },
  // Battery section
  batteryHeader: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#1B3F8B",
    marginBottom: "12px",
    paddingBottom: "8px",
    borderBottom: "2px solid #EBF1FF",
  },
  totalCard: {
    backgroundColor: "#1B3F8B",
    borderRadius: "16px",
    padding: "16px 20px",
    marginBottom: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: "16px", fontWeight: "600", color: "#ffffff" },
  totalValue: { fontSize: "28px", fontWeight: "800", color: "#F5A623" },
  sliderCard: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "10px 20px 14px",
    marginBottom: "12px",
    // Reserves enough vertical space for the tallest state of the
    // slider card: header label + slider + ticks + a two-line message
    // (e.g. cap_applied banner). Without this, the card grows/shrinks
    // when the message area below the slider changes content.
    minHeight: 180,
  },
  // Reserved-space container for the below-slider messages (loading,
  // all-errored, per-position error, cap_applied, no_se warning). Holds
  // ≥ 60px so sliding between positions with different messages doesn't
  // cause the card height (and everything below it) to shift.
  messageArea: {
    minHeight: 60,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    gap: "4px",
    marginTop: "8px",
  },
  // The financing card always renders; this style covers the
  // ineligibility message branch so the card height stays roughly
  // constant whether the system qualifies for financing or not.
  financingUnavailable: {
    fontSize: "14px",
    color: "#6b7280",
    fontStyle: "italic",
    lineHeight: 1.5,
    padding: "12px 0",
    margin: 0,
    textAlign: "center",
  },
  financingCard: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "16px 20px",
    marginBottom: "12px",
    minHeight: 145,    // accommodates either 3 breakdown rows or the ineligibility paragraph (bumped ~10% from 130 after browser check)
  },
  sliderLabel: { fontSize: "14px", fontWeight: "600", color: "#374151", marginBottom: "8px" },
  sliderValue: { fontSize: "22px", fontWeight: "800", color: "#1B3F8B", textAlign: "center", marginBottom: "10px" },
  sliderTicks: { display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9ca3af", marginTop: "6px" },
  addBatteryLink: {
    textAlign: "center",
    fontSize: "15px",
    color: "#1B3F8B",
    textDecoration: "underline",
    cursor: "pointer",
    marginBottom: "12px",
    display: "block",
    background: "none",
    border: "none",
    width: "100%",
    padding: "8px 0",
  },
  // Buttons
  btnOrange: {
    width: "100%",
    padding: "16px",
    fontSize: "18px",
    fontWeight: "600",
    color: "#ffffff",
    backgroundColor: "#F5A623",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    marginBottom: "12px",
    display: "block",
  },
  btnGray: {
    width: "100%",
    padding: "16px",
    fontSize: "18px",
    fontWeight: "600",
    color: "#ffffff",
    backgroundColor: "#9ca3af",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    display: "block",
  },
};

// ─── EstimateScreen ─────────────────────────────────────────────────────────
function EstimateScreenInner({ ocrData, sqft, batteryHours, setBatteryHours, fetchSolarConfig, onInterested, onNotInterested, onBack }) {
  const consumoMensual = parseNum(ocrData?.consumoKWH);
  const municipio      = ocrData?.municipio || "San Juan";
  const cargoCliente   = parseNum(ocrData?.cargoCliente);
  const cargoDemanda   = parseNum(ocrData?.cargoDemanda);
  const excesoUSD      = parseNum(ocrData?.excesoUSD);
  const costoKWH       = parseNum(ocrData?.costoPorKWH);
  // Read raw numeric OCR fields exposed by normalizeOCR (post Tool Belt migration).
  // Floor at the tariff's regulatory cap (25 kVA Residencial / 50 kVA Secundaria
  // & others) so OCR misses and rep-cleared fields use a sensible default
  // matched to the bill type. Also drives battery-inverter sizing downstream.
  const tariff         = ocrData?.tariff || "";
  const demandaKVA     = Math.max(ocrData?.carga_contratada_kva ?? 0, defaultDemandKva(tariff));
  const excesoKVA      = ocrData?.exceso_de_demanda_kva ?? 0;
  // serviceType is merged into ocrData by WelcomeScreen's upload-completion
  // handler. Read it here for use in Step 3 of the migration (battery sizing
  // via the Tool Belt /api/v1/battery-sizing endpoint, which requires
  // voltage and phases via resolveVoltagePhases). The ?? 'no_se' default
  // protects against ocrData captured in older sessions before the
  // serviceType plumbing existed.
  // eslint-disable-next-line no-unused-vars
  const serviceType    = ocrData?.serviceType ?? 'no_se';

  const [liveSolarConfig, setLiveSolarConfig] = useState(null);

  useEffect(() => {
    if (!municipio || !sqft || !fetchSolarConfig) return;
    fetchSolarConfig(municipio, sqft).then(cfg => {
      if (cfg) setLiveSolarConfig(cfg);
    });
  }, [municipio, sqft]); // eslint-disable-line

  const liveYield  = liveSolarConfig?.solarData?.specific_yield || null;
  const liveMaxKwp = liveSolarConfig?.areaData?.kw              || null;

  // calcEstimate is now async (Step 2 — pulls solar pricing from Tool Belt
  // /api/price). Wrap in a useEffect that re-runs only when inputs change;
  // the slider's batteryHours is intentionally NOT in the dep list, so
  // sliding does not refetch pricing.
  const [est, setEst]                                 = useState(null);
  const [batteryCache, setBatteryCache]               = useState({});
  const [batteryCacheLoading, setBatteryCacheLoading] = useState(true);
  const [batteryResult, setBatteryResult]             = useState(null);
  const localBatteryHours = batteryHours ?? 0;

  // Single useEffect that:
  //   1. Runs calcEstimate (async — fetches /api/price)
  //   2. After setEst(result), batch-precomputes the 5 non-zero battery
  //      slider positions in parallel using result.systemKwp (the local
  //      variable, NOT est state — which may be re-set if a downstream
  //      input changes and triggers a re-run of this effect).
  //
  // The battery batch used to live in its own useEffect with `est` as a
  // dep. That fired twice on initial mount because /api/area-to-system
  // arrived after the first calcEstimate run, triggered a second run
  // (new est ref with updated systemKwp), and the standalone battery
  // useEffect refired. By inlining the batch here and reading from
  // `result.systemKwp` directly, each input change produces exactly one
  // battery batch, regardless of how many re-renders the est setter causes.
  //
  // All hooks below the cleanup return live above the `if (!est) return …`
  // loading gate so React's hooks-order invariant holds.
  useEffect(() => {
    if (!sqft || !consumoMensual) return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      const result = await calcEstimate(consumoMensual, sqft, municipio, {
        cargo_cliente: cargoCliente,
        cargo_demanda: cargoDemanda,
        exceso_usd:    excesoUSD,
        consumo_kwh:   consumoMensual,
        costo_kwh:     costoKWH,
        tariff,
        demanda_kva:   demandaKVA,
        exceso_kva:    excesoKVA,
      }, liveYield, liveMaxKwp);
      if (cancelled) return;
      setEst(result);

      // ── Battery batch — kicks off only after the just-computed estimate
      //    is stable. Uses result.systemKwp directly to avoid the previous
      //    double-batch bug.
      setBatteryCacheLoading(true);
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const { voltage, phases } = resolveVoltagePhases(ocrData?.serviceType ?? 'no_se');
      const normalizedTariff    = normalizeLumaTariff(ocrData?.tariff) ?? undefined;
      const demandKva           = ocrData?.carga_contratada_kva ?? undefined;
      const cache = {};
      await Promise.allSettled(
        BATTERY_HOURS_TO_PREFETCH.map(async (hours) => {
          try {
            const r = await fetch('/api/battery-sizing', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_kw:              result.systemKwp,
                annual_consumption_kwh: consumoMensual * 12,
                battery_hours:          hours,
                voltage,
                phases,
                location:               'outdoor',
                tariff:                 normalizedTariff,
                demand_kva:             demandKva,
              }),
              signal: controller.signal,
            });
            const data = await r.json().catch(() => ({ error: 'parse_failed' }));
            cache[hours] = r.ok ? data : { error: data?.error ?? `http_${r.status}` };
          } catch (e) {
            cache[hours] = { error: e.name === 'AbortError' ? 'timeout' : e.message };
          }
        })
      );
      clearTimeout(timeoutId);
      if (!cancelled) {
        setBatteryCache(cache);
        setBatteryCacheLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line
  }, [consumoMensual, sqft, municipio, cargoCliente, cargoDemanda, excesoUSD, costoKWH, tariff, demandaKVA, excesoKVA, liveYield, liveMaxKwp, ocrData?.serviceType, ocrData?.carga_contratada_kva]);

  // Sync batteryResult from cache whenever the slider moves or the cache
  // refreshes. No network here — pure derivation.
  useEffect(() => {
    if (batteryCacheLoading) return;
    if (localBatteryHours === 0) {
      setBatteryResult(null);
      return;
    }
    const cached = batteryCache[localBatteryHours];
    if (!cached)                    setBatteryResult(null);
    else if (cached.error)          setBatteryResult({ error: cached.error });
    else                            setBatteryResult(cached);
  }, [localBatteryHours, batteryCache, batteryCacheLoading]);

  // Loading gate — render a small placeholder while the first /api/price
  // round-trip completes. Subsequent slider changes do NOT trigger this
  // (batteryHours is not in the useEffect dep list).
  if (!est) {
    return (
      <div style={S.page}>
        <Header />
        <ProgressBar current={5} total={6} />
        <div style={S.content}>
          <p style={{ textAlign: "center", color: "#6b7280", marginTop: "32px" }}>
            Calculando estimado…
          </p>
        </div>
      </div>
    );
  }

  const allBatteryErrored =
    !batteryCacheLoading &&
    BATTERY_HOURS_TO_PREFETCH.every((h) => batteryCache[h]?.error);

  // When every position errored, check whether they share an error
  // code. If yes, the all-errors banner can show the per-code message
  // (which tells the rep WHY) instead of a generic fallback. If the
  // codes are mixed, fall back to the neutral generic message.
  const sharedErrorCode = (() => {
    if (!allBatteryErrored) return null;
    const codes = BATTERY_HOURS_TO_PREFETCH
      .map((h) => batteryCache[h]?.error)
      .filter(Boolean);
    if (codes.length === 0) return null;
    const first = codes[0];
    return codes.every((c) => c === first) ? first : null;
  })();

  // Helpers derived from batteryResult.
  const batteryError       = batteryResult?.error || null;
  const validBatteryResult = batteryResult && !batteryError ? batteryResult : null;

  const totalCost = est.systemCost + (validBatteryResult?.total_price ?? 0);

  // Recalculate financing on total cost (solar + battery)
  const totalFin          = calcFinancing(totalCost);
  const totalMonthlyPmt   = totalFin.monthlyPmt;
  const totalSavingsNet   = Math.round(est.savingsCash - totalMonthlyPmt);
  const paybackYears      = est.savingsCash > 0
    ? Math.ceil(totalCost / (est.savingsCash * 12))
    : "—";

  const sliderIdx = Math.max(0, SLIDER_HOURS.indexOf(localBatteryHours));
  const handleSliderChange = (e) => {
    setBatteryHours(SLIDER_HOURS[Number(e.target.value)]);
  };

  const banner = getConstraintBanner(est.caps);

  return (
    <div style={S.page}>
      <Header />
      <ProgressBar current={5} total={6} />
      <div style={S.content}>
        <h1 style={S.h1}>Tu estimado</h1>
        <p style={S.sub}>{municipio} – {sqft.toLocaleString()} p²</p>

        {banner && (
          <div style={S.constraintBanner}>
            <div style={S.constraintTitle}>{banner.title}</div>
            <div style={S.constraintDetail}>{banner.detail}</div>
          </div>
        )}

        {/* Generación + Cubre + Respaldo (if battery) */}
        <div style={S.card}>
          <div style={S.row}>
            <span style={S.rowLabel}>Generación:</span>
            <span style={S.rowValue}>{est.systemKwp.toLocaleString("en-US")} kWp</span>
          </div>
          <div style={S.row}>
            <span style={S.rowLabel}>Cubre:</span>
            <span style={S.rowValue}>{est.coverage}% de tu consumo</span>
          </div>
          <div style={S.rowLast}>
            <span style={S.rowLabel}>Respaldo estimado:</span>
            <span style={S.rowValue}>
              {batteryError && localBatteryHours > 0
                ? "—"
                : validBatteryResult
                  ? `${validBatteryResult.actual_backup_hours} horas`
                  : "0 horas"}
            </span>
          </div>
        </div>

        {/* Savings highlight */}
        <div style={S.highlight}>
          <div>
            <div style={S.highlightLabel}>Ahorro mensual*</div>
            <div style={S.highlightFootnote}>*compra de contado</div>
          </div>
          <div style={S.highlightValue}>{fmtUSD(est.savingsCash)}</div>
        </div>

        {/* Investment — three rows, all always rendered. The
            Almacenamiento row breaks out the battery contribution so
            the total ("Precio de contado") math is transparent:
            solar + storage = total. When no battery is selected or the
            current position errored, Almacenamiento shows "—" and
            Precio de contado naturally falls back to solar-only
            (because totalCost adds 0 to est.systemCost). */}
        <div style={S.card}>
          <div style={S.row}>
            <span style={S.rowLabel}>Almacenamiento:</span>
            <span style={S.rowValue}>
              {localBatteryHours === 0
                ? "—"
                : batteryError
                  ? "—"
                  : validBatteryResult
                    ? fmtUSD(validBatteryResult.total_price)
                    : "—"}
            </span>
          </div>
          <div style={S.row}>
            <span style={S.rowLabel}>Precio de contado:</span>
            <span style={S.rowValue}>{fmtUSD(totalCost)}</span>
          </div>
          <div style={S.rowLast}>
            <span style={S.rowLabel}>Recuperas la inversión en:</span>
            <span style={S.rowValue}>{paybackYears} años</span>
          </div>
        </div>

        {/* Financing — always rendered. When the total qualifies, shows
            the breakdown rows. Otherwise shows an ineligibility message
            at the same approximate height (minHeight on financingCard
            holds the slot whether content is the 3-row breakdown or the
            single paragraph). Independent of battery state per Rule 6
            of the layout-stability prompt — if the rep is on an errored
            battery position, totalCost reflects the solar-only fallback
            and financing displays consistently with that. */}
        <div style={S.sliderValue}>¿Prefieres financiar?</div>
        <div style={S.financingCard}>
          {totalCost >= FINANCING_THRESHOLD ? (
            <>
              <div style={S.row}>
                <span style={S.rowLabel}>Pronto pago:</span>
                <span style={S.rowValue}>$0</span>
              </div>
              <div style={S.row}>
                <span style={S.rowLabel}>Pago mensual:</span>
                <span style={S.rowValue}>{fmtUSD(totalMonthlyPmt)}</span>
              </div>
              <div style={S.rowBold}>
                <span style={S.rowBoldLabel}>Ahorro mensual neto:</span>
                <span style={S.rowBoldValue}>{fmtUSD(totalSavingsNet)}</span>
              </div>
            </>
          ) : (
            <p style={S.financingUnavailable}>
              En estos momentos no contamos con una opción de
              financiamiento para este tipo de sistemas. Consulta con
              tu institución bancaria.
            </p>
          )}
        </div>

        {/* Battery fine-tune slider */}
        <style>{`
          .est-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 28px; background: transparent; outline: none; cursor: pointer; }
          .est-slider::-webkit-slider-runnable-track { height: 3px; background: #d1d5db; border-radius: 2px; }
          .est-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px; border-radius: 50%; background: #1B3F8B; cursor: pointer; margin-top: -12.5px; }
          .est-slider::-moz-range-track { height: 3px; background: #d1d5db; border-radius: 2px; }
          .est-slider::-moz-range-thumb { width: 28px; height: 28px; border-radius: 50%; background: #1B3F8B; cursor: pointer; border: none; }
        `}</style>
        <div style={S.sliderValue}>Ajusta el nivel de respaldo</div>
        <div style={{ fontSize: "14px", color: "#374151", textAlign: "center", marginBottom: "10px", marginTop: "-6px" }}>
          Selecciona las horas de respaldo deseadas
        </div>
        <div style={S.sliderCard}>
          <div style={S.sliderValue}>
            {localBatteryHours === 0 ? "Sin almacenamiento" : `${localBatteryHours} horas de respaldo`}
          </div>
          <input
            type="range"
            className="est-slider"
            min={0}
            max={SLIDER_HOURS.length - 1}
            step={1}
            value={sliderIdx}
            onChange={handleSliderChange}
            disabled={batteryCacheLoading || allBatteryErrored}
            style={{ width: "100%", cursor: (batteryCacheLoading || allBatteryErrored) ? "not-allowed" : "pointer" }}
          />
          <div style={S.sliderTicks}>
            {SLIDER_HOURS.map((h) => (
              <span key={h}>{h === 0 ? "0" : `${h}h`}</span>
            ))}
          </div>
          {/* Reserved-space message area. Single slot, priority cascade:
                1) batteryCacheLoading
                2) allBatteryErrored
                3) per-position batteryError
                4) cap_applied + no_se warnings (can stack when valid result)
              The minHeight on S.messageArea ensures the card doesn't
              shift when the message changes. */}
          <div style={S.messageArea}>
            {batteryCacheLoading ? (
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Calculando opciones de respaldo…
              </span>
            ) : allBatteryErrored ? (
              <span style={{ fontSize: "12px", color: "#dc2626" }}>
                {sharedErrorCode
                  ? batteryAllErroredMessage(sharedErrorCode)
                  : 'Estimado de baterías no disponible en este momento.'}
              </span>
            ) : batteryError && localBatteryHours > 0 ? (
              <span style={{ fontSize: "12px", color: "#dc2626" }}>
                {batteryErrorMessage(batteryError)}
              </span>
            ) : (
              <>
                {validBatteryResult?.cap_applied && (
                  <span style={{ fontSize: "12px", color: "#1B3F8B" }}>
                    El sistema de baterías fue ajustado por los límites de su tarifa LUMA.
                    Respaldo estimado: {validBatteryResult.actual_backup_hours} horas.
                  </span>
                )}
                {ocrData?.serviceType === 'no_se' && localBatteryHours > 0 && validBatteryResult && (
                  <span style={{ fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>
                    Estimado basado en servicio bifásico 240V. Verifica el tipo de servicio para mayor precisión.
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <button style={S.btnOrange} onClick={() => onInterested(est, validBatteryResult)}>
          Sí me interesa
        </button>
        <button style={S.btnGray} onClick={onNotInterested}>
          No por ahora
        </button>
        <button style={{ ...S.btnGray, backgroundColor: "transparent", color: "#1B3F8B", border: "2px solid #1B3F8B", marginTop: "12px" }} onClick={onBack}>
          Atrás
        </button>
      </div>
    </div>
  );
}

export default function EstimateScreen(props) {
  try {
    return <EstimateScreenInner {...props} />;
  } catch (err) {
    return (
      <div style={{ padding: "24px", backgroundColor: "#fff3cd", minHeight: "100vh" }}>
        <h2 style={{ color: "#dc2626", marginTop: 0 }}>Error en Estimado</h2>
        <pre style={{ fontSize: "13px", whiteSpace: "pre-wrap", color: "#7f1d1d" }}>{String(err)}</pre>
        <pre style={{ fontSize: "11px", whiteSpace: "pre-wrap", color: "#6b7280" }}>{err?.stack}</pre>
      </div>
    );
  }
}
