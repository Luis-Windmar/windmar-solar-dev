import { useState, useEffect } from "react";
import { Header, ProgressBar } from "./shared.jsx";
import { computeSystemKwCaps } from "./sizing/caps.js";
import { defaultDemandKva, resolveVoltagePhases } from "./sizing/tariff.js";

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

// Build a human-readable product name from the sanitized BOM.
const buildBatteryProductName = (batteryResult) => {
  const inv     = batteryResult?.bom?.inverter;
  const firstBt = batteryResult?.bom?.batteries?.[0];
  if (inv?.model && firstBt?.model) {
    return `${inv.model} ×${inv.qty} / ${batteryResult.system_kwh} kWh`;
  }
  return `Sistema ${batteryResult?.system_kwh ?? "?"} kWh`;
};

// Spanish copy for each /api/v1/battery-sizing 422 error code.
const batteryErrorMessage = (code) => {
  switch (code) {
    case 'no_inverter_for_voltage':
      return 'Almacenamiento no disponible para este tipo de servicio eléctrico.';
    case 'capacity_exceeded_kw':
      return 'Sistema solar demasiado grande para las opciones de almacenamiento actuales.';
    case 'capacity_exceeded_kwh':
      return '—';
    case 'no_legal_configuration':
      return 'Configuración no disponible. Contacte a su coordinador.';
    case 'timeout':
    default:
      return 'Estimado de baterías no disponible. Contacte a su coordinador.';
  }
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
  const [est, setEst] = useState(null);
  useEffect(() => {
    if (!sqft || !consumoMensual) return;
    let cancelled = false;
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
      if (!cancelled) setEst(result);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [consumoMensual, sqft, municipio, cargoCliente, cargoDemanda, excesoUSD, costoKWH, tariff, demandaKVA, excesoKVA, liveYield, liveMaxKwp]);

  // Battery — sized via Tool Belt /api/v1/battery-sizing. Two useEffects
  // below: (1) batch-precompute the 5 non-zero slider positions in parallel
  // when `est` resolves, and (2) sync `batteryResult` from the cache when
  // the slider moves. Slider changes do NOT retrigger the batch (it
  // depends on `est`, not `batteryHours`).
  //
  // NOTE: every hook declaration must run on every render — they live
  // above any conditional early-return (`if (!est) return …` below) so
  // React's hooks-order invariant holds across all render states.
  const localBatteryHours = batteryHours ?? 0;
  const [batteryCache, setBatteryCache]               = useState({});
  const [batteryCacheLoading, setBatteryCacheLoading] = useState(true);
  const [batteryResult, setBatteryResult]             = useState(null);

  useEffect(() => {
    if (!est) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 8000);
    setBatteryCacheLoading(true);

    (async () => {
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
                system_kw:              est.systemKwp,
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
      clearTimeout(timeoutId);
      controller.abort();
    };
    // eslint-disable-next-line
  }, [est, ocrData?.serviceType, ocrData?.tariff, ocrData?.carga_contratada_kva, consumoMensual]);

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
              {validBatteryResult ? `${validBatteryResult.actual_backup_hours} horas` : "0 horas"}
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

        {/* Investment */}
        <div style={S.card}>
          <div style={S.row}>
            <span style={S.rowLabel}>Precio de contado:</span>
            <span style={S.rowValue}>{fmtUSD(totalCost)}</span>
          </div>
          <div style={S.rowLast}>
            <span style={S.rowLabel}>Recuperas la inversión en:</span>
            <span style={S.rowValue}>{paybackYears} años</span>
          </div>
        </div>

        {/* Financing */}
        {totalCost >= 60000 ? (
          <>
            <div style={S.sliderValue}>¿Prefieres financiar?</div>
            <div style={S.card}>
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
            </div>
          </>
        ) : null}

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
          Decide cuánto quieres ahorrarte en tu factura de LUMA
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
          {batteryCacheLoading && (
            <div style={{ fontSize: "12px", color: "#6b7280", textAlign: "center", marginTop: "8px" }}>
              Calculando opciones de respaldo…
            </div>
          )}
          {allBatteryErrored && (
            <div style={{ fontSize: "12px", color: "#dc2626", textAlign: "center", marginTop: "8px" }}>
              Estimado de baterías no disponible. Contacte a su coordinador.
            </div>
          )}
          {!batteryCacheLoading && !allBatteryErrored && batteryError && (
            <div style={{ fontSize: "12px", color: "#dc2626", textAlign: "center", marginTop: "8px" }}>
              {batteryErrorMessage(batteryError)}
            </div>
          )}
          {validBatteryResult?.cap_applied && (
            <div style={{ fontSize: "12px", color: "#1B3F8B", textAlign: "center", marginTop: "8px" }}>
              El sistema de baterías fue ajustado por los límites de su tarifa LUMA.
              Respaldo estimado: {validBatteryResult.actual_backup_hours} horas.
            </div>
          )}
          {ocrData?.serviceType === 'no_se' && localBatteryHours > 0 && validBatteryResult && (
            <div style={{ fontSize: "12px", color: "#6b7280", textAlign: "center", marginTop: "8px", fontStyle: "italic" }}>
              Estimado basado en servicio bifásico 240V. Verifica el tipo de servicio para mayor precisión.
            </div>
          )}
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
