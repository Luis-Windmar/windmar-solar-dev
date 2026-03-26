import { useState, useEffect } from "react";
import UploadScreen from "./UploadScreen.jsx";
import RoofScreen from "./RoofScreen.jsx";
import BatteryIntentScreen from "./BatteryIntentScreen.jsx";
import EstimateScreen from "./EstimateScreen.jsx";
import ContactScreen from "./ContactScreen.jsx";
import ThankYouScreen from "./ThankYouScreen.jsx";

const LOGO_B64 = "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J1enf7PFRXMLiIHVarLT5RNaEbS+KRr9N7fAbobH08e6rjp4zLJrVxVL0e/n0L/yMXTjKXUqyIi5DUQREQBERAEREAREQBERAEREAB0FygC5QBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAVlZQqV5JZo6sLJX/ADPbGA5/6kDypXkGNlzHH82P5FiMW+9F2VhZr2n2AjJBDg9v17TrX18KW4WTSqZqFqpVinrxsibGHytYHyPLiQ7Q0NlunHX08KqnDnvBYoSTdM1hEXPkK0V7G2qc7c2mJjiHMf8ALrz/ADXHfg7VGnXRXDWmhFCyqIPyuFhMobnBi7dN3Iw/e7R+2wR9wSPpvSuXD6kVSCB9WpMIY2sMtqCSd7tDW+5ji7iPc/UqA+GrN7NXKxe3sSfDue8ftZJBa4EdoJ8bKgKFZuL5bDc1IKlbHQvx9SGe1BHDJZiEzRG573sG2Oa4Odt25OhLlUr4KnFYry1q8vxUYkDJmNePVGz2EePcHR0PLXDRCzqGZDagYYuPMirRVmySRNL3iM+x+Utd5cNnZ8bA+q0j07GMbPbpPjbJYfA2J8kYJla1jnNJ1rfcHN8+67G9b11WecZ54RhJ3fVb9PuKSpJavbU5REXKbhERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREB//2Q==";

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#EBF1FF",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  header: {
    backgroundColor: "#ffffff",
    borderBottom: "3px solid #1B3F8B",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    height: "144px",
    objectFit: "contain",
  },
  progressWrap: {
    backgroundColor: "#ffffff",
    padding: "10px 20px",
  },
  progressLabel: {
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "6px",
    textAlign: "center",
  },
  progressBar: {
    height: "6px",
    backgroundColor: "#e5e7eb",
    borderRadius: "3px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F5A623",
    borderRadius: "3px",
    transition: "width 0.4s ease",
  },
  content: {
    flex: 1,
    padding: "40px 24px 32px",
    maxWidth: "480px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  heading: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1B3F8B",
    marginBottom: "8px",
    marginTop: 0,
  },
  subheading: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#111827",
    marginBottom: "16px",
    marginTop: 0,
  },
  bodyText: {
    fontSize: "16px",
    color: "#374151",
    lineHeight: "1.6",
    marginBottom: "32px",
  },
  label: {
    display: "block",
    fontSize: "16px",
    fontWeight: "600",
    color: "#111827",
    marginBottom: "10px",
  },
  select: {
    width: "100%",
    padding: "14px 16px",
    fontSize: "16px",
    border: "2px solid #d1d5db",
    borderRadius: "10px",
    backgroundColor: "#ffffff",
    color: "#111827",
    marginBottom: "24px",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  selectSelected: {
    borderColor: "#1B3F8B",
    outline: "none",
  },
  btnPrimary: {
    width: "100%",
    padding: "16px 24px",
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
  btnGray: {
    width: "100%",
    padding: "16px 24px",
    fontSize: "18px",
    fontWeight: "600",
    color: "#ffffff",
    backgroundColor: "#6b7280",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    marginBottom: "12px",
    display: "block",
  },
  noteCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "16px",
    marginTop: "24px",
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  noteIcon: {
    fontSize: "20px",
    flexShrink: 0,
  },
  noteText: {
    fontSize: "14px",
    color: "#6b7280",
    lineHeight: "1.5",
    margin: 0,
  },
  exitCard: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "40px 24px",
    textAlign: "center",
    marginTop: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  exitIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  exitHeading: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#111827",
    marginBottom: "12px",
  },
  exitText: {
    fontSize: "16px",
    color: "#6b7280",
    lineHeight: "1.6",
    marginBottom: "32px",
  },
};

const Header = () => (
  <div style={styles.header}>
    <img src="/logo.png" alt="Windmar Commercial" style={styles.logo} />
  </div>
);

