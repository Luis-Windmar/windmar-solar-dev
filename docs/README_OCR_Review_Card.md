# Windmar Deal Section — OCR Review Card Implementation

This document tells the Deal Section Claude session exactly how to implement
the OCR bill review UI — the interactive card with checkboxes that lets the
user confirm or correct bill data — matching the PreQual implementation exactly.

---

## Overview: How It Works in PreQual

Instead of asking the user to confirm each field one by one in the chat,
PreQual displays a single interactive card showing ALL OCR-extracted fields at once.
The user can:

- **Check any field** that looks wrong (checkbox turns row red with strikethrough)
- Type **"listo"** → confirms everything, moves on
- Type **"corregir"** → enters correction flow for only the checked fields
- Type **"ayuda"** → same as corregir but with hints showing where to find each value on the bill

This is much faster and less tedious than confirming field by field.

---

## The 4 Components to Copy Exactly from PreQual_Solar.jsx

### 1. FIELD_DEFS — field definitions arrays

Two arrays — one for demand tariffs (Primaria, Transmisión, Agrícola),
one for Secundaria (no demand fields):

```javascript
const FIELD_DEFS_DEMAND = [
  { id:'address',       pendingKey:'address_pending',       label:'Dirección del negocio',       hint:'',                                                                                      fixStep:'FIX_ADDRESS'      },
  { id:'municipio',     pendingKey:'municipio_pending',     label:'Municipio',                   hint:'Extráelo de la dirección (ciudad antes del "PR").',                                     fixStep:'FIX_MUNICIPIO'    },
  { id:'luma_total',    pendingKey:'luma_total_pending',    label:'Cantidad total adeudada',     hint:'Primera página, esquina superior izquierda, junto al logo de LUMA.',                    fixStep:'FIX_TOTAL'        },
  { id:'tarifa',        pendingKey:'tarifa_pending',        label:'Tarifa',                      hint:'Tercera página, sección "Información del Medidor".',                                    fixStep:'FIX_TARIFA'       },
  { id:'demanda',       pendingKey:'demanda_pending',       label:'Carga contratada (kVA)',      hint:'Tercera página, sección "Información del Medidor".',                                    fixStep:'FIX_DEMANDA'      },
  { id:'cargo_cliente', pendingKey:'cargo_cliente_pending', label:'Cargo por cliente',           hint:'Tercera página, sección "Detalles de Cargos Corrientes".',                             fixStep:'FIX_CARGO_CLIENTE'},
  { id:'cargo_demanda', pendingKey:'cargo_demanda_pending', label:'Cargo por demanda',           hint:'Sección "Detalles de Cargos Corrientes".',                                             fixStep:'FIX_CARGO_DEMANDA'},
  { id:'exceso_kva',    pendingKey:'exceso_kva_pending',    label:'Exceso de demanda (kVA)',     hint:'Sección "Detalles de Cargos Corrientes".',                                             fixStep:'FIX_EXCESO_KVA'   },
  { id:'exceso_usd',    pendingKey:'exceso_usd_pending',    label:'Monto por exceso de demanda', hint:'Sección "Detalles de Cargos Corrientes".',                                             fixStep:'FIX_EXCESO_USD'   },
  { id:'consumo',       pendingKey:'consumo_pending',       label:'Promedio de consumo mensual', hint:'Barras del historial de consumo al fondo de la factura — estima el promedio visualmente.', fixStep:'FIX_CONSUMO'   },
  { id:'costo_kwh',     pendingKey:'costo_kwh_pending',     label:'Costo promedio de energía',   hint:'Debajo de las barras del historial de consumo.',                                       fixStep:'FIX_COSTO_KWH'   },
];

const FIELD_DEFS_SECONDARY = [
  { id:'address',       pendingKey:'address_pending',       label:'Dirección del negocio',       hint:'',                                                                                      fixStep:'FIX_ADDRESS'      },
  { id:'municipio',     pendingKey:'municipio_pending',     label:'Municipio',                   hint:'Ciudad antes del "PR" en la dirección.',                                               fixStep:'FIX_MUNICIPIO'    },
  { id:'luma_total',    pendingKey:'luma_total_pending',    label:'Cantidad total adeudada',     hint:'Primera página, esquina superior izquierda.',                                          fixStep:'FIX_TOTAL'        },
  { id:'tarifa',        pendingKey:'tarifa_pending',        label:'Tarifa',                      hint:'Tercera página, sección "Información del Medidor".',                                   fixStep:'FIX_TARIFA'       },
  { id:'cargo_cliente', pendingKey:'cargo_cliente_pending', label:'Cargo por cliente',           hint:'Tercera página, sección "Detalles de Cargos Corrientes".',                            fixStep:'FIX_CARGO_CLIENTE'},
  { id:'consumo',       pendingKey:'consumo_pending',       label:'Promedio de consumo mensual', hint:'Barras del historial de consumo.',                                                     fixStep:'FIX_CONSUMO'      },
  { id:'costo_kwh',     pendingKey:'costo_kwh_pending',     label:'Costo promedio de energía',   hint:'Debajo de las barras del historial de consumo.',                                      fixStep:'FIX_COSTO_KWH'   },
];

const getFieldDefs = (tarifa) => tarifa === 'Secundaria' ? FIELD_DEFS_SECONDARY : FIELD_DEFS_DEMAND;
```

