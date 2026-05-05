# Windmar Commercial — PreQual Solar Wizard
## Claude Code Project README
## Last updated: 2026-05-05
---

## Project Overview

A mobile-first, tablet-facing solar pre-qualification wizard for Windmar Commercial sales reps.
Reps walk prospects through a flow on a tablet to determine solar viability and capture leads.
Built in Spanish, Puerto Rico-specific (LUMA utility, 78 municipios, local solar yield data).

**Deployed at:** https://windmar-commercial-estimator.vercel.app  
**Vercel project:** `windmar-commercial-estimator` (team: `windmar`)  
**GitHub:** https://github.com/Windmar-Home/windmar-commercial-estimator-dev  
**Stack:** Node.js / Express backend + React frontend (single-page, no router), hosted on Vercel (`@vercel/node`)  
**AI:** Anthropic API (`claude-opus-4-6`) for OCR of LUMA electricity bills  
**Pricing/Solar data:** Windmar Commercial Tool Belt API (`windmar-commercial-toolbelt.vercel.app/api/v1`)

---

## Directory Structure

```
/Users/luismorales/Desktop/IQ_Claude/PreQual_Deal/windmar_dev/
├── server.js                        # Express server: OCR, Zoho, PDF gen, Tool Belt proxies
├── build.js                         # esbuild script → public/prequal.bundle.js + prequal.html
├── package.json                     # name: windmar-prequal; pdf-lib, multer, express, etc.
├── vercel.json                      # Vercel deployment config
├── patch_and_build.sh               # Thin wrapper: runs node build.js
├── .env                             # Secrets — never commit
├── .claude/commands/wrap-up.md      # Custom /wrap-up slash command
├── src/
│   ├── prequal_main.jsx             # React entry point
│   ├── WelcomeScreen.jsx            # App root + all screen routing + pricing/solar fetches
│   ├── UploadScreen.jsx             # Bill upload, OCR, review
│   ├── RoofScreen.jsx               # Roof size selector
│   ├── EstimateScreen.jsx           # System sizing, pricing, battery slider
│   ├── ContactScreen.jsx            # Lead capture form
│   ├── ThankYouScreen.jsx           # PDF download, Zoho confirmation, SmartSheet link
│   └── shared.jsx                   # Header, ProgressBar components
├── public/                          # Built output + static assets served by Express
│   ├── prequal.bundle.js            # Built React bundle
│   ├── prequal.html                 # HTML shell with cache-busting ?v= query string
│   ├── Estimate_template_loan.pdf   # PDF template for systems >= $60k
│   ├── Estimate_template_cash.pdf   # PDF template for systems < $60k
│   └── cotizacion_wrapper.pdf       # Multi-page wrapper (cover + facilities pages)
├── docs/                            # Session notes, integration specs
│   ├── session_notes_YYYY-MM-DD.md  # Per-session changelogs
│   └── toolbelt_migration_brief.md  # Tool Belt API integration spec
└── leads/                           # Local lead JSON files (not writable on Vercel)
```

---

## How to Run Locally

```bash
cd /Users/luismorales/Desktop/IQ_Claude/PreQual_Deal/windmar_dev
node build.js        # bundles React → public/prequal.bundle.js
node server.js       # starts on http://localhost:3001
# Visit: http://localhost:3001/prequal
```

To deploy to Vercel production:
```bash
npx vercel --prod
# Deploys to: https://windmar-commercial-estimator.vercel.app
# Requires .vercel/project.json linked to windmar-commercial-estimator (windmar team)
# GitHub auto-deploy is NOT configured — must run CLI manually
```

---

## Implementation Status

### PreQual Wizard — ✅ COMPLETE
All screens built and deployed to Vercel (`windmar-commercial-estimator.vercel.app`).

### Zoho CRM Integration — ✅ COMPLETE
Implemented in `server.js`. Creates `Commercial_Lead` record, attaches LUMA bill and
estimate PDF. PDF is generated server-side via `POST /api/generate-and-attach-pdf`.

### Tool Belt API Integration — ✅ COMPLETE (2026-05-05)
All three estimation inputs now pull from the Tool Belt:
- EPC pricing tiers — `GET /api/v1/epc-tiers` → proxied via `/api/pricing`
- Solar yield by municipio — `GET /api/v1/solar-resource` → proxied via `/api/solar-resource`
- Max kW from roof area — `GET /api/v1/area-to-system` → proxied via `/api/area-to-system`
All proxies have hardcoded fallbacks. TOOLBELT_API_KEY stays server-side only.