const ProgressBar = ({ current, total }) => {
  const pct = Math.round((current / total) * 100);
  return (
    <div style={styles.progressWrap}>
      <div style={styles.progressLabel}>
        Paso {current} de {total}
      </div>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default function WelcomeScreen() {
  const [selection, setSelection] = useState("");
  const [screen, setScreen]       = useState("welcome"); // welcome | exit | upload | roof | battery | estimate | contact | thankyou-yes | thankyou-no
  const [contactData, setContactData] = useState(null);
  const [ocrData, setOcrData]     = useState(null);
  const [sqft, setSqft]           = useState(null);
  const [estData, setEstData]     = useState(null);
  const [batteryHours, setBatteryHours] = useState(0);
  const [batteryResult, setBatteryResult] = useState(null);
  const [billFiles, setBillFiles] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((data) => setPricing(data))
      .catch(() => { /* silently fall back to hardcoded defaults */ })
      .finally(() => setPricingLoading(false));
  }, []);

  const handleContinue = () => setScreen(selection === "si" ? "upload" : "exit");
  const handleRestart  = () => { setSelection(""); setScreen("welcome"); setOcrData(null); setSqft(null); setEstData(null); setContactData(null); setBillFiles(null); setBatteryHours(0); setBatteryResult(null); };

  if (pricingLoading) {
    return (
      <div style={styles.container}>
        <Header />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, minHeight: "200px" }}>
          <p style={{ color: "#6b7280", fontSize: "16px" }}>Cargando…</p>
        </div>
      </div>
    );
  }

  if (screen === "exit") {
    return (
      <div style={styles.container}>
        <Header />
        <div style={styles.content}>
          <div style={styles.exitCard}>
            <img src="/hand_shake.jpg" alt="" style={{ width: "384px", height: "384px", objectFit: "contain", display: "block", margin: "0 auto 16px" }} />
            <h2 style={styles.exitHeading}>¡Gracias por su tiempo!</h2>
            <p style={styles.exitText}>
              Entendemos que este no es el momento ideal. Cuando esté listo para
              explorar opciones de energía solar, estaremos aquí para ayudarle.
            </p>
            <button style={styles.btnPrimary} onClick={handleRestart}>
              ← Regresar al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "upload") {
    return (
      <UploadScreen
        resumeData={ocrData}
        onNext={(data, files) => { setOcrData(data); setBillFiles(files); setScreen("roof"); }}
        onBack={handleRestart}
      />
    );
  }

  if (screen === "roof") {
    return (
      <RoofScreen
        onNext={(s) => { setSqft(s); setScreen("battery"); }}
        onBack={() => setScreen("upload")}
      />
    );
  }

  if (screen === "battery") {
    return (
      <BatteryIntentScreen
        batteryHours={batteryHours}
        onNext={(hours) => { setBatteryHours(hours); setScreen("estimate"); }}
        onBack={() => setScreen("roof")}
      />
    );
  }

  if (screen === "estimate") {
    return (
      <EstimateScreen
        ocrData={ocrData}
        sqft={sqft}
        pricing={pricing}
        batteryHours={batteryHours}
        setBatteryHours={setBatteryHours}
        onInterested={(est, batt) => { setEstData(est); setBatteryResult(batt); setScreen("contact"); }}
        onNotInterested={() => setScreen("thankyou-no")}
        onBack={() => setScreen("battery")}
      />
    );
  }

  if (screen === "contact") {
    return (
      <ContactScreen
        ocrData={ocrData}
        sqft={sqft}
        onNext={(contact) => { setContactData(contact); setScreen("thankyou-yes"); }}
        onBack={() => setScreen("estimate")}
      />
    );
  }

  if (screen === "thankyou-yes") {
    return (
      <ThankYouScreen
        interested={true}
        contactData={contactData}
        ocrData={ocrData}
        sqft={sqft}
        estData={estData}
        batteryHours={batteryHours}
        batteryResult={batteryResult}
        billFiles={billFiles}
        onRestart={handleRestart}
      />
    );
  }

  if (screen === "thankyou-no") {
    return (
      <ThankYouScreen
        interested={false}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <div style={styles.container}>
      <Header />
      <ProgressBar current={1} total={6} />
      <div style={styles.content}>
        <h1 style={styles.heading}>¡Bienvenido!</h1>
        <h2 style={styles.subheading}>Estimado Solar Comercial</h2>
        <p style={styles.bodyText}>
          En <strong>menos de 5 minutos</strong> te vamos a decir cuánto te puedes ahorrar con un sistema solar fotovoltaico Windmar™. Para ello necesitamos tu factura de LUMA más reciente.
        </p>

        <label style={styles.label}>
          ¿Tienes la factura de LUMA de tu negocio a la mano?
        </label>

        <select
          style={selection ? { ...styles.select, ...styles.selectSelected } : styles.select}
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
        >
          <option value="">— Seleccione una opción —</option>
          <option value="si">Sí, tengo la factura</option>
          <option value="no">No, en otro momento</option>
        </select>

        {selection === "si" && (
          <button style={styles.btnPrimary} onClick={handleContinue}>
            Continuar
          </button>
        )}

        {selection === "no" && (
          <button style={styles.btnGray} onClick={handleContinue}>
            Entendido →
          </button>
        )}

        <div style={styles.noteCard}>
          <div style={{ width: "100px", height: "100px", overflow: "hidden", flexShrink: 0 }}>
            <img src="/financing_icon.png" alt="" style={{ width: "100px", height: "100px", objectFit: "contain", transform: "scale(1.6)", transformOrigin: "center" }} />
          </div>
          <p style={styles.noteText}>
            Windmar Comercial ofrece opciones de financiamiento. Entre ellas,
            15 años sin pronto. Evaluaremos el sistema ideal para tu negocio,
            y te daremos un estimado del ahorro.
          </p>
        </div>
      </div>
    </div>
  );
}
