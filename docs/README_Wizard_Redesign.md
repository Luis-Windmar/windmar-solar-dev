# Windmar PreQual — UI Redesign: Chat → Wizard

## Context & Goal

The current `PreQual_Solar.jsx` uses a chat/messaging UI (bubbles, text input,
send button). After field testing, this was found to be cumbersome for what is
actually a simple 4-step process. 

**The goal is to redesign the UI layer only** — replacing the chat interface
with a clean, mobile-first, full-screen card wizard — while keeping ALL existing
business logic, calculations, and API calls exactly as they are.

---

## What STAYS exactly the same (do not touch)

- All calculation functions: `calcEstimate()`, `calcFinancing()`, `getEPC()`, `roundToPanels()`
- All helper functions: `fmtUSD()`, `fmtKWH()`, `fmtKVA()`, `parseNum()`, `parseCostPerKWH()`, `mapTariff()`, `normalizeAddress()`, `extractMunicipio()`, `getYield()`
- All OCR logic: `handleFile()`, the `fetch('/api/ocr', ...)` call
- All field definitions: `FIELD_DEFS_DEMAND`, `FIELD_DEFS_SECONDARY`, `getFieldDefs()`, `getFieldValue()`
- All fix step handlers: `FIX_ADDRESS`, `FIX_MUNICIPIO`, `FIX_TOTAL`, etc.
- The `OCRReviewCard` component (reused as-is in Step 2)
- The `EstimateCard` component (reused as-is in Step 3)
- The `commitAll()` function
- The `classifyOCRIntent()` function
- The lead saving + encryption handoff logic (the `fetch('/api/leads')` and `fetch('/api/encrypt')` calls)
- All state variables: `data`, `step`, `checkedFields`, `fixQueue`, `guidedMode`, `loading`
- The `MUNICIPIO_YIELDS` lookup table and `CFG` config object
- The `windmar.config.js` values embedded in `CFG`

---

## What CHANGES: The UI Layer Only

Replace the entire `return (...)` JSX and the `messages` / `say()` system
with a wizard UI. The `messages` array and `say()` function are no longer needed.

---

## New UI Architecture: 4-Screen Wizard

### Design Principles
- **Mobile-first** — designed for phones first, works on desktop too
- **Large fonts** — minimum 16px body text, 24px+ headings
- **Big touch targets** — buttons minimum 48px tall, full width on mobile
- **No text input except for name and phone** — everything else is buttons
- **One thing per screen** — no scrolling except within the OCR card
- **Progress bar** at the top showing current step

### Screen flow
```
SCREEN 1: Welcome + Upload
     ↓ (bill uploaded + OCR completes)
SCREEN 2: OCR Review (existing OCRReviewCard + confirm/correct buttons)
     ↓ (user confirms OR corrects fields)
SCREEN 3: Estimate (existing EstimateCard + Sí/No buttons)
     ↓ (user says Sí)
SCREEN 4: Contact (name + phone inputs + submit)
     ↓
SCREEN 5: Thank You (confirmation + handoff link button)
```

---

## Branding (unchanged from current)

| Element | Value |
|---------|-------|
| Primary blue | `#1B3F8B` |
| Accent orange | `#F5A623` |
| Background | `#EBF1FF` |
| Banner | White, `3px solid #1B3F8B` bottom border |
| Logo | `<img src="/logo.png" style={{height:'52px'}} />` |
| CTA buttons | `#1B3F8B` background, white text, full width, rounded-xl |
| Secondary buttons | White background, `#1B3F8B` border and text |
| Tailwind CDN | `https://cdn.tailwindcss.com` |

---

## State Variables for the Wizard

Replace `messages` array with a simple `screen` state:

