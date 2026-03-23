import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Loader2, Sun } from 'lucide-react';

// ─── MUNICIPIO YIELD LOOKUP ───────────────────────────────────────────────────
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
const DEFAULT_YIELD = 1530;
const getYield = (m) => MUNICIPIO_YIELDS[m] ?? DEFAULT_YIELD;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtUSD = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(n);
const fmtKWH = (n) => new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n)+' kWh';
const fmtKVA = (n) => new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(n)+' kVA';

const parseNum = (input) => {
  const t = input.toLowerCase().trim().replace(/,/g,'');
  if (t.includes('-')) return null;
  const n = parseFloat(t);
  if (!isNaN(n) && n >= 0) return n;
  const words = {'cero':0,'uno':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,
    'siete':7,'ocho':8,'nueve':9,'diez':10,'mil':1000,'dos mil':2000,'tres mil':3000};
  if (words[t] !== undefined) return words[t];
  return null;
};

const parseCostPerKWH = (input) => {
  const clean = input.toLowerCase().replace(/centavos?|cents?|\$|usd/g,'').trim();
  let n = parseNum(clean);
  if (n === null) return null;
  if (n >= 1) n = n / 100;
  return (n > 0 && n < 1) ? n : null;
};

const mapTariff = (input) => {
  const r = input.toLowerCase();
  if (r.includes('primaria'))    return 'Primaria';
  if (r.includes('secundaria'))  return 'Secundaria';
  if (r.includes('transmision') || r.includes('transmisión')) return 'Transmisión';
  if (r.includes('agricola') || r.includes('agrícola'))       return 'Agrícola';
  return 'Otra';
};

const normalizeAddress = (s) => {
  s = s.trim().toUpperCase().replace(/(\d)\.(\d)/g,'$1§$2').replace(/\s+/g,' ');
  s = s.replace(/\bCE\s+CAR\b/g,'CARR').replace(/\bCAR\b(?!\s*R)/g,'CARR')
       .replace(/\bCARRETERA\b/g,'CARR').replace(/\bAVENIDA\b/g,'AVE')
       .replace(/\bK\s+M\b/g,'KM').replace(/\bKM\.\s*/g,'KM ')
       .replace(/\bK(\d)/g,'KM $1').replace(/\bH\s+(\d)/g,'H$1')
       .replace(/\bBY[-\s]PASS\b/g,'BYPASS').replace(/\bBO\.\s*/g,'BO. ')
       .replace(/\bBO\b(?!\.)/g,'BO.').replace(/\bURB\.?\b/g,'URB.')
       .replace(/\bPR\s+(\d{5}(-\d{4})?)\b/,', PR $1').replace(/\bPR$/,', PR')
       .replace(/,\s*,/g,',').replace(/§/g,'.').replace(/\s+/g,' ')
       .replace(/\s+,/g,',').trim();
  return s;
};

const extractMunicipio = (address) => {
  const MUNICIPIOS = [
    'Adjuntas','Aguada','Aguadilla','Aguas Buenas','Aibonito','Añasco','Arecibo','Arroyo',
    'Barceloneta','Barranquitas','Bayamón','Cabo Rojo','Caguas','Camuy','Canóvanas',
    'Carolina','Cataño','Cayey','Ceiba','Ciales','Cidra','Coamo','Comerío','Corozal',
    'Culebra','Dorado','Fajardo','Florida','Guánica','Guayama','Guayanilla','Guaynabo',
    'Gurabo','Hatillo','Hormigueros','Humacao','Isabela','Jayuya','Juana Díaz','Juncos',
    'Lajas','Lares','Las Marías','Las Piedras','Loíza','Luquillo','Manatí','Maricao',
    'Maunabo','Mayagüez','Moca','Morovis','Naguabo','Naranjito','Orocovis','Patillas',
    'Peñuelas','Ponce','Quebradillas','Rincón','Río Grande','Sabana Grande','Salinas',
    'San Germán','San Juan','San Lorenzo','San Sebastián','Santa Isabel','Toa Alta',
    'Toa Baja','Trujillo Alto','Utuado','Vega Alta','Vega Baja','Vieques','Villalba',
    'Yabucoa','Yauco'
  ];
  const upper = address.toUpperCase();
  let bestMatch = null, bestPos = -1;
  for (const mun of MUNICIPIOS) {
    const variants = [mun.toUpperCase(), mun.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')];
    for (const v of variants) {
      const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'g');
      let m;
      while ((m = re.exec(upper)) !== null) {
        if (m.index > bestPos) { bestPos = m.index; bestMatch = mun; }
      }
    }
  }
  return bestMatch;
};

// ─── CONFIG (from windmar.config.js) ─────────────────────────────────────────
// Keep in sync with windmar.config.js — single source of truth for hardware/pricing.
const CFG = {
  panel_watts:      410,       // Wp per panel — update when changing module
  kwp_per_2500sqft: 45,        // roof density assumption
  epc_table: [
    { from:     0, to:      5, epc: 3.20 },
    { from:     5, to:     35, epc: 2.90 },
    { from:    35, to:     50, epc: 2.80 },
    { from:    50, to:    100, epc: 2.70 },
    { from:   100, to:    500, epc: 2.50 },
    { from:   500, to:  1000,  epc: 2.40 },
    { from:  1000, to:  2000,  epc: 2.30 },
    { from:  2000, to:  6000,  epc: 2.20 },
    { from:  6000, to: 12000,  epc: 2.10 },
    { from: 12000, to: 24000,  epc: 1.95 },
    { from: 24000, to:100000,  epc: 1.70 },
  ],
};

const getEPC = (kwp) => {
  const row = CFG.epc_table.find(r => kwp >= r.from && kwp < r.to);
  return row ? row.epc : CFG.epc_table[CFG.epc_table.length - 1].epc;
};

// Round kWp down to nearest panel increment
const roundToPanels = (kwp) => {
  const panelKwp = CFG.panel_watts / 1000;
  return Math.floor(kwp / panelKwp) * panelKwp;
};

