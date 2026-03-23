# Windmar Deal Section — Session Handoff README
_Last updated: February 2026_

---

## Project Overview

Windmar Energy (Puerto Rico) solar sales platform with two components:

| Component | File | Purpose |
|---|---|---|
| PreQual | `PreQual_Solar.jsx` | Lead qualification, instant estimate, encrypted handoff link |
| Deal Section | `Cuestionario_Solar_INTEGRATED.jsx` | Full questionnaire for warm leads (~5,500 lines, 54 step handlers) |

Both are React single-file apps served by a shared Node/Express backend (`server.js`).

---

## Project Directory

```
~/Desktop/IQ_Clone/PreQual_Deal/windmar/
├── server.js                         # Express backend — OCR, encrypt/decrypt, leads
├── .env                              # ANTHROPIC_API_KEY, ENCRYPTION_KEY, PORT
├── src/
│   └── DealSection_api.jsx           # Source for the deal section (copy JSX here)
├── public/
│   ├── deal.html                     # Compiled output served at /deal
│   └── prequal.html                  # Compiled output served at /prequal
├── patch_and_build.sh                # Build script: ./patch_and_build.sh deal
└── apply_prequal_handoff.js          # Pre-build patcher
```

### Deploy workflow
```bash
cp Cuestionario_Solar_INTEGRATED.jsx src/DealSection_api.jsx
./patch_and_build.sh deal
# Then access at http://localhost:3001/deal
# NOT at localhost:3000 — OCR proxy only works through the Express server
```

---

## Two User Types

| Type | How they arrive | What's pre-populated |
|---|---|---|
| **Prequal lead** | `?d=<encrypted_token>` URL param | nombre, phone, municipio, address, tarifa, luma_total, consumo_kwh, roof_sqft, estimate, all LUMA bill fields |
| **Fresh lead** | No URL params | Nothing — all questions asked |

Detection: `sessionData._from_prequal === true`

The encrypted token is decrypted server-side via `POST /api/decrypt` on component mount. All prequal session data merges into `sessionData`.

### Example prequal session data (from debug panel)
```json
{
  "nombre": "Pedro Perez",
  "phone": "787-999-0000",
  "municipio": "Barceloneta",
  "address": "00000 CARR 2 KM 55.8 SECTOR CRUCE DAVILA BO. FLO AFU BARCELONETA, PR 00617",
  "tarifa": "Secundaria",
  "luma_total": 3030.04,
  "consumo_kwh": 6049,
  "costo_kwh": 0.2291,
  "roof_sqft": 50000,
  "estimate": { "systemKwp": "47.1", "numPanels": 115, ... },
  "_from_prequal": true
}
```

---

## Step Map (logicTree)

```
1.1  Test mode?
2.1  Welcome (dynamic — personalized for prequal vs fresh)
3.1  Referidor / consultor name
3.2  Referidor email
4.1  Business name
4.2  Contact name          ← SKIPPED for prequal (nombre already known)
4.3  Phone                 ← SKIPPED for prequal
4.4  Email                 ← personalized prompt: "Perfecto, [firstName]. ¿Nos compartes tu correo?"
4.5  Alternate contact? (sí/no)
4.6-4.9  Alternate contact details (conditional)
4.10-4.12 Technical contact details (conditional)
4.13 Entity type (LLC, Corp, etc.)
4.14 Business activity
4.15 High-risk activity?
5.1  Services selection (solar, batteries, repairs, sellado)
  5.2-5.2.condition  Sellado flow (hormigón roof qualification)
  5.3-5.4            Battery backup % 
  5.5-5.8            Repairs flow (asset → problem → urgency ← WITH CONFIRMATION)
6.1  Business address      ← SKIPPED for prequal (_from_prequal + address + municipio)
6.2  CRIM number
7.1  Dimensioning method   ← SKIPPED for prequal (auto-sets to 'factura', goes to 7.1.prequal)
7.1.prequal  Meter count confirmation (prequal path only)
7.2  Meter count (fresh path)
7.3  Bill upload (real OCR via /api/ocr)  → BILL_REVIEW card
BILL_REVIEW  OCR card review (listo/corregir/ayuda)
FIX_*        Individual field correction handlers
8    Roof count
8.1.size     Roof size     ← prequal shows "Veo que tienes un techo de X pies². ¿Es correcto?"
8.1.material Roof material
8.1.condition Roof condition
9.1  Payment method (contado / financiamiento / no sé)
10.1 Commercial credit?
  YES → 10.2 Bank name → 10.3 Credit officer? → 10.4 Officer name → 10.5
  NO  → Skip to 10.5 with Windmar Finance explanation
10.5 Windmar bank partnership (sí/no)
11.1 Quote card (showQuote helper) — cash or financing
12.1 Customer decision (sí/pensarlo/no)
12.2 Callback time (if pensarlo)
12.3 Deposit confirmation (if sí)
13.1 Notes & closing
```