---

### 2. getFieldValue — formats each field for display

```javascript
const getFieldValue = (d, pendingKey) => {
  const v = d[pendingKey];
  if (v === undefined || v === null) return '—';
  if (pendingKey === 'luma_total_pending')    return fmtUSD(v);
  if (pendingKey === 'tarifa_pending')        return String(v);
  if (pendingKey === 'demanda_pending')       return fmtKVA(v);
  if (pendingKey === 'cargo_cliente_pending') return fmtUSD(v);
  if (pendingKey === 'cargo_demanda_pending') return fmtUSD(v);
  if (pendingKey === 'exceso_kva_pending')    return fmtKVA(v);
  if (pendingKey === 'exceso_usd_pending')    return fmtUSD(v);
  if (pendingKey === 'consumo_pending')       return fmtKWH(v);
  if (pendingKey === 'costo_kwh_pending')     return fmtUSD(v)+'/kWh';
  return String(v);
};
```

Requires these formatters (copy from PreQual if not already present):
```javascript
const fmtUSD = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(n);
const fmtKWH = (n) => new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n)+' kWh';
const fmtKVA = (n) => new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(n)+' kVA';
```

---

### 3. OCRReviewCard — the interactive card component

```jsx
function OCRReviewCard({ data, checkedFields, onToggle, disabled }) {
  const defs = getFieldDefs(data.tarifa_pending ?? data.ocr?.tarifa);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden w-full max-w-lg">
      <div className="bg-orange-50 border-b border-orange-100 px-4 py-3">
        <p className="text-sm font-semibold text-orange-800">Datos de tu factura LUMA</p>
        <p className="text-xs text-orange-600 mt-0.5">Marca los campos que necesitan corrección</p>
      </div>
      <div className="divide-y divide-gray-100">
        {defs.map((f) => {
          const checked = checkedFields.includes(f.id);
          return (
            <label
              key={f.id}
              className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-orange-50'
              } ${checked ? 'bg-red-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => !disabled && onToggle(f.id)}
                className="mt-0.5 accent-red-500 w-4 h-4 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500">{f.label}: </span>
                <span className={`text-xs font-semibold break-words ${
                  checked ? 'text-red-600 line-through' : 'text-gray-800'
                }`}>
                  {getFieldValue(data, f.pendingKey)}
                </span>
              </div>
            </label>
          );
        })}
      </div>
      {!disabled && (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          Escribe <span className="font-semibold text-orange-600">listo</span> para continuar ·{' '}
          <span className="font-semibold text-red-600">corregir</span> si marcaste campos ·{' '}
          <span className="font-semibold text-blue-600">ayuda</span> si necesitas orientación
        </div>
      )}
    </div>
  );
}
```

