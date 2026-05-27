import { useState, useEffect, useRef } from "react";
import { Header } from "./shared.jsx";
import { defaultDemandKva } from "./sizing/tariff.js";

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

export default function ThankYouScreen({ interested, generateLead = true, contactData, ocrData, sqft, estData, batteryHours, batteryResult, billFiles, onRestart }) {
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
        // Floor the demand value the same way UploadScreen's normalizeOCR does
        // (tariff-aware: 25 for Residencial, 50 for everything else) so that a
        // cleared field or any null/undefined value still flows a real number
        // to Zoho through parseLeadNotes — which extracts demand via a
        // /Demanda:\s*([\d,]+)\s*kVA/ regex and would otherwise capture
        // nothing when this slot shows "—". Using the raw numeric field with
        // a guaranteed " kVA" suffix also handles the case where a rep edit
        // dropped the " kVA" suffix from the display.
        const demandaForZoho = ocrData?.carga_contratada_kva ?? defaultDemandKva(ocrData?.tariff);

        const notes = [
          `Cotización: ${leadNameRef.current || "Pendiente"}`,
          `Tarifa: ${ocrData?.tariff || "—"}`,
          `Consumo: ${ocrData?.consumoKWH || "—"}`,
          `Demanda: ${demandaForZoho} kVA`,
          `Costo/kWh: ${ocrData?.costoPorKWH || "—"}`,
          `Sistema: ${estData?.systemKwp} kWp | Cobertura: ${estData?.coverage}%`,
          `Precio est.: $${estData?.systemCost?.toLocaleString("en-US")}`,
          `Techo: ${sqft?.toLocaleString("en-US")} p²`,
          contactData.consultorNombre ? `Consultor en Estimado: ${contactData.consultorNombre}` : null,
          contactData.consultorEmail  ? `Estimado Rep-email: ${contactData.consultorEmail}`     : null,
          batteryResult ? (() => {
            // Step 3: battery shape is now { bom, system_kwh, total_price,
            // actual_backup_hours, cap_applied, ... } from Tool Belt
            // /api/v1/battery-sizing. Build the product name from the
            // sanitized BOM to match the Lead_Notes string contract.
            // Mirrors buildBatteryProductName in EstimateScreen.jsx.
            const inv = batteryResult?.bom?.inverter;
            const productName = inv?.model
              ? `${inv.model}${inv.quantity ? ` ×${inv.quantity}` : ''} / ${batteryResult.system_kwh} kWh`
              : `Sistema ${batteryResult.system_kwh ?? "?"} kWh`;
            const hours = batteryResult.actual_backup_hours;
            const price = batteryResult.total_price;
            return `Baterías: ${productName} | Respaldo: ${hours}h | Precio bat.: $${price?.toLocaleString("en-US")}`;
          })() : null,
        ].filter(Boolean).join(" | ");

        const { street, zip } = parseAddress(ocrData?.direccion, ocrData?.municipio);
        const leadData = {
          customerName:   contactData.nombre,
          businessName:   ocrData?.nombreNegocio || "",
          phone:          contactData.phone,
          direccion:      street,
          city:           ocrData?.municipio     || "",
          zip,
          roofSqft:       sqft,
          avgConsumption: parseNum(ocrData?.consumoKWH),
          systemKwp:      estData?.systemKwp,
          batteryHours:   batteryHours  || 0,
          // Step 3 + BOM-fixes 2026-05-27: field names match the Tool Belt
          // /api/v1/battery-sizing response shape. Upstream has no bom.head;
          // the AC inverter nameplate lives at bom.system_kwac. Note that
          // leadData.batteryKW has no Zoho field consumer in server.js yet
          // (createZohoLead doesn't read it). Populated here so future Zoho
          // field additions can pick it up.
          batteryKWH:     batteryResult?.system_kwh   || null,
          batteryKW:      batteryResult?.bom?.system_kwac || null,
          batteryPrice:   batteryResult?.total_price  || null,
          totalPrice:     (estData?.systemCost || 0) + (batteryResult?.total_price || 0),
          notes,
        };

        let leadName = null;

        if (generateLead) {
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

          leadName = data.commercialLeadName;
          leadNameRef.current = leadName;

          // Step 2+3: Generate PDF server-side and attach to Zoho
          setPdfStatus("Generando estimado…");
          const pdfRes  = await fetch("/api/generate-and-attach-pdf", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              leadId:             data.zohoLeadId,
              ocrData,
              estData,
              contactData,
              commercialLeadName: leadName,
              batteryResult,
            }),
          });
          const pdfData = await pdfRes.json();
          if (pdfData.success && pdfData.pdfBase64) {
            const pdfBytes = Uint8Array.from(atob(pdfData.pdfBase64), c => c.charCodeAt(0));
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            blobRef.current = blob;
            setPdfReady(true);
          }

        } else {
          // generateLead=false: generate PDF for download only (no Zoho)
          setPdfStatus("Generando estimado…");
          const pdfRes  = await fetch("/api/generate-and-attach-pdf", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ ocrData, estData, contactData, batteryResult }),
          });
          const pdfData = await pdfRes.json();
          if (pdfData.success && pdfData.pdfBase64) {
            const pdfBytes = Uint8Array.from(atob(pdfData.pdfBase64), c => c.charCodeAt(0));
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            blobRef.current = blob;
            setPdfReady(true);
          }
        }

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
