# Windmar Commercial — PreQual Solar Wizard: Current State

---

## What the App Is
A mobile-first, tablet-facing solar pre-qualification wizard for Windmar Commercial sales reps. Built in Spanish for Puerto Rico (LUMA utility). Deployed at **windmar-solar-production.up.railway.app/prequal**.

**Stack:** Node.js/Express + React (single-page, no router), bundled via esbuild into `public/prequal_bundle.js`. AI OCR via Anthropic API.

**Repo:** `https://github.com/Luis-Windmar/windmar-solar` (main branch auto-deploys to Railway)

**Local dev:** `node server.js` → `http://localhost:3001/prequal`
**Build & deploy:** `./patch_and_build.sh prequal`

---

## Wizard Flow (all screens built and working)
1. **WelcomeScreen** — Has bill? Sí → continue, No → exit
2. **UploadScreen** — Upload LUMA bill (photo/PDF) → OCR processing → review/edit extracted fields
3. **RoofScreen** — Select roof size (4 options) or enter exact sq ft
4. **EstimateScreen** — Shows solar system recommendation based on OCR + roof data
5. **ContactScreen** — Capture name + phone, posts to `/api/leads`
6. **ThankYouScreen (interested)** — 3 buttons: Download PDF estimate, Continue to deal questionnaire, New consultation
7. **ThankYouScreen (not interested)** — Thank you + restart

---

## Key Files
```
src/
  WelcomeScreen.jsx      — router, holds estData + contactData state
  UploadScreen.jsx       — OCR upload, processing checklist, review fields
  RoofScreen.jsx         — roof size selection
  EstimateScreen.jsx     — calcEstimate(), passes est obj via onInterested(est)
  ContactScreen.jsx      — lead capture, returns {leadId, quoteNumber, nombre, phone}
  ThankYouScreen.jsx     — PDF generation, deal link, restart
  shared.jsx             — Header, ProgressBar components

server.js               — Express server, /api/ocr, /api/leads, quote counter
public/
  prequal_bundle.js      — built React bundle (commit this after every build)
  estimate_template 2.pdf — PDF template for estimate (blank with design fields)
  cotizacion_wrapper.pdf  — 3-page wrapper (cover + map + facilities)
  listo_icon.jpg         — navy checkmark icon
  utility_bill_cropped.jpg — bill icon for OCR processing screen
  hourglass.png          — hourglass icon for pending checklist items
leads/
  counter.json           — sequential quote number (C20000+)
```

---

## PDF Estimate Generation (ThankYouScreen.jsx)
- Uses `pdf-lib` (CDN via `window.PDFLib`) — client-side, no server needed
- Template: `estimate_template 2.pdf` (page 1) + `cotizacion_wrapper.pdf` (pages 1-3) = 4-page PDF
- Quote number format: `C20001 FirstWordOfBusiness Municipio` (e.g. `C20001 Arcos Fajardo`)

**Current calibrated COORDS (PDF pts, origin bottom-left, 612×792pt page):**
```js
numero:      { x: 355, y: 631, size: 9  }
cliente:     { x: 355, y: 609, size: 9  }
negocio:     { x: 355, y: 587, size: 9  }
telefono:    { x: 355, y: 565, size: 9  }
capacidad:   { x: 143, y: 505, size: 10 }
cubre:       { x: 143, y: 467, size: 10 }
precio:      { x: 143, y: 429, size: 10 }  // ← still being fine-tuned
ahorro:      { x: 432, y: 458, size: 34, center: true }  // orange bold, centered
prontoPago:  { x: 406, y: 359, size: 10 }
pagoMensual: { x: 406, y: 319, size: 10 }
ahorroFin:   { x: 406, y: 282, size: 10 }
```
- All values: dark grey `rgb(0.25, 0.25, 0.25)`, Helvetica
- `ahorro` (cash savings): 34pt bold orange, centered in navy box

---

## OCR Pipeline
- POST `/api/ocr` → Anthropic API reads bill image/PDF
- Extracts: `nombre_negocio`, `address`, `municipio`, `tarifa`, `consumos_mensuales[]`, `tasas_mensuales[]`, `demanda_contratada`, `cargo_cliente`, `cargo_demanda`, `exceso_demanda_usd`
- `normalizeOCR()` in UploadScreen.jsx computes:
  - `consumoPromedio` = avg of non-zero monthly consumption bars
  - `avgMonthlyBill` = Σ(consumo × tasa) / `consumos.length` (all 13 bars, not just non-zero)
  - `effectiveRate` = energy-only cost per kWh (after subtracting fixed charges)
- **Critical:** `demandaKVA` is in kVA, not USD

---

## Design System
```
Background:     #EBF1FF
Navy:           #1B3F8B
Orange:         #F5A623
Input style:    bg #dbeafe, border 2px solid #93c5fd, color #1e3a8a
Font:           'Segoe UI', system-ui, sans-serif
Border radius:  10px inputs/buttons, 16px cards
Max width:      480px centered
```

---

## Current UI Icon State
- **Upload drop zone:** `paperclip_icon.png` (scale 1.6x, 100px container) ✅ final
- **File chip (processing screen):** `utility_bill_cropped.jpg` (scale 2.25x, transformOrigin "center 48%", 77px container) — acceptable, minor whitespace above/below icon
- **OCR checklist done items:** `listo_icon.jpg` at 72px
- **OCR checklist pending items:** `hourglass.png` at 44px
- **ThankYouScreen PDF status:** `listo_icon.jpg` at 72px + navy text `#1B3F8B`

---

## Pending / Known Issues
1. **PDF alignment** — `precio` and `cubre` were last nudged and may still need minor fine-tuning (last adjustment was −0.1 lines each)
2. **Lead file storage** — discussed but not implemented: save bill file + all OCR/estimate data to `/leads/{leadId}/` folder per lead
3. **ZOHO CRM integration** — future task
4. **Do not modify:** `Cuestionario_Solar_INTEGRATED.jsx` (deal questionnaire, separate flow)
