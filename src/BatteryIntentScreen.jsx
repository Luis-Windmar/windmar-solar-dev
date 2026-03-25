import { useState } from "react";
import { Header, ProgressBar } from "./shared.jsx";

const SLIDER_HOURS = [0, 4, 8, 12, 16, 24];

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
    marginBottom: "12px",
    marginTop: 0,
  },
  sub: {
    fontSize: "16px",
    color: "#374151",
    lineHeight: "1.6",
    marginBottom: "32px",
    marginTop: 0,
  },
  sliderLabel: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "12px",
    display: "block",
  },
  sliderValue: {
    fontSize: "28px",
    fontWeight: "800",
    color: "#1B3F8B",
    textAlign: "center",
    marginBottom: "16px",
  },
  sliderWrap: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "32px",
  },
  sliderTicks: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "#6b7280",
    marginTop: "8px",
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
    padding: "16px",
    fontSize: "18px",
    fontWeight: "600",
    color: "#1B3F8B",
    backgroundColor: "transparent",
    border: "2px solid #1B3F8B",
    borderRadius: "10px",
    cursor: "pointer",
    marginBottom: "12px",
    display: "block",
  },
  btnBack: {
    width: "100%",
    padding: "16px",
    fontSize: "16px",
    fontWeight: "500",
    color: "#6b7280",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    display: "block",
  },
};

export default function BatteryIntentScreen({ batteryHours, onNext, onBack }) {
  const initIdx = Math.max(0, SLIDER_HOURS.indexOf(batteryHours));
  const [sliderIdx, setSliderIdx] = useState(initIdx);
  const hours = SLIDER_HOURS[sliderIdx];

  return (
    <div style={S.page}>
      <style>{`
        .battery-slider { -webkit-appearance: none; appearance: none; height: 3px; background: #d1d5db; border-radius: 2px; outline: none; }
        .battery-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px; border-radius: 50%; background: #1B3F8B; cursor: pointer; }
        .battery-slider::-webkit-slider-runnable-track { height: 3px; background: #d1d5db; border-radius: 2px; }
        .battery-slider::-moz-range-thumb { width: 28px; height: 28px; border-radius: 50%; background: #1B3F8B; cursor: pointer; border: none; }
        .battery-slider::-moz-range-track { height: 3px; background: #d1d5db; border-radius: 2px; }
      `}</style>
      <Header />
      <ProgressBar current={3} total={5} />
      <div style={S.content}>
        <h1 style={S.h1}>¿Deseas incluir almacenamiento de energía?</h1>
        <p style={S.sub}>
          Las baterías te dan respaldo eléctrico durante apagones. No reducen tu factura, pero mantienen tu negocio operando.
        </p>

        <span style={S.sliderLabel}>¿Cuántas horas de respaldo deseas?</span>
        <div style={S.sliderWrap}>
          <div style={S.sliderValue}>
            {hours === 0 ? "Sin almacenamiento" : `${hours} horas de respaldo`}
          </div>
          <input
            type="range"
            className="battery-slider"
            min={0}
            max={SLIDER_HOURS.length - 1}
            step={1}
            value={sliderIdx}
            onChange={(e) => setSliderIdx(Number(e.target.value))}
            style={{ width: "100%", cursor: "pointer", padding: "12px 0" }}
          />
          <div style={S.sliderTicks}>
            {SLIDER_HOURS.map((h) => (
              <span key={h}>{h === 0 ? "0" : `${h}h`}</span>
            ))}
          </div>
        </div>

        <button style={S.btnOrange} onClick={() => onNext(hours)}>
          {hours > 0 ? "Ver estimado con baterías →" : "Ver estimado solar →"}
        </button>
        <button style={S.btnBack} onClick={onBack}>
          Atrás
        </button>
      </div>
    </div>
  );
}
