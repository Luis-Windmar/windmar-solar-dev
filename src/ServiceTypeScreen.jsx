import { useState } from "react";
import { Header, ProgressBar } from "./shared.jsx";

const OPTIONS = [
  { key: "trifasico_480", img: "/480V_outlet_icon.png", label: "480V", sub: "3 fases" },
  { key: "trifasico_208", img: "/208V_outlet_icon.png", label: "208V", sub: "3 fases" },
  { key: "bifasico_240",  img: "/240V_outlet_icon.png", label: "240V", sub: "2 fases" },
  { key: "no_se",         img: "/no_lo_se_icon.png",   label: "No estoy seguro" },
];

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
    marginBottom: "28px",
    marginTop: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
    marginBottom: "24px",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "2px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.15s, background-color 0.15s",
    userSelect: "none",
  },
  cardSelected: {
    border: "4px solid #1B3F8B",
    backgroundColor: "#ffffff",
  },
  cardIcon: {
    width: "100%",
    height: "120px",
    objectFit: "contain",
    marginBottom: "10px",
  },
  cardLabel: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#1B3F8B",
    marginBottom: "2px",
    lineHeight: "1.2",
  },
  cardSub: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#1B3F8B",
    lineHeight: "1.2",
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
};

export default function ServiceTypeScreen({ onNext, onBack }) {
  const [selected, setSelected] = useState(null);
  const canContinue = selected !== null;

  return (
    <div style={S.page}>
      <Header />
      <ProgressBar current={4} total={6} />
      <div style={S.content}>
        <h1 style={S.h1}>¿Sabes qué tipo de servicio eléctrico tienes?</h1>
        <p style={S.sub}>Selecciona una de las cuatro opciones:</p>

        <div style={S.grid}>
          {OPTIONS.map(({ key, img, label, sub }) => (
            <div
              key={key}
              style={{ ...S.card, ...(selected === key ? S.cardSelected : {}) }}
              onClick={() => setSelected(key)}
            >
              <img src={img} alt={sub ? `${label} ${sub}` : label} style={S.cardIcon} />
              <div style={S.cardLabel}>{label}</div>
              {sub && <div style={S.cardSub}>{sub}</div>}
            </div>
          ))}
        </div>

        <button
          style={{ ...S.btnNavy, ...(canContinue ? {} : S.btnNavyDisabled) }}
          disabled={!canContinue}
          onClick={() => onNext(selected)}
        >
          Continuar
        </button>
        <button style={S.btnGhost} onClick={onBack}>
          Atrás
        </button>
      </div>
    </div>
  );
}