### Known Follow-ups
- Panel count display (`numPanels`) still uses hardcoded 410W; live module is 585-600W
- Zoho credential consolidation (ZOHO_READ_* / ZOHO_WRITE_* → single ZOHO_CLIENT_*)
- `serviceType` field captured in WelcomeScreen but not yet mapped to a Zoho field
- TEST prefix fields in ContactScreen/UploadScreen must be removed before production launch

---

## Design System

```
Background:        #EBF1FF  (light blue — differentiates commercial from residential)
Navy (primary):    #1B3F8B
Orange (accent):   #F5A623
Header:            white bg, 3px solid #1B3F8B bottom border
Progress fill:     #F5A623 orange
Input (OCR edit):  bg #dbeafe, border 2px solid #93c5fd, color #1e3a8a
Font:              'Segoe UI', system-ui, sans-serif
Min body font:     16px
Min button height: ~52px (padding: 16px)
Border radius:     10px inputs/buttons, 16px cards
Max content width: 480px centered
```

### Logo
Served as `/logo.png` from `public/`. Referenced in `shared.jsx` Header component.

---

## Tool Belt API Architecture

**Base URL:** `https://windmar-commercial-toolbelt.vercel.app/api/v1`  
**Auth:** `X-API-Key` header — stored in `TOOLBELT_API_KEY` env var, never sent to browser

All Tool Belt calls are server-side proxies in `server.js`. The client calls
`/api/pricing`, `/api/solar-resource`, `/api/area-to-system` on the wizard server,
which forwards to the Tool Belt with the API key.

| Wizard endpoint | Tool Belt endpoint | Data returned | When fetched |
|---|---|---|---|
| `GET /api/pricing` | `/api/v1/epc-tiers` | EPC $/W tiers | WelcomeScreen mount |
| `GET /api/solar-resource` | `/api/v1/solar-resource` | `specific_yield` kWh/kWp/yr | EstimateScreen mount |
| `GET /api/area-to-system` | `/api/v1/area-to-system` | `kw` (max system from roof) | EstimateScreen mount |

**Tool Belt endpoints that exist but are NOT yet wired:**
- `POST /api/v1/price` — per-job price calc (wizard uses `/epc-tiers` + local lookup instead)
- `POST /api/v1/system-to-area` — not needed (wizard goes sqft→system, not reverse)

**Fallback behavior:** All three proxy routes return hardcoded defaults if the Tool Belt
is unreachable, so the wizard never breaks due to Tool Belt downtime.

---

## Shared Component Pattern

Every screen uses these three pieces:

```jsx
const Header = () => (
  <div style={S.header}>
    {/* logo or text placeholder */}
  </div>
);

const ProgressBar = ({ current, total, pct: overridePct }) => {
  const pct = overridePct !== undefined ? overridePct : Math.round((current / total) * 100);
  // orange fill bar, "Paso X de 4" label
};

// Shared style object S = { page, header, progressWrap, track, fill, content, h1, sub, btnNavy, btnOrange, btnGhost }
```

---

## Wizard Flow — All Screens ✅ COMPLETE

### Screen 1 — WelcomeScreen
- Dropdown: Sí tengo la factura / No en otro momento
- Sí → navy "Continuar →" → Screen 2
- No → gray "Entendido →" → graceful exit card
- Bottom teaser: 🔋 financing note

### Screen 2 — UploadScreen
- Large tap/drop zone for bill upload (image or PDF)
- Animated OCR processing progress bar
- Review stage: extracted fields shown as editable inputs
- Fields vary by tariff type (`FIELD_DEFS_DEMAND` vs `FIELD_DEFS_SECONDARY`)
- Orange CTA: "Todo bien. Listo" → Screen 3

### Screen 3 — RoofScreen
- 4 tappable icon cards: Pequeño / Mediano / Grande / Industrial
- Optional numeric override input
- Sets `sqftValue` state

### Screen 4 — EstimateScreen
- Runs `calcEstimate()` using sqft + OCR data
- Shows: Sistema recomendado, Cobertura, Precio estimado, Ahorro mensual
- "✅ Sí me interesa" → Screen 5
- "❌ No por ahora" → Screen 6 (not interested)

