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

const CFG = {
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

const getEPC = (kwp) => {
  const row = CFG.epc_table.find(r => kwp >= r.from && kwp < r.to);
  return row ? row.epc : CFG.epc_table[CFG.epc_table.length - 1].epc;
};

const roundToPanels = (kwp) => {
  const panelKwp = CFG.panel_watts / 1000;
  return Math.floor(kwp / panelKwp) * panelKwp;
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

const calcEstimate = (consumoMensual, roofSqft, municipio, billData) => {
  const { cargo_cliente = 0, cargo_demanda = 0, exceso_usd = 0, consumo_kwh = consumoMensual, costo_kwh = 0,
          tariff = "", demanda_kva = 0, exceso_kva = 0 } = billData;
  const annualYield   = getYield(municipio);
  const annualConsump = consumoMensual * 12;
  const maxKwpRoof    = (roofSqft / 2500) * CFG.kwp_per_2500sqft;
  const kwpFor100pct  = annualConsump / annualYield;
  const isSecundaria  = /secundaria/i.test(tariff);
  const demandCap     = isSecundaria ? 60 : (demanda_kva + exceso_kva) * 1.2 * 1.5;
  const systemKwp     = roundToPanels(Math.min(maxKwpRoof, kwpFor100pct, demandCap > 0 ? demandCap : Infinity));
  const annualGen     = systemKwp * annualYield;
  const coverage      = Math.min((annualGen / annualConsump) * 100, 100);
  const epcPerW       = getEPC(systemKwp);
  const systemCost    = systemKwp * 1000 * epcPerW;
  // Average monthly bill = energy + fixed client charge + demand charges
  const avgMonthlyBill  = (costo_kwh * consumo_kwh) + cargo_cliente + cargo_demanda + exceso_usd;
  // Solar offsets energy kWh only — demand charges remain regardless
  const solarKwhMonthly = Math.min(annualGen / 12, consumo_kwh);
  const savingsCash     = costo_kwh * solarKwhMonthly;
  const fin               = calcFinancing(systemCost);
  const savingsFinanced   = savingsCash - fin.monthlyPmt;
  const numPanels         = Math.round(systemKwp * 1000 / CFG.panel_watts);
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
  // Savings highlight box
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
  // Financing divider
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
export default function EstimateScreen({ ocrData, sqft, onInterested, onNotInterested }) {
  const consumoMensual = parseNum(ocrData?.consumoKWH);
  const municipio      = ocrData?.municipio || "San Juan";
  const cargoCliente   = parseNum(ocrData?.cargoCliente);
  const cargoDemanda   = parseNum(ocrData?.cargoDemanda);
  const excesoUSD      = parseNum(ocrData?.excesoUSD);
  const costoKWH       = parseNum(ocrData?.costoPorKWH);
  const demandaKVA     = parseNum(ocrData?.demandaKVA);
  const excesoKVA      = parseNum(ocrData?.excesoKVA);
  const tariff         = ocrData?.tariff || "";

  const est = calcEstimate(consumoMensual, sqft, municipio, {
    cargo_cliente: cargoCliente,
    cargo_demanda: cargoDemanda,
    exceso_usd:    excesoUSD,
    consumo_kwh:   consumoMensual,
    costo_kwh:     costoKWH,
    tariff,
    demanda_kva:   demandaKVA,
    exceso_kva:    excesoKVA,
  });

  const paybackYears = est.savingsCash > 0
    ? Math.ceil(est.systemCost / (est.savingsCash * 12))
    : "—";

  return (
    <div style={S.page}>
      <Header />
      <ProgressBar current={4} total={4} />
      <div style={S.content}>
        <h1 style={S.h1}>Tu estimado solar</h1>
        <p style={S.sub}>{municipio} – {sqft.toLocaleString()} p²</p>

        {/* Capacidad + Cubre */}
        <div style={S.card}>
          <div style={S.row}>
            <span style={S.rowLabel}>Capacidad:</span>
            <span style={S.rowValue}>{est.systemKwp.toLocaleString("en-US")} kWp</span>
          </div>
          <div style={S.rowLast}>
            <span style={S.rowLabel}>Cubre:</span>
            <span style={S.rowValue}>{est.coverage}% de tu consumo</span>
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

        {/* Investment + financing */}
        <div style={S.card}>
          <div style={S.row}>
            <span style={S.rowLabel}>Precio de contado:</span>
            <span style={S.rowValue}>{fmtUSD(est.systemCost)}</span>
          </div>
          <div style={S.rowLast}>
            <span style={S.rowLabel}>Recuperas la inversión en:</span>
            <span style={S.rowValue}>{paybackYears} años</span>
          </div>

          <div style={S.financeDivider}>¿Prefieres financiar?</div>

          <div style={S.row}>
            <span style={S.rowLabel}>Pronto pago:</span>
            <span style={S.rowValue}>$0</span>
          </div>
          <div style={S.row}>
            <span style={S.rowLabel}>Pago mensual:</span>
            <span style={S.rowValue}>{fmtUSD(est.monthlyPmt)}</span>
          </div>
          <div style={S.rowBold}>
            <span style={S.rowBoldLabel}>Ahorro mensual neto:</span>
            <span style={S.rowBoldValue}>{fmtUSD(est.savingsFinanced)}</span>
          </div>
        </div>

        <button style={S.btnOrange} onClick={() => onInterested(est)}>
          Sí me interesa
        </button>
        <button style={S.btnGray} onClick={onNotInterested}>
          No por ahora
        </button>
      </div>
    </div>
  );
}