```javascript
// REMOVE these (no longer needed):
// const [messages, setMessages] = useState([]);
// const [input, setInput]       = useState('');

// ADD this:
const [screen, setScreen] = useState('WELCOME'); 
// screens: 'WELCOME' | 'OCR_REVIEW' | 'FIX_FIELD' | 'ESTIMATE' | 'CONTACT' | 'THANKYOU'

// KEEP all existing state:
const [data,          setData]          = useState({});
const [step,          setStep]          = useState('START');
const [loading,       setLoading]       = useState(false);
const [checkedFields, setCheckedFields] = useState([]);
const [fixQueue,      setFixQueue]      = useState([]);
const [guidedMode,    setGuidedMode]    = useState(false);
const [attempts,      setAttempts]      = useState(0);
const [testMode,      setTestMode]      = useState(false);

// NEW state for contact form:
const [nombre,        setNombre]        = useState('');
const [phone,         setPhone]         = useState('');
const [formError,     setFormError]     = useState('');
```

---

## Screen 1: WELCOME

```jsx
// Full screen, centered, logo at top, welcome text, big upload button

<div style={{background:'#EBF1FF', minHeight:'100vh'}}>
  
  {/* Header */}
  <div style={{background:'white', borderBottom:'3px solid #1B3F8B', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px'}}>
    <img src="/logo.png" style={{height:'48px'}} alt="Windmar" />
    <div style={{borderLeft:'2px solid #e5e7eb', paddingLeft:'12px'}}>
      <p style={{color:'#1B3F8B', fontWeight:'600', fontSize:'14px', margin:0}}>Estimado Solar Comercial</p>
      <p style={{color:'#F5A623', fontSize:'12px', margin:0}}>para su negocio</p>
    </div>
  </div>

  {/* Progress bar — Step 1 of 4 */}
  <ProgressBar current={1} total={4} />

  {/* Content */}
  <div style={{padding:'32px 24px', maxWidth:'480px', margin:'0 auto'}}>
    <h1 style={{fontSize:'28px', fontWeight:'700', color:'#1B3F8B', marginBottom:'16px'}}>
      Energía de la Buena™
    </h1>
    <p style={{fontSize:'16px', color:'#374151', lineHeight:'1.6', marginBottom:'32px'}}>
      En menos de 5 minutos te damos un estimado personalizado de sistema solar 
      para tu negocio. Solo necesitamos tu factura de LUMA más reciente.
    </p>
    
    {/* Upload button — big, prominent */}
    <input type="file" ref={fileRef} onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png,.webp,image/*" style={{display:'none'}} />
    <button
      onClick={() => fileRef.current?.click()}
      disabled={loading}
      style={{
        width:'100%', padding:'18px', borderRadius:'12px',
        background:'#1B3F8B', color:'white', fontSize:'18px',
        fontWeight:'600', border:'none', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', gap:'12px'
      }}
    >
      {loading ? '⏳ Procesando factura...' : '📄 Subir Factura de LUMA'}
    </button>
    
    <p style={{fontSize:'13px', color:'#6b7280', textAlign:'center', marginTop:'12px'}}>
      PDF o foto (JPG, PNG) · máximo 20MB
    </p>

    {/* Note about batteries */}
    <div style={{marginTop:'32px', padding:'16px', background:'white', borderRadius:'12px', border:'1px solid #e5e7eb'}}>
      <p style={{fontSize:'13px', color:'#6b7280', margin:0}}>
        * Si quieres explorar un sistema con baterías, completa este estimado primero. 
        Al final te daremos un enlace para la cotización con baterías.
      </p>
    </div>
  </div>
</div>
```

---

## ProgressBar Component

```jsx
function ProgressBar({ current, total }) {
  return (
    <div style={{background:'white', padding:'12px 16px', borderBottom:'1px solid #e5e7eb'}}>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'6px'}}>
        <span style={{fontSize:'12px', color:'#6b7280'}}>Paso {current} de {total}</span>
        <span style={{fontSize:'12px', color:'#1B3F8B', fontWeight:'600'}}>
          {Math.round((current/total)*100)}%
        </span>
      </div>
      <div style={{background:'#e5e7eb', borderRadius:'999px', height:'6px'}}>
        <div style={{
          background:'#F5A623', borderRadius:'999px', height:'6px',
          width:`${(current/total)*100}%`, transition:'width 0.3s ease'
        }} />
      </div>
    </div>
  );
}
```

