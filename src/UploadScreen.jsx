import { useState, useRef, useEffect } from "react";
import { Header, ProgressBar } from "./shared.jsx";

// ─── Checklist items & progress thresholds ─────────────────────────────────
const CHECKLIST = [
  { text: "Leyendo documento",           threshold: 25 },
  { text: "Identificando tarifa LUMA",   threshold: 55 },
  { text: "Extrayendo consumo y demanda", threshold: 80 },
  { text: "Calculando costo por kWh",    threshold: 100 },
];

function getStepLabel(pct) {
  if (pct < 25)  return "Leyendo factura…";
  if (pct < 55)  return "Identificando tarifa…";
  if (pct < 80)  return "Extrayendo consumo y demanda…";
  return "¡Análisis completado!";
}

// ─── Number formatter ───────────────────────────────────────────────────────
const fmtNum = (val, minDec, maxDec) => {
  const n = parseFloat(String(val).replace(/[$,]/g, ""));
  if (isNaN(n)) return String(val);
  return n.toLocaleString("en-US", { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
};

// ─── Review-screen field definitions ───────────────────────────────────────
// suffix: appended on the "Leído:" display line only (not in the input)
const FIELDS = [
  { key: "nombreNegocio", label: "Nombre del negocio", type: "input",    suffix: ""       },
  { key: "direccion",    label: "Dirección",           type: "textarea", suffix: ""       },
  { key: "municipio",   label: "Municipio",            type: "input",    suffix: ""       },
  { key: "tariff",      label: "Tarifa LUMA",        type: "input",    suffix: ""       },
  { key: "consumoKWH",  label: "Consumo promedio",   type: "input",    suffix: ""       },
  { key: "demandaKVA",  label: "Demanda contratada", type: "input",    suffix: ""       },
  { key: "totalFactura",label: "Total facturado",    type: "input",    suffix: ""       },
  { key: "costoPorKWH", label: "Costo por kWh",      type: "input",    suffix: " $/kWh" },
];

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
    padding: "32px 24px 48px",
    maxWidth: "480px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  h1: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#1B3F8B",
    marginBottom: "8px",
    marginTop: 0,
  },
  sub: {
    fontSize: "16px",
    color: "#374151",
    lineHeight: "1.6",
    marginBottom: "24px",
    marginTop: 0,
  },
  // ── idle ──
  dropZone: {
    backgroundColor: "#ffffff",
    border: "2px dashed #93c5fd",
    borderRadius: "16px",
    padding: "48px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "background-color 0.2s, border-color 0.2s",
    marginBottom: "16px",
  },
  dropZoneDragging: {
    backgroundColor: "#dbeafe",
    borderColor: "#1B3F8B",
  },
  dropText: { fontSize: "17px", fontWeight: "600", color: "#1B3F8B", marginBottom: "6px" },
  dropSub:  { fontSize: "14px", color: "#6b7280" },
  tipsCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "24px",
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
  },
  tipsTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#111827",
    marginBottom: "8px",
    marginTop: 0,
  },
  tipItem: { fontSize: "14px", color: "#374151", marginBottom: "4px" },
  // ── processing ──
  fileChip: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "24px",
    fontSize: "14px",
    color: "#374151",
  },
  processingCard: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "24px",
  },
  processingTrack: {
    height: "10px",
    backgroundColor: "#e5e7eb",
    borderRadius: "5px",
    overflow: "hidden",
    marginBottom: "10px",
  },
  stepLabel: {
    fontSize: "14px",
    color: "#1B3F8B",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: "20px",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 0",
    fontSize: "15px",
  },
  // ── review ──
  reviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "20px 24px",
    marginBottom: "20px",
  },
  fieldGroup: { marginBottom: "18px" },
  fieldLabel: {
    display: "block",
    fontSize: "11px",
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    marginBottom: "4px",
  },
  fieldExtracted: {
    fontSize: "13px",
    color: "#9ca3af",
    marginBottom: "6px",
    paddingLeft: "2px",
  },
  fieldInput: {
    width: "100%",
    padding: "12px 14px",
    fontSize: "16px",
    backgroundColor: "#dbeafe",
    border: "2px solid #93c5fd",
    borderRadius: "10px",
    color: "#1e3a8a",
    boxSizing: "border-box",
    fontFamily: "inherit",
    outline: "none",
  },
  fieldTextarea: {
    width: "100%",
    padding: "12px 14px",
    fontSize: "16px",
    backgroundColor: "#dbeafe",
    border: "2px solid #93c5fd",
    borderRadius: "10px",
    color: "#1e3a8a",
    boxSizing: "border-box",
    fontFamily: "inherit",
    resize: "vertical",
    minHeight: "72px",
    outline: "none",
  },
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
  btnGhost: {
    width: "100%",
    padding: "14px",
    fontSize: "16px",
    color: "#1B3F8B",
    backgroundColor: "transparent",
    border: "2px solid #1B3F8B",
    borderRadius: "10px",
    cursor: "pointer",
    display: "block",
  },
};