---

### 4. State variables needed

Add these to the main component's useState declarations:

```javascript
const [checkedFields, setCheckedFields] = useState([]);   // fields marked for correction
const [fixQueue,      setFixQueue]      = useState([]);   // ordered list of fields to fix
const [guidedMode,    setGuidedMode]    = useState(false); // true = show hints
```

And the toggle handler:
```javascript
const toggleField = (id) => {
  setCheckedFields(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
};
```

---

## How to Render the Card in the Message Stream

The card is rendered as a special message type `ocr_review` in the message list.

### Step 1 — Add a `say()` helper that supports custom message types

PreQual's `say()` function signature:
```javascript
const say = (content, stepName, extra = {}) => {
  setMessages(prev => [...prev, {
    role: 'assistant',
    content,
    step: stepName,
    timestamp: new Date(),
    ...extra,           // ← spreads type, ocrData, etc.
  }]);
};
```

### Step 2 — Emit the card after OCR completes

After populating `data` with OCR results:
```javascript
say('__OCR_REVIEW__', 'BILL_REVIEW', { type: 'ocr_review', ocrData: newData });
setStep('BILL_REVIEW');
```

### Step 3 — Handle the card in the message renderer

In your `messages.map(...)` render loop:

```jsx
{m.type === 'ocr_review' ? (
  <div className="w-full max-w-lg">
    <OCRReviewCard
      data={m.ocrData ?? data}
      checkedFields={m.locked ? [] : checkedFields}
      onToggle={m.locked ? () => {} : toggleField}
      disabled={!!m.locked}
    />
    <div className="text-xs text-gray-400 mt-1 ml-1">
      {m.timestamp.toLocaleTimeString('es-PR', {hour:'2-digit', minute:'2-digit'})}
    </div>
  </div>
) : (
  // ... your normal bubble renderer
)}
```

The `locked` flag freezes the card once the user moves past the review step,
so they can scroll back and see the confirmed values without accidentally changing them.

---

## The BILL_REVIEW Step Logic

When `step === 'BILL_REVIEW'`, handle user input like this:

```javascript
if (step === 'BILL_REVIEW') {
  const intent = classifyOCRIntent(txt);

  if (intent === 'listo') {
    // Lock the card, confirm data, move on
    setMessages(prev => prev.map(m =>
      m.type === 'ocr_review' ? { ...m, locked: true } : m
    ));
    setCheckedFields([]);
    // ... commit pending values to session data
    // ... move to next step
    return;
  }

  if (intent === 'corregir' || intent === 'ayuda') {
    setGuidedMode(intent === 'ayuda');
    // Build fix queue from checked fields (or all fields if none checked)
    const defs = getFieldDefs(data.tarifa_pending);
    const toFix = checkedFields.length > 0
      ? defs.filter(f => checkedFields.includes(f.id))
      : defs;
    setFixQueue(toFix.map(f => f.fixStep));
    // Move to first fix step
    setStep(toFix[0].fixStep);
    return;
  }

  // Unrecognized input
  say('Por favor escribe "listo" para confirmar, "corregir" si hay errores, o "ayuda" si necesitas orientación.', 'BILL_REVIEW');
  return;
}
```

---

## classifyOCRIntent helper

Copy this exactly from PreQual:

