import { Header, ProgressBar } from "./shared.jsx";

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
  // New format: { max_kw, price_per_w } — max_kw is upper bound, null means no limit
  if (table[0]?.price_per_w !== undefined) {
    const row = table.find(r => r.max_kw === null || kwp < r.max_kw);
    return row ? row.price_per_w : table[table.length - 1].price_per_w;
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

const calcEstimate = (consumoMensual, roofSqft, municipio, billData, epcTable) => {
  const { cargo_cliente = 0, cargo_demanda = 0, exceso_usd = 0, consumo_kwh = consumoMensual, costo_kwh = 0,
          tariff = "", demanda_kva = 0, exceso_kva = 0 } = billData;
  const annualYield   = getYield(municipio);
  const annualConsump = consumoMensual * 12;
  const maxKwpRoof    = (roofSqft / 2500) * CFG_DEFAULTS.kwp_per_2500sqft;
  const kwpFor100pct  = annualConsump / annualYield;
  const isSecundaria  = /secundaria/i.test(tariff);
  const demandCap     = isSecundaria ? 60 : (demanda_kva + exceso_kva) * 1.2 * 1.5;
  const systemKwp     = roundToPanels(Math.min(maxKwpRoof, kwpFor100pct, demandCap > 0 ? demandCap : Infinity));
  const annualGen     = systemKwp * annualYield;
  const coverage      = Math.min((annualGen / annualConsump) * 100, 100);
  const epcPerW       = getEPC(systemKwp, epcTable);
  const systemCost    = systemKwp * 1000 * epcPerW;
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
  };
};

// ─── Battery storage sizing logic ───────────────────────────────────────────
const BAT_CFG_DEFAULTS = {
  AC_DC_CONV:        1.25,
  INV_UNIT_KW:       60,
  BAT_UNIT_KWH:      60,
  MAX_BATT_PER_INV:  6,
  INV_COST:          12900,
  BAT_COST:          27700,
  BAT_SHIP:          500,
  INV_SHIP:          150,
  BAT_INSTALL_FIRST: 7000,
  BAT_INSTALL_NEXT:  2000,
  MARKUP:            1.35,
};

const resolveBatCfg = (pricing) => {
  if (!pricing?.battery) return BAT_CFG_DEFAULTS;
  const b = pricing.battery;
  return {
    AC_DC_CONV:        b.ac_dc_conv                      ?? BAT_CFG_DEFAULTS.AC_DC_CONV,
    INV_UNIT_KW:       b.batt_inv_60?.kw_per_unit        ?? BAT_CFG_DEFAULTS.INV_UNIT_KW,
    BAT_UNIT_KWH:      b.batt_unit?.kwh_per_unit         ?? BAT_CFG_DEFAULTS.BAT_UNIT_KWH,
    MAX_BATT_PER_INV:  b.batt_unit?.max_per_inverter     ?? BAT_CFG_DEFAULTS.MAX_BATT_PER_INV,
    INV_COST:          b.batt_inv_60?.inv_cost           ?? BAT_CFG_DEFAULTS.INV_COST,
    INV_SMA_COST:      b.batt_inv_60?.sma_cost           ?? 0,
    BAT_COST:          b.batt_unit?.cost                 ?? BAT_CFG_DEFAULTS.BAT_COST,
    BAT_SHIP:          b.batt_unit?.shipping             ?? BAT_CFG_DEFAULTS.BAT_SHIP,
    INV_SHIP:          b.batt_inv_60?.shipping           ?? BAT_CFG_DEFAULTS.INV_SHIP,
    BAT_INSTALL_FIRST: b.batt_unit?.install_first        ?? BAT_CFG_DEFAULTS.BAT_INSTALL_FIRST,
    BAT_INSTALL_NEXT:  b.batt_unit?.install_next         ?? BAT_CFG_DEFAULTS.BAT_INSTALL_NEXT,
    MARKUP:            b.markup                          ?? BAT_CFG_DEFAULTS.MARKUP,
  };
};