---

## Screen 2: OCR_REVIEW

Reuse the existing `OCRReviewCard` component exactly as-is.
Replace the text input + "listo/corregir/ayuda" instructions with buttons.

```jsx
<div style={{background:'#EBF1FF', minHeight:'100vh'}}>
  <Header />
  <ProgressBar current={2} total={4} />
  
  <div style={{padding:'24px 16px', maxWidth:'480px', margin:'0 auto'}}>
    <h2 style={{fontSize:'22px', fontWeight:'700', color:'#1B3F8B', marginBottom:'8px'}}>
      Datos de tu Factura
    </h2>
    <p style={{fontSize:'15px', color:'#374151', marginBottom:'20px'}}>
      Revisa que estos datos sean correctos. Marca cualquier campo que necesite corrección.
    </p>

    {/* Existing OCRReviewCard — no changes */}
    <OCRReviewCard
      data={data}
      checkedFields={checkedFields}
      onToggle={toggleField}
      disabled={false}
    />

    {/* Action buttons — replace text input */}
    <div style={{marginTop:'16px', display:'flex', flexDirection:'column', gap:'10px'}}>
      <button
        onClick={() => handleOCRConfirm('listo')}
        style={{
          width:'100%', padding:'16px', borderRadius:'12px',
          background:'#1B3F8B', color:'white', fontSize:'16px',
          fontWeight:'600', border:'none', cursor:'pointer'
        }}
      >
        ✅ Todo correcto — Continuar
      </button>
      
      {checkedFields.length > 0 && (
        <button
          onClick={() => handleOCRConfirm('corregir')}
          style={{
            width:'100%', padding:'16px', borderRadius:'12px',
            background:'white', color:'#1B3F8B', fontSize:'16px',
            fontWeight:'600', border:'2px solid #1B3F8B', cursor:'pointer'
          }}
        >
          ✏️ Corregir {checkedFields.length} campo{checkedFields.length > 1 ? 's' : ''} marcado{checkedFields.length > 1 ? 's' : ''}
        </button>
      )}
      
      <button
        onClick={() => handleOCRConfirm('ayuda')}
        style={{
          width:'100%', padding:'14px', borderRadius:'12px',
          background:'transparent', color:'#6b7280', fontSize:'14px',
          border:'1px solid #e5e7eb', cursor:'pointer'
        }}
      >
        ❓ Necesito ayuda para leer la factura
      </button>
    </div>
  </div>
</div>
```

### handleOCRConfirm function

```javascript
const handleOCRConfirm = (intent) => {
  if (intent === 'listo') {
    setData(p => commitAll(p));
    setCheckedFields([]);
    // Calculate estimate
    const roof = data.roof_sqft || 5000; // will be asked separately or use default
    const est = calcEstimate(data.consumo_kwh || data.consumo_pending, roof, 
      data.municipio || data.municipio_pending, {
        luma_total:    data.luma_total    || data.luma_total_pending,
        cargo_demanda: data.cargo_demanda || data.cargo_demanda_pending || 0,
        exceso_usd:    data.exceso_usd    || data.exceso_usd_pending    || 0,
        consumo_kwh:   data.consumo_kwh   || data.consumo_pending,
      });
    setData(p => ({...p, estimate: est, roof_sqft: roof}));
    setScreen('ESTIMATE');
    return;
  }
  if (intent === 'corregir' || intent === 'ayuda') {
    setGuidedMode(intent === 'ayuda');
    const defs = getFieldDefs(data.tarifa_pending ?? data.ocr?.tarifa);
    const toFix = checkedFields.length > 0
      ? defs.filter(f => checkedFields.includes(f.id))
      : defs;
    const queue = toFix.map(f => f.fixStep);
    setFixQueue(queue.slice(1));
    setCurrentFix(queue[0]);
    setScreen('FIX_FIELD');
  }
};
```