// ─── WINDMAR FINANCE CALCULATOR (mirrors Excel PAYMENT_CALCULATOR) ────────────
// Inputs: systemCost ($), rate = 9%, term shown = 84mo, amortization = 180mo
const calcFinancing = (systemCost) => {
  const RATE     = 0.09;
  const AMORT    = 180;       // 15-yr amortization for payment calc
  const BALLOON_MO = 83;      // balloon due end of month 84 (0-indexed: after 83 payments)
  const DOC_FEE  = 500;       // fixed documentation fee

  const base         = systemCost + DOC_FEE;
  const facilityFee  = Math.round(((base / 0.95) * 0.02) * 100) / 100;
  const secDeposit   = Math.round(((base / 0.95) * 0.03) * 100) / 100;
  const financed     = systemCost + facilityFee + secDeposit + DOC_FEE;

  const r            = RATE / 12;
  const monthlyPmt   = Math.round((r * financed / (1 - Math.pow(1 + r, -AMORT))) * 100) / 100;

  // Balloon = remaining balance after 84th payment
  const balloon      = Math.round((financed * Math.pow(1+r, BALLOON_MO+1)
                       + monthlyPmt * ((Math.pow(1+r, BALLOON_MO+1) - 1) / r)
                       - monthlyPmt) * (-1) * 100) / 100;

  return { facilityFee, secDeposit, financed, monthlyPmt, balloon };
};

// ─── INSTANT ESTIMATE CALCULATOR ─────────────────────────────────────────────
// consumoMensual: monthly kWh; billData: { luma_total, cargo_demanda, exceso_usd, consumo_kwh }
const calcEstimate = (consumoMensual, roofSqft, municipio, billData) => {
  const { luma_total = 0, cargo_demanda = 0, exceso_usd = 0, consumo_kwh = consumoMensual } = billData;

  const annualYield   = getYield(municipio);                  // kWh/kWp/year
  const annualConsump = consumoMensual * 12;                  // kWh/year

  // 1. Max system that fits on roof
  const maxKwpRoof    = (roofSqft / 2500) * CFG.kwp_per_2500sqft;

  // 2. System needed for 100% coverage
  const kwpFor100pct  = annualConsump / annualYield;

  // 3. Smaller of the two, then round DOWN to nearest panel increment
  const systemKwp     = roundToPanels(Math.min(maxKwpRoof, kwpFor100pct));

  // 4. Annual generation and actual coverage
  const annualGen     = systemKwp * annualYield;              // kWh/year
  const coverage      = Math.min((annualGen / annualConsump) * 100, 100);

  // 5. System cost via tiered EPC table
  const epcPerW       = getEPC(systemKwp);
  const systemCost    = systemKwp * 1000 * epcPerW;          // kWp → W → $

  // 6. Savings calculation
  // Solar only offsets consumption charges, not demand or excess demand
  const non_demand_usd    = luma_total - cargo_demanda - exceso_usd;
  const non_demand_tariff = consume_kwh => non_demand_usd / (consume_kwh || 1); // $/kWh for non-demand portion
  const solarKwhMonthly   = Math.min(annualGen / 12, consumo_kwh);  // capped at actual consumption
  const tariff            = non_demand_tariff(consumo_kwh);
  const savingsCash       = tariff * solarKwhMonthly;               // consumption offset value

  // 7. Financing (Windmar Finance Program)
  const fin               = calcFinancing(systemCost);
  const savingsFinanced   = savingsCash - fin.monthlyPmt;

  const numPanels = Math.round(systemKwp * 1000 / CFG.panel_watts);
  return {
    systemKwp:          systemKwp.toFixed(1),
    numPanels,
    panelWatts:         CFG.panel_watts,
    annualGen:          Math.round(annualGen),
    annualConsump:      Math.round(annualConsump),
    coverage:           coverage.toFixed(0),
    epcPerW:            epcPerW.toFixed(2),
    systemCost:         systemCost.toFixed(0),
    monthlyGen:         Math.round(annualGen / 12),
    non_demand_usd:     non_demand_usd.toFixed(2),
    non_demand_tariff:  tariff.toFixed(4),
    savingsCash:        savingsCash.toFixed(0),
    // Financing details
    financed:           fin.financed.toFixed(0),
    facilityFee:        fin.facilityFee.toFixed(0),
    secDeposit:         fin.secDeposit.toFixed(0),
    monthlyPmt:         fin.monthlyPmt.toFixed(2),
    savingsFinanced:    savingsFinanced.toFixed(0),
  };
};

// ─── MOCK OCR ─────────────────────────────────────────────────────────────────
const mockOCR = () => {
  const v = () => 0.98 + Math.random()*0.04;
  return {
    address:            'CAR 172 KM. 13.3 (MCDONALDS) BO. BAYAMON CIDRA PR 00739',
    total_adeudado:     7030.87,
    tarifa:             'Primaria',
    cargo_cliente:      200.00,
    cargo_demanda:      534.60,
    demanda_contratada: 100,
    exceso_demanda_kva: 0,
    exceso_demanda_usd: 0,
    consumo_promedio:   Math.round(27043 * v()),
    costo_kwh:          0.2580 * v(),
  };
};

// ─── CLASSIFY USER INTENT at OCR review step ─────────────────────────────────
const classifyOCRIntent = (txt) => {
  const r = txt.toLowerCase().trim();
  const LISTO = ['listo','dale','si','sí','ok','okay','bien','perfecto','correcto','exacto',
    'todo bien','todo correcto','está bien','esta bien','adelante','confirmo','continua',
    'seguimos','correcto','yes','todo ok','todo está bien'];
  const CORREGIR = ['corregir','correg','no','malo','error','errores','incorrecto','equivocado',
    'mal','falla','falló','fallo','wrong','bad','fix','arreglar','modificar','cambiar',
    'no se ve bien','no está bien','no esta bien','hay error','tiene error'];
  const AYUDA = ['ayuda','help','como','cómo','que','qué','auxilio','no entiendo','no sé',
    'no se','no sé leer','explicame','explícame','dónde','donde','no encuentro'];
  if (CORREGIR.some(w => r.includes(w))) return 'corregir';
  if (AYUDA.some(w => r.includes(w))) return 'ayuda';
  if (LISTO.some(w => r.includes(w))) return 'listo';
  return null;
};