// ─── Normalize server OCR response → internal field names ──────────────────
function normalizeOCR(data) {
  const consumos = Array.isArray(data.consumos_mensuales) ? data.consumos_mensuales : [];
  const tasas    = Array.isArray(data.tasas_mensuales)    ? data.tasas_mensuales    : [];

  // Pair months, keep only non-zero consumption readings
  const nonZero = consumos
    .map((c, i) => ({ c, t: tasas[i] ?? 0 }))
    .filter(p => p.c > 0);

  // Average monthly consumption from non-zero bars
  const consumoPromedio = nonZero.length > 0
    ? nonZero.reduce((s, p) => s + p.c, 0) / nonZero.length
    : (data.consumo_promedio ?? 0);

  // Average monthly bill = Σ(consumo_i × tasa_i) / total_months
  // Divide by consumos.length (all bars incl. zero months) not nonZero.length,
  // because a zero-consumption month still counts toward the annual average.
  const avgMonthlyBill = nonZero.length > 0 && nonZero.some(p => p.t > 0)
    ? nonZero.reduce((s, p) => s + p.c * p.t, 0) / consumos.length
    : (data.total_adeudado ?? 0);

  // Fixed non-solar-offsettable charges (last month used as monthly proxy)
  const cargoCliente = data.cargo_cliente      ?? 0;
  const cargoDemanda = data.cargo_demanda      ?? 0;
  const excesoUSD    = data.exceso_demanda_usd ?? 0;
  const excesoKVA    = data.exceso_demanda_kva ?? 0;

  // Effective energy-only rate
  const avgEnergyOnly  = avgMonthlyBill - cargoCliente - cargoDemanda - excesoUSD;
  const effectiveRate  = consumoPromedio > 0 ? avgEnergyOnly / consumoPromedio : 0;

  return {
    nombreNegocio: data.nombre_negocio    ?? "",
    direccion:    data.address            ?? "",
    municipio:    data.municipio          ?? "",
    tariff:       data.tarifa             ?? "",
    consumoKWH:   consumoPromedio > 0     ? fmtNum(consumoPromedio, 0, 0) + " kWh" : "",
    demandaKVA:   data.demanda_contratada != null ? fmtNum(data.demanda_contratada, 0, 2) + " kVA" : "",
    totalFactura: avgMonthlyBill  > 0     ? "$" + fmtNum(avgMonthlyBill,  2, 2) : "",
    costoPorKWH:  effectiveRate   > 0     ? fmtNum(effectiveRate,          4, 4) : "",
    // Pass-through for savings calculation — not shown on review screen
    cargoCliente,
    cargoDemanda,
    excesoUSD,
    excesoKVA,
  };
}