### Screen 5 — ContactScreen
- Fields: Nombre completo, Teléfono
- On submit: calls `submitToZoho()` then proceeds to Screen 6

### Screen 6 — ThankYouScreen
- If interested: deal questionnaire link + Zoho lead confirmation
- If not interested: gracias + restart button

---

## Key Business Logic (from PreQual_Solar.jsx — do not reimplement)

```js
calcEstimate(sqft, consumoKWH, municipio)  // returns system size, coverage, price
calcFinancing(systemPrice)                  // 15yr / 9% / balloon at month 84
getEPC(kWp)                                // tiered pricing $3.20/W → $1.70/W
roundToPanels(kWp)                         // rounds to nearest panel (0.4 kWp)
getYield(municipio)                        // kWh/kWp/yr from MUNICIPIO_YIELDS table
fmtUSD(n), fmtKWH(n), fmtKVA(n)
```

---

## Important Notes

- `demandaKVA` must be extracted/stored in **kVA**, not USD. This was a known OCR bug.
- The wizard is rep-operated — the rep holds the tablet, not the prospect.
- ~20-25% of bills need OCR field corrections, hence the editable review screen.
- Do not modify `Cuestionario_Solar_INTEGRATED.jsx` — it is the deal questionnaire, separate flow.
- The existing `/api/ocr` and `/api/leads` endpoints in `server.js` are production-ready.

---

## Zoho CRM Integration — ✅ COMPLETE
### Added 2026-03-19

Full implementation details in `docs/README_ZOHO_INTEGRATION.md` and
`docs/ZOHO_FILE_ATTACHMENT_INSTRUCTIONS.md`.

### What's implemented
- `POST /api/zoho-lead` route in `server.js`
- Creates `Commercial_Lead` record with all fields populated
- Attaches LUMA bill file to the record
- Attaches estimado PDF to the record
- `parseLeadNotes()` parses the wizard summary string into proper Zoho fields

### Credentials — Two Sets (pending consolidation)

**First credentials** (`ZOHO_READ_*`) — used for ALL operations:
- ✅ Create records, populate fields, read records, attach files
- ❌ Cannot update existing records

**Second credentials** (`ZOHO_WRITE_*`) — kept for reference:
- ✅ Create records, populate fields only
- ❌ Cannot read, attach, or update

**Pending admin action:** Consolidate into one credential set with scopes:
`ZohoCRM.modules.ALL,ZohoCRM.modules.attachments.CREATE`
This will also add UPDATE capability needed for the follow-up quoting workflow.
When received, replace all `ZOHO_READ_*` and `ZOHO_WRITE_*` vars with `ZOHO_CLIENT_*`.

### Environment Variables (`.env` and Railway)

```
# First credentials — used for ALL operations currently
ZOHO_READ_CLIENT_ID=...
ZOHO_READ_CLIENT_SECRET=...
ZOHO_READ_REFRESH_TOKEN=...

# Second credentials — kept for reference
ZOHO_WRITE_CLIENT_ID=...
ZOHO_WRITE_CLIENT_SECRET=...
ZOHO_WRITE_REFRESH_TOKEN=...

# Config
ZOHO_OWNER_USER_ID=4258103001863220103
```

### Field Map Summary (see `docs/ZOHO_LEADS_FIELD_MAP.md` for full reference)

| Wizard Data | Zoho API Field |
|---|---|
| Customer full name | `Primary_Contact` |
| Business name | `Account_Name` |
| Main phone | `Phone_2` |
| Secondary phone | `Phone_3` |
| Email | `Email` |
| Address | `Address` |
| City / municipio | `City` |
| Zip code | `Zip_Code` |
| Roof size sq ft | `Tama_o_Estimado` |
| Avg kWh consumption | `Consumo_Promedio` |
| Demand kVA | `Carga_Contratada_KVA` |
| System size kW | `PV_System_Size_kW1` |
| Cotización number | `Lead_Number` |
| Sales rep email | `Sales_Rep_Email` |
| Remaining OCR summary | `Lead_Notes` |

Hardcoded: `Lead_Status: "New Lead"`, `Lead_Source: "PreQual Wizard"`, `Owner: ZOHO_OWNER_USER_ID`

### Outstanding Items