// ─── FIELD DEFINITIONS ───────────────────────────────────────────────────────
const FIELD_DEFS_DEMAND = [
  { id:'address',       pendingKey:'address_pending',       label:'Dirección del negocio',           hint:'',   fixStep:'FIX_ADDRESS'      },
  { id:'municipio',     pendingKey:'municipio_pending',     label:'Municipio',                       hint:'Extráelo de la dirección (ciudad antes del "PR").',                       fixStep:'FIX_MUNICIPIO'    },
  { id:'luma_total',    pendingKey:'luma_total_pending',    label:'Cantidad total adeudada',         hint:'Primera página, esquina superior izquierda, junto al logo de LUMA.',      fixStep:'FIX_TOTAL'        },
  { id:'tarifa',        pendingKey:'tarifa_pending',        label:'Tarifa',                          hint:'Tercera página, sección "Información del Medidor".',                      fixStep:'FIX_TARIFA'       },
  { id:'demanda',       pendingKey:'demanda_pending',       label:'Carga contratada (kVA)',          hint:'Tercera página, sección "Información del Medidor".',                      fixStep:'FIX_DEMANDA'      },
  { id:'cargo_cliente', pendingKey:'cargo_cliente_pending', label:'Cargo por cliente',               hint:'Tercera página, sección "Detalles de Cargos Corrientes".',               fixStep:'FIX_CARGO_CLIENTE'},
  { id:'cargo_demanda', pendingKey:'cargo_demanda_pending', label:'Cargo por demanda',               hint:'Sección "Detalles de Cargos Corrientes".',                               fixStep:'FIX_CARGO_DEMANDA'},
  { id:'exceso_kva',    pendingKey:'exceso_kva_pending',    label:'Exceso de demanda (kVA)',         hint:'Sección "Detalles de Cargos Corrientes".',                               fixStep:'FIX_EXCESO_KVA'   },
  { id:'exceso_usd',    pendingKey:'exceso_usd_pending',    label:'Monto por exceso de demanda',     hint:'Sección "Detalles de Cargos Corrientes".',                               fixStep:'FIX_EXCESO_USD'   },
  { id:'consumo',       pendingKey:'consumo_pending',       label:'Promedio de consumo mensual',     hint:'Barras del historial de consumo al fondo de la factura — estima el promedio visualmente.', fixStep:'FIX_CONSUMO'},
  { id:'costo_kwh',     pendingKey:'costo_kwh_pending',     label:'Costo promedio de energía',       hint:'Debajo de las barras del historial de consumo.',                         fixStep:'FIX_COSTO_KWH'   },
];
const FIELD_DEFS_SECONDARY = [
  { id:'address',       pendingKey:'address_pending',       label:'Dirección del negocio',           hint:'',                                                                       fixStep:'FIX_ADDRESS'      },
  { id:'municipio',     pendingKey:'municipio_pending',     label:'Municipio',                       hint:'Ciudad antes del "PR" en la dirección.',                                 fixStep:'FIX_MUNICIPIO'    },
  { id:'luma_total',    pendingKey:'luma_total_pending',    label:'Cantidad total adeudada',         hint:'Primera página, esquina superior izquierda.',                            fixStep:'FIX_TOTAL'        },
  { id:'tarifa',        pendingKey:'tarifa_pending',        label:'Tarifa',                          hint:'Tercera página, sección "Información del Medidor".',                      fixStep:'FIX_TARIFA'       },
  { id:'cargo_cliente', pendingKey:'cargo_cliente_pending', label:'Cargo por cliente',               hint:'Tercera página, sección "Detalles de Cargos Corrientes".',               fixStep:'FIX_CARGO_CLIENTE'},
  { id:'consumo',       pendingKey:'consumo_pending',       label:'Promedio de consumo mensual',     hint:'Barras del historial de consumo.',                                       fixStep:'FIX_CONSUMO'      },
  { id:'costo_kwh',     pendingKey:'costo_kwh_pending',     label:'Costo promedio de energía',       hint:'Debajo de las barras del historial de consumo.',                         fixStep:'FIX_COSTO_KWH'   },
];

const getFieldDefs = (tarifa) => tarifa === 'Secundaria' ? FIELD_DEFS_SECONDARY : FIELD_DEFS_DEMAND;

const getFieldValue = (d, pendingKey) => {
  const v = d[pendingKey];
  if (v === undefined || v === null) return '—';
  if (pendingKey === 'luma_total_pending')    return fmtUSD(v);
  if (pendingKey === 'tarifa_pending')        return String(v);
  if (pendingKey === 'demanda_pending')       return fmtKVA(v);
  if (pendingKey === 'cargo_cliente_pending') return fmtUSD(v);
  if (pendingKey === 'cargo_demanda_pending') return fmtUSD(v);
  if (pendingKey === 'exceso_kva_pending')    return fmtKVA(v);
  if (pendingKey === 'exceso_usd_pending')    return fmtUSD(v);
  if (pendingKey === 'consumo_pending')       return fmtKWH(v);
  if (pendingKey === 'costo_kwh_pending')     return fmtUSD(v)+'/kWh';
  return String(v);
};