```javascript
const classifyOCRIntent = (txt) => {
  const r = txt.toLowerCase().trim();
  const LISTO   = ['listo','dale','si','sí','ok','okay','bien','perfecto','correcto','exacto',
    'todo bien','todo correcto','está bien','esta bien','adelante','confirmo','continua',
    'seguimos','yes','todo ok','todo está bien'];
  const CORREGIR = ['corregir','correg','no','malo','error','errores','incorrecto','equivocado',
    'mal','falla','falló','fallo','wrong','bad','fix','arreglar','modificar','cambiar',
    'no se ve bien','no está bien','no esta bien','hay error','tiene error'];
  const AYUDA   = ['ayuda','help','como','cómo','que','qué','auxilio','no entiendo','no sé',
    'no se','explicame','explícame','dónde','donde','no encuentro'];
  if (CORREGIR.some(w => r.includes(w))) return 'corregir';
  if (AYUDA.some(w =>    r.includes(w))) return 'ayuda';
  if (LISTO.some(w =>    r.includes(w))) return 'listo';
  return null;
};
```

---

## Data Flow: PreQual → Deal

In the Deal Section, the OCR data arrives TWO ways:

### A) From PreQual handoff (URL parameter)
The session JSON from PreQual already contains confirmed bill data.
Display it in the OCRReviewCard so the user can verify it's still current
(bills change month to month). Pre-populate all `*_pending` fields from
the PreQual session data:

```javascript
// On load, decode the ?d= token and pre-fill:
const prefill = (session) => {
  setData({
    address_pending:       session.address,
    municipio_pending:     session.municipio,
    luma_total_pending:    session.luma_total,
    tarifa_pending:        session.tarifa,
    demanda_pending:       session.demanda_contratada,
    cargo_cliente_pending: session.cargo_cliente,
    cargo_demanda_pending: session.cargo_demanda,
    exceso_kva_pending:    session.exceso_kva,
    exceso_usd_pending:    session.exceso_usd,
    consumo_pending:       session.consumo_kwh,
    costo_kwh_pending:     session.costo_kwh,
  });
};
```

Then display the OCRReviewCard immediately with a message like:
> "Estos son los datos de factura que capturamos en el pre-cuestionario.
>  ¿Siguen siendo correctos, o quieres usar una factura más reciente?"

### B) From a fresh bill upload (if customer uploads a new bill)
Same flow as PreQual — call `POST /api/ocr`, populate `*_pending` fields,
display OCRReviewCard.

---

## FIX Steps (correction flow)

Each field has a `fixStep` (e.g. `FIX_ADDRESS`, `FIX_TOTAL`, etc.).
Copy the FIX step handlers from `PreQual_Solar.jsx` — they are identical
and handle the full correction → confirm → yes/no → next field flow.

Key FIX steps to copy:
- `FIX_ADDRESS`, `FIX_MUNICIPIO`, `FIX_TOTAL`, `FIX_TARIFA`
- `FIX_DEMANDA`, `FIX_CARGO_CLIENTE`, `FIX_CARGO_DEMANDA`
- `FIX_EXCESO_KVA`, `FIX_EXCESO_USD`, `FIX_CONSUMO`, `FIX_COSTO_KWH`

After the fix queue is exhausted:
1. Show the updated OCRReviewCard (with corrected values)
2. Return to `BILL_REVIEW` step so user can confirm the corrections

---

## Summary Checklist

- [ ] Copy `FIELD_DEFS_DEMAND`, `FIELD_DEFS_SECONDARY`, `getFieldDefs()`
- [ ] Copy `getFieldValue()`
- [ ] Copy `fmtUSD()`, `fmtKWH()`, `fmtKVA()` formatters
- [ ] Copy `OCRReviewCard` component
- [ ] Copy `classifyOCRIntent()`
- [ ] Add `checkedFields`, `fixQueue`, `guidedMode` state
- [ ] Add `toggleField` handler
- [ ] Add `ocr_review` case to message renderer
- [ ] Add `BILL_REVIEW` step handler
- [ ] Add all `FIX_*` step handlers
- [ ] Pre-fill from PreQual session data on load
- [ ] Lock card when user confirms with "listo"