export const calcBatterySystem = (demandaKVA, avgMonthlyKWH, batteryHours, pricing) => {
  if (!batteryHours || batteryHours === 0) return null;
  const { AC_DC_CONV, INV_UNIT_KW, BAT_UNIT_KWH, MAX_BATT_PER_INV,
          INV_COST, INV_SMA_COST, BAT_COST, BAT_SHIP, INV_SHIP,
          BAT_INSTALL_FIRST, BAT_INSTALL_NEXT, MARKUP } = resolveBatCfg(pricing);

  const requiredKW_dc = demandaKVA * AC_DC_CONV;
  const numInverters  = Math.ceil(requiredKW_dc / INV_UNIT_KW);
  const systemKW      = numInverters * INV_UNIT_KW;

  const hourlyKW      = (avgMonthlyKWH / 30.4375) / 24;
  const requiredKWH   = hourlyKW * batteryHours;

  const rawBatteries  = Math.ceil(requiredKWH / BAT_UNIT_KWH);
  const minBatteries  = numInverters;
  const maxBatteries  = numInverters * MAX_BATT_PER_INV;
  const numBatteries  = Math.min(Math.max(rawBatteries, minBatteries), maxBatteries);
  const systemKWH     = numBatteries * BAT_UNIT_KWH;

  // Substitution pricing: inverter cost = SolArk cost − equivalent SMA cost (SMA already in EPC)
  const invSubCost    = INV_COST - INV_SMA_COST;
  const shipping      = (numBatteries * BAT_SHIP) + (numInverters * INV_SHIP);
  const installation  = BAT_INSTALL_FIRST + ((numBatteries - 1) * BAT_INSTALL_NEXT);
  const totalCost     = (numInverters * invSubCost + numBatteries * BAT_COST + shipping + installation) * MARKUP;
  const actualHours   = hourlyKW > 0 ? systemKWH / hourlyKW : 0;

  return {
    numInverters,
    numBatteries,
    systemKW,
    systemKWH,
    actualHours: Math.round(actualHours * 10) / 10,
    shipping,
    installation,
    totalCost: Math.round(totalCost),
    productName: `Sol-Ark ${systemKW}kW / ${systemKWH}kWh`,
    capped: numBatteries === maxBatteries,
  };
};

const SLIDER_HOURS = [0, 4, 8, 12, 16, 24];

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
    padding: "16px 20px",
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
function EstimateScreenInner({ ocrData, sqft, batteryHours, setBatteryHours, pricing, onInterested, onNotInterested, onBack }) {
  const consumoMensual = parseNum(ocrData?.consumoKWH);
  const municipio      = ocrData?.municipio || "San Juan";
  const cargoCliente   = parseNum(ocrData?.cargoCliente);
  const cargoDemanda   = parseNum(ocrData?.cargoDemanda);
  const excesoUSD      = parseNum(ocrData?.excesoUSD);
  const costoKWH       = parseNum(ocrData?.costoPorKWH);
  // Regulatory minimum: Secundaria tariff cap is 50 kVA; also use as fallback if OCR missed it
  const demandaKVA     = Math.max(parseNum(ocrData?.demandaKVA), 50);
  const excesoKVA      = parseNum(ocrData?.excesoKVA);
  const tariff         = ocrData?.tariff || "";

  const epcTable = pricing?.solar?.epc_tiers || null;

  const est = calcEstimate(consumoMensual, sqft, municipio, {
    cargo_cliente: cargoCliente,
    cargo_demanda: cargoDemanda,
    exceso_usd:    excesoUSD,
    consumo_kwh:   consumoMensual,
    costo_kwh:     costoKWH,
    tariff,
    demanda_kva:   demandaKVA,
    exceso_kva:    excesoKVA,
  }, epcTable);

  // Battery
  const localBatteryHours = batteryHours ?? 0;
  const batteryResult = calcBatterySystem(demandaKVA, consumoMensual, localBatteryHours, pricing);
  const totalCost = est.systemCost + (batteryResult?.totalCost ?? 0);

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

  return (
    <div style={S.page}>
      <Header />
      <ProgressBar current={5} total={6} />
      <div style={S.content}>
        <h1 style={S.h1}>Tu estimado</h1>
        <p style={S.sub}>{municipio} – {sqft.toLocaleString()} p²</p>

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
            <span style={S.rowValue}>{batteryResult ? `${batteryResult.actualHours} horas` : "0 horas"}</span>
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

        {/* Battery fine-tune slider */}
        <style>{`
          .est-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 28px; background: transparent; outline: none; cursor: pointer; }
          .est-slider::-webkit-slider-runnable-track { height: 3px; background: #d1d5db; border-radius: 2px; }
          .est-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px; border-radius: 50%; background: #1B3F8B; cursor: pointer; margin-top: -12.5px; }
          .est-slider::-moz-range-track { height: 3px; background: #d1d5db; border-radius: 2px; }
          .est-slider::-moz-range-thumb { width: 28px; height: 28px; border-radius: 50%; background: #1B3F8B; cursor: pointer; border: none; }
        `}</style>
        <div style={S.sliderCard}>
          <div style={S.sliderLabel}>Ajusta las horas de respaldo:</div>
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
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div style={S.sliderTicks}>
            {SLIDER_HOURS.map((h) => (
              <span key={h}>{h === 0 ? "0" : `${h}h`}</span>
            ))}
          </div>
        </div>

        <button style={S.btnOrange} onClick={() => onInterested(est, batteryResult)}>
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