// ─── OCR REVIEW CARD (interactive message bubble) ────────────────────────────
// ─── ESTIMATE CARD ───────────────────────────────────────────────────────────
function EstimateCard({ est, municipio }) {
  const savingsFinancedNum = Number(est.savingsFinanced);
  const systemRows = [
    { label: 'Sistema recomendado',       value: `${est.systemKwp} kWp (${est.numPanels} paneles × ${est.panelWatts}W)` },
    { label: 'Cobertura energética',      value: `${est.coverage}%` },
  ];
  const roiMonthsTotal = Number(est.savingsCash) > 0 ? Number(est.systemCost) / Number(est.savingsCash) : null;
  const roiYears  = roiMonthsTotal !== null ? Math.floor(roiMonthsTotal / 12) : null;
  const roiMonths = roiMonthsTotal !== null ? Math.round(roiMonthsTotal % 12) : null;
  const roiStr    = roiMonthsTotal === null ? '' :
    roiYears === 0
      ? ` (recuperas la inversión en ${roiMonths} ${roiMonths === 1 ? 'mes' : 'meses'})`
      : roiMonths === 0
        ? ` (recuperas la inversión en ${roiYears} ${roiYears === 1 ? 'año' : 'años'})`
        : ` (recuperas la inversión en ${roiYears} ${roiYears === 1 ? 'año' : 'años'}, ${roiMonths} ${roiMonths === 1 ? 'mes' : 'meses'})`;
  const cashRows = [
    { label: 'Precio del sistema',        value: `${fmtUSD(Number(est.systemCost))} ($${est.epcPerW}/W)` },
    { label: 'Ahorro mensual estimado',   value: `${fmtUSD(Number(est.savingsCash))}/mes${roiStr}` },
  ];
  const finRows = [
    { label: 'Monto financiado',          value: fmtUSD(Number(est.financed)) },
    { label: 'Pago inicial',              value: 'Ninguno ($0 pronto)' },
    { label: 'Pago mensual',              value: `${fmtUSD(Number(est.monthlyPmt))}/mes` },
    { label: 'Ahorro mensual neto',
      value: savingsFinancedNum >= 0
        ? `${fmtUSD(savingsFinancedNum)}/mes`
        : `−${fmtUSD(Math.abs(savingsFinancedNum))}/mes (esto es un aumento de ${fmtUSD(Math.abs(savingsFinancedNum))} a tu factura)`,
      negative: savingsFinancedNum < 0 },
  ];
  const Section = ({ title, rows, accent }) => (
    <>
      <div className={`px-4 py-2 ${accent}`}>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</p>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="px-4 py-2.5 border-t border-gray-100">
          <span className="text-xs text-gray-500">{row.label}: </span>
          <span className={`text-xs font-semibold break-words ${row.negative ? 'text-red-600' : 'text-gray-800'}`}>
            {row.value}
          </span>
        </div>
      ))}
    </>
  );
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden w-full max-w-lg">
      <div className="bg-orange-50 border-b border-orange-100 px-4 py-3 flex items-center gap-2">
        <span className="text-lg">🌞</span>
        <div>
          <p className="text-sm font-semibold text-orange-800">Estimado Preliminar</p>
          <p className="text-xs text-orange-600 mt-0.5">Basado en el área de techo y tu consumo</p>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        <Section title="Sistema Solar" rows={systemRows} accent="bg-gray-50" />
        <Section title="Compra al Contado" rows={cashRows} accent="bg-blue-50" />
        <Section title="Financiamiento Windmar (7 años)" rows={finRows} accent="bg-green-50" />
      </div>
      <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
        Estimado preliminar · sujeto a inspección técnica
      </div>
    </div>
  );
}