1. **Admin credential consolidation** — message sent, awaiting response.
2. **Sales rep email source** — `Sales_Rep_Email` needs a value. Options: entered on WelcomeScreen, hardcoded per device, or future login step.
3. **`Com_Lead_Name` on estimate PDF** — printing CRM record number (e.g. "CL1059") on the estimado requires a GET call after record creation. Decide if needed for v1 or future enhancement.
4. **Token caching** — future optimization, not needed now.

### Zoho API Quick Reference

| Item | Value |
|---|---|
| Auth endpoint | `https://accounts.zoho.com/oauth/v2/token` |
| API base | `https://www.zohoapis.com/crm/v3` |
| Module API name | `Commercial_Lead` |
| Attachment endpoint | `POST /crm/v3/Commercial_Lead/{id}/Attachments` |
| Owner user ID | `4258103001863220103` |
| Lead_Source picklist value | `"PreQual Wizard"` ✅ confirmed |

---
# Tool Belt API v1 — Migration Brief for PreQual Estimator
**Created:** May 4, 2026  
**Purpose:** Connect the PreQual estimator to the Windmar Commercial Tool Belt pricing API, replacing the hardcoded `config/pricing.json`.

---

## What Is the Tool Belt API?

The Windmar Commercial Tool Belt is a live Express/Vercel app that manages pricing data centrally. It exposes a versioned public API (`/api/v1`) that external apps can call to get live pricing, solar resource data, and system sizing calculations.

**Base URL:** `https://windmar-commercial-toolbelt.vercel.app/api/v1`

---

## Authentication

Every API call requires an API key. Include it using **any one** of these methods:

```
Header:      X-API-Key: wmc_live_...
Header:      Authorization: Bearer wmc_live_...
Query param: ?api_key=wmc_live_...
```

Store the key as an environment variable:
```
TOOLBELT_API_KEY=wmc_live_...
```

Never hardcode the key in source files.

---

## Available Endpoints

### 1. POST /api/v1/price
Get EPC price for a PV system.

**Request:**
```json
{
  "surfaces": [
    { "kw": 100, "surface_type": "flat_roof" },
    { "kw": 50,  "surface_type": "carport" }
  ]
}
```

**Response:**
```json
{
  "surfaces": [
    {
      "kw": 100,
      "surface_type": "flat_roof",
      "price_per_watt": 2.704,
      "base_epc": 2.6,
      "misc_adder_pct": 0.04,
      "total_price": 270400,
      "currency": "USD"
    }
  ],
  "total_kw": 150,
  "total_price": 405600,
  "currency": "USD"
}
```

**Valid surface_type values:** `flat_roof`, `carport`, `ground_mount`, `multistory` (more may be added without versioning)

---

### 2. GET /api/v1/solar-resource
Get solar yield for a Puerto Rico municipality.

**Request:**
```
GET /api/v1/solar-resource?municipality=Ponce
```

**Response:**
```json
{
  "municipality": "Ponce",
  "specific_yield": 1700,
  "unit": "kWh/kWp/year"
}
```

---

### 3. GET /api/v1/area-to-system
Given a roof area, calculate the system that fits.

**Request:**
```
GET /api/v1/area-to-system?sqft=2000&municipality=Ponce&buffer=true
```

**Response:**
```json
{
  "sqft": 2000,
  "effective_sqft": 1666.7,
  "buffer": true,
  "modules": 57,
  "kw": 33.63,
  "monthly_gen_kwh": 4764,
  "municipality": "Ponce",
  "specific_yield": 1700,
  "module": "Qcells Q.PEAK DUO BLK ML-G10+"
}
```

---

### 4. POST /api/v1/system-to-area
Given a system size, calculate the required roof area.

**Request:**
```json
{ "kw": 100, "municipality": "Ponce", "buffer": true }
```

**Response:**
```json
{
  "kw": 100,
  "modules": 244,
  "sqft": 4397.2,
  "sqft_with_buffer": 5276.6,
  "buffer": true,
  "monthly_gen_kwh": 14167,
  "municipality": "Ponce",
  "specific_yield": 1700,
  "module": "Qcells Q.PEAK DUO BLK ML-G10+"
}
```

---

## Migration Plan — What to Change

### Replace (pricing-related)