---

## Screen 3: FIX_FIELD

When correcting a field, show a focused single-field correction screen:

```jsx
<div style={{background:'#EBF1FF', minHeight:'100vh'}}>
  <Header />
  <ProgressBar current={2} total={4} />
  
  <div style={{padding:'32px 24px', maxWidth:'480px', margin:'0 auto'}}>
    <h2 style={{fontSize:'22px', fontWeight:'700', color:'#1B3F8B', marginBottom:'8px'}}>
      Corregir: {currentFieldDef?.label}
    </h2>
    
    {guidedMode && currentFieldDef?.hint && (
      <div style={{padding:'14px', background:'#FEF3E2', borderRadius:'10px', marginBottom:'16px', border:'1px solid #F5A623'}}>
        <p style={{fontSize:'14px', color:'#92400e', margin:0}}>
          💡 {currentFieldDef.hint}
        </p>
      </div>
    )}
    
    <input
      type="text"
      placeholder={`Ingresa ${currentFieldDef?.label}...`}
      style={{
        width:'100%', padding:'16px', fontSize:'18px',
        border:'2px solid #1B3F8B', borderRadius:'12px',
        outline:'none', boxSizing:'border-box'
      }}
      autoFocus
      onKeyPress={(e) => e.key === 'Enter' && handleFixSubmit()}
    />
    
    <button
      onClick={handleFixSubmit}
      style={{
        width:'100%', padding:'16px', marginTop:'12px',
        borderRadius:'12px', background:'#1B3F8B', color:'white',
        fontSize:'16px', fontWeight:'600', border:'none', cursor:'pointer'
      }}
    >
      Confirmar
    </button>
  </div>
</div>
```

---

## Screen 4: ESTIMATE

Reuse the existing `EstimateCard` component exactly as-is.
Replace text input with Sí/No buttons.

```jsx
<div style={{background:'#EBF1FF', minHeight:'100vh'}}>
  <Header />
  <ProgressBar current={3} total={4} />
  
  <div style={{padding:'24px 16px', maxWidth:'480px', margin:'0 auto'}}>
    <h2 style={{fontSize:'22px', fontWeight:'700', color:'#1B3F8B', marginBottom:'16px'}}>
      Tu Estimado Solar
    </h2>
    
    {/* Existing EstimateCard — no changes */}
    <EstimateCard est={data.estimate} municipio={data.municipio} />
    
    <p style={{fontSize:'16px', color:'#374151', textAlign:'center', margin:'24px 0 16px'}}>
      ¿Te interesa explorar esto más a fondo?
    </p>
    
    <div style={{display:'flex', gap:'12px'}}>
      <button
        onClick={() => setScreen('CONTACT')}
        style={{
          flex:1, padding:'18px', borderRadius:'12px',
          background:'#1B3F8B', color:'white', fontSize:'18px',
          fontWeight:'700', border:'none', cursor:'pointer'
        }}
      >
        ¡Sí!
      </button>
      <button
        onClick={handleNoInterest}
        style={{
          flex:1, padding:'18px', borderRadius:'12px',
          background:'white', color:'#6b7280', fontSize:'18px',
          fontWeight:'600', border:'2px solid #e5e7eb', cursor:'pointer'
        }}
      >
        No
      </button>
    </div>
  </div>
</div>
```

---

## Screen 5: CONTACT

Replace chat-style name/phone confirmation with a simple form:

