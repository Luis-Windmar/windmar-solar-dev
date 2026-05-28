import { useState, useRef, useEffect } from "react";
import { Header, ProgressBar } from "./shared.jsx";
import { normalizeLumaTariff, defaultDemandKva } from "./sizing/tariff.js";
import { TEST_MODE } from "./testMode.js";

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

// ─── Tariff display formatter ──────────────────────────────────────────────
// The OCR + handleFieldBlur store the canonical lowercase form in
// fields.tariff ('primaria', 'secundaria', 'transmision', 'residencial').
// The review-card input shows the title-cased Spanish display form (with
// the accent restored for transmisión). Mid-edit values and unrecognized
// text pass through unchanged so the rep can type/backspace freely
// without the input fighting them.
const TARIFF_DISPLAY = {
  residencial: "Residencial",
  secundaria:  "Secundaria",
  primaria:    "Primaria",
  transmision: "Transmisión",
};
const displayTariff = (value) => TARIFF_DISPLAY[value] || value || "";

// ─── Review-screen field definitions ───────────────────────────────────────
// All fields render regardless of tariff. The rep may need to correct any
// field — including adding demand values to a bill OCR classified as
// Secundaria but should be Primaria.
const FIELDS = [
  { key: "nombreNegocio", label: "Nombre del negocio", type: "input"    },
  { key: "direccion",    label: "Dirección",           type: "textarea" },
  { key: "municipio",   label: "Municipio",            type: "input"    },
  { key: "tariff",      label: "Tarifa LUMA",          type: "input"    },
  { key: "consumoKWH",  label: "Consumo promedio",    type: "input"    },
  { key: "demandaKVA",  label: "Demanda contratada",  type: "input"    },
  { key: "excesoKVA",   label: "Exceso de demanda",   type: "input"    },
  { key: "totalFactura",label: "Total facturado",     type: "input"    },
  { key: "costoPorKWH", label: "Costo por kWh",       type: "input"    },
];

// Tariff normalization is owned by src/sizing/tariff.js (imported above)
// — the single canonical helper used everywhere in the Wizard.

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
  btnNavy: {
    width: "100%",
    padding: "16px",
    fontSize: "18px",
    fontWeight: "600",
    color: "#ffffff",
    backgroundColor: "#1B3F8B",
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
  const cargoCliente = data.cargo_cliente         ?? 0;
  const cargoDemanda = data.cargo_demanda         ?? 0;
  const excesoUSD    = data.exceso_demanda_usd    ?? 0;
  const excesoKVA    = data.exceso_de_demanda_kva ?? 0;

  // Effective energy-only rate
  const avgEnergyOnly  = avgMonthlyBill - cargoCliente - cargoDemanda - excesoUSD;
  const effectiveRate  = consumoPromedio > 0 ? avgEnergyOnly / consumoPromedio : 0;

  // Floor demand at the regulatory cap for the detected tariff — 25 kVA
  // for Residencial, 50 kVA for Secundaria / Primaria / Transmisión /
  // unknown. By applying the floor here (instead of inside EstimateScreen
  // only), the value flows through to the Zoho payload too. If the rep
  // edits the field on the review card, handleFieldChange overwrites
  // both demandaKVA and carga_contratada_kva with the new value.
  const cargaContratada = data.carga_contratada_kva ?? defaultDemandKva(data.tarifa);

  // exceso_de_demanda_kva legitimately defaults to 0 (no excess demand).
  const excesoKvaRaw = data.exceso_de_demanda_kva ?? 0;

  // TEST_MODE prefixes every real OCR result with "TEST - " so reps can spot
  // demo records easily. Production strips the prefix entirely.
  const prefix = TEST_MODE ? "TEST - " : "";
  return {
    nombreNegocio: data.nombre_negocio ? prefix + data.nombre_negocio : prefix,
    direccion:    data.direccion       ? prefix + data.direccion       : prefix,
    municipio:    data.municipio          ?? "",
    tariff:       normalizeLumaTariff(data.tarifa) || "",
    consumoKWH:   consumoPromedio > 0     ? fmtNum(consumoPromedio, 0, 0) + " kWh" : "",
    demandaKVA:   fmtNum(cargaContratada, 0, 2) + " kVA",
    excesoKVA:    fmtNum(excesoKvaRaw,    0, 2) + " kVA",
    totalFactura: avgMonthlyBill  > 0     ? "$" + fmtNum(avgMonthlyBill,  2, 2) : "",
    costoPorKWH:  effectiveRate   > 0     ? fmtNum(effectiveRate,          4, 4) : "",
    // Hidden pass-throughs used by EstimateScreen's savings calc.
    cargoCliente,
    cargoDemanda,
    excesoUSD,
    // Raw numeric OCR fields used by EstimateScreen for the demand cap.
    // carga_contratada_kva is floored at 50 (above) so it never reaches Zoho
    // as null. exceso_de_demanda_kva defaults to 0 (no excess).
    carga_contratada_kva:  cargaContratada,
    exceso_de_demanda_kva: excesoKvaRaw,
  };
}

