import { useState } from "react";
import { Header, ProgressBar } from "./shared.jsx";

const SIZES = [
  { key: "small",      img: "/small_business_icon.jpg",  label: "Pequeño",    sqft: 1000,  desc: "~1,000 sq ft" },
  { key: "medium",     img: "/med_business_icon.jpg",    label: "Mediano",    sqft: 2500,  desc: "~2,500 sq ft" },
  { key: "large",      img: "/large_business_icon.jpg",  label: "Grande",     sqft: 5000,  desc: "~5,000 sq ft" },
  { key: "industrial", img: "/ind_business_icon.jpg",    label: "Industrial", sqft: 10000, desc: "~10,000 sq ft" },
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
    marginBottom: "4px",
  },
  cardDesc: {
    fontSize: "13px",
    color: "#6b7280",
  },
  overrideWrap: {
    marginBottom: "28px",
  },
  overrideLabel: {
    display: "block",
    fontSize: "14px",
    color: "#6b7280",
    marginBottom: "8px",
  },
  overrideInput: {
    width: "100%",
    padding: "13px 16px",
    fontSize: "16px",
    border: "2px solid #d1d5db",
    borderRadius: "10px",
    backgroundColor: "#ffffff",
    color: "#111827",
    boxSizing: "border-box",
    fontFamily: "inherit",
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

export default function RoofScreen({ onNext, onBack }) {
  const [selected, setSelected] = useState(null);  // key of selected size card
  const [custom, setCustom]     = useState("");     // free-text override

  // Effective sqft: custom input wins if filled, otherwise card preset
  const customNum  = parseFloat(custom.replace(/,/g, ""));
  const effectiveSqft = custom.trim() !== "" && !isNaN(customNum)
    ? customNum
    : SIZES.find((s) => s.key === selected)?.sqft ?? null;

  const canContinue = effectiveSqft !== null && effectiveSqft > 0;

  return (
    <div style={S.page}>
      <Header />
      <ProgressBar current={3} total={5} />
      <div style={S.content}>
        <h1 style={S.h1}>¿Cuánto techo tienes disponible?</h1>
        <p style={S.sub}>
          Selecciona la opción que mejor describe tu negocio, o ingresa el área exacta abajo.
        </p>

        <div style={S.grid}>
          {SIZES.map(({ key, img, label, desc }) => {
            const isSelected = selected === key && custom.trim() === "";
            return (
              <div
                key={key}
                style={{ ...S.card, ...(isSelected ? S.cardSelected : {}) }}
                onClick={() => { setSelected(key); setCustom(""); }}
              >
                <img src={img} alt={label} style={S.cardIcon} />
                <div style={S.cardLabel}>{label}</div>
                <div style={S.cardDesc}>{desc}</div>
              </div>
            );
          })}
        </div>

        <div style={S.overrideWrap}>
          <label style={S.overrideLabel}>
            O ingresa el área exacta (sq ft)
          </label>
          <input
            style={S.overrideInput}
            type="number"
            min="1"
            placeholder="ej. 3,500"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </div>

        <button
          style={{ ...S.btnNavy, ...(canContinue ? {} : S.btnNavyDisabled) }}
          disabled={!canContinue}
          onClick={() => onNext(effectiveSqft)}
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