// ─── Mock OCR data (dev bypass) ─────────────────────────────────────────────
const MOCK_OCR = {
  nombreNegocio: "MOC OCR BIZ NAME",
  direccion:     "PONCE BY PASS PONCE, PONCE PR 00730",
  municipio:     "Ponce",
  tariff:        "Servicio Comercial General a Distribución Primaria",
  consumoKWH:    "38,880 kWh",
  demandaKVA:    "150.00 kVA",
  totalFactura:  "$10,599.08",
  costoPorKWH:   "0.2479",
  cargoCliente:  200,
  cargoDemanda:  769.50,
  excesoUSD:     0,
  excesoKVA:     0,
};

// ─── UploadScreen ───────────────────────────────────────────────────────────
export default function UploadScreen({ onNext, onBack }) {
  const [stage, setStage]           = useState("idle");      // idle | processing | done
  const [file, setFile]             = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress]     = useState(0);
  const [fields, setFields]         = useState({
    nombreNegocio: "", direccion: "", municipio: "", tariff: "",
    consumoKWH: "", demandaKVA: "", totalFactura: "", costoPorKWH: "",
    cargoCliente: 0, cargoDemanda: 0, excesoUSD: 0, excesoKVA: 0,
  });
  const [extractedRaw, setExtractedRaw] = useState({});

  const fileInputRef = useRef(null);
  const intervalRef  = useRef(null);

  // Cleanup interval on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // ── Start the upload + OCR flow ──────────────────────────────────────────
  const runProcessing = (selectedFiles) => {
    setStage("processing");
    setProgress(0);

    // Use local vars to avoid stale closure issues in the setInterval callback
    let pct = 0;
    let ocrDone = false;
    let ocrResult = null;

    const fd = new FormData();
    Array.from(selectedFiles).forEach((f) => fd.append("bills", f));
    fetch("/api/ocr", { method: "POST", body: fd })
      .then((r) => r.json())
      .then(({ data }) => { ocrDone = true; ocrResult = data || {}; })
      .catch(()      => { ocrDone = true; ocrResult = {}; });

    intervalRef.current = setInterval(() => {
      // Pause at 92% while waiting for OCR; sprint to 100% once done
      if (!ocrDone && pct >= 92) return;

      const speed = ocrDone ? 5 : pct < 70 ? 1.8 : 0.6;
      pct = Math.min(pct + speed, 100);
      setProgress(Math.round(pct));

      if (pct >= 100) {
        clearInterval(intervalRef.current);
        const normalized = normalizeOCR(ocrResult || {});
        setTimeout(() => {
          setExtractedRaw(normalized);
          setFields(normalized);
          setStage("done");
        }, 600);
      }
    }, 100);
  };

  const handleFileChange = (files) => {
    if (!files || files.length === 0) return;
    setFile(files);
    runProcessing(files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFileChange(e.dataTransfer.files);
  };

  const handleMockOCR = () => {
    onNext(MOCK_OCR, null);
  };

  const resetToIdle = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStage("idle");
    setFile(null);
    setProgress(0);
  };

  // ── IDLE ─────────────────────────────────────────────────────────────────
  if (stage === "idle") {
    return (
      <div style={S.page}>
        <Header />
        <ProgressBar current={2} total={6} />
        <div style={S.content}>
          <h1 style={S.h1}>Sube tu factura de LUMA</h1>
          <p style={S.sub}>
            Toma una foto, o selecciona un PDF de tu factura más reciente.
            Nosotros nos encargamos del resto.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFileChange(e.target.files)}
          />

          <div
            style={{ ...S.dropZone, ...(isDragging ? S.dropZoneDragging : {}) }}
            onClick={() => fileInputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div style={{ width: "100px", height: "100px", overflow: "hidden", margin: "0 auto 16px" }}>
              <img src="/paperclip_icon.png" alt="" style={{ width: "100px", height: "100px", objectFit: "contain", transform: "scale(1.6)", transformOrigin: "center" }} />
            </div>
            <div style={S.dropText}>Selecciona un archivo</div>
            <div style={S.dropSub}>Foto(s) o PDF · puedes seleccionar varias páginas</div>
          </div>

          <div style={S.tipsCard}>
            <div style={{ width: "112px", height: "112px", overflow: "hidden", flexShrink: 0 }}>
              <img src="/lightbulb.png" alt="" style={{ width: "112px", height: "112px", objectFit: "contain", transform: "scale(1.5)", transformOrigin: "center" }} />
            </div>
            <div>
              <p style={S.tipsTitle}>Para mejores resultados...</p>
              <div style={S.tipItem}>• Sube una factura reciente</div>
              <div style={S.tipItem}>• Si es foto, tómala con buena luz</div>
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <button
              onClick={handleMockOCR}
              style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
            >
              usar datos de prueba
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── PROCESSING ───────────────────────────────────────────────────────────
  if (stage === "processing") {
    const fileList  = file ? Array.from(file) : [];
    const stepLabel = getStepLabel(progress);

    return (
      <div style={S.page}>
        <Header />
        <ProgressBar current={2} total={6} />
        <div style={S.content}>
          <h1 style={S.h1}>Analizando factura…</h1>

          <div style={S.fileChip}>
            <div style={{ width: "77px", height: "77px", overflow: "hidden", flexShrink: 0 }}>
              <img src="/utility_bill_cropped.jpg" alt="" style={{ width: "77px", height: "77px", objectFit: "contain", transform: "scale(2.25)", transformOrigin: "center 48%" }} />
            </div>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fileList.length === 1
                ? fileList[0].name
                : `${fileList.length} archivos seleccionados`}
            </span>
            <img src="/listo_icon.jpg" alt="" style={{ width: "132px", height: "132px", objectFit: "contain" }} />
          </div>

          <div style={S.processingCard}>
            <div style={S.processingTrack}>
              <div style={{
                height: "100%",
                backgroundColor: "#F5A623",
                borderRadius: "5px",
                width: `${progress}%`,
                transition: "width 0.3s ease",
              }} />
            </div>
            <div style={S.stepLabel}>{stepLabel}</div>

            {CHECKLIST.map(({ text, threshold }, i) => {
              const done = progress >= threshold;
              return (
                <div
                  key={i}
                  style={{
                    ...S.checkRow,
                    color: done ? "#1B3F8B" : "#9ca3af",
                    fontWeight: done ? "600" : "400",
                    borderBottom: i < CHECKLIST.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}
                >
                  {done
                    ? <img src="/listo_icon.jpg" alt="" style={{ width: "72px", height: "72px", objectFit: "contain", flexShrink: 0 }} />
                    : <img src="/hourglass.png" alt="" style={{ width: "44px", height: "44px", objectFit: "contain", flexShrink: 0 }} />
                  }
                  <span>{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── REVIEW (done) ────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <Header />
      <ProgressBar current={2} total={6} />
      <div style={S.content}>
        <h1 style={S.h1}>¡Factura procesada!</h1>
        <p style={S.sub}>
          Revisa lo que leí, y corrige lo necesario únicamente.
        </p>

        <div style={S.reviewCard}>
          {FIELDS.map(({ key, label, type, suffix }) => (
            <div key={key} style={S.fieldGroup}>
              <span style={S.fieldLabel}>{label}</span>
              <div style={S.fieldExtracted}>
                Leído: {extractedRaw[key] ? extractedRaw[key] + suffix : "—"}
              </div>
              {type === "textarea" ? (
                <textarea
                  style={S.fieldTextarea}
                  value={fields[key]}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                />
              ) : (
                <input
                  style={S.fieldInput}
                  type="text"
                  value={fields[key]}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>

        <button style={S.btnOrange} onClick={() => onNext(fields, file)}>
          Todo bien. Listo
        </button>
        <button style={S.btnGhost} onClick={resetToIdle}>
          Subir otra factura
        </button>
      </div>
    </div>
  );
}