// ─── Mock OCR data (dev bypass) ─────────────────────────────────────────────
// Mirrors the shape of normalizeOCR's output so the "usar datos de prueba"
// bypass behaves identically to a real OCR response — including the raw
// numeric fields EstimateScreen reads for the demand cap, the formatted
// excesoKVA display string, and the canonical tariff value.
const MOCK_OCR = {
  nombreNegocio: "TEST - MOC OCR BIZ NAME", // TODO: remove before production
  direccion:     "TEST - PONCE BY PASS PONCE, PONCE PR 00730", // TODO: remove before production
  municipio:     "Ponce",
  tariff:        "primaria",
  consumoKWH:    "38,880 kWh",
  demandaKVA:    "150.00 kVA",
  excesoKVA:     "0.00 kVA",
  totalFactura:  "$10,599.08",
  costoPorKWH:   "0.2479",
  cargoCliente:  200,
  cargoDemanda:  769.50,
  excesoUSD:     0,
  // Raw numeric companions — must match the formatted display values above.
  carga_contratada_kva:  150,
  exceso_de_demanda_kva: 0,
};

// ─── Client-side image compression ──────────────────────────────────────────
// Vercel serverless functions have a 4.5 MB inbound edge limit.
// Images (phone photos) are compressed to fit. PDFs cannot be compressed here.
const MAX_OCR_BYTES = 4 * 1024 * 1024; // 4 MB — leave 0.5 MB margin