---

## Key Architecture Patterns

### Step Handler Pattern
Every step handler follows this structure:
```javascript
if (currentStep === 'X.X') {
  // CONFIRMATION MODE — _pending key exists
  if (sessionData.field_pending !== undefined) {
    const { isYes, isNo, isUnclear } = validateYesNo(userInput);
    if (isUnclear) { /* retry up to MAX_ATTEMPTS, then showExitMessage() */ }
    if (isNo)  { /* clear pending, re-ask */ }
    // isYes: commit, advance
  }
  // ENTRY MODE — parse input, set _pending, ask "¿X es correcto? (sí/no)"
}
```

### Prequal Skip Pattern
ALL transitions use the generic resolver at the bottom of `process()`:
```javascript
// Default: move to next step
if (currentStepData.next) {
  let resolvedNextId = currentStepData.next;
  // Skip 6.1 for prequal — address already known
  if (resolvedNextId === '6.1' && sessionData._from_prequal && sessionData.address && sessionData.municipio) {
    setSessionData(prev => ({ ...prev, business_address: prev.address }));
    resolvedNextId = '6.2';
  }
  const nextStep = logicTree.find(s => s.id === resolvedNextId);
  if (nextStep) { ... }
}
```
**Important:** Individual transition handlers also have prequal checks, but the generic resolver is the definitive intercept point for logicTree `next:` jumps.

### OCR Card (BILL_REVIEW)
- Module-level: `fmtUSD/KWH/KVA`, `classifyOCRIntent`, `FIELD_DEFS_DEMAND/SECONDARY`, `getFieldDefs`, `getFieldValue`, `OCRReviewCard` component
- State: `checkedFields`, `fixQueue`, `guidedMode`
- Helpers inside component: `toggleField`, `commitAllOCR`, `startNextFix`
- Message type `'ocr_review'` renders `<OCRReviewCard>` instead of a text bubble
- User commands: `listo` (confirm all), `corregir` (fix checked fields), `ayuda` (guided mode with hints)
- FIX_* handlers: FIX_ADDRESS, FIX_MUNICIPIO, FIX_TOTAL, FIX_TARIFA, FIX_DEMANDA, FIX_CARGO_CLIENTE, FIX_CARGO_DEMANDA, FIX_EXCESO_KVA, FIX_EXCESO_USD, FIX_CONSUMO, FIX_COSTO_KWH

### OCR API Call (handleFileUpload)
```javascript
const formData = new FormData();
formData.append('bill', file);          // field name must be 'bill'
fetch('/api/ocr', { method: 'POST', body: formData })  // relative URL → Express proxy
```
Server (`server.js`) reads `ANTHROPIC_API_KEY` from `.env`, calls `claude-opus-4-6`, returns:
```json
{ "success": true, "data": { "total_adeudado": 3030.04, "tarifa": "Secundaria", ... } }
```
Server field name is `costo_kwh` (not `costo_promedio_kwh`).

### Quote Card (showQuote helper)
Called from 9.1 (cash) or 10.5 (financing). Builds `quoteMsg` string.
- Cash: shows 20% deposit / 50% pre-install / 30% on completion breakdown
- Financing: shows monthly payment, net savings, pago balloon (mes 84), 9% annual / 15yr amortization
- Header uses `━━━` dashes (not box-drawing chars) to avoid bubble overflow

