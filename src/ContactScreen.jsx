import { useState } from "react";
import { Header, ProgressBar } from "./shared.jsx";

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

// Lenient email pattern: allows any TLD (including non-.com domains like .pr,
// .business, .co.uk). Requires non-empty local part, an @, a domain with at
// least one dot, and TLD of 2+ chars. Does NOT block obscure-but-valid forms.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

export default function ContactScreen({ ocrData, sqft, onNext, onBack, generateLead = true }) {
  const [nombre, setNombre]           = useState("TEST - "); // TODO: remove before production
  const [phone, setPhone]             = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [consultorNombre, setConsultor] = useState("TEST - "); // TODO: remove before production
  const [consultorEmail, setConsultorEmail] = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [focusedField, setFocusedField] = useState(null);

  const customerEmailValid = customerEmail.trim() === "" || EMAIL_PATTERN.test(customerEmail.trim());
  const canSubmit = nombre.trim().length > 1
                 && phone.trim().length >= 7
                 && customerEmail.trim() !== ""
                 && customerEmailValid;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");

    const contactPayload = {
      leadId:          null,
      nombre:          nombre.trim(),
      phone:           phone.trim(),
      customerEmail:   customerEmail.trim(),
      consultorNombre: consultorNombre.trim(),
      consultorEmail:  consultorEmail.trim(),
    };

    // Test/demo mode: skip the local lead save entirely and continue
    if (!generateLead) {
      onNext(contactPayload);
      return;
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          phone:  phone.trim(),
          customerEmail: customerEmail.trim(),
          municipio:    ocrData?.municipio   || "",
          tariff:       ocrData?.tariff      || "",
          consumoKWH:   ocrData?.consumoKWH  || "",
          demandaKVA:   ocrData?.demandaKVA  || "",
          totalFactura: ocrData?.totalFactura || "",
          sqft,
          consultorEmail: consultorEmail.trim(),
          source: "prequal-wizard",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor.");
      onNext({ ...contactPayload, leadId: data.leadId, quoteNumber: data.quoteNumber });
    } catch (err) {
      // Non-blocking: show the error but still allow continuing
      setError(`No se pudo registrar la visita (${err.message}). Puedes continuar — el estimado PDF se generará de todas formas.`);
      setLoading(false);
    }
  };

  const customerEmailShowError =
    customerEmail.trim() !== "" && !customerEmailValid;

  const inputStyle = (field) => ({
    ...S.input,
    ...(focusedField === field ? S.inputFocus : {}),
  });

  return (
    <div style={S.page}>
      <Header />
      <ProgressBar current={6} total={6} />
      <div style={S.content}>
        <h1 style={S.h1}>Un paso más</h1>
        <p style={S.sub}>
          Compártenos tus datos y un consultor de Windmar se pondrá en
          contacto para discutir tu interés.
        </p>

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
            style={inputStyle("phone")}
            type="tel"
            placeholder="ej. 787-555-1234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onFocus={() => setFocusedField("phone")}
            onBlur={() => setFocusedField(null)}
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Correo electrónico</label>
          <input
            style={inputStyle("customerEmail")}
            type="email"
            placeholder="ej. maria@ejemplo.com"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            onFocus={() => setFocusedField("customerEmail")}
            onBlur={() => setFocusedField(null)}
          />
          {customerEmailShowError && (
            <div style={{ fontSize: "13px", color: "#dc2626", marginTop: "6px" }}>
              Por favor verifica que el correo sea válido.
            </div>
          )}
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>¿Quién es tu consultor?</label>
          <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.5", margin: "0 0 8px" }}>
            ¿Ya estás trabajando con un consultor de Windmar? Compártenos su nombre, o deja el espacio en blanco si no estás trabajando aún con nadie.
          </p>
          <input
            style={inputStyle("consultor")}
            type="text"
            placeholder="ej. Juan Pérez"
            value={consultorNombre}
            onChange={(e) => setConsultor(e.target.value)}
            onFocus={() => setFocusedField("consultor")}
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

        {error && (
          <>
            <div style={S.errorMsg}>{error}</div>
            <button
              style={{ ...S.btnNavy, marginBottom: "8px" }}
              onClick={() => onNext({ leadId: null, nombre: nombre.trim(), phone: phone.trim(), customerEmail: customerEmail.trim(), consultorNombre: consultorNombre.trim(), consultorEmail: consultorEmail.trim() })}
            >
              Continuar de todas formas →
            </button>
          </>
        )}

        <button
          style={{ ...S.btnNavy, ...(canSubmit ? {} : S.btnNavyDisabled) }}
          disabled={!canSubmit || loading}
          onClick={handleSubmit}
        >
          {loading ? "Enviando…" : "Continuar"}
        </button>
        <button style={S.btnGhost} onClick={onBack}>
          Atrás
        </button>
      </div>
    </div>
  );
}