| File | Location | Current behavior | New behavior |
|------|----------|-----------------|--------------|
| `server.js` | Line 170 — `GET /api/pricing` | Reads `config/pricing.json` | Call `POST /api/v1/price` |
| `server.js` | Any municipality yield lookup | Hardcoded or not present | Call `GET /api/v1/solar-resource` |
| `src/EstimateScreen.jsx` | Price calculation logic | Uses pricing.json tiers | Uses Tool Belt API response |
| `src/prequal_main.jsx` | Solar yield / system sizing | Hardcoded yields | Uses Tool Belt API |

### Leave Untouched

- **Zoho CRM integration** — works independently, no changes needed
- **OCR endpoint** (`POST /api/ocr`) — uses app's own Anthropic key, no changes needed
- **All UI screens** — WelcomeScreen, UploadScreen, RoofScreen, BatteryIntentScreen, ContactScreen, ThankYouScreen
- **esbuild pipeline** — no changes needed
- **Tailwind CSS** — no changes needed

---

## Environment Variables to Add

Add to `.env` and to the Vercel deployment:

```
TOOLBELT_API_KEY=wmc_live_33f164de88eee4dfb72519876691df0c6483765d7bdd3044c3f065f096b047e4
```

---

## Deployment Target

Deploy as a **standalone Vercel app** — NOT inside the Tool Belt shell. The estimator is used by sales reps in the field; the Tool Belt is used by the internal commercial team. Different audiences, different apps.

---
# Tool Belt API v1 — Migration Brief for PreQual Estimator
**Created:** May 4, 2026  
**Purpose:** Connect the PreQual estimator to the Windmar Commercial Tool Belt pricing API, replacing the hardcoded `config/pricing.json`.

---

## What Is the Tool Belt API?

The Windmar Commercial Tool Belt is a live Express/Vercel app that manages pricing data centrally. It exposes a versioned public API (`/api/v1`) that external apps can call to get live pricing, solar resource data, and system sizing calculations.

**Base URL:** `https://windmar-commercial-toolbelt.vercel.app/api/v1`

---

## Authentication

Every API call requires an API key. Include it using **any one** of these methods:

```
Header:      X-API-Key: wmc_live_...
Header:      Authorization: Bearer wmc_live_...
Query param: ?api_key=wmc_live_...
```

Store the key as an environment variable:
```
TOOLBELT_API_KEY=wmc_live_33f164de88eee4dfb72519876691df0c6483765d7bdd3044c3f065f096b047e4
```

Never hardcode the key in source files.

---

## Available Endpoints

### 1. POST /api/v1/price
Get EPC (Engineering, Procurement & Construction) price for a PV system. This is the primary replacement for the local `getEPC()` function and `config/pricing.json` tier lookups.

**Request:**
```json
{
  "surfaces": [
    { "kw": 100, "surface_type": "flat_roof" }
  ]
}
```

**Response:**
```json
{
  "surfaces": [
    {
      "kw": 100,
      "surface_type": "flat_roof",
      "price_per_watt": 2.704,
      "base_epc": 2.6,
      "misc_adder_pct": 0.04,
      "total_price": 270400,
      "currency": "USD"
    }
  ],
  "total_kw": 100,
  "total_price": 270400,
  "currency": "USD"
}
```

**Valid surface_type values:** `flat_roof`, `carport`, `ground_mount`, `multistory`, `unknown`  
**Note on `unknown`:** The PreQual estimator does not collect surface type. Pass `"unknown"` — the API maps it to `flat_roof` pricing automatically. This is the correct value for a generic commercial rooftop quote.

---

### 2. GET /api/v1/epc-tiers
Returns the full EPC tier table. Use this if the frontend needs to display pricing tiers or do its own tier lookup. **For per-job pricing, use `/api/v1/price` instead** — it's simpler and always uses the latest data.

**Request:**
```
GET /api/v1/epc-tiers
```

**Response:**
```json
{
  "tiers": [
    { "kw_from": 0, "kw_to": 4.9999, "base_epc": 3.20, "misc_adder_pct": 0.10, "effective_price_per_w": 3.52 },
    { "kw_from": 5, "kw_to": 34.9999, "base_epc": 2.90, "misc_adder_pct": 0.08, "effective_price_per_w": 3.132 }
  ]
}
```

**When to use this vs /price:**
- Use `/price` when you have a specific system size and want a computed price (replaces `getEPC()`)
- Use `/epc-tiers` only if you need to display the full table to the user

---

### 3. GET /api/v1/solar-resource
Get solar yield for a Puerto Rico municipality. Replaces the hardcoded `MUNICIPIO_YIELDS` table and `getYield()` function.

