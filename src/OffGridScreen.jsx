import { useState } from "react";
import { Header } from "./shared.jsx";
import { TEST_MODE } from "./testMode.js";

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
    marginBottom: "32px",
    marginTop: 0,
  },
  fieldGroup: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "8px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    fontSize: "17px",
    border: "2px solid #d1d5db",
    borderRadius: "10px",
    backgroundColor: "#ffffff",
    color: "#111827",
    boxSizing: "border-box",
    fontFamily: "inherit",
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: "14px 16px",
    fontSize: "17px",
    border: "2px solid #d1d5db",
    borderRadius: "10px",
    backgroundColor: "#ffffff",
    color: "#111827",
    boxSizing: "border-box",
    fontFamily: "inherit",
    outline: "none",
    minHeight: "80px",
    resize: "vertical",
  },
  inputFocus: {
    borderColor: "#1B3F8B",
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
    opacity: 1,
    transition: "opacity 0.15s",
  },
  btnNavyDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
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
  errorMsg: {
    backgroundColor: "#fee2e2",
    border: "1px solid #fca5a5",
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "14px",
    color: "#dc2626",
    marginBottom: "16px",
  },
};

// Format a phone number string as XXX-XXX-XXXX after stripping non-digits.
// Returns null if fewer than 10 digits — caller should validate before calling.
const formatPhone = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const d = digits.slice(0, 10);
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
};

// Match ContactScreen's lenient name gate — a single-word name passes
// (e.g. "María"). Phone still requires 10 digits because `formatPhone`
// composes XXX-XXX-XXXX from exactly 10 digits.
const isValidName  = (s) => s.trim().length > 1;
const isValidPhone = (s) => String(s || "").replace(/\D/g, "").length === 10;

// Notes string passed through to /api/zoho-lead. The server's parseLeadNotes
// regex set won't capture the off-grid markers (cobertura/costo line items
// are non-numeric strings, no kWp/kWh fields, etc.) — only the consultor
// name flows through to Zoho's Lead_Notes field. The "Tipo: Sistema Autónomo"
// tag is preserved in the raw notes (visible in server logs) but does not
// surface in the Zoho record without a server-side change.
const buildOffGridNotes = ({ consultorNombre, consultorEmail }) => {
  const parts = [
    "Cobertura Estimada: off-grid",
    "Costo de energía promedio estimado: off-grid",
    consultorNombre ? `Consultor en Estimado: ${consultorNombre}` : "Consultor en Estimado: —",
    consultorEmail  ? `Rep-email: ${consultorEmail}`              : "Rep-email: —",
    "Tipo: Sistema Autónomo (off-grid)",
  ];
  return parts.join(" | ");
};

export default function OffGridScreen({ onBack, onDone }) {
  const [businessName, setBusinessName]     = useState(TEST_MODE ? "TEST - Negocio Off-Grid" : "");
  const [nombre, setNombre]                 = useState(TEST_MODE ? "TEST - Cliente Off-Grid" : "");
  const [telefono, setTelefono]             = useState(TEST_MODE ? "7879990000" : "");
  const [direccion, setDireccion]           = useState(TEST_MODE ? "TEST - Carr 2 km 55, Bo. Centro" : "");
  const [municipio, setMunicipio]           = useState(TEST_MODE ? "Ponce" : "");
  const [consultorNombre, setConsultorNombre] = useState(TEST_MODE ? "TEST - Consultor Off-Grid" : "");
  const [consultorEmail, setConsultorEmail] = useState(TEST_MODE ? "consultant@test.com" : "");
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [focusedField, setFocusedField]     = useState(null);

  const canSubmit = isValidName(nombre) && isValidPhone(telefono);

  const inputStyle = (field, base = S.input) => ({
    ...base,
    ...(focusedField === field ? S.inputFocus : {}),
  });

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");

    const phoneFormatted = formatPhone(telefono);
    const leadData = {
      customerName:     nombre.trim(),
      businessName:     businessName.trim() || null,
      phone:            phoneFormatted,
      direccion:        direccion.trim() || null,
      city:             municipio.trim() || null,
      salesRepEmail:    consultorEmail.trim() || null,
      notes:            buildOffGridNotes({
        consultorNombre: consultorNombre.trim(),
        consultorEmail:  consultorEmail.trim(),
      }),
      avgConsumption:   null,
      demandaKVA:       null,
      systemSizeKw:     null,
      roofSizeEstimate: null,
    };

    try {
      const fd = new FormData();
      fd.append("leadData", JSON.stringify(leadData));
      const res  = await fetch("/api/zoho-lead", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        // Non-blocking — log the message but still hand off to the thank-you.
        console.warn("Zoho off-grid lead error:", data?.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn("Zoho off-grid lead error:", err.message);
    }

    setLoading(false);
    onDone();
  };

  return (
    <div style={S.page}>
      <Header />
      <div style={S.content}>
        <h1 style={S.h1}>Quiero un Sistema Autónomo</h1>
        <p style={S.sub}>
          Los sistemas autónomos operan sin conexión a la red eléctrica de
          LUMA. Un especialista de Windmar se pondrá en contacto contigo
          para diseñar tu solución.
        </p>

        <div style={S.fieldGroup}>
          <label style={S.label}>Nombre del negocio</label>
          <input
            style={inputStyle("businessName")}
            type="text"
            placeholder="ej. Panadería Buen Pan"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            onFocus={() => setFocusedField("businessName")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Nombre completo</label>
          <input
            style={inputStyle("nombre")}
            type="text"
            placeholder="ej. María González"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onFocus={() => setFocusedField("nombre")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Teléfono</label>
          <input
            style={inputStyle("telefono")}
            type="tel"
            placeholder="ej. 787-555-1234"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            onFocus={() => setFocusedField("telefono")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Dirección del negocio</label>
          <textarea
            style={inputStyle("direccion", S.textarea)}
            placeholder="ej. Carr. 2 km 55, Bo. Centro"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            onFocus={() => setFocusedField("direccion")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Municipio</label>
          <input
            style={inputStyle("municipio")}
            type="text"
            placeholder="ej. Ponce"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            onFocus={() => setFocusedField("municipio")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>¿Quién es tu consultor?</label>
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.5", margin: "0 0 8px" }}>
            ¿Ya estás trabajando con un consultor de Windmar? Compártenos su nombre, o deja el espacio en blanco si no estás trabajando aún con nadie.
          </p>
          <input
            style={inputStyle("consultorNombre")}
            type="text"
            placeholder="ej. Juan Pérez"
            value={consultorNombre}
            onChange={(e) => setConsultorNombre(e.target.value)}
            onFocus={() => setFocusedField("consultorNombre")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>¿Tienes su correo electrónico?</label>
          <input
            style={inputStyle("consultorEmail")}
            type="email"
            placeholder="ej. juan.perez@windmar.com"
            value={consultorEmail}
            onChange={(e) => setConsultorEmail(e.target.value)}
            onFocus={() => setFocusedField("consultorEmail")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        {error && <div style={S.errorMsg}>{error}</div>}

        <button
          style={{ ...S.btnNavy, ...(canSubmit && !loading ? {} : S.btnNavyDisabled) }}
          disabled={!canSubmit || loading}
          onClick={handleSubmit}
        >
          {loading ? "Enviando…" : "Continuar"}
        </button>
        <button style={S.btnGhost} onClick={onBack} disabled={loading}>
          Atrás
        </button>
      </div>
    </div>
  );
}
