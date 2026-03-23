# Windmar Commercial — PreQual Solar Wizard
## Claude Code Project README

---

## Project Overview

A mobile-first, tablet-facing solar pre-qualification wizard for Windmar Commercial sales reps.
Reps walk prospects through a flow on a tablet to determine solar viability and capture leads.
Built in Spanish, Puerto Rico-specific (LUMA utility, 78 municipios, local solar yield data).

**Deployed at:** windmar-solar-production.up.railway.app  
**Stack:** Node.js / Express backend + React frontend (single-page, no router)  
**AI:** Anthropic API for OCR of LUMA electricity bills

---

## Directory Structure

```
/Users/luismorales/Desktop/IQ_Claude/PreQual_Deal/windmar/
├── server.js                        # Express server, serves React as HTML, OCR endpoint, Zoho integration
├── package.json
├── patch_and_build.sh               # Build + deploy script (run with: ./patch_and_build.sh prequal)
├── .env                             # ANTHROPIC_API_KEY, Zoho credentials — never commit
├── PreQual_Solar.jsx                # LEGACY chat-style UI (52KB) — DO NOT DELETE, mines business logic
├── Cuestionario_Solar_INTEGRATED.jsx # Deal section questionnaire (263KB) — separate flow
├── src/                             # React source
│   └── (wizard screen components)
├── public/                          # Built output served by Express
├── docs/                            # Design docs and wireframes
│   ├── README_ZOHO_INTEGRATION.md   # Zoho integration spec — credentials, field map, server.js code
│   ├── ZOHO_FILE_ATTACHMENT_INSTRUCTIONS.md  # File attachment implementation details
│   └── ZOHO_LEADS_FIELD_MAP.md     # Complete API name ↔ UI label map for Commercial_Lead module
└── leads/                           # CSV lead captures
```

---

## How to Run Locally

```bash
cd /Users/luismorales/Desktop/IQ_Claude/PreQual_Deal/windmar
node server.js
# Visit: http://localhost:3001/prequal
```

To build and deploy to Railway:
```bash
./patch_and_build.sh prequal
```

---

## Implementation Status

### PreQual Wizard — ✅ COMPLETE
All screens built and deployed to Railway.

### Zoho CRM Integration — ✅ COMPLETE
Implemented in `server.js`. Creates leads, populates fields, attaches both files.
See `docs/README_ZOHO_INTEGRATION.md` for full details.

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
File: `1772488938446_image.png` (JPEG, 872×138px) — Windmar Commercial logo.
Embed as base64 in the Header component for Railway deployment.
Use text placeholder `WINDMAR / COMMERCIAL` during local dev to avoid file size issues.

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