```jsx
<div style={{background:'#EBF1FF', minHeight:'100vh'}}>
  <Header />
  <ProgressBar current={4} total={4} />
  
  <div style={{padding:'32px 24px', maxWidth:'480px', margin:'0 auto'}}>
    <h2 style={{fontSize:'24px', fontWeight:'700', color:'#1B3F8B', marginBottom:'8px'}}>
      ¡Casi listo!
    </h2>
    <p style={{fontSize:'16px', color:'#374151', marginBottom:'28px'}}>
      Un consultor certificado de Windmar se pondrá en contacto contigo pronto.
    </p>
    
    <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
      <div>
        <label style={{fontSize:'14px', fontWeight:'600', color:'#1B3F8B', display:'block', marginBottom:'6px'}}>
          Nombre completo
        </label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Tu nombre y apellido"
          style={{
            width:'100%', padding:'14px', fontSize:'16px',
            border:'2px solid #e5e7eb', borderRadius:'10px',
            outline:'none', boxSizing:'border-box'
          }}
        />
      </div>
      
      <div>
        <label style={{fontSize:'14px', fontWeight:'600', color:'#1B3F8B', display:'block', marginBottom:'6px'}}>
          Teléfono
        </label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="787-555-1234"
          style={{
            width:'100%', padding:'14px', fontSize:'16px',
            border:'2px solid #e5e7eb', borderRadius:'10px',
            outline:'none', boxSizing:'border-box'
          }}
        />
      </div>
      
      {formError && (
        <p style={{color:'#dc2626', fontSize:'14px', margin:0}}>{formError}</p>
      )}
      
      <button
        onClick={handleContactSubmit}
        disabled={loading}
        style={{
          width:'100%', padding:'18px', borderRadius:'12px',
          background:'#F5A623', color:'white', fontSize:'18px',
          fontWeight:'700', border:'none', cursor:'pointer', marginTop:'8px'
        }}
      >
        {loading ? '⏳ Enviando...' : '🚀 Enviar y Ver Cotización'}
      </button>
    </div>
  </div>
</div>
```

### handleContactSubmit function

```javascript
const handleContactSubmit = async () => {
  // Validate
  const words = nombre.trim().split(/\s+/).filter(w => w.length > 1);
  if (words.length < 2) { setFormError('Por favor ingresa tu nombre y apellido.'); return; }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) { setFormError('Por favor ingresa un número de teléfono válido (10 dígitos).'); return; }
  
  setFormError('');
  setLoading(true);

  const fmt = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
  const firstName = words[0][0].toUpperCase() + words[0].slice(1).toLowerCase();
  const fullName  = words.map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  const sessionPayload = {
    nombre:             fullName,
    phone:              fmt,
    municipio:          data.municipio,
    address:            data.address,
    tarifa:             data.tarifa,
    demanda_contratada: data.demanda_contratada,
    cargo_cliente:      data.cargo_cliente,
    cargo_demanda:      data.cargo_demanda,
    exceso_kva:         data.exceso_kva,
    exceso_usd:         data.exceso_usd,
    luma_total:         data.luma_total,
    consumo_kwh:        data.consumo_kwh,
    costo_kwh:          data.costo_kwh,
    non_demand_usd:     data.non_demand_usd,
    non_demand_tariff:  data.non_demand_tariff,
    roof_sqft:          data.roof_sqft,
    estimate:           data.estimate,
  };

  try {
    const [leadRes, encRes] = await Promise.all([
      fetch('/api/leads', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(sessionPayload)
      }).then(r => r.json()),
      fetch('/api/encrypt', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ data: sessionPayload })
      }).then(r => r.json()),
    ]);

    const leadId  = leadRes.leadId || '';
    const token   = encRes.token   || '';
    const dealUrl = `http://localhost:3001/deal?d=${encodeURIComponent(token)}&leadId=${encodeURIComponent(leadId)}`;

    setData(p => ({...p, nombre: fullName, phone: fmt, dealUrl, firstName}));
    setScreen('THANKYOU');
  } catch (err) {
    setFormError('Error al enviar. Por favor intenta de nuevo.');
  } finally {
    setLoading(false);
  }
};
```

---

## Screen 6: THANKYOU

```jsx
<div style={{background:'#EBF1FF', minHeight:'100vh'}}>
  <Header />
  
  <div style={{padding:'48px 24px', maxWidth:'480px', margin:'0 auto', textAlign:'center'}}>
    <div style={{fontSize:'64px', marginBottom:'16px'}}>🌞</div>
    <h2 style={{fontSize:'28px', fontWeight:'700', color:'#1B3F8B', marginBottom:'12px'}}>
      ¡Gracias, {data.firstName}!
    </h2>
    <p style={{fontSize:'16px', color:'#374151', lineHeight:'1.6', marginBottom:'32px'}}>
      Un consultor de Windmar se pondrá en contacto contigo al{' '}
      <strong>{data.phone}</strong> muy pronto.
    </p>
    
    <div style={{background:'white', borderRadius:'16px', padding:'24px', border:'1px solid #e5e7eb', marginBottom:'24px'}}>
      <p style={{fontSize:'15px', color:'#374151', marginBottom:'16px'}}>
        Para una cotización más precisa, llena el cuestionario detallado:
      </p>
      <button
        onClick={() => window.open(data.dealUrl, '_blank')}
        style={{
          width:'100%', padding:'18px', borderRadius:'12px',
          background:'#F5A623', color:'white', fontSize:'16px',
          fontWeight:'700', border:'none', cursor:'pointer'
        }}
      >
        📋 Llenar Cuestionario Detallado
      </button>
    </div>
    
    <p style={{fontSize:'14px', color:'#6b7280'}}>
      Energía de la Buena™ · Windmar Commercial
    </p>
  </div>