### Financing Terms
```
Interest rate:    9% annual
Amortization:     15 years (180 months)
Balloon payment:  month 84
Facility fee:     2% of system cost
Security deposit: 3% of system cost
Doc fee:          $500
```

---

## Windmar Branding
```
Primary blue:     #1B3F8B
Background:       #EBF1FF
Accent orange:    #F5A623
```

---

## Server API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/ocr` | POST multipart `bill` | Extract LUMA bill data via Claude Vision |
| `/api/encrypt` | POST `{ data }` | Encrypt prequal session → token |
| `/api/decrypt` | POST `{ token }` | Decrypt token → session data |
| `/api/leads` | POST | Save lead JSON to `leads/` folder |
| `/api/leads/:id` | GET | Retrieve lead by ID |
| `/api/health` | GET | Check API key + encryption config |

---

## Fixes Applied This Session

### OCR Review Card (new feature)
Replaced old field-by-field bill review (steps 7.3.a–7.3.g) with interactive card UI showing all fields at once with checkboxes. Matches PreQual_Solar.jsx implementation.

### Prequal Skip Logic
- **Step 4.2/4.3**: Skipped, name/phone already known
- **Step 4.4**: Personalized prompt "Perfecto, [firstName]. ¿Nos compartes tu correo?"
- **Step 6.1**: Skipped via generic resolver intercept — `resolvedNextId` redirected to `6.2`
- **Step 7.1**: Auto-sets `dimensioning_method: 'factura'`, goes to `7.1.prequal`
- **Step 7.1.prequal** (no = 1 meter): Shows OCR card with prequal bill data for re-verification
- **Step 8.1.size**: Shows "Veo que tienes un techo de X pies². ¿Es correcto?" instead of generic prompt

### Bug Fixes
- **4.4 double prompt**: `_4_4_prompt_shown` flag prevents handler from re-firing after transition already showed prompt
- **5.8 urgency**: Added full confirmation loop (entry → "¿La urgencia es X?" → yes/no → advance)
- **9.1 duplicate ¡Listo!**: Split into two separate messages
- **10.1 duplicate prompt**: Transition now includes the credit question inline; `_10_1_shown` flag prevents double-emit
- **10.1 answer "no"**: Skips 10.2-10.4, goes to 10.5 with Windmar Finance explanation
- **10.5 prompt**: Updated to "¿Estarías dispuesto a trabajar con Windmar para solicitar crédito a través de un banco?"
- **Quote header overflow**: Replaced `╔══╗` box chars with `━━━` dashes
- **"pago globo"**: Renamed to "pago balloon" everywhere
- **Generic resolver**: Added prequal-aware `resolvedNextId` intercept for 6.1 — this was the root cause of 6.1 showing for prequal users (the logicTree `next:` jump bypassed all individual handler checks)

---

## Known Issues / Next Steps

These were identified but not yet tested end-to-end:

1. **Second meter OCR** — upload flow for `current_meter_upload > 1` needs live testing with real PDF
2. **Fresh lead flow** — full pass-through without `?d=` param to confirm no regressions
3. **Step 8 multi-roof** — prequal path only tested for 1 roof; multi-roof prequal path untested
4. **Step 12/13 closing** — decision → deposit → closing flow not recently tested
5. **Download quote** — `downloadQuote()` function exists but output format not recently reviewed
6. **High-risk path** — `high_risk === 'yes'` forces cash only; integration with quote not recently tested

---

## Testing Commands (debug mode)

In the chat input while `test_mode: on`:
```
/jump 6.2        — jump to any step by ID
/restart         — reset session
/exit            — end session
```

**Important:** Always test prequal skips via the natural flow, not `/jump` — jumping directly bypasses all transition logic.

---

## Files to Upload in Next Chat

1. `Cuestionario_Solar_INTEGRATED.jsx` — current working file (always upload latest)
2. `PreQual_Solar.jsx` — for reference when syncing patterns
3. `server.js` — for reference on API routes
4. This README

Claude has access to the file at `/home/claude/Cuestionario_Solar_INTEGRATED.jsx` in the container during the session.
