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