</div>
```

---

## Main render function structure

```jsx
return (
  <div>
    {screen === 'WELCOME'    && <WelcomeScreen />}
    {screen === 'OCR_REVIEW' && <OCRReviewScreen />}
    {screen === 'FIX_FIELD'  && <FixFieldScreen />}
    {screen === 'ESTIMATE'   && <EstimateScreen />}
    {screen === 'CONTACT'    && <ContactScreen />}
    {screen === 'THANKYOU'   && <ThankYouScreen />}
    
    {/* Test mode toggle — keep in bottom corner */}
    {testMode && <DebugPanel data={data} screen={screen} checkedFields={checkedFields} fixQueue={fixQueue} />}
    <button
      onClick={() => setTestMode(p => !p)}
      style={{position:'fixed', bottom:'12px', right:'12px', fontSize:'11px', 
              color:'#9ca3af', background:'transparent', border:'none', cursor:'pointer'}}
    >
      {testMode ? '🔴 Ocultar debug' : '🧪 Modo prueba'}
    </button>
  </div>
);
```

---

## Roof Size Step

In the current PreQual, roof size is collected as a text input between OCR review
and the Estimate screen. In the wizard, add it as part of Screen 2 (OCR Review)
or as a simple half-screen between OCR and Estimate:

```jsx
// Simple roof size buttons — no text input needed
<div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'16px'}}>
  {[
    { label:'Pequeño',    sub:'< 2,500 pies²',   sqft:1500  },
    { label:'Mediano',    sub:'2,500–5,000 pies²', sqft:3750  },
    { label:'Grande',     sub:'5,000–10,000 pies²', sqft:7500  },
    { label:'Industrial', sub:'> 10,000 pies²',   sqft:30000 },
  ].map(opt => (
    <button
      key={opt.label}
      onClick={() => handleRoofSelect(opt.sqft)}
      style={{
        padding:'16px 12px', borderRadius:'12px', background:'white',
        border:'2px solid #e5e7eb', cursor:'pointer', textAlign:'center'
      }}
    >
      <div style={{fontSize:'16px', fontWeight:'600', color:'#1B3F8B'}}>{opt.label}</div>
      <div style={{fontSize:'12px', color:'#6b7280', marginTop:'4px'}}>{opt.sub}</div>
    </button>
  ))}
</div>
```

Or allow numeric entry with a large text input below the buttons as an alternative.

---

## Build & Deploy (unchanged)

After building the new JSX:
```bash
cd ~/Desktop/IQ_Claude/PreQual_Deal/windmar
cp ~/Downloads/PreQual_Solar.jsx src/PreQual_Solar_api.jsx
./patch_and_build.sh prequal
```

Access at: `http://localhost:3001/prequal`

See `README_Project_Structure.md` for full build details.