**Request:**
```
GET /api/v1/solar-resource?municipality=Ponce
```

**Response:**
```json
{
  "municipality": "Ponce",
  "specific_yield": 1700,
  "unit": "kWh/kWp/year"
}
```

**Municipality names:** Must match exactly (case-insensitive). Use full Spanish names — e.g. `"San Juan"`, `"Juana Díaz"`, `"Añasco"`. All 78 PR municipalities are supported.

---

### 4. GET /api/v1/area-to-system
Given a roof area, calculate the system that fits. Useful for the RoofScreen → EstimateScreen transition.

**Request:**
```
GET /api/v1/area-to-system?sqft=2000&municipality=Ponce&buffer=true
```

**Response:**
```json
{
  "sqft": 2000,
  "effective_sqft": 1666.7,
  "buffer": true,
  "modules": 57,
  "kw": 33.63,
  "monthly_gen_kwh": 4764,
  "municipality": "Ponce",
  "specific_yield": 1700,
  "module": "Qcells Q.PEAK DUO BLK ML-G10+"
}
```

---

### 5. POST /api/v1/system-to-area
Given a system size, calculate the required roof area.

**Request:**
```json
{ "kw": 100, "municipality": "Ponce", "buffer": true }
```

**Response:**
```json
{
  "kw": 100,
  "modules": 244,
  "sqft": 4397.2,
  "sqft_with_buffer": 5276.6,
  "buffer": true,
  "monthly_gen_kwh": 14167,
  "municipality": "Ponce",
  "specific_yield": 1700,
  "module": "Qcells Q.PEAK DUO BLK ML-G10+"
}
```

---

## Migration Plan — What to Change

### Replace (pricing-related)

| File | Location | Current behavior | New behavior |
|------|----------|-----------------|--------------|
| `server.js` | Line 170 — `GET /api/pricing` | Reads `config/pricing.json` | Call `POST /api/v1/price` |
| `server.js` | Any municipality yield lookup | Hardcoded or not present | Call `GET /api/v1/solar-resource` |
| `src/EstimateScreen.jsx` | `getEPC(kwp)` call | Uses local pricing.json tiers | Call `POST /api/v1/price` with `surface_type: "unknown"` |
| `src/prequal_main.jsx` | `getYield(municipio)` call | Hardcoded MUNICIPIO_YIELDS table | Call `GET /api/v1/solar-resource` |

### Key migration note on getEPC()
The current `getEPC(kwp)` does a client-side tier lookup. Replace the entire function with a single API call:

```javascript
async function getEPC(kwp, municipio) {
  const res = await fetch('https://windmar-commercial-toolbelt.vercel.app/api/v1/price', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.TOOLBELT_API_KEY
    },
    body: JSON.stringify({
      surfaces: [{ kw: kwp, surface_type: 'unknown' }]
    })
  });
  const data = await res.json();
  return data.surfaces[0]; // { price_per_watt, total_price, ... }
}
```

### Leave Untouched

- **Zoho CRM integration** — works independently, no changes needed
- **OCR endpoint** (`POST /api/ocr`) — uses app's own Anthropic key, no changes needed
- **All UI screens** — WelcomeScreen, UploadScreen, RoofScreen, BatteryIntentScreen, ContactScreen, ThankYouScreen
- **esbuild pipeline** — no changes needed
- **Tailwind CSS** — no changes needed

---

## Environment Variables to Add

Add to `.env` and to the Vercel deployment:

```
TOOLBELT_API_KEY=wmc_live_33f164de88eee4dfb72519876691df0c6483765d7bdd3044c3f065f096b047e4
```

---

## Deployment Target

Deploy as a **standalone Vercel app** — NOT inside the Tool Belt shell. The estimator is used by sales reps in the field; the Tool Belt is used by the internal commercial team. Different audiences, different apps.

---

## Notes

- The Tool Belt API key is managed at `/app/admin → API Keys tab` on the Tool Belt
- If pricing tiers change in the Tool Belt Admin panel, the estimator automatically gets the new prices — no redeploy needed
- The `buffer` parameter defaults to `true` (20% safety margin) — pass `buffer=false` to disable
- `surface_type: "unknown"` is the correct value for the estimator — it maps to flat_roof pricing
- The full tier table is available at `GET /api/v1/epc-tiers` but prefer `POST /api/v1/price` for per-job calculations