async function compressImageFile(file) {
  if (!file.type.startsWith('image/') || file.size <= MAX_OCR_BYTES) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.sqrt(MAX_OCR_BYTES / file.size) * 0.92; // extra margin
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg',
        0.88
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// ─── UploadScreen ───────────────────────────────────────────────────────────
export default function UploadScreen({ onNext, onBack, resumeData }) {
  const [stage, setStage]           = useState(resumeData ? "done" : "idle");
  const [file, setFile]             = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress]     = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [fields, setFields]         = useState(resumeData || {
    nombreNegocio: "", direccion: "", municipio: "", tariff: "",
    consumoKWH: "", demandaKVA: "", totalFactura: "", costoPorKWH: "",
    cargoCliente: 0, cargoDemanda: 0, excesoUSD: 0, excesoKVA: 0,
  });
  const [extractedRaw, setExtractedRaw] = useState(resumeData || {});

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
    let payloadTooLarge = false;

    // Tool Belt /api/v1/ocr/luma-bill accepts one file per request. For
    // multi-page bills the client fans out and merges results (first non-null
    // value per field wins, so a multi-page bill where each page contributes
    // different fields produces a complete object).
    const files = Array.from(selectedFiles);
    Promise.all(
      files.map((f) => {
        const fd = new FormData();
        fd.append("bill", f);
        return fetch("/api/ocr-luma-bill", { method: "POST", body: fd })
          .then((r) => r.json().then((body) => ({ status: r.status, body })))
          .catch(()  => ({ status: 0, body: {} }));
      })
    ).then((results) => {
      // 413 anywhere → surface the Spanish error and reset to idle.
      if (results.some((r) => r.status === 413)) {
        payloadTooLarge = true;
        ocrDone = true;
        ocrResult = {};
        return;
      }
      // Merge: first non-null value for each field across all responses.
      const merged = {};
      for (const r of results) {
        const data = (r.body && r.body.data) || {};
        for (const [k, v] of Object.entries(data)) {
          if (merged[k] == null && v != null) merged[k] = v;
        }
      }
      ocrDone = true;
      ocrResult = merged;
    });

    intervalRef.current = setInterval(() => {
      // Pause at 92% while waiting for OCR; sprint to 100% once done
      if (!ocrDone && pct >= 92) return;

      const speed = ocrDone ? 5 : pct < 70 ? 1.8 : 0.6;
      pct = Math.min(pct + speed, 100);
      setProgress(Math.round(pct));

      if (pct >= 100) {
        clearInterval(intervalRef.current);
        if (payloadTooLarge) {
          setUploadError("La factura excede el tamaño máximo de 4MB. Por favor usa un archivo más pequeño.");
          setStage("idle");
          setFile(null);
          setProgress(0);
          return;
        }
        const normalized = normalizeOCR(ocrResult || {});
        setTimeout(() => {
          setExtractedRaw(normalized);
          setFields(normalized);
          setStage("done");
        }, 600);
      }
    }, 100);
  };

  const handleFileChange = async (files) => {
    if (!files || files.length === 0) return;
    setUploadError("");
    const arr = Array.from(files);

    // PDFs over the limit can't be compressed in-browser — block early
    const bigPdf = arr.find(f => f.type === 'application/pdf' && f.size > MAX_OCR_BYTES);
    if (bigPdf) {
      const mb = (bigPdf.size / 1024 / 1024).toFixed(1);
      setUploadError(`El PDF es demasiado grande (${mb} MB). Las facturas de LUMA no deben exceder 4 MB. Descarga la factura directamente desde luma.com, o toma una foto con tu teléfono y súbela como imagen.`);
      return;
    }

    // Compress large images (phone photos) before upload
    const compressed = await Promise.all(arr.map(compressImageFile));
    setFile(compressed);
    runProcessing(compressed);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFileChange(e.dataTransfer.files);
  };

  const handleMockOCR = () => {
    setExtractedRaw(MOCK_OCR);
    setFields(MOCK_OCR);
    setStage("done");
  };

  const resetToIdle = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStage("idle");
    setFile(null);
    setProgress(0);
    setUploadError("");
  };

  // When the rep edits a review-card field, write to the formatted display
  // string AND keep the raw numeric companion fields in sync. EstimateScreen
  // reads the raw numbers directly for the demand cap, so without this sync
  // the rep's correction would be silently ignored.
  const handleFieldChange = (key, value) => {
    setFields((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "demandaKVA") {
        const parsed = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
        next.carga_contratada_kva = Number.isFinite(parsed) ? parsed : null;
      }
      if (key === "excesoKVA") {
        const parsed = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
        next.exceso_de_demanda_kva = Number.isFinite(parsed) ? parsed : 0;
      }
      return next;
    });
  };

  // On blur, normalize free-text tariff input to its canonical form
  // (residencial | secundaria | primaria | transmision — lowercase ASCII).
  // Doing this on blur rather than every keystroke avoids fighting the
  // user's typing / backspacing mid-edit. Leaves unrecognized text as-is
  // so the rep can fix typos without the input snapping to empty.
  const handleFieldBlur = (key, value) => {
    if (key === "tariff") {
      const normalized = normalizeLumaTariff(value);
      if (normalized && normalized !== value) {
        setFields((prev) => ({ ...prev, tariff: normalized }));
      }
    }
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

          {uploadError && (
            <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "10px", padding: "12px 16px", fontSize: "14px", color: "#dc2626", marginBottom: "16px" }}>
              {uploadError}
            </div>
          )}

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
              <div style={S.tipItem}>• Archivo de menos de 4MB</div>
            </div>
          </div>

          <button style={{ ...S.btnGhost, marginTop: "16px" }} onClick={onBack}>
            Atrás
          </button>

          {/* TEST_MODE bypass — skips OCR and injects MOCK_OCR. Hidden in
              production; MOCK_OCR + handleMockOCR remain defined for dev use. */}
          {TEST_MODE && (
            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <button
                onClick={handleMockOCR}
                style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
              >
                usar datos de prueba
              </button>
            </div>
          )}

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
          {FIELDS.map(({ key, label, type }) => (
            <div key={key} style={S.fieldGroup}>
              <span style={S.fieldLabel}>{label}</span>
              {type === "textarea" ? (
                <textarea
                  style={S.fieldTextarea}
                  value={fields[key]}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  onBlur={(e) => handleFieldBlur(key, e.target.value)}
                />
              ) : (
                <input
                  style={S.fieldInput}
                  type="text"
                  value={key === "tariff" ? displayTariff(fields.tariff) : fields[key]}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  onBlur={(e) => handleFieldBlur(key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <button style={S.btnNavy} onClick={() => onNext(fields, file)}>
          Todo bien. Listo
        </button>
        <button style={S.btnGhost} onClick={resetToIdle}>
          Atrás
        </button>
      </div>
    </div>
  );
}
