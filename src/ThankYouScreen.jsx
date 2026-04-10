import { useState, useEffect, useRef } from "react";
import { Header } from "./shared.jsx";

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
    padding: "48px 24px",
    maxWidth: "480px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "40px 28px",
    textAlign: "center",
    width: "100%",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  iconWrap: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  iconWrapGray: { backgroundColor: "#f3f4f6" },
  h1: { fontSize: "26px", fontWeight: "700", color: "#1B3F8B", marginBottom: "12px", marginTop: 0 },
  sub: { fontSize: "16px", color: "#374151", lineHeight: "1.6", marginBottom: "28px", marginTop: 0 },
  btnOrange: {
    width: "100%", padding: "16px", fontSize: "18px", fontWeight: "600",
    color: "#ffffff", backgroundColor: "#F5A623", border: "none", borderRadius: "10px",
    cursor: "pointer", marginBottom: "12px", display: "block",
    textDecoration: "none", textAlign: "center", boxSizing: "border-box",
  },
  btnOrangeDisabled: {
    width: "100%", padding: "16px", fontSize: "18px", fontWeight: "600",
    color: "#ffffff", backgroundColor: "#d1d5db", border: "none", borderRadius: "10px",
    cursor: "not-allowed", marginBottom: "12px", display: "block",
    textAlign: "center", boxSizing: "border-box",
  },
  btnNavy: {
    width: "100%", padding: "16px", fontSize: "18px", fontWeight: "600",
    color: "#ffffff", backgroundColor: "#1B3F8B", border: "none", borderRadius: "10px",
    cursor: "pointer", marginBottom: "12px", display: "block",
    textDecoration: "none", textAlign: "center", boxSizing: "border-box",
  },
  btnGhost: {
    width: "100%", padding: "14px", fontSize: "16px", color: "#1B3F8B",
    backgroundColor: "transparent", border: "2px solid #1B3F8B", borderRadius: "10px",
    cursor: "pointer", display: "block", boxSizing: "border-box",
  },
  pdfStatus: { fontSize: "13px", color: "#1B3F8B", marginTop: "-6px", marginBottom: "12px", minHeight: "18px", display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" },
  pdfStatusError: { fontSize: "13px", color: "#dc2626", marginTop: "-6px", marginBottom: "12px", minHeight: "18px" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtUSD = (n) =>
  "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ─── PDF coordinate maps (origin = bottom-left, 612×792pt page) ──────────────
// Calibrated against each template. Adjust after first test output if needed.

const COORDS_FINANCING = {
  // ── Info section ───────────────────────────────────────────────────────────
  numero:      { x: 355, y: 631, size: 9  },
  cliente:     { x: 355, y: 609, size: 9  },
  negocio:     { x: 355, y: 587, size: 9  },
  telefono:    { x: 355, y: 565, size: 9  },
  // ── Tu Estimado — left column ──────────────────────────────────────────────
  capacidad:   { x: 143, y: 505, size: 10 },
  cubre:       { x: 143, y: 467, size: 10 },
  precio:      { x: 143, y: 429, size: 10 },
  // ── Tu Estimado — savings highlight (centered in navy box) ─────────────────
  ahorro:      { x: 432, y: 458, size: 34, center: true },
  // ── Prefieres Financiar — right column ─────────────────────────────────────
  prontoPago:  { x: 406, y: 359, size: 10 },
  pagoMensual: { x: 406, y: 319, size: 10 },
  ahorroFin:   { x: 406, y: 282, size: 10 },
};

// Cash template coordinates — calibrate after first test output
const COORDS_CASH = {
  // ── Info section ───────────────────────────────────────────────────────────
  numero:      { x: 355, y: 631, size: 9  },
  cliente:     { x: 355, y: 609, size: 9  },
  negocio:     { x: 355, y: 587, size: 9  },
  telefono:    { x: 355, y: 565, size: 9  },
  // ── Tu Estimado — left column ──────────────────────────────────────────────
  capacidad:   { x: 143, y: 505, size: 10 },
  cubre:       { x: 143, y: 467, size: 10 },
  precio:      { x: 143, y: 429, size: 10 },
  // ── Tu Estimado — savings highlight (centered in navy box) ─────────────────
  ahorro:      { x: 432, y: 458, size: 34, center: true },
};

// ─── PDF generation ───────────────────────────────────────────────────────────
async function generateEstimatePDF(ocrData, sqft, estData, contactData, commercialLeadName, batteryResult) {
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;

  const fetchBytes = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo cargar: ${url}`);
    return new Uint8Array(await res.arrayBuffer());
  };

  const totalPrice    = (estData.systemCost || 0) + (batteryResult?.totalCost || 0);
  const showFinancing = totalPrice >= 60000;

  const wrapperBytes = await fetchBytes("/cotizacion_wrapper.pdf");
  const wrapperDoc   = await PDFDocument.load(wrapperBytes);
  const outDoc       = await PDFDocument.create();

  // Page 1: wrapper cover
  const [coverPage] = await outDoc.copyPages(wrapperDoc, [0]);
  outDoc.addPage(coverPage);

  const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg  = await outDoc.embedFont(StandardFonts.Helvetica);
  const navy   = rgb(0.106, 0.247, 0.545);
  const orange = rgb(0.961, 0.651, 0.137);
  const grey   = rgb(0.25,  0.25,  0.25);

  // Page 2: estimate template (financing = PDF, cash = JPG)
  let estimatePage;
  let COORDS;

  {
    const templateUrl   = showFinancing ? "/Estimate_template_loan.pdf" : "/Estimate_template_cash.pdf";
    const templateBytes = await fetchBytes(templateUrl);
    const templateDoc   = await PDFDocument.load(templateBytes);
    [estimatePage]      = await outDoc.copyPages(templateDoc, [0]);
    outDoc.addPage(estimatePage);
    COORDS = showFinancing ? COORDS_FINANCING : COORDS_CASH;
  }

  // ── Build field values ────────────────────────────────────────────────────
  const negocioName = ocrData?.nombreNegocio || ocrData?.address || ocrData?.direccion || "";
  const quoteNumber = commercialLeadName || "Pendiente";

  const fields = {
    numero:      quoteNumber,
    cliente:     contactData?.nombre  || "",
    negocio:     negocioName.substring(0, 52),
    telefono:    contactData?.phone   || "",
    capacidad:   estData.systemKwp.toLocaleString("en-US") + " kWp",
    cubre:       estData.coverage + "% de tu consumo",
    precio:      fmtUSD(estData.systemCost),
    ahorro:      fmtUSD(estData.savingsCash),
    ...(showFinancing ? {
      prontoPago:  "$0",
      pagoMensual: fmtUSD(estData.monthlyPmt) + " / mes",
      ahorroFin:   fmtUSD(estData.savingsFinanced) + " / mes",
    } : {}),
  };

  // ── Draw each field ───────────────────────────────────────────────────────
  for (const [key, value] of Object.entries(fields)) {
    const c = COORDS[key];
    const isAhorro = key === "ahorro";
    const font  = isAhorro ? fontBold : fontReg;
    const color = isAhorro ? orange   : grey;
    const size  = c.size;

    let x = c.x;
    if (c.center) {
      const textWidth = font.widthOfTextAtSize(value, size);
      x = 310 + (245 - textWidth) / 2;
    }

    estimatePage.drawText(value, { x, y: c.y, font, size, color });
  }

  // Pages 3+: remaining wrapper pages (map + facilities)
  const numWrapper = wrapperDoc.getPageCount();
  if (numWrapper >= 2) {
    const indices = Array.from({ length: numWrapper - 1 }, (_, i) => i + 1);
    const extra = await outDoc.copyPages(wrapperDoc, indices);
    extra.forEach((p) => outDoc.addPage(p));
  }

  return await outDoc.save();
}

// ─── Component ───────────────────────────────────────────────────────────────
const parseNum = (s) => parseFloat(String(s ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, "")) || 0;

const parseAddress = (fullAddress, municipio) => {
  if (!fullAddress) return { street: "", zip: "" };
  // Normalize "BY PASS" → "BYPASS"
  let street = fullAddress.replace(/\bBY\s+PASS\b/gi, "BYPASS");
  // Extract PR zip code (00600–00988)
  const zipMatch = street.match(/\b(00[6-9]\d{2})\b/);
  const zip = zipMatch ? zipMatch[1] : "";
  // Strip trailing "<MUNICIPIO> PR <ZIP>" suffix only — avoids removing city name mid-street
  if (municipio) {
    const escMun = municipio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (zip) {
      street = street.replace(new RegExp(`\\s+${escMun}\\s+PR\\s+${zip}(?:-\\d{4})?\\s*$`, 'i'), "");
    }
    street = street.replace(new RegExp(`\\s+${escMun}\\s+PR\\s*$`, 'i'), "");
    street = street.replace(new RegExp(`\\s+${escMun}\\s*$`, 'i'), "");
  }
  if (zip) street = street.replace(new RegExp(`\\b${zip}(?:-\\d{4})?\\b`), "");
  street = street.replace(/\bPR\b/gi, "");
  street = street.replace(/[,\s]+$/, "").replace(/\s{2,}/g, " ").trim();
  return { street, zip };
};

export default function ThankYouScreen({ interested, contactData, ocrData, sqft, estData, batteryHours, batteryResult, billFiles, onRestart }) {
  const [pdfStatus,  setPdfStatus]  = useState("");
  const [pdfError,   setPdfError]   = useState("");
  const [pdfReady,          setPdfReady]          = useState(false);
  // Refs hold the live values — no stale-closure issues in handleDownload
  const blobRef        = useRef(null);
  const leadNameRef    = useRef(null);

  // On mount: create Zoho lead (with bill) → get Com_Lead_Name → generate PDF → attach PDF
  useEffect(() => {
    if (!interested || !contactData) return;
    const run = async () => {
      try {
        const notes = [
          `Cotización: ${leadNameRef.current || "Pendiente"}`,
          `Tarifa: ${ocrData?.tariff || "—"}`,
          `Consumo: ${ocrData?.consumoKWH || "—"}`,
          `Demanda: ${ocrData?.demandaKVA || "—"}`,
          `Costo/kWh: ${ocrData?.costoPorKWH || "—"}`,
          `Sistema: ${estData?.systemKwp} kWp | Cobertura: ${estData?.coverage}%`,
          `Precio est.: $${estData?.systemCost?.toLocaleString("en-US")}`,
          `Techo: ${sqft?.toLocaleString("en-US")} p²`,
          contactData.consultorNombre ? `Consultor en Estimado: ${contactData.consultorNombre}` : null,
          contactData.consultorEmail  ? `Estimado Rep-email: ${contactData.consultorEmail}`     : null,
          batteryResult               ? `Baterías: ${batteryResult.productName} | Respaldo: ${batteryResult.actualHours}h | Precio bat.: $${batteryResult.totalCost?.toLocaleString("en-US")}` : null,
        ].filter(Boolean).join(" | ");

        const { street, zip } = parseAddress(ocrData?.direccion, ocrData?.municipio);
        const leadData = {
          customerName:   contactData.nombre,
          businessName:   ocrData?.nombreNegocio || "",
          phone:          contactData.phone,
          address:        street,
          city:           ocrData?.municipio     || "",
          zip,
          roofSqft:       sqft,
          avgConsumption: parseNum(ocrData?.consumoKWH),
          systemKwp:      estData?.systemKwp,
          batteryHours:   batteryHours  || 0,
          batteryKWH:     batteryResult?.systemKWH  || null,
          batteryKW:      batteryResult?.systemKW   || null,
          batteryPrice:   batteryResult?.totalCost  || null,
          totalPrice:     (estData?.systemCost || 0) + (batteryResult?.totalCost || 0),
          notes,
        };

        // Step 1: Create lead + attach bill
        const fd = new FormData();
        fd.append("leadData", JSON.stringify(leadData));
        if (billFiles) Array.from(billFiles).forEach((f) => {
          const renamed = new File([f], `PreQual - ${f.name}`, { type: f.type });
          fd.append("billFile", renamed);
        });

        const res  = await fetch("/api/zoho-lead", { method: "POST", body: fd });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const leadName = data.commercialLeadName;
        leadNameRef.current = leadName;

        // Step 2: Generate PDF with Com_Lead_Name as the número
        if (!window.PDFLib) return;
        const pdfBytes = await generateEstimatePDF(ocrData, sqft, estData, contactData, leadName, batteryResult);
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        blobRef.current = blob;
        setPdfReady(true);

        // Step 3: Attach PDF to lead
        const fd2 = new FormData();
        fd2.append("leadId", data.zohoLeadId);
        const fileName = `Windmar_Estimado_${leadName || "Solar"}.pdf`;
        fd2.append("file", blob, fileName);
        await fetch("/api/zoho-attach", { method: "POST", body: fd2 });

      } catch (err) {
        console.error("Zoho error:", err);
      }
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = () => {
    const blob     = blobRef.current;
    const leadName = leadNameRef.current;
    if (!blob) { setPdfError("El estimado aún no está listo."); return; }
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href    = url;
    a.download = `Windmar_Estimado_${leadName || "Solar"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setPdfStatus("PDF descargado.");
  };

  if (interested) {
    return (
      <div style={S.page}>
        <Header />
        <div style={S.content}>
          <div style={S.card}>
            <div style={{ width: "192px", height: "192px", overflow: "hidden", margin: "0 auto 4px" }}>
              <img
                src="/todo_listo_icon.png"
                alt=""
                style={{ width: "192px", height: "192px", objectFit: "contain", transform: "scale(2.0)", transformOrigin: "center" }}
              />
            </div>
            <h1 style={S.h1}>¡Todo listo!</h1>
            <p style={S.sub}>
              Un consultor certificado de Windmar Comercial se pondrá en
              contacto para generarte una propuesta firme.
            </p>
            <p style={{ ...S.sub, fontSize: "18px", fontWeight: "700", color: "#1B3F8B", marginBottom: "28px" }}>
              ¡Gracias por tu interés en un sistema con Energía de la Buena™!
            </p>

            {/* 1. Descargar estimado */}
            <button
              style={!pdfReady ? S.btnOrangeDisabled : S.btnOrange}
              onClick={handleDownload}
              disabled={!pdfReady}
            >
              {pdfReady ? "⬇ Descargar estimado" : "Preparando estimado…"}
            </button>
            {pdfError  && <div style={S.pdfStatusError}>{pdfError}</div>}
            {!pdfError && pdfStatus && (
              <div style={S.pdfStatus}>
                <img src="/listo_icon.jpg" alt="" style={{ width: "72px", height: "72px", objectFit: "contain" }} />
                {pdfStatus}
              </div>
            )}

            {/* TODO: Re-enable Deal questionnaire when ready to launch */}
            {/* <a href="https://windmar-solar-production.up.railway.app/deal" style={S.btnNavy}>
              Continuar al cuestionario completo
            </a> */}

            {/* 2. SmartSheet form */}
            <button
              style={S.btnOrange}
              onClick={() => window.open("https://app.smartsheet.com/b/form/9f6e441c850e439a9ea42a82e46b774e", "_blank")}
            >
              Completar cuestionario completo →
            </button>

            {/* 3. Nueva consulta */}
            <button style={S.btnGhost} onClick={onRestart}>
              Nueva consulta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not interested
  return (
    <div style={S.page}>
      <Header />
      <div style={S.content}>
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "center", margin: "0 auto 20px" }}>
            <img src="/hand_shake.jpg" alt="" style={{ width: "288px", height: "288px", objectFit: "contain" }} />
          </div>
          <h1 style={S.h1}>¡Gracias por tu tiempo!</h1>
          <p style={S.sub}>
            Entendemos que este no es el momento ideal. Cuando estés listo para
            explorar opciones de energía solar, estaremos aquí para ayudarte.
          </p>
          <button style={S.btnNavy} onClick={onRestart}>
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