function OCRReviewCard({ data, checkedFields, onToggle, disabled }) {
  const defs = getFieldDefs(data.tarifa_pending ?? data.ocr?.tarifa);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden w-full max-w-lg">
      <div className="bg-orange-50 border-b border-orange-100 px-4 py-3">
        <p className="text-sm font-semibold text-orange-800">Datos de tu factura LUMA</p>
        <p className="text-xs text-orange-600 mt-0.5">Marca los campos que necesitan corrección</p>
      </div>
      <div className="divide-y divide-gray-100">
        {defs.map((f) => {
          const checked = checkedFields.includes(f.id);
          return (
            <label
              key={f.id}
              className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-orange-50'
              } ${checked ? 'bg-red-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => !disabled && onToggle(f.id)}
                className="mt-0.5 accent-red-500 w-4 h-4 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500">{f.label}: </span>
                <span className={`text-xs font-semibold break-words ${checked ? 'text-red-600 line-through' : 'text-gray-800'}`}>
                  {getFieldValue(data, f.pendingKey)}
                </span>
              </div>
            </label>
          );
        })}
      </div>
      {!disabled && (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          Escribe <span className="font-semibold text-orange-600">listo</span> para continuar ·{' '}
          <span className="font-semibold text-red-600">corregir</span> si marcaste campos ·{' '}
          <span className="font-semibold text-blue-600">ayuda</span> si necesitas orientación
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PreQualSolar() {
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [step, setStep]               = useState('START');
  const [data, setData]               = useState({});
  const [attempts, setAttempts]       = useState(0);
  const [testMode, setTestMode]       = useState(false);
  const [checkedFields, setCheckedFields] = useState([]);
  const [fixQueue, setFixQueue]       = useState([]);
  const [guidedMode, setGuidedMode]   = useState(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);
  const fileRef  = useRef(null);
  const MAX = 3;

  const WELCOME = '¡Bienvenido! Estoy aquí para ayudarte a potenciar tu negocio con Energía de la Buena™.\n\nEn menos de 5 minutos te daré un estimado personalizado de un sistema solar* para tu negocio. Si estás interesado en seguir adelante, te pediré cierta información adicional para generarte una cotización profesional.\n\nPara empezar, sube tu factura de LUMA más reciente usando el botón de carga ↙. Un archivo PDF es lo mejor, pero una foto funciona también.\n\n(*) Nota: Si quieres explorar un sistema con baterías, por favor realiza este ejercicio, y si los números tienen sentido SIN baterías, sigue el vínculo al final para generar una cotización con baterías.';

  const say  = (content, s, extra={}) => setMessages(prev=>[...prev,{role:'assistant',content,timestamp:new Date(),step:s||step,...extra}]);
  const fail = () => { setAttempts(0); say('Lo siento, no estamos pudiendo completar este proceso. Por favor comunícate con un consultor de Windmar directamente. ¡Que tengas un excelente día!','EXIT'); setStep('DONE'); setLoading(false); };
  const bump = (msg) => {
    const n = attempts+1; setAttempts(n);
    if (n >= MAX) { fail(); return true; }
    say(msg); setLoading(false); return false;
  };

  useEffect(()=>{ say(WELCOME,'START'); },[]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  const toggleField = (id) => {
    setCheckedFields(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf   = file.type === 'application/pdf';
    if (!isImage && !isPdf) { say('❌ Por favor sube un PDF o una foto (JPG, PNG, WEBP).'); return; }
    if (file.size > 20*1024*1024) { say('❌ El archivo es muy grande. Máximo 20 MB.'); return; }

    setMessages(prev=>[...prev,{role:'user',content:`📎 ${file.name}`,timestamp:new Date()}]);
    setLoading(true);
    setCheckedFields([]);
    setGuidedMode(false);
    say('Leyendo tu factura... ⏳','BILL_UPLOAD');

    setTimeout(()=>{
      const ocr = mockOCR();
      const norm = normalizeAddress(ocr.address);
      const mun  = extractMunicipio(norm);
      const newData = {
        ocr,
        address_pending:       norm,
        municipio_pending:     mun,
        luma_total_pending:    ocr.total_adeudado,
        tarifa_pending:        ocr.tarifa,
        demanda_pending:       ocr.demanda_contratada,
        cargo_cliente_pending: ocr.cargo_cliente,
        cargo_demanda_pending: ocr.cargo_demanda,
        exceso_kva_pending:    ocr.exceso_demanda_kva,
        exceso_usd_pending:    ocr.exceso_demanda_usd,
        consumo_pending:       ocr.consumo_promedio,
        costo_kwh_pending:     ocr.costo_kwh,
      };
      setData(newData);

      const intro = 'Factura procesada. Veo la siguiente información. Revísala contra tu factura y marca el checkbox de cualquier cantidad que quieras corregir.\n\n• Si leí todo correctamente, escribe: listo\n• Si necesitas corregir algún campo, márcalo y escribe: corregir\n• Si necesitas ayuda para leer la factura, escribe: ayuda';
      say(intro, '7.3.a');
      say('__OCR_REVIEW__', '7.3.a', { type:'ocr_review', ocrData: newData });
      setStep('7.3.a');
      setLoading(false);
    },1500);
    e.target.value='';
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const txt = input.trim();

    if (testMode && txt.startsWith('/')) {
      setMessages(prev=>[...prev,{role:'user',content:txt,timestamp:new Date()}]);
      setInput('');
      const parts = txt.slice(1).split(/\s+/);
      const cmd   = parts[0].toLowerCase();
      if (cmd === 'restart') {
        setStep('START'); setData({}); setAttempts(0); setCheckedFields([]); setFixQueue([]); setGuidedMode(false);
        setMessages([
          {role:'assistant',content:'🔄 Sesión reiniciada.',timestamp:new Date(),step:'START'},
          {role:'assistant',content:WELCOME,timestamp:new Date(),step:'START'},
        ]);
        return;
      }
      if (cmd === 'exit') {
        setStep('DONE'); setAttempts(0);
        say('🚪 Sesión terminada por comando /exit.','DONE'); return;
      }
      if (cmd === 'jump') {
        const target = parts.slice(1).join(' ').trim().toUpperCase() || 'ROOF';
        setStep(target); setAttempts(0);
        say(`⚡ Salto al step: ${target}`, target); return;
      }
      say('❓ Comandos disponibles: /jump <step>, /exit, /restart'); return;
    }

    setMessages(prev=>[...prev,{role:'user',content:txt,timestamp:new Date()}]);
    setInput('');
    setLoading(true);
    setTimeout(()=>inputRef.current?.focus(),100);
    process(txt);
  };

  const commitAll = (d) => ({
    ...d,
    luma_total:         d.luma_total_pending,    luma_total_pending:    undefined,
    tarifa:             d.tarifa_pending,         tarifa_pending:        undefined,
    demanda_contratada: d.demanda_pending,        demanda_pending:       undefined,
    cargo_cliente:      d.cargo_cliente_pending,  cargo_cliente_pending: undefined,
    cargo_demanda:      d.cargo_demanda_pending,  cargo_demanda_pending: undefined,
    exceso_kva:         d.exceso_kva_pending,     exceso_kva_pending:    undefined,
    exceso_usd:         d.exceso_usd_pending,     exceso_usd_pending:    undefined,
    consumo_kwh:        d.consumo_pending,        consumo_pending:       undefined,
    costo_kwh:          d.costo_kwh_pending,      costo_kwh_pending:     undefined,
    address:            d.address_pending,        address_pending:       undefined,
    municipio:          d.municipio_pending,      municipio_pending:     undefined,
  });

  const startNextFix = (queue, currentData, guided) => {
    setGuidedMode(guided);
    if (queue.length === 0) {
      say('He actualizado los datos. Revisa que todo esté correcto:', '7.3.a');
      say('__OCR_REVIEW__', '7.3.a', { type:'ocr_review', ocrData: currentData });
      setStep('7.3.a'); setCheckedFields([]); setAttempts(0); setLoading(false);
      return;
    }
    const [next, ...rest] = queue;
    setFixQueue(rest);
    const defs = getFieldDefs(currentData.tarifa_pending ?? currentData.ocr?.tarifa);
    const fieldDef = defs.find(f => f.fixStep === next);
    if (!fieldDef) { startNextFix(rest, currentData, guided); return; }
    const prompt = (guided && fieldDef.hint)
      ? `${fieldDef.label}:\n${fieldDef.hint}`
      : `${fieldDef.label}:`;
    say(prompt, next);
    setStep(next); setLoading(false);
  };

  const process = (txt) => {
    const r = txt.toLowerCase().trim();

    if (step === '7.3.a') {
      const intent = classifyOCRIntent(txt);
      if (intent === 'listo') {
        if (checkedFields.length > 0) {
          say('Veo que marcaste algunos campos. ¿Quieres corregirlos antes de continuar? (corregir / listo de todas formas)', '7.3.a');
          setLoading(false); return;
        }
        setData(p => { const committed = commitAll(p); return committed; });
        say('¡Perfecto! Seguimos adelante.', '7.3.a');
        say('¿Cuántos pies cuadrados de techo tienes disponibles para paneles solares, aproximadamente?\n\nSi tienes un número aproximado, ingrésalo ahora (ej: 3500).\nSi no estás seguro, puedes usar estas referencias:\n• pequeño — menos de 2,500 pies²\n• mediano — 2,500–5,000 pies²\n• grande — 5,000–10,000 pies²\n• industrial — más de 10,000 pies²','ROOF');
        setStep('ROOF'); setLoading(false); return;
      }
      if (intent === 'corregir') {
        const defs = getFieldDefs(data.tarifa_pending ?? data.ocr?.tarifa);
        const queue = checkedFields.length === 0
          ? defs.map(f => f.fixStep)
          : defs.filter(f => checkedFields.includes(f.id)).map(f => f.fixStep);
        setFixQueue(queue.slice(1));
        setMessages(prev => prev.map(m => m.type === 'ocr_review' ? {...m, locked:true} : m));
        startNextFix(queue, data, false);
        return;
      }
      if (intent === 'ayuda') {
        if (checkedFields.length === 0) {
          const defs = getFieldDefs(data.tarifa_pending ?? data.ocr?.tarifa);
          const queue = defs.map(f => f.fixStep);
          setFixQueue(queue.slice(1));
          setMessages(prev => prev.map(m => m.type === 'ocr_review' ? {...m, locked:true} : m));
          say('Con gusto te ayudo a leer la factura. Vamos campo por campo:', 'GUIDED');
          startNextFix(queue, data, true);
          return;
        } else {
          const defs = getFieldDefs(data.tarifa_pending ?? data.ocr?.tarifa);
          const queue = defs.filter(f => checkedFields.includes(f.id)).map(f => f.fixStep);
          setFixQueue(queue.slice(1));
          setMessages(prev => prev.map(m => m.type === 'ocr_review' ? {...m, locked:true} : m));
          say('Vamos a repasar los campos que marcaste:', 'GUIDED');
          startNextFix(queue, data, true);
          return;
        }
      }
      if (bump('Escribe "listo" para confirmar, "corregir" si necesitas cambiar algo, o "ayuda" si necesitas orientación.')) return;
      return;
    }

    const fixHandlers = {
      FIX_ADDRESS: {
        pendingKey: 'address_fix_pending',
        targetKey:  'address_pending',
        parse: (t) => t.length >= 5 ? normalizeAddress(t) : null,
        format: (v) => v,
        confirmMsg: (v) => `¿La dirección correcta es "${v}"?`,
        retryMsg: 'Ingresa la dirección completa:',
        errorMsg: 'La dirección parece demasiado corta. Intenta de nuevo:',
        onCommit: (val, d) => {
          const mun = extractMunicipio(val);
          return { ...d, address_pending: val, municipio_pending: mun || d.municipio_pending };
        },
      },
      FIX_MUNICIPIO: {
        pendingKey: 'municipio_fix_pending',
        targetKey:  'municipio_pending',
        parse: (t) => {
          const MUNS = Object.keys(MUNICIPIO_YIELDS);
          const up = t.trim().toUpperCase();
          const na = up.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
          return MUNS.find(m => { const mu=m.toUpperCase(); const mn=mu.normalize('NFD').replace(/[\u0300-\u036f]/g,''); return up===mu||na===mn||mu.startsWith(up)||mn.startsWith(na); }) ?? null;
        },
        format: (v) => v,
        confirmMsg: (v) => `¿El municipio correcto es ${v}?`,
        retryMsg: 'Escribe el nombre del municipio (ej: Ponce, San Juan):',
        errorMsg: 'No reconocí ese municipio. Escribe el nombre completo:',
      },
      FIX_TOTAL: {
        pendingKey: 'luma_total_fix_pending',
        targetKey:  'luma_total_pending',
        parse: parseNum,
        format: fmtUSD,
        confirmMsg: (v) => `¿El total adeudado correcto es ${fmtUSD(v)}?`,
        retryMsg: 'Ingresa el monto total adeudado:',
        errorMsg: 'Ingresa un monto válido en dólares:',
      },
      FIX_TARIFA: {
        pendingKey: 'tarifa_fix_pending',
        targetKey:  'tarifa_pending',
        parse: (t) => mapTariff(t),
        format: (v) => v,
        confirmMsg: (v) => `¿La tarifa correcta es "${v}"?`,
        retryMsg: 'Ingresa el tipo de tarifa (Secundaria, Primaria, Transmisión, Agrícola):',
        errorMsg: 'No reconocí esa tarifa. Intenta de nuevo:',
      },
      FIX_DEMANDA: {
        pendingKey: 'demanda_fix_pending',
        targetKey:  'demanda_pending',
        parse: parseNum,
        format: fmtKVA,
        confirmMsg: (v) => `¿La carga contratada correcta es ${fmtKVA(v)}?`,
        retryMsg: 'Ingresa la carga contratada en kVA:',
        errorMsg: 'Ingresa un número válido en kVA:',
      },
      FIX_CARGO_CLIENTE: {
        pendingKey: 'cargo_cliente_fix_pending',
        targetKey:  'cargo_cliente_pending',
        parse: parseNum,
        format: fmtUSD,
        confirmMsg: (v) => `¿El cargo por cliente correcto es ${fmtUSD(v)}?`,
        retryMsg: 'Ingresa el cargo por cliente:',
        errorMsg: 'Ingresa un monto válido:',
      },
      FIX_CARGO_DEMANDA: {
        pendingKey: 'cargo_demanda_fix_pending',
        targetKey:  'cargo_demanda_pending',
        parse: parseNum,
        format: fmtUSD,
        confirmMsg: (v) => `¿El cargo por demanda correcto es ${fmtUSD(v)}?`,
        retryMsg: 'Ingresa el cargo por demanda:',
        errorMsg: 'Ingresa un monto válido:',
      },
      FIX_EXCESO_KVA: {
        pendingKey: 'exceso_kva_fix_pending',
        targetKey:  'exceso_kva_pending',
        parse: parseNum,
        format: fmtKVA,
        confirmMsg: (v) => `¿El exceso de demanda correcto es ${fmtKVA(v)}?`,
        retryMsg: 'Ingresa el exceso de demanda en kVA (o 0):',
        errorMsg: 'Ingresa un número válido en kVA:',
      },
      FIX_EXCESO_USD: {
        pendingKey: 'exceso_usd_fix_pending',
        targetKey:  'exceso_usd_pending',
        parse: parseNum,
        format: fmtUSD,
        confirmMsg: (v) => `¿El monto por exceso de demanda correcto es ${fmtUSD(v)}?`,
        retryMsg: 'Ingresa el monto por exceso de demanda (o 0):',
        errorMsg: 'Ingresa un monto válido:',
      },
      FIX_CONSUMO: {
        pendingKey: 'consumo_fix_pending',
        targetKey:  'consumo_pending',
        parse: (t) => { const n = parseNum(t); return (n !== null && n > 0) ? n : null; },
        format: fmtKWH,
        confirmMsg: (v) => `¿El promedio de consumo mensual correcto es ${fmtKWH(v)}?`,
        retryMsg: 'Ingresa el consumo mensual promedio en kWh:',
        errorMsg: 'Ingresa un número válido en kWh:',
      },
      FIX_COSTO_KWH: {
        pendingKey: 'costo_kwh_fix_pending',
        targetKey:  'costo_kwh_pending',
        parse: parseCostPerKWH,
        format: (v) => `${fmtUSD(v)}/kWh`,
        confirmMsg: (v) => `¿El costo por kWh correcto es ${fmtUSD(v)}/kWh?`,
        retryMsg: 'Ingresa el costo por kWh (ej: 0.28 o 28):',
        errorMsg: 'Ingresa un valor válido (ej: 0.28 o 24):',
      },
    };

    const handler = fixHandlers[step];
    if (handler) {
      const { pendingKey, targetKey, parse, confirmMsg, retryMsg, errorMsg, onCommit } = handler;
      const isYes = /\b(s[ií]|yes|correcto|exacto|confirmado|dale|ok|okay|adelante|bien|perfecto)\b/.test(r);
      const isNo  = /\bno\b/.test(r) || ['nope','nel','negativo','incorrecto','mal'].some(w=>r.includes(w));

      if (data[pendingKey] !== undefined) {
        if (isYes) {
          const val = data[pendingKey];
          let nd = { ...data, [targetKey]: val, [pendingKey]: undefined };
          if (onCommit) nd = onCommit(val, nd);
          setData(nd);
          setAttempts(0);
          startNextFix(fixQueue, nd, guidedMode);
          return;
        } else if (isNo) {
          setData(p=>({...p,[pendingKey]:undefined}));
          say(retryMsg, step); setLoading(false); return;
        } else {
          if (bump('¿Correcto? (sí / no)')) return; return;
        }
      } else {
        const val = parse(txt);
        if (val === null || val === undefined) {
          if (bump(errorMsg)) return; return;
        }
        setData(p=>({...p,[pendingKey]:val}));
        say(confirmMsg(val), step); setLoading(false); return;
      }
    }

    if (step === 'ROOF') {
      const isYes = /\b(s[ií]|yes|correcto|exacto|confirmado|dale|ok|okay|adelante|bien|perfecto)\b/.test(r);
      const isNo  = /\bno\b/.test(r);
      if (data.roof_pending !== undefined) {
        if (isYes) {
          const roof = data.roof_pending;
          setData(p=>({...p,roof_sqft:roof,roof_pending:undefined}));
          const est = calcEstimate(data.consumo_kwh, roof, data.municipio, {
            luma_total:    data.luma_total,
            cargo_demanda: data.cargo_demanda,
            exceso_usd:    data.exceso_usd,
            consumo_kwh:   data.consumo_kwh,
          });
          setData(p=>({...p,estimate:est}));
          say('__ESTIMATE_CARD__', 'ESTIMATE', { type:'estimate_card', estData: est, municipio: data.municipio });
          say('¿Te parece interesante? ¿Quieres explorar esto más a fondo?', 'INTEREST');
          setStep('INTEREST'); setLoading(false); return;
        } else if (isNo) {
          setData(p=>({...p,roof_pending:undefined}));
          say('Ingresa el tamaño aproximado del techo en pies² (o: pequeño, mediano, grande, industrial):','ROOF');
          setLoading(false); return;
        } else { setData(p=>({...p,roof_pending:undefined})); }
      }
      const LABELS = {pequeño:1500,pequeno:1500,small:1500,mediano:3750,medium:3750,grande:7500,large:7500,industrial:30000};
      const lk = Object.keys(LABELS).find(k=>r.includes(k));
      let sqft = lk ? LABELS[lk] : null;
      if (!sqft) { const n = parseNum(txt); if (n&&n>0&&n<=500000) sqft=Math.round(n); }
      if (!sqft) { if (bump('No entendí el tamaño. Ingresa pies² (ej: 5000) o: pequeño, mediano, grande, industrial:')) return; return; }
      setData(p=>({...p,roof_pending:sqft}));
      const label = lk ? lk : `${sqft.toLocaleString()} pies²`;
      say(`¿El tamaño aproximado del techo es ${label}?`,'ROOF'); setLoading(false); return;
    }

    if (step === 'INTEREST') {
      const isYes = /\b(s[ií]|yes|correcto|exacto|confirmado|dale|ok|okay|adelante|bien|perfecto|claro|vamos|listo|interesa)\b/.test(r);
      const isNo  = /\bno\b/.test(r) || ['nope','nel','negativo','mejor no','ahora no'].some(w=>r.includes(w));
      if (isYes) {
        say('¡Excelente! Para ponerte en contacto con un consultor, necesito tu nombre completo:','NAME');
        setStep('NAME'); setLoading(false); return;
      } else if (isNo) {
        say('Ok, perfecto. Lamentamos que en este momento la energía renovable no sea una opción atractiva para tu negocio. Si cambias de opinión en el futuro, ya sabes donde encontrarnos. ¡Que tengas un excelente día! 🌞','DONE');
        setStep('DONE'); setLoading(false); return;
      } else {
        if (bump('¿Te interesa explorar esto más a fondo? (sí/no)')) return; return;
      }
    }

    if (step === 'NAME') {
      const isYes = /\b(s[ií]|yes|correcto|exacto|confirmado|dale|ok|okay|adelante|bien|perfecto)\b/.test(r);
      const isNo  = /\bno\b/.test(r);
      if (data.nombre_pending !== undefined) {
        if (isYes) {
          setData(p=>({...p,nombre:p.nombre_pending,nombre_pending:undefined}));
          say('¿Y tu número de teléfono?','PHONE'); setStep('PHONE'); setLoading(false); return;
        } else {
          setData(p=>({...p,nombre_pending:undefined}));
          say('Por favor ingresa tu nombre completo:','NAME'); setLoading(false); return;
        }
      }
      const words = txt.trim().split(/\s+/).filter(w=>w.length>1);
      if (words.length < 2) { if (bump('Por favor ingresa tu nombre y apellido completos:')) return; return; }
      const name = words.map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase()).join(' ');
      setData(p=>({...p,nombre_pending:name}));
      say(`¿Tu nombre es ${name}?`,'NAME'); setLoading(false); return;
    }

    if (step === 'PHONE') {
      const isYes = /\b(s[ií]|yes|correcto|exacto|confirmado|dale|ok|okay|adelante|bien|perfecto)\b/.test(r);
      const digits = txt.replace(/\D/g,'');
      if (data.phone_pending !== undefined) {
        if (isYes) {
          setData(p=>({...p,phone:p.phone_pending,phone_pending:undefined}));
          const firstName = data.nombre ? data.nombre.split(' ')[0] : data.nombre;
          say(`¡Perfecto, ${firstName}! 🎉\n\nUn consultor de Windmar, certificado en proyectos comerciales, estará poniéndose en contacto contigo al ${data.phone_pending} muy pronto.\n\nMientras tanto, por favor llena el siguiente cuestionario para generarte una cotización más precisa:\n\n🔗 https://www.windmar.com/cuestionario?lead=${encodeURIComponent(data.nombre)}&kwh=${data.consumo_kwh}&roof=${data.roof_sqft}&municipio=${encodeURIComponent(data.municipio)}\n\n¡Gracias por la oportunidad de estimar un sistema para tu negocio con Energía de la Buena™. ¡Que tengas un excelente día! 🌞`,'DONE');
          setStep('DONE'); setLoading(false); return;
        } else {
          setData(p=>({...p,phone_pending:undefined}));
          say('Por favor ingresa tu número de teléfono:','PHONE'); setLoading(false); return;
        }
      }
      if (digits.length < 10) { if (bump('Por favor ingresa un número de teléfono válido (10 dígitos):')) return; return; }
      const fmt = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
      setData(p=>({...p,phone_pending:fmt}));
      say(`¿Tu teléfono es ${fmt}?`,'PHONE'); setLoading(false); return;
    }

    if (step === 'DONE') { setLoading(false); return; }

    setLoading(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-yellow-50 to-orange-50">
      <div className="bg-gradient-to-r from-orange-500 to-yellow-400 text-white p-4 shadow-lg flex items-center gap-3">
        <Sun size={28} className="text-white" />
        <div>
          <h1 className="text-xl font-bold">Cotización Solar — Windmar</h1>
          <p className="text-xs opacity-90">Estimado instantáneo para tu negocio</p>
        </div>
        {testMode && (
          <span className="ml-auto text-xs bg-orange-700 bg-opacity-60 rounded px-2 py-1">
            🧪 MODO PRUEBA · Step: {step}
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m,i)=>(
              <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                {m.type === 'ocr_review' ? (
                  <div className="w-full max-w-lg">
                    {testMode && (
                      <div className="text-xs font-mono text-orange-400 mb-1">step: {m.step}</div>
                    )}
                    <OCRReviewCard
                      data={m.ocrData ?? data}
                      checkedFields={m.locked ? [] : checkedFields}
                      onToggle={m.locked ? ()=>{} : toggleField}
                      disabled={!!m.locked}
                    />
                    <div className="text-xs text-gray-400 mt-1 ml-1">
                      {m.timestamp.toLocaleTimeString('es-PR',{hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                ) : m.type === 'estimate_card' ? (
                  <div className="w-full max-w-lg">
                    {testMode && (
                      <div className="text-xs font-mono text-orange-400 mb-1">step: {m.step}</div>
                    )}
                    <EstimateCard est={m.estData} municipio={m.municipio} />
                    <div className="text-xs text-gray-400 mt-1 ml-1">
                      {m.timestamp.toLocaleTimeString('es-PR',{hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                ) : (
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap shadow-sm ${
                    m.role==='user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-100'
                  }`}>
                    {testMode && m.role==='assistant' && (
                      <div className="text-xs font-mono text-orange-400 mb-1">step: {m.step}</div>
                    )}
                    {m.content}
                    <div className={`text-xs mt-1 ${m.role==='user'?'text-blue-100':'text-gray-400'}`}>
                      {m.timestamp.toLocaleTimeString('es-PR',{hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
                  <Loader2 className="animate-spin text-orange-400" size={20}/>
                </div>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          <div className="p-3 bg-white border-t border-gray-200">
            <div className="flex gap-2 items-center">
              <input type="file" ref={fileRef} onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,image/*" className="hidden"/>
              <button
                onClick={()=>fileRef.current?.click()}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                title="Subir factura PDF o foto"
              >
                <Upload size={18} className="text-gray-500"/>
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyPress={e=>e.key==='Enter'&&!loading&&handleSend()}
                placeholder={step==='DONE' ? (testMode ? '/restart para reiniciar' : 'Sesión completada') : 'Escribe tu respuesta...'}
                disabled={loading||(step==='DONE'&&!testMode)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50"
              />
              <button
                onClick={handleSend}
                disabled={loading||!input.trim()||(step==='DONE'&&!testMode)}
                className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-40"
              >
                <Send size={18}/>
              </button>
            </div>
            <div className="mt-2 flex justify-end">
              <button onClick={()=>setTestMode(p=>!p)} className="text-xs text-gray-400 hover:text-gray-600">
                {testMode?'🔴 Ocultar debug':'🧪 Modo prueba'}
              </button>
            </div>
          </div>
        </div>

        {testMode && (
          <div className="w-64 border-l border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">🔍 Debug Panel</span>
            </div>
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Current Step:</p>
              <p className="text-sm font-mono font-bold text-orange-500">{step}</p>
            </div>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Checked Fields:</p>
              <p className="text-xs font-mono text-red-500">{checkedFields.length > 0 ? checkedFields.join(', ') : '—'}</p>
            </div>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Fix Queue:</p>
              <p className="text-xs font-mono text-blue-500">{fixQueue.length > 0 ? fixQueue.join(' → ') : '—'}</p>
            </div>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Guided Mode:</p>
              <p className="text-xs font-mono text-purple-500">{guidedMode ? 'YES' : 'no'}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Session Data:</p>
              <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
