# Windmar Commercial — PreQual Solar Wizard
## Comprehensive As-Built Specification — **Verified Against Code**
*Verified: 2026-05-25. Source of truth: `windmar_dev/` working tree (server.js, src/*.jsx, config/pricing.json, package.json, build.js, patch_and_build.sh). Original spec was compiled from documentation against the production `windmar/` branch and predates several dev-branch features; this revision is a strict factual snapshot of what exists in dev today. Section 14 is preserved verbatim per the verification instructions.*

---

## 1. Purpose & Context

The PreQual Wizard is a **mobile-first, tablet-facing React application** operated by Windmar Commercial sales reps. The rep holds the tablet and walks a commercial prospect through a short qualification flow that:

1. Asks two intent questions (bill availability + electrical service type)
2. Captures and OCR-reads the prospect's LUMA electricity bill
3. Collects roof area
4. Computes a preliminary solar system estimate and lets the rep tune **autonomy hours** inline via a battery-backup slider
5. Collects minimal contact info
6. Creates a Zoho `Commercial_Lead` record, attaches the LUMA bill, generates a customer-facing estimate PDF server-side, attaches the PDF to the lead, and offers it as a download to the rep
7. Optionally hands the prospect off to a separate SmartSheet questionnaire (the Deal Section CTA is currently commented out in `ThankYouScreen.jsx`)

**The rep, not the prospect, operates the device.**

A dev/demo toggle ("Generar lead SI/NO") at the bottom of WelcomeScreen lets the rep skip Zoho lead creation and PDF attachment while still generating the PDF locally — marked for removal before production.

---

## 2. Deployment & Stack

| Item | Value |
|------|-------|
| Production URL | `windmar-commercial-estimator.vercel.app` |
| Hosting | Vercel (`@vercel/node`) — Railway is no longer used |
| Path | `/prequal` |
| Backend | Node.js / Express (`server.js`) — exports the Express `app` for Vercel serverless |
| Frontend | React 19 (single-page, no router), built via esbuild |
| Build script | `./patch_and_build.sh` (no argument) — internally runs `node build.js` |
| Deploy command | `vercel --prod` (manual; GitHub auto-deploy is not configured) |
| Local port | `3001` |
| AI service | Anthropic API — `claude-opus-4-6` for OCR (`server.js:341`) |
| CRM | Zoho CRM — `Commercial_Lead` module |
| External pricing source | Windmar Commercial Tool Belt (`windmar-commercial-toolbelt.vercel.app/api/v1`) — proxied via `/api/pricing`, `/api/solar-resource`, `/api/area-to-system` |

---

## 3. Directory Structure

```
windmar_dev/
├── server.js                          # Express server; all API endpoints
├── build.js                           # esbuild driver — bundles src/prequal_main.jsx
├── package.json                       # name: windmar-prequal; React 19, Express 5, pdf-lib, multer, @anthropic-ai/sdk
├── patch_and_build.sh                 # Thin wrapper: `set -e; node build.js`
├── vercel.json                        # Vercel deployment config
├── .env                               # API keys — not committed
├── PreQual_Solar.jsx                  # LEGACY chat-style UI (not imported anywhere in the live build)
├── Cuestionario_Solar_INTEGRATED.jsx  # Deal section questionnaire (separate flow; do not modify)
├── src/                               # React source (wizard screens)
│   ├── prequal_main.jsx               # Entry — mounts <WelcomeScreen/>
│   ├── WelcomeScreen.jsx              # App root + all screen routing + pricing fetch
│   ├── UploadScreen.jsx               # Bill upload, OCR, editable review
│   ├── RoofScreen.jsx                 # Roof size selector
│   ├── EstimateScreen.jsx             # System sizing, pricing, autonomy/backup slider, battery sizing logic
│   ├── BatteryIntentScreen.jsx        # ⚠ EXISTS but never routed to — orphan file
│   ├── ContactScreen.jsx              # Lead capture form
│   ├── ThankYouScreen.jsx             # PDF download, Zoho confirmation, SmartSheet link
│   ├── shared.jsx                     # <Header>, <ProgressBar>
│   └── PreQual_Solar_api.jsx          # LEGACY (not imported)
├── public/                            # esbuild output + static assets served by Express
│   ├── prequal.bundle.js              # Built React bundle
│   ├── prequal.html                   # HTML shell with cache-busting ?v= query string
│   ├── Estimate_template_loan.pdf     # PDF template for systems ≥ $60k
│   ├── Estimate_template_cash.pdf     # PDF template for systems < $60k
│   ├── cotizacion_wrapper.pdf         # Multi-page wrapper (cover + facilities pages)
│   ├── logo.png, financing_icon.png, paperclip_icon.png, hand_shake.jpg, … (UI assets)
├── config/
│   ├── pricing.json                   # Local fallback only — not read at runtime (see §8)
│   ├── pricing.csv                    # Source for pricing.json
│   └── pricing_correction.csv         # Untracked, used by update_pricing.sh
├── scripts/
│   └── csv_to_pricing.js              # Builds pricing.json from pricing.csv
├── docs/                              # Design & integration docs (session notes, migration briefs, this spec)
├── prompts/                           # One-off task prompt files
├── leads/                             # Lead JSON files (writable only when filesystem allows; Vercel = read-only)
├── wrap-up/                           # Session deliverable copies
├── API/, scripts/, test/, node_modules/
```

---

## 4. Wizard Screen Flow

### Live flow (as routed in `WelcomeScreen.jsx`)

```
Screen 1 — WelcomeScreen ("welcome")
     ↓  (selection === "si")
Screen 2 — UploadScreen ("upload")
     ↓  (rep taps "Todo bien. Listo")
Screen 3 — RoofScreen ("roof")
     ↓  (rep taps "Continuar")
Screen 4 — EstimateScreen ("estimate")     ← contains inline autonomy/backup slider; sole battery-hours UI
     ↓  (rep taps "Sí me interesa" → contact; "No por ahora" → thankyou-no)
Screen 5 — ContactScreen ("contact")
     ↓  (rep submits)
Screen 6 — ThankYouScreen ("thankyou-yes" | "thankyou-no")
```

**Graceful-exit branch:** Selecting "No, en otro momento" on Screen 1 routes to a `"exit"` screen state showing a "¡Gracias por tu tiempo!" card and an "Atrás" button back to Welcome.

**Progress bar:** Every routed screen renders `<ProgressBar current={N} total={6} />` where N = 1 (Welcome), 2 (Upload), 3 (Roof), 5 (Estimate **and** Contact — both report "Paso 5 de 6"). The total of 6 leaves a gap at step 4 — the never-rendered `BatteryIntentScreen` (see §5.4 below). ThankYouScreen has no progress bar.

---

## 5. Screen-by-Screen Detail

### 5.1 — WelcomeScreen (Step 1 of 6)

**Purpose:** Establish intent; gate entry on bill availability; capture electrical service type.

**UI elements:**
- Windmar logo in white header with `3px solid #1B3F8B` bottom border (logo file: `/logo.png`)
- Progress bar (Paso 1 de 6)
- Heading: "¡Bienvenido!"
- Sub-heading: "Estimado Solar Comercial"
- Body copy: "En menos de 5 minutos te vamos a decir cuánto te puedes ahorrar..."
- **Dropdown #1 — "¿Tienes la factura de LUMA de tu negocio a la mano?"**
  - Options: `"Sí, tengo la factura"` (value `si`) / `"No, en otro momento"` (value `no`)
- **Dropdown #2 — "¿Sabes qué tipo de servicio eléctrico tienes?"**
  - Options: `"Bifásico (240V L-L)"` (`bifasico_240`), `"Trifásico (208V)"` (`trifasico_208`), `"Trifásico (480V)"` (`trifasico_480`), `"No lo sé"` (`no_se`, default)
  - Stored on the OCR data object as `serviceType`; currently passed through but **not consumed downstream** (no sizing/Zoho mapping)
- **CTA**: navy "Continuar" when `selection === "si"`; gray "Entendido" when `"no"`; disabled until a selection is made
- **Bottom note card**: financing icon + text "Windmar Comercial ofrece opciones de financiamiento. Entre ellas, 15 años sin pronto..."
- **Demo toggle**: "Generar lead SI/NO" pill button (TODO: remove before production)

**Loading state:** While `/api/pricing` resolves on mount, the screen renders a centered "Cargando…" placeholder; the rest of the form does not appear until pricing is loaded (success or failure).

**Side effects on mount:**
- `fetch("/api/pricing")` → stores the response in `pricing` state, passed to EstimateScreen
- Defines `fetchSolarConfig(municipio, sqft)` closure that bundles `GET /api/solar-resource` + `GET /api/area-to-system` for the estimate screen to call later

---

### 5.2 — UploadScreen (Step 2 of 6)

**Purpose:** Capture the LUMA bill, extract bill data via Anthropic OCR, allow rep to review/correct.

**Three internal stages** (component state `stage`):

1. **`idle`** — large dashed drop-zone with paperclip icon; tap to open file picker; drag-and-drop also supported. Accepts `image/*` and `application/pdf`; `multiple` allowed. Below the drop-zone: a tips card and a subtle "usar datos de prueba" link that bypasses OCR and seeds a `MOCK_OCR` object (TODO: remove before production).
2. **`processing`** — file chip + animated orange progress bar with four checklist rows (Leyendo documento → Identificando tarifa LUMA → Extrayendo consumo y demanda → Calculando costo por kWh). Pauses at 92% while waiting for Anthropic; sprints to 100% on completion.
3. **`done`** — review card; each OCR field shown as an editable input with a `Leído: …` label above showing the raw extracted value. There is **no checkbox UI, no intent classifier ("listo"/"corregir"/"ayuda") and no FIX_* step queue** in the dev build — the rep simply edits inputs and taps a single orange "Todo bien. Listo" button.

**Client-side pre-flight (`handleFileChange`):**
- PDFs > 4 MB are blocked locally (4 MB is the Vercel inbound serverless edge limit, with ~0.5 MB margin).
- Images > 4 MB are scaled down via an HTML5 canvas re-encode at JPEG quality 0.88 before upload.

**OCR API call:**
```
POST /api/ocr
Content-Type: multipart/form-data
field name: bills        (singular spec said "bill" — actual server uses upload.array('bills', 10))
→ Returns { success: true, data: { ... } }   (see §7.1 for full shape)
```

**Review-card field set** (single `FIELDS` array — there is no longer a tariff-based `FIELD_DEFS_DEMAND` vs `FIELD_DEFS_SECONDARY` split; every field is rendered for every tariff):

| Field key | Label | Input type |
|---|---|---|
| `nombreNegocio` | Nombre del negocio | text input |
| `direccion` | Dirección | textarea |
| `municipio` | Municipio | text input |
| `tariff` | Tarifa LUMA | text input |
| `consumoKWH` | Consumo promedio | text input (formatted `"38,880 kWh"`) |
| `demandaKVA` | Demanda contratada | text input (formatted `"150.00 kVA"`) |
| `totalFactura` | Total facturado | text input (formatted `"$10,599.08"`) |
| `costoPorKWH` | Costo por kWh | text input (formatted `"0.2479"`; suffix `" $/kWh"` shown only on the `Leído:` line) |

**Hidden pass-through fields** (held in component state, never rendered as inputs, used by `calcEstimate`): `cargoCliente`, `cargoDemanda`, `excesoUSD`, `excesoKVA`.

**Normalization (`normalizeOCR`):**
- `consumoPromedio` = mean of non-zero entries in `consumos_mensuales[]`.
- `avgMonthlyBill` = Σ(consumo_i × tasa_i) ÷ **total months in the array** (not non-zero months — zero-consumption months still count toward the divisor).
- `effectiveRate` = (avgMonthlyBill − cargoCliente − cargoDemanda − excesoUSD) ÷ consumoPromedio. This **replaces** the model-supplied `costo_kwh` on the review screen.
- `nombreNegocio` and `direccion` are wrapped with a literal `"TEST - "` prefix (TODO: remove before production).
- The original `consumos_mensuales[]` and `tasas_mensuales[]` arrays are dropped after normalization — not passed downstream.

**⚠ Known constraint:** `demandaKVA` is stored in **kVA**, not USD. OCR has historically confused these. Downstream, `EstimateScreen.jsx:352` floors any value below 50 up to 50 (regulatory Secundaria minimum and OCR-miss safety net).

**Validation:** None on the review card. The "Todo bien. Listo" CTA is always enabled.

---

### 5.3 — RoofScreen (Step 3 of 6)

**Purpose:** Capture approximate roof area as the second sizing input.

**UI:** 4 tappable icon cards in a 2×2 grid (no sub-labels rendered):

| Label | sqft value seeded |
|-------|-------------------|
| Pequeño | 2,000 |
| Mediano | 7,500 |
| Grande | 15,000 |
| Industrial | 50,000 |

**Numeric override input** below the cards (always present). Formats on blur to `"X,XXX Sq Ft"`; strips formatting on focus. The "Continuar" navy button is disabled until the input parses to a positive number. On confirm, calls `onNext(effectiveSqft)`.

---

### 5.4 — *Removed flow node* — Screen 3.5 / BatteryIntentScreen

**Status in dev:** `src/BatteryIntentScreen.jsx` **exists** as a file (a standalone screen with a 0–24 h backup slider and "¿Deseas incluir almacenamiento de energía?" heading) but is **never imported or rendered** by `WelcomeScreen.jsx`. The dev flow goes directly Roof → Estimate. The backup/autonomy selection happens entirely inline on EstimateScreen (see §5.5 below). The orphan file is retained in the tree but is not part of the live build.

---

### 5.5 — EstimateScreen (Step 5 of 6)

**Purpose:** Show the solar estimate and let the rep tune the autonomy/backup-hours level inline; reveal financing block when the total crosses the $60,000 threshold.

**On mount, in parallel:**
- Calls `fetchSolarConfig(municipio, sqft)` to retrieve `specific_yield` (kWh/kWp/yr) and `kw` (max system from roof, with buffer) from the Tool Belt. Falls back silently to hardcoded values if either call fails.
- Runs `calcEstimate(...)` (see §7.1) and conditionally `calcBatterySystem(...)` when `batteryHours > 0`.

**Visible card layout (top to bottom):**

1. **Generación / Cubre / Respaldo card** (always shown):
   - `Generación: {systemKwp} kWp`
   - `Cubre: {coverage}% de tu consumo`
   - `Respaldo estimado: {batteryResult?.actualHours ?? 0} horas`

2. **Savings highlight** (navy with orange accent):
   - Headline: **Ahorro mensual\***
   - Footnote: `*compra de contado`
   - Value: `{savingsCash}` formatted as `$X,XXX`

3. **Investment card**:
   - `Precio de contado: ${totalCost}` (solar + battery if any)
   - `Recuperas la inversión en: {Math.ceil(totalCost / (savingsCash × 12))} años`

4. **Financing block — *conditional on `totalCost >= 60000`***:
   - Title: "¿Prefieres financiar?"
   - `Pronto pago: $0`
   - `Pago mensual: ${totalMonthlyPmt}`
   - `Ahorro mensual neto: ${savingsCash − totalMonthlyPmt}` (bold)

5. **Autonomy / backup slider card** (always rendered):
   - Heading: **"Ajusta el nivel de respaldo"**
   - Subtitle: *"Decide cuánto quieres ahorrarte en tu factura de LUMA"* (note: the subtitle frames the control as a savings adjuster, but the slider actually controls backup hours; the subtitle is misleading copy carried forward from an earlier design)
   - Discrete slider with 6 positions: **0, 4, 8, 12, 16, 24 hours** (the constant `SLIDER_HOURS`)
   - Live value display: `"Sin almacenamiento"` at 0, otherwise `"{N} horas de respaldo"`
   - This is the sole entry point in the live flow for choosing battery sizing; default starts at **0** because the removed Screen 3.5 used to seed this value upstream.
   - Recomputes `batteryResult` and `totalCost` and re-runs `calcFinancing` on every slider change.

**CTAs:**
- Orange "Sí me interesa" → ContactScreen
- Gray "No por ahora" → ThankYouScreen (not-interested branch)
- Ghost "Atrás" → RoofScreen

**Error boundary:** `EstimateScreen` wraps `EstimateScreenInner` in a try/catch and renders an amber error card with the exception message + stack on failure (so a bad OCR field never throws an unhandled error mid-demo).

---

### 5.6 — ContactScreen (Step 5 of 6, shares step number with Estimate)

**Purpose:** Capture minimum contact data needed to create a Zoho lead.

**Fields:**
- **Nombre completo** (text input, seeded with literal `"TEST - "` — TODO: remove before production)
- **Teléfono** (tel input)
- **Consultor en Estimado** (text input, seeded with literal `"TEST - "`) — optional
- **¿Tienes su correo electrónico?** (email input) — optional

**Validation:**
- `canSubmit = nombre.trim().length > 1 && phone.trim().length >= 7`
- No e-mail format check.

**On submit:**
1. If `generateLead === false` (demo toggle off): builds a local `contactPayload`, skips the server call, and routes directly to ThankYouScreen.
2. Otherwise: `POST /api/leads` with name + phone + key OCR + sqft + consultor email. Server saves the lead JSON locally if the filesystem is writable (Vercel is not) and returns `{ leadId, quoteNumber }`. **No `/api/encrypt` handoff is performed** — the encrypt/decrypt endpoints still exist on the server but the wizard no longer drives them.
3. Non-blocking error: if `/api/leads` fails, the screen surfaces a red error card and a "Continuar de todas formas →" button so the rep can advance anyway.

**Note:** The PDF is **not** generated here — it's generated on ThankYouScreen.

---

### 5.7 — ThankYouScreen (Step 6 of 6)

**Interested branch (`thankyou-yes`):**

- Renders a card with a "¡Todo listo!" heading and the "todo_listo_icon" image.

**On mount it kicks off a multi-step async chain (idempotent guard via `useEffect` mount-only dep array):**

1. (If `generateLead === true`) **`POST /api/zoho-lead`** — multipart upload of `leadData` (JSON) + zero or more `billFile` parts (each LUMA bill renamed to `"PreQual - {originalName}"`).
   - Server creates a `Commercial_Lead` record, attaches each bill, reads back `Com_Lead_Name`, and creates a separate "PreQual Wizard" note. Returns `{ zohoLeadId, commercialLeadName }`.
2. **`POST /api/generate-and-attach-pdf`** — server generates the estimate PDF using `pdf-lib`, overlaying customer/system/financing values onto either `Estimate_template_loan.pdf` (totalPrice ≥ $60k) or `Estimate_template_cash.pdf` (< $60k), then prepends a cover page and appends additional pages from `cotizacion_wrapper.pdf`. If `leadId` was passed, the server also attaches the PDF to the Zoho lead. Returns `{ pdfBase64 }`.
3. The base64 PDF is decoded into a `Blob` held in `blobRef.current`; the "⬇ Descargar estimado" button becomes enabled.

**If `generateLead === false`:** Zoho is skipped entirely; only `/api/generate-and-attach-pdf` runs (without `leadId`) so the rep still gets a downloadable PDF.

**CTAs on the interested branch:**
- Disabled "Preparando estimado…" / enabled "⬇ Descargar estimado" — downloads `Windmar_Estimado_{commercialLeadName||'Solar'}.pdf`
- Orange "Completar cuestionario completo →" — opens the SmartSheet form at `https://app.smartsheet.com/b/form/9f6e441c850e439a9ea42a82e46b774e` in a new tab
- Ghost "Nueva consulta" — calls `onRestart`
- A commented-out anchor to the legacy Deal Section (`https://windmar-solar-production.up.railway.app/deal`) is preserved in source but not rendered (`TODO: Re-enable Deal questionnaire when ready to launch`)

**Not-interested branch (`thankyou-no`):**
- Hand-shake icon + "¡Gracias por tu tiempo!" copy + navy "Volver al inicio" button → calls `onRestart`

**Address parsing:** Before sending to Zoho, the wizard normalizes `"BY PASS"` → `"BYPASS"`, extracts a PR ZIP (`00600`–`00988`), and strips a trailing `"{MUNICIPIO} PR {ZIP}"` suffix from the street line so Zoho's `Address` and `Zip_Code` fields are clean.

---

## 6. Design System

| Token | Value |
|-------|-------|
| Background | `#EBF1FF` (light blue — differentiates commercial from residential) |
| Navy / primary | `#1B3F8B` |
| Orange / accent | `#F5A623` |
| Header | White background, `3px solid #1B3F8B` bottom border |
| Progress fill | `#F5A623` orange |
| OCR edit inputs | bg `#dbeafe`, border `2px solid #93c5fd`, color `#1e3a8a` |
| Font | `'Segoe UI'`, system-ui, sans-serif |
| Min body font | 16px |
| Min button height | ~52px (`padding: 16px`) |
| Border radius | 10px inputs/buttons, 16px cards |
| Max content width | 480px centered |
| Slider track | `#d1d5db` (light gray) |
| Slider thumb | `#1B3F8B` navy (28 × 28 px) |

**Logo:** Served as a static asset at `/logo.png` from `public/`. Referenced in `shared.jsx` and `WelcomeScreen.jsx` as `<img src="/logo.png" ... />`. (A base64 fallback constant `LOGO_B64` exists in `WelcomeScreen.jsx` and `shared.jsx` but is no longer used by the render path.)

---

## 7. Business Logic Functions

All live business logic resides in `src/EstimateScreen.jsx` (sizing/pricing/financing/battery) and `src/UploadScreen.jsx` (OCR post-processing). The root-level `PreQual_Solar.jsx` is a **legacy chat-style UI** retained for historical reference; it is **not imported by the live build** and has diverged from the wizard logic in several places (notably: legacy `roundToPanels` uses `Math.floor`, no demand cap, no battery sizing, different savings formula).

### 7.1 Solar Estimation (`src/EstimateScreen.jsx`)

```js
calcEstimate(consumoMensual, roofSqft, municipio, billData, epcTable, annualYieldOverride, maxKwpRoofOverride)
// Returns: { systemKwp, numPanels, coverage, systemCost, avgMonthlyBill,
//            savingsCash, monthlyPmt, savingsFinanced, balloon }
```

**Algorithm:**
1. `annualYield` ← `annualYieldOverride` (Tool Belt `/solar-resource`) || `MUNICIPIO_YIELDS[municipio] ?? 1530`.
2. `annualConsump` = `consumoMensual × 12`.
3. `maxKwpRoof` ← `maxKwpRoofOverride` (Tool Belt `/area-to-system`) || `(roofSqft / 2500) × 45`.
4. `kwpFor100pct` = `annualConsump / annualYield`.
5. **Demand-based cap** (new in dev — not present in legacy `PreQual_Solar.jsx`):
   - If `tariff` matches `/secundaria/i`: cap = **60 kVA**.
   - Otherwise: cap = `(demanda_kva + exceso_kva) × 1.2 × 1.5`.
6. `systemKwp = roundToPanels(min(maxKwpRoof, kwpFor100pct, demandCap))` — rounds **UP** via `Math.ceil` to the nearest 0.410 kWp (since `panel_watts = 410`).
7. `annualGen = systemKwp × annualYield`.
8. `coverage = min((annualGen / annualConsump) × 100, 100)`.
9. `epcPerW = getEPC(systemKwp, epcTable)` — see below.
10. `systemCost = systemKwp × 1000 × epcPerW`.
11. `avgMonthlyBill = (costo_kwh × consumo_kwh) + cargo_cliente + cargo_demanda + exceso_usd`.
12. `solarKwhMonthly = min(annualGen / 12, consumo_kwh)`.
13. `savingsCash = costo_kwh × solarKwhMonthly`.
14. Financing via `calcFinancing(systemCost)`.
15. `numPanels = round(systemKwp × 1000 / 410)`.

```js
getEPC(kwp, epcTable)
// Tiered $/W lookup. Accepts both Tool Belt shape ({kw_from, kw_to, effective_price_per_w})
// and the legacy hardcoded fallback shape ({from, to, epc}).
// If kwp is above the last tier, returns the last tier's price.
```

**Hardcoded EPC fallback** (`CFG_DEFAULTS.epc_table` in `EstimateScreen.jsx:26–42`, used only if `pricing.solar.epc_tiers` is missing — see §8):

| from (kWp) | to (kWp) | $/W |
|---|---|---|
| 0 | 5 | 3.20 |
| 5 | 35 | 2.90 |
| 35 | 50 | 2.80 |
| 50 | 100 | 2.70 |
| 100 | 500 | 2.50 |
| 500 | 1,000 | 2.40 |
| 1,000 | 2,000 | 2.30 |
| 2,000 | 6,000 | 2.20 |
| 6,000 | 12,000 | 2.10 |
| 12,000 | 24,000 | 1.95 |
| 24,000 | 100,000 | 1.70 |

```js
roundToPanels(kwp)
// Math.ceil(kwp / (410/1000)) × (410/1000)  — rounds UP to nearest 0.410 kWp
```

```js
getYield(municipio)
// MUNICIPIO_YIELDS[m] ?? 1530.  78-municipio dictionary in EstimateScreen.jsx:5–23.
// Values: 1400 (Ciales, Orocovis), 1530 (default), 1650 (south/east coast),
//         1750 (Guayama). Used only as a fallback when /api/solar-resource is unreachable.
```

```js
calcFinancing(systemCost)
// 15-yr (180 mo) amortization at 9% APR; balloon due AFTER month 84
// (BALLOON_MO = 83 — the variable is the index of the last payment before balloon).
//
// RATE        = 0.09
// AMORT       = 180
// BALLOON_MO  = 83
// DOC_FEE     = 500
// base        = systemCost + DOC_FEE
// facilityFee = round((base / 0.95) × 0.02, 2 dp)
// secDeposit  = round((base / 0.95) × 0.03, 2 dp)
// financed    = systemCost + facilityFee + secDeposit + DOC_FEE
// r           = 0.09 / 12
// monthlyPmt  = round( r × financed / (1 − (1 + r)^−180), 2 dp )
// balloon     = round( -(financed × (1+r)^84 + monthlyPmt × ((1+r)^84 − 1)/r − monthlyPmt), 2 dp )
// returns { facilityFee, secDeposit, financed, monthlyPmt, balloon }
```

### 7.2 Battery / Autonomy Sizing (`calcBatterySystem`, EstimateScreen.jsx:142–180)

**Equipment constants** — `BAT_CFG_DEFAULTS` is the in-code fallback; `resolveBatCfg(pricing)` overlays any keys provided by the `pricing.battery` block from `/api/pricing`. The `pricing` proxy does **not** currently return a battery block, so in production these constants are always sourced from the fallback object.

| Constant | Default value | Notes |
|----------|--------------|-------|
| `AC_DC_CONV` | 1.25 | DC sizing factor |
| `INV_UNIT_KW` | 60 | Sol-Ark 60kW inverter, per unit |
| `BAT_UNIT_KWH` | 60 | L3-HVR-60KWH per battery |
| `MAX_BATT_PER_INV` | 6 | Max batteries per inverter |
| `INV_COST` | $12,900 | Sol-Ark cost per inverter (pre-markup) |
| `INV_SMA_COST` | $0 (defaults to 0 if pricing.battery.batt_inv_60.sma_cost is absent) | SMA cost subtracted from `INV_COST` because the base solar EPC already includes an SMA inverter |
| `BAT_COST` | $27,700 | Per battery (pre-markup) |
| `BAT_SHIP` | $500 | Shipping per battery |
| `INV_SHIP` | $150 | Shipping per inverter |
| `BAT_INSTALL_FIRST` | $7,000 | Install, first battery |
| `BAT_INSTALL_NEXT` | $2,000 | Install, each additional |
| `MARKUP` | 1.35 | Applied to (inverters + batteries + shipping + installation) |

**Sizing logic:**
1. `requiredKW_dc = demandaKVA × 1.25`
2. `numInverters = ceil(requiredKW_dc / 60)`; `systemKW = numInverters × 60`
3. `hourlyKW = (avgMonthlyKWH / 30.4375) / 24`; `requiredKWH = hourlyKW × batteryHours`
4. `rawBatteries = ceil(requiredKWH / 60)`; `numBatteries = clamp(rawBatteries, numInverters, numInverters × 6)`; `systemKWH = numBatteries × 60`
5. Inverter substitution pricing: `invSubCost = INV_COST − INV_SMA_COST`
6. `shipping = numBatteries × 500 + numInverters × 150`
7. `installation = 7000 + (numBatteries − 1) × 2000`
8. `totalCost = (numInverters × invSubCost + numBatteries × BAT_COST + shipping + installation) × 1.35`
9. `actualHours = systemKWH / hourlyKW` (rounded to 1 decimal place; may be < requested when batteries hit the per-inverter cap)

**Returns:** `{ numInverters, numBatteries, systemKW, systemKWH, actualHours, shipping, installation, totalCost, productName, capped }` where `productName` is the literal string `` `Sol-Ark ${systemKW}kW / ${systemKWH}kWh` `` and `capped === true` when the battery count was clamped at the maximum.

**Returns `null` if `batteryHours === 0`.**

**Demand-KVA floor:** Before calling `calcBatterySystem`, EstimateScreen applies `demandaKVA = Math.max(parseNum(ocrData?.demandaKVA), 50)` — the 50 kVA floor doubles as the regulatory Secundaria minimum and an OCR-miss safety net.

### 7.3 Formatting Helpers (`src/EstimateScreen.jsx`)

```js
fmtUSD(n)        // "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
parseNum(s)      // strips commas and non-numeric chars; returns 0 on failure
```

(The legacy `fmtKWH`, `fmtKVA`, `parseCostPerKWH`, `mapTariff`, `normalizeAddress`, `extractMunicipio` helpers exist in `PreQual_Solar.jsx` but are **not** used by the live wizard.)

### 7.4 OCR Utilities

`normalizeOCR(data)` in `src/UploadScreen.jsx:220–266` — see §5.2 above. The legacy `classifyOCRIntent` and `commitAll` functions exist in `PreQual_Solar.jsx` but are not imported by the live wizard.

---

## 8. Pricing Configuration

`config/pricing.json` exists in the repo but is **not read by the live server at runtime**. The only code that touches it today is `scripts/csv_to_pricing.js`, a build helper that regenerates the file from `config/pricing.csv`.

**Live data flow:**

| Wizard endpoint | Upstream | Returned shape (truncated) |
|---|---|---|
| `GET /api/pricing` | `GET https://windmar-commercial-toolbelt.vercel.app/api/v1/epc-tiers` (header `X-API-Key: ${TOOLBELT_API_KEY}`) | `{ solar: { epc_tiers: [ { kw_from, kw_to, base_epc, misc_adder_pct, effective_price_per_w } ] } }` |
| `GET /api/solar-resource?municipality=Ponce` | `GET .../api/v1/solar-resource?municipality=Ponce` | `{ municipality, specific_yield, unit }` |
| `GET /api/area-to-system?sqft=…&municipality=…&buffer=true` | `GET .../api/v1/area-to-system?sqft=…&municipality=…&buffer=true` | `{ sqft, effective_sqft, kw, modules, monthly_gen_kwh, … }` |

**Server-side fallbacks** if a Tool Belt call fails:
- `/api/pricing` returns a hardcoded 11-row tier array (`server.js:212–224`) matching the `CFG_DEFAULTS.epc_table` in `EstimateScreen.jsx`.
- `/api/solar-resource` returns `{ specific_yield: 1530, unit: 'kWh/kWp/year' }` (`server.js:248`).
- `/api/area-to-system` returns `{ sqft, kw: (sqft/2500)×45, specific_yield: 1530, fallback: true }` (`server.js:271–273`).

**Client-side fallback:** `EstimateScreen.jsx`'s `CFG_DEFAULTS.epc_table` and `MUNICIPIO_YIELDS` table are used only if the `pricing` prop is missing or the live fetch in `fetchSolarConfig` failed.

**TOOLBELT_API_KEY** is server-side only — never exposed to the client.

---

## 9. State Management

State is split across multiple `useState` hooks in `WelcomeScreen.jsx` (the routing component), not consolidated into one `data` object:

```js
// In WelcomeScreen.jsx:
const [selection,        setSelection]        = useState("");          // "" | "si" | "no"
const [serviceType,      setServiceType]      = useState("no_se");     // bifasico_240 | trifasico_208 | trifasico_480 | no_se
const [screen,           setScreen]           = useState("welcome");
//     "welcome" | "exit" | "upload" | "roof" | "estimate" | "contact" | "thankyou-yes" | "thankyou-no"
const [contactData,      setContactData]      = useState(null);
const [ocrData,          setOcrData]          = useState(null);        // includes serviceType after upload
const [sqft,             setSqft]             = useState(null);
const [estData,          setEstData]          = useState(null);
const [batteryHours,     setBatteryHours]     = useState(0);           // 0 | 4 | 8 | 12 | 16 | 24
const [batteryResult,    setBatteryResult]    = useState(null);
const [billFiles,        setBillFiles]        = useState(null);        // Array of File objects from UploadScreen
const [pricing,          setPricing]          = useState(null);
const [pricingLoading,   setPricingLoading]   = useState(true);
const [generateLead,     setGenerateLead]     = useState(true);        // demo toggle
```

UploadScreen, EstimateScreen, ContactScreen, ThankYouScreen each carry their own component-local state for stage/loading/PDF refs/etc.

### `ocrData` shape after `normalizeOCR()` + `serviceType` merge

```js
{
  nombreNegocio: "TEST - ...",  // TEST prefix added by normalizeOCR
  direccion:     "TEST - ...",
  municipio:     "Cidra",
  tariff:        "Primaria",            // or Secundaria | Transmisión | Agrícola | ""
  consumoKWH:    "27,043 kWh",          // formatted string
  demandaKVA:    "100.00 kVA",          // formatted string
  totalFactura:  "$7,030.08",           // formatted string
  costoPorKWH:   "0.2479",              // formatted string (4 dp, no symbol)
  cargoCliente:  200,                   // number, USD
  cargoDemanda:  534.60,                // number, USD
  excesoUSD:     0,                     // number, USD
  excesoKVA:     0,                     // number, kVA
  serviceType:   "no_se"                // from WelcomeScreen dropdown
}
```

---

## 10. API Endpoints (`server.js`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/prequal` | Serves `public/prequal.html` |
| `GET` | `/deal` | Serves `public/deal.html` (separate flow — Cuestionario_Solar_INTEGRATED) |
| `GET` | `/` | 302 redirect to `/prequal` |
| `POST` | `/api/encrypt` | AES-256-CBC encrypt JSON payload → token string (`iv:cipher` hex). Currently unused by the live wizard but retained for legacy handoff. |
| `POST` | `/api/decrypt` | Inverse of above. |
| `POST` | `/api/leads` | Saves lead JSON to `leads/{date}_{name}_{phone}.json`. On Vercel the filesystem is read-only — the call still returns a `leadId` + sequential `quoteNumber` (`C20001`, …) but does not persist. |
| `GET` | `/api/leads/:leadId` | Reads one saved lead JSON. |
| `GET` | `/api/leads` | Lists all saved lead IDs (newest first). |
| `GET` | `/api/pricing` | Proxies Tool Belt `/api/v1/epc-tiers`. Falls back to a hardcoded 11-tier table. |
| `GET` | `/api/solar-resource?municipality=…` | Proxies Tool Belt `/api/v1/solar-resource`. Falls back to `{ specific_yield: 1530 }`. |
| `GET` | `/api/area-to-system?sqft=…&municipality=…&buffer=…` | Proxies Tool Belt `/api/v1/area-to-system`. Falls back to `(sqft/2500)×45`. |
| `POST` | `/api/ocr` | Multipart upload, field name **`bills`** (plural), `multer.array('bills', 10)`. Per-file MIME check (`image/*` or `application/pdf`). Multer memory storage, 25 MB per file cap. Calls Anthropic `claude-opus-4-6` with up to N document/image blocks + one Spanish user-prompt text block. Returns `{ success: true, data: { ... } }`. On Anthropic 401: `{ error: "API key inválida..." }`. On 429: `{ error: "Límite de uso alcanzado..." }`. On JSON parse failure: HTTP 422 with the raw model text. |
| `POST` | `/api/zoho-lead` | Multipart upload, `leadData` (JSON string) + zero-or-more `billFile` parts. Creates `Commercial_Lead` (write token), attaches each bill (read token), reads back `Com_Lead_Name` (read token), creates a separate `Note` (read token). Returns `{ success, zohoLeadId, commercialLeadName }`. |
| `POST` | `/api/zoho-attach` | Multipart upload, `leadId` + `file`. Attaches arbitrary file to an existing Zoho `Commercial_Lead`. |
| `POST` | `/api/generate-and-attach-pdf` | JSON body `{ leadId?, ocrData, estData, contactData, commercialLeadName?, batteryResult? }`. Builds the estimate PDF server-side using `pdf-lib` (template depends on whether total ≥ $60k), optionally attaches it to the Zoho lead, returns `{ success, pdfBase64 }`. |
| `GET` | `/api/health` | Returns `{ status, apiKeyConfigured, encryptionConfigured, zohoConfigured, timestamp }`. |
| `GET` | `/api/zoho-test` | Diagnostic — forces a fresh Zoho write-token fetch. **⚠ contains a bug**: the handler references an undefined `_zohoTokenCache` / `getZohoToken` (server.js:748–749) — the current codebase uses split read/write caches. This route will throw if called. |
| `GET` | `/*` (regex fallback) | 404 with a small HTML body. |

### `POST /api/ocr` response shape

```json
{
  "success": true,
  "data": {
    "nombre_negocio":     "McDonald's",
    "address":            "CAR 172 KM. 13.3 (MCDONALDS) BO. BAYAMON CIDRA PR 00739",
    "municipio":          "Cidra",
    "total_adeudado":     7030.87,
    "tarifa":             "Primaria",
    "demanda_contratada": 100,
    "cargo_cliente":      200.00,
    "cargo_demanda":      534.60,
    "exceso_demanda_kva": 0,
    "exceso_demanda_usd": 0.00,
    "consumo_promedio":   27043,
    "costo_kwh":          0.2580,
    "consumos_mensuales": [27000, 27500, 28000, 26500, 27000, 27200, 27800, 27100, 27000, 26900, 27300, 27000, 27050],
    "tasas_mensuales":    [0.2580, 0.2575, 0.2590, 0.2570, 0.2580, 0.2585, 0.2595, 0.2580, 0.2580, 0.2570, 0.2585, 0.2580, 0.2580]
  }
}
```

The Spanish system prompt instructs the model to return `null` for the four demand-related fields when `tarifa === "Secundaria"`.

---

## 11. Zoho CRM Integration

### Credentials & token caching

Two credential sets in `.env` (consolidation still outstanding):

| Set | Env prefix | Used for |
|-----|-----------|----------|
| Write | `ZOHO_WRITE_*` | Creating the `Commercial_Lead` record |
| Read | `ZOHO_READ_*` | Attaching files, reading `Com_Lead_Name`, creating notes |

Tokens are cached in module-local variables (`_zohoWriteCache`, `_zohoReadCache`) for ~58 minutes per refresh (`server.js:417–431`).

### Zoho API basics

| Item | Value |
|------|-------|
| Auth | `POST https://accounts.zoho.com/oauth/v2/token` |
| API base | `https://www.zohoapis.com/crm/v3` |
| Module API name | `Commercial_Lead` |
| Attachment endpoint | `POST /crm/v3/Commercial_Lead/{id}/Attachments` |
| Notes endpoint | `POST /crm/v3/Commercial_Lead/{id}/Notes` |
| Owner user ID | `${ZOHO_OWNER_USER_ID}` (set to `4258103001863220103` in production) |

### Field map: wizard → Zoho (verbatim from `createZohoLead`, `server.js:439–485`)

| Zoho field | Source | Notes |
|---|---|---|
| `Primary_Contact` | `leadData.customerName` | Customer full name |
| `Account_Name` | `leadData.businessName` | OCR `nombreNegocio` (with TEST prefix until removed) |
| `Phone_2` | `cleanPhone(leadData.phone)` | Strips non-numeric except `+-().` and whitespace; null if < 7 chars after cleaning |
| `Phone_3` | `cleanPhone(leadData.phoneSecondary)` | Always null today — no secondary phone collected |
| `Email` | `leadData.email` | Always null today — not collected on ContactScreen |
| `Address` | `leadData.address` | Parsed street (zip + municipio stripped client-side) |
| `City` | `leadData.city` | OCR municipio |
| `Zip_Code` | `leadData.zip` | Parsed from OCR address by `parseAddress()` in ThankYouScreen |
| `Tama_o_Estimado` | `parseFloat(notes.techo)` ?? `leadData.roofSqft` | Number, sqft |
| `Consumo_Promedio` | `parseFloat(notes.consumo)` ?? `leadData.avgConsumption` | Number, kWh/mo |
| `Carga_Contratada_KVA` | `notes.demanda` (string) | kVA |
| `PV_System_Size_kW1` | `notes.sistema` ?? `String(leadData.systemKwp)` | String, kWp |
| `Tipo_de_Tarifa` | `notes.tarifa` | Parsed from notes |
| `Quote_Amount` | `parseFloat(notes.precio)` | Number, USD |
| `Baterias` | `parseFloat(leadData.batteryPrice)` (or null) | **Number (USD)** — *not* a boolean |
| `Battery_System_Size_kWh` | `String(leadData.batteryKWH)` | null when no battery |
| `Storage_Size_kWh` | `String(leadData.batteryKWH)` | duplicate of above |
| `Lead_Notes` | `condensedNotes` | Only contains `Cobertura: X% | Costo de energia promedio estimado: Y | Consultor en Estimado: Z | Estimado Rep-email: W` |
| `Lead_Status` | `"New Lead"` | Hardcoded |
| `Lead_Source` | `"PreQual"` | Hardcoded |
| `Owner` | `{ id: ZOHO_OWNER_USER_ID }` | Hardcoded |

**Lead_Number is intentionally NOT mapped** — Zoho auto-assigns `Com_Lead_Name` (e.g. `"CL1059"`), which the server reads back via `getZohoLeadName()` and returns to the client. The client uses that name on the PDF cover.

**Sales_Rep_Email has no Zoho mapping today** — captured in ContactScreen as `consultorEmail` and stuffed into the free-text `Lead_Notes`, not into a dedicated field.

### Notes string parsed by `parseLeadNotes()`

The client emits a pipe-delimited free-text summary like:

```
Cotización: CL1059 | Tarifa: Primaria | Consumo: 27,043 kWh | Demanda: 100 kVA | Costo/kWh: 0.2580 |
Sistema: 100.0 kWp | Cobertura: 100% | Precio est.: $257,000 | Techo: 50,000 p² |
Consultor en Estimado: Juan Pérez | Estimado Rep-email: juan.perez@windmar.com |
Baterías: Sol-Ark 60kW / 60kWh | Respaldo: 6.0h | Precio bat.: $73,235
```

`parseLeadNotes()` (`server.js:375–394`) extracts: `cotizacion, tarifa, consumo, demanda, costo, sistema, cobertura, precio, techo, consultor, consultorEmail`. Parsed values **take priority** over individual `leadData.*` fields the client sends.

### Server-side note + readback

After creating the lead, the server also (best-effort, errors logged but not surfaced):
1. Reads back `Com_Lead_Name` via `GET /crm/v3/Commercial_Lead/{id}?fields=Name` — returned to client as `commercialLeadName`.
2. Creates a separate `Note` titled `"PreQual Wizard"` with content like `"Lead creado por PreQual Wizard el 05/25/2026, 02:34 PM. Sistema: 100 kWp | 60 kWh | Precio: $330,235"` (Puerto Rico timezone).

### File-attachment flow

1. `billFiles` — every `File` object from UploadScreen, renamed to `"PreQual - {original}"` — sent as part of `/api/zoho-lead`; attached after lead creation.
2. **Estimate PDF — server-side generated.** `pdf-lib` overlays customer + system + financing values onto either `Estimate_template_loan.pdf` (total ≥ $60k) or `Estimate_template_cash.pdf` (< $60k), prepended with the cover page of `cotizacion_wrapper.pdf` and appended with additional wrapper pages. The base64 result is returned to the client for download **and** attached directly to the Zoho lead inside `/api/generate-and-attach-pdf` (no separate client round-trip).
3. multer uses `memoryStorage` throughout — files never touch disk on the server.

The `/api/zoho-attach` endpoint exists for ad-hoc file attaches but is not used by the current wizard.

---

## 12. PreQual → Deal Section Handoff

The live ThankYouScreen does **not** invoke the legacy encrypted-token handoff flow. Specifically:

- ContactScreen calls `POST /api/leads` (local persistence + quote-number assignment) but does **not** call `/api/encrypt`.
- The "Cuestionario completo" CTA on ThankYouScreen opens a SmartSheet form (`https://app.smartsheet.com/b/form/9f6e441c850e439a9ea42a82e46b774e`) in a new tab.
- A commented-out anchor to the legacy Deal Section (`https://windmar-solar-production.up.railway.app/deal`) is preserved as a `<!-- TODO: Re-enable ... -->` block; it is **not** rendered.
- The `/api/encrypt` and `/api/decrypt` endpoints are still in `server.js` and remain functional (AES-256-CBC, key derived via `crypto.scryptSync(ENCRYPTION_KEY, 'windmar_salt', 32)`, IV randomized per call) for future use.

---

## 13. Outstanding Items / Known Issues

| # | Item | Notes |
|---|------|-------|
| 1 | **Admin credential consolidation** | Two Zoho credential sets (`ZOHO_READ_*` + `ZOHO_WRITE_*`) still required because neither alone has both create-with-attach and update scopes. Pending unified `ZOHO_CLIENT_*` from admin. |
| 2 | **`Sales_Rep_Email` field mapping** | Captured on ContactScreen as `consultorEmail` but written only into `Lead_Notes`, not into a dedicated Zoho field. |
| 3 | **TEST scaffolding still present** | `"TEST - "` prefix on `nombreNegocio`, `direccion`, and the seeded `nombre`/`consultorNombre` inputs (UploadScreen, ContactScreen); `"usar datos de prueba"` link on UploadScreen; "Generar lead SI/NO" pill on WelcomeScreen — all flagged `// TODO: remove before production`. |
| 4 | **`demandaKVA` OCR misreads** | OCR has historically returned the USD value of the demand line. `EstimateScreen` floors any value < 50 up to 50 as a safety net. |
| 5 | **Panel count is wrong on PDF** | `panel_watts` is hardcoded at 410 in `EstimateScreen.jsx:27`; the live module is 585–600 W. `numPanels` therefore overstates the panel count by ~50%. |
| 6 | **Tier-table drift** | Three EPC tier tables exist (Tool Belt live, `server.js` hardcoded fallback, `CFG_DEFAULTS.epc_table` in EstimateScreen, plus the dead `config/pricing.json`). They are not synced automatically and can drift. |
| 7 | **`GET /api/zoho-test` is broken** | References undefined `_zohoTokenCache` / `getZohoToken` (`server.js:748–749`). Will throw if called. |
| 8 | **`BatteryIntentScreen.jsx` is dead code** | File exists in `src/` but is never imported or rendered. Progress bar reserves "Paso 4 de 6" for it but the slot is empty in the live flow. |
| 9 | **Slider subtitle misleads** | EstimateScreen's autonomy slider subtitle reads *"Decide cuánto quieres ahorrarte en tu factura de LUMA"* — the slider actually controls backup hours, not savings. |
| 10 | **`serviceType` is captured but unused** | The bifásico/trifásico dropdown on WelcomeScreen is stored in `ocrData.serviceType` but never read downstream. |
| 11 | **Two ProgressBar instances report "Paso 5 de 6"** | Both EstimateScreen and ContactScreen render `current={5}`. |

---

## 14. Functions Targeted for Removal / Externalization
*(Preserved verbatim from the original spec as required. Forward-looking content; the code does not yet reflect these refactors.)*

The following business logic currently lives **inside the React component or PreQual_Solar.jsx**. As the wizard transitions to a "flow control engine" that calls centralized Toolbelt services, these are the primary candidates for extraction:

| Function | What it does | Externalization target |
|----------|-------------|----------------------|
| `calcEstimate()` | Full solar system sizing from kWh + sqft + municipio | Toolbelt: Solar Sizing API |
| `getEPC()` | Tiered $/W pricing lookup | Toolbelt: Pricing Service |
| `roundToPanels()` | Rounds kWp to panel increments | Toolbelt: Solar Sizing API |
| `getYield()` | kWh/kWp/yr by municipio lookup table | Toolbelt: Solar Sizing API |
| `calcFinancing()` | Monthly payment + balloon calc | Toolbelt: Finance Calculator |
| `calcBatterySystem()` | Battery system sizing + pricing | Toolbelt: Battery Sizing API |
| `MUNICIPIO_YIELDS` | 78-row lookup table | Toolbelt: Reference Data API |
| `CFG` / `windmar.config.js` | System config constants | Toolbelt: Config Service |
| `pricing.json` | EPC tiers + battery constants | Toolbelt: Pricing Service |

**What should remain in the wizard after refactor:**
- Screen/flow state machine
- OCR trigger + field review UI
- Roof size capture
- Battery intent capture
- Contact info capture
- Zoho CRM submission
- Deal Section handoff

**What moves to Toolbelt services:**
- All solar + battery calculation logic
- All pricing data
- Municipio yield data
- Financing math

---

## 15. Environment Variables

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Tool Belt (Windmar Commercial pricing/solar API)
TOOLBELT_API_KEY=wmc_live_...

# Encryption (legacy PreQual → Deal handoff — still wired server-side, unused by live wizard)
ENCRYPTION_KEY=...

# Zoho — Write set (create only)
ZOHO_WRITE_CLIENT_ID=...
ZOHO_WRITE_CLIENT_SECRET=...
ZOHO_WRITE_REFRESH_TOKEN=...

# Zoho — Read set (read, attach, notes)
ZOHO_READ_CLIENT_ID=...
ZOHO_READ_CLIENT_SECRET=...
ZOHO_READ_REFRESH_TOKEN=...

# Zoho config
ZOHO_OWNER_USER_ID=4258103001863220103

# Server (defaults to 3001 when unset)
PORT=3001
```

`server.js`'s startup banner explicitly reports the configured status of `ANTHROPIC_API_KEY`, `TOOLBELT_API_KEY`, `ENCRYPTION_KEY`, `ZOHO_WRITE_CLIENT_ID`, and `ZOHO_OWNER_USER_ID`.

---

## 16. Build & Deploy

```bash
# Local development
node build.js                              # esbuild → public/prequal.bundle.js + prequal.html
node server.js                             # http://localhost:3001/prequal

# Convenience wrapper
./patch_and_build.sh                       # set -e; node build.js  (no other arguments accepted)

# Deploy to Vercel (production)
vercel --prod                              # → windmar-commercial-estimator.vercel.app
```

The bundler entry is `src/prequal_main.jsx` (which mounts `<WelcomeScreen/>`). Build output goes to `public/prequal.bundle.js` and `public/prequal.html` (the HTML shell carries a cache-busting `?v=` query string). GitHub auto-deploy is **not** configured for this project — production deploys are manual via `vercel --prod`.

The legacy `package.json` exposes `npm run build` (→ `node build.js`) and `npm start` / `npm run dev` (both → `node server.js`).

---

*End of verified specification.*
