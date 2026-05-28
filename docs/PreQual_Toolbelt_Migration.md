# PreQual Wizard → Tool Belt Migration Plan
**Date:** 2026-05-26 (updated)
**Author:** Planning session — Claude Sonnet 4.6
**Source documents:** `PreQual_Wizard_Spec_Verified.md` (2026-05-25), `api-v1-spec.md` (v1.0, commit 70fda4e — corrected 2026-05-26), `prompt-prequal-migrate-ocr-step4.md` (2026-05-26)
**Scope:** Strip internal calculation and OCR logic from the Wizard; replace with Tool Belt API calls. The Wizard becomes a flow-control and data-capture engine.

---

## 1. Executive Summary

The Wizard currently contains four categories of logic that belong in the Tool Belt:

| Category | Current location | Migration target | Status |
|----------|-----------------|-----------------|--------|
| OCR — LUMA bill parsing | `POST /api/ocr` in `server.js` | `/api/v1/ocr/luma-bill` | Steps 1–3 done at Tool Belt; **Step 4 = this doc** |
| Solar system sizing | `calcEstimate()` in `EstimateScreen.jsx` | `/api/v1/area-to-system` + `/api/v1/price` | Pending |
| Battery / inverter sizing | `calcBatterySystem()` in `EstimateScreen.jsx` | `/api/v1/battery-sizing` | Pending |
| EPC tier table | `CFG_DEFAULTS.epc_table` hardcoded in `EstimateScreen.jsx` | `/api/v1/epc-tiers` (already partially proxied) | Pending |

**The OCR migration (Step 0 in this document's sequencing) is the highest-priority item** because it has been completed and verified at the Tool Belt side, and a detailed prompt already exists for executing it. The calculation migrations follow.

Two Tool Belt calls (`/api/v1/solar-resource` and `/api/v1/area-to-system`) are already wired via the Wizard's proxy endpoints. The migration extends that pattern to cover pricing and battery sizing, and removes the client-side math that currently duplicates or approximates what the Tool Belt already computes authoritatively.

After full migration, `EstimateScreen.jsx` contains no solar or battery math, `server.js` contains no OCR handler or system prompt, and the Wizard is purely a flow-control and data-capture layer.

---

## 2. What Changes vs. What Stays

### Removed from the Wizard

| Function / constant | File | Replacement |
|---------------------|------|-------------|
| `POST /api/ocr` route | `server.js` | Tool Belt `/api/v1/ocr/luma-bill` (direct client call) |
| OCR system prompt constant(s) | `server.js` | Owned by Tool Belt — delete entirely |
| multer middleware (if OCR-only) | `server.js` | Remove if not shared with other routes |
| `calcEstimate()` | `EstimateScreen.jsx` | See §5 |
| `calcBatterySystem()` | `EstimateScreen.jsx` | See §6 |
| `getEPC()` | `EstimateScreen.jsx` | Subsumed by `/api/v1/price` |
| `roundToPanels()` | `EstimateScreen.jsx` | Subsumed by `/api/v1/area-to-system` |
| `getYield()` | `EstimateScreen.jsx` | Subsumed by `/api/v1/solar-resource` (already proxied) |
| `CFG_DEFAULTS.epc_table` | `EstimateScreen.jsx` | Server-side fallback in `server.js` (already exists) |
| `MUNICIPIO_YIELDS` table | `EstimateScreen.jsx` | Server-side fallback in `server.js` (already exists) |
| `BAT_CFG_DEFAULTS` constants | `EstimateScreen.jsx` | Removed — no client-side battery fallback after migration |
| `resolveBatCfg()` | `EstimateScreen.jsx` | Removed |

### Stays in the Wizard (unchanged)

- All Zoho CRM submission logic (`/api/zoho-lead`, `createZohoLead()`) — **except** field name updates driven by OCR rename (see §3.3)
- All PDF generation logic (`/api/generate-and-attach-pdf`)
- All screen routing and state management in `WelcomeScreen.jsx`
- `calcFinancing()` — not yet in the Tool Belt; stays in `EstimateScreen.jsx`
- The `serviceType` dropdown on WelcomeScreen — activated by this migration (see §4)
- Address parsing, lead persistence, encryption/handoff logic
- The OCR **review card UI** and all FIX steps — these are Wizard UI, not OCR logic; they remain, but read from the new field names (see §3.2)

### New additions to the Wizard

- `TOOLBELT_API_KEY` env var referenced in `server.js` (for proxy auth) and injected into the client via the existing `__PLACEHOLDER__` pattern (for the direct OCR call)
- A new server-side proxy endpoint: `POST /api/battery-sizing` (see §6.2)
- `serviceType` propagated from `WelcomeScreen` state through `ocrData` into `EstimateScreen` (see §4)

---

## 3. OCR Migration (Step 0 — Execute First)

### 3.1 Background

This is Step 4 of a 5-step OCR consolidation at the Tool Belt. Steps 1–3 are complete and verified (Tool Belt commit `4859ffa`, 13/14 regression tests passing). The detailed execution prompt for this step is in `prompt-prequal-migrate-ocr-step4.md`. This section summarises the architectural decisions so the full migration document is self-contained.

### 3.2 What changes in the OCR path

**In `server.js`:**
- Delete the `POST /api/ocr` route entirely — the route definition, its multer middleware instance, and the system prompt constant(s) it uses
- If multer is used only by `/api/ocr`, remove the `require('multer')` and middleware setup entirely
- Add `TOOLBELT_API_KEY` to the env var references at the top of the file
- Inject `TOOLBELT_API_KEY` into the client via the existing `__PLACEHOLDER__` pattern so the frontend can authenticate directly

**In the frontend upload screen (`UploadScreen.jsx` or equivalent):**
- Change the fetch target from `/api/ocr` (Wizard backend) to `https://windmar-commercial-toolbelt.vercel.app/api/v1/ocr/luma-bill` (Tool Belt, direct)
- Add `X-API-Key: ${TOOLBELT_API_KEY}` header (value injected via placeholder)
- Request format is already `multipart/form-data` with field name `bill` — no change needed there
- Remove any `system`, `model`, or `max_tokens` fields from the request body if present
- Update response reading: old endpoint returned raw Anthropic content; new endpoint returns `{ success: true, data: { ... } }` — read `response.data.<fieldname>`

**One-file-per-request constraint:** The Tool Belt endpoint accepts one file per request (max 4MB). If the Wizard upload screen allows multiple bill uploads, fire one request per file in parallel via `Promise.all` and merge results client-side. For the common single-bill case, no change is needed.

### 3.3 OCR field name renames

The Tool Belt's unified schema uses different field names from PreQual's old OCR handler. Every reference to the old names throughout the Wizard codebase — JSX files, utility functions, Zoho CRM mapping, display components, the OCR review card — must be updated:

| Old PreQual field | New unified field | Notes |
|---|---|---|
| `demanda_contratada` | `carga_contratada_kva` | Renamed to match Tool Belt convention |
| `exceso_demanda_kva` | `exceso_de_demanda_kva` | Added `_de_` |
| `address` | `direccion` | Renamed to Spanish |
| `total_adeudado` | `total_adeudado` | Unchanged |
| `consumo_promedio` | `consumo_promedio` | Unchanged |
| `tarifa` | `tarifa` | Unchanged |
| `municipio` | `municipio` | Unchanged |
| `cargo_cliente` | `cargo_cliente` | Unchanged |
| `cargo_demanda` | `cargo_demanda` | Unchanged |
| `exceso_demanda_usd` | `exceso_demanda_usd` | Unchanged |
| `costo_kwh` | `costo_kwh` | Unchanged |
| `consumos_mensuales` | `consumos_mensuales` | Unchanged |
| `tasas_mensuales` | `tasas_mensuales` | Unchanged |

**New fields available after migration (not previously in PreQual's OCR):**

| New field | Type | Notes |
|-----------|------|-------|
| `demanda_maxima_kva` | number\|null | Server-computed: `carga_contratada_kva + exceso_de_demanda_kva`. Use this instead of computing it locally. |
| `factor_de_potencia` | number\|null | Power factor 0–1. Not currently used by Wizard — available for future use. |
| `nombre_negocio` | string\|null | Business name from bill — unreliable per Tool Belt spec. Do not depend on it; do not display it as a confirmed field. |
| `fuente` | object | Provenance notes. Never null. Useful for debugging OCR quality. |
| `consumos_mensuales` | number[]\|null | 13-month consumption history. |
| `tasas_mensuales` | number[]\|null | 13-month $/kWh rate history. |

### 3.4 Zoho CRM field mapping updates

The Zoho mapping in `server.js` (`createZohoLead()` / `parseLeadNotes()`) reads OCR field names from `leadData`. Anywhere these are sourced from OCR fields, apply the rename table above. Specifically:

| Zoho field | Old OCR source | New OCR source |
|------------|---------------|----------------|
| `Carga_Contratada_KVA` | `leadData.demandaKVA` (from `demanda_contratada`) | `leadData.demandaKVA` (from `carga_contratada_kva`) |
| `Address` | `leadData.address` | `leadData.direccion` |

The Zoho field names themselves do not change — only the OCR field names that feed them.

### 3.5 Demand cap update

The demand cap in `EstimateScreen.jsx` (§5.4 below) currently references `demandaKVA` derived from `demanda_contratada`. After the OCR rename, it must read from `carga_contratada_kva`. The cap logic itself is unchanged:

```js
// After OCR rename — source field changes, logic stays the same:
const demandaKVA  = ocrData.carga_contratada_kva  ?? 0;   // was: ocrData.demanda_contratada
const excesoKVA   = ocrData.exceso_de_demanda_kva  ?? 0;   // was: ocrData.exceso_demanda_kva
```

### 3.6 Environment variable

`TOOLBELT_API_KEY` must be added to the PreQual Vercel project's environment variables before the OCR migration deployment will work. **Do not hardcode the key.** The key is a `wmc_live_` prefixed 73-character string managed at Tool Belt Admin → API Keys. The developer must add it manually via:
`https://vercel.com/windmar-home/<prequal-project>/settings/environment-variables`

### 3.7 Verification checklist

1. Upload a Primaria bill end-to-end — confirm `carga_contratada_kva`, `consumo_promedio`, and `municipio` populate correctly
2. Confirm no Network tab requests to the old `/api/ocr` endpoint
3. Confirm the Zoho CRM lead creates with correct field values for the renamed fields
4. Grep `server.js` for `/api/ocr` — must return no matches after migration
5. Confirm the 4MB file size limit is handled gracefully in the UI (the two 18MB/3.5MB fixtures that fail with 413 should show a user-facing error, not a crash)

---

## 4. serviceType → voltage/phases Mapping

The WelcomeScreen already captures `serviceType`. This migration activates it as a required input to `/api/v1/battery-sizing`.

| `serviceType` value | `voltage` | `phases` | Notes |
|---------------------|-----------|----------|-------|
| `bifasico_240` | 240 | 2 | |
| `trifasico_208` | 208 | 3 | Full catalog support confirmed |
| `trifasico_480` | 480 | 3 | |
| `no_se` | 240 | 2 | **Default.** Represents the most common scenario for users who don't know their service type. This default **must be surfaced in the UI** (see §4.1). It is subject to change. |

### 4.1 UI requirement: surface the default

When `serviceType === "no_se"` and the battery slider is moved above 0, the EstimateScreen must display a visible qualifier near the battery estimate:

> *"Estimado basado en servicio bifásico 240V. Verifica el tipo de servicio para mayor precisión."*

This makes the assumption transparent to the rep without blocking the flow.

### 4.2 Propagating serviceType

`serviceType` is currently stored in `WelcomeScreen` state but never passed to child screens. Merge it into `ocrData` at the point `UploadScreen` completes:

```js
// In WelcomeScreen.jsx, when transitioning from upload → roof:
const handleUploadComplete = (ocrResult) => {
  setOcrData({ ...ocrResult, serviceType });  // merge serviceType into ocrData
  setScreen('roof');
};
```

`EstimateScreen` then reads `ocrData.serviceType` and applies the mapping table above.

---

## 5. Solar Sizing Migration

### 5.1 Current flow (to be removed)

`EstimateScreen` currently:
1. Uses `annualYieldOverride` from `/api/solar-resource` (already proxied) or falls back to `MUNICIPIO_YIELDS`
2. Uses `maxKwpRoofOverride` from `/api/area-to-system` (already proxied) or falls back to `(sqft/2500)×45`
3. Applies a demand-based cap locally
4. Calls `getEPC()` against a locally-held tier table
5. Computes `systemCost = systemKwp × 1000 × epcPerW`

Steps 3–5 are client-side math that duplicates Tool Belt logic.

### 5.2 Target flow

Replace steps 3–5 with a single call to `POST /api/price` (proxied via a new Wizard server endpoint).

**The `kw` input comes from `/api/v1/area-to-system`'s `kw` field**, which already incorporates the active module spec and the 1.20 layout buffer. Do not independently compute `systemKwp` in the Wizard.

**Step-by-step after migration:**

```
1. On EstimateScreen mount, two parallel calls (already wired):
     GET /api/solar-resource?municipality={municipio}
     GET /api/area-to-system?sqft={sqft}&municipality={municipio}&buffer=true

2. From area-to-system response, read:
     systemKwp   ← response.kw
     numModules  ← response.modules           (replaces roundToPanels() output)
     annualYield ← response.specific_yield    (same source as solar-resource)

3. NEW: single additional call:
     POST /api/price
     Body: { "surfaces": [{ "kw": systemKwp, "surface_type": "flat_roof" }] }
     → systemCost ← response.surfaces[0].total_price

4. Compute locally (not yet in Tool Belt):
     annualGen       = systemKwp × annualYield
     coverage        = min((annualGen / (consumoKWH × 12)) × 100, 100)
     solarKwhMonthly = min(annualGen / 12, consumoKWH)
     savingsCash     = costoPorKWH × solarKwhMonthly
     calcFinancing(systemCost)  → monthlyPmt, balloon
```

### 5.3 Proxy endpoint

Add a thin proxy to `server.js`:

```
POST /api/price
→ proxies to https://windmar-commercial-toolbelt.vercel.app/api/v1/price
  with X-API-Key: ${TOOLBELT_API_KEY}
```

Pattern is identical to the existing `/api/solar-resource` and `/api/area-to-system` proxies. `TOOLBELT_API_KEY` is already present after the OCR migration.

### 5.4 Demand-based cap

The demand cap is not passed to `/api/v1/price` — that endpoint only prices a given kW. Apply the cap in the Wizard **before** calling `/api/price`, using the renamed OCR fields:

```js
const demandaKVA    = ocrData.carga_contratada_kva  ?? 0;   // renamed from demanda_contratada
const excesoKVA     = ocrData.exceso_de_demanda_kva  ?? 0;   // renamed from exceso_demanda_kva

const demandCapKwp  = tariff.match(/secundaria/i)
  ? 60
  : (demandaKVA + excesoKVA) * 1.2 * 1.5;

const kwpFor100pct  = (consumoKWH * 12) / annualYield;

const systemKwp = Math.min(
  areaToSystemResponse.kw,   // roof constraint (from Tool Belt)
  kwpFor100pct,              // consumption constraint (computed locally)
  demandCapKwp               // regulatory constraint (computed locally)
);
```

Note: `demanda_maxima_kva` is now available directly from the OCR response (`carga_contratada_kva + exceso_de_demanda_kva` is pre-computed by the Tool Belt). You may use `ocrData.demanda_maxima_kva` instead of summing manually, but verify the value is non-null before relying on it.

### 5.5 Panel count and the 410W bug

`panel_watts` is hardcoded at 410W in `EstimateScreen.jsx` while the live module is 585–600W, overstating panel count by ~40–45%. After migration, `numModules` comes directly from the Tool Belt's `/api/v1/area-to-system` response, which uses the active module spec from the database. **This bug is resolved automatically by the migration** — no separate fix required.

---

## 6. Battery Sizing Migration

### 6.1 Current flow (to be removed)

`calcBatterySystem()` in `EstimateScreen.jsx` uses hardcoded constants (`BAT_CFG_DEFAULTS`) to size inverters and batteries, compute shipping and installation, and apply a fixed 1.35× markup. The Tool Belt's `/api/v1/battery-sizing` endpoint does all of this with live catalog data and admin-managed design constants.

### 6.2 New proxy endpoint

Add to `server.js`:

```
POST /api/battery-sizing
→ proxies to https://windmar-commercial-toolbelt.vercel.app/api/v1/battery-sizing
  with X-API-Key: ${TOOLBELT_API_KEY}
```

The proxy passes the request body through unchanged. On the response, strip sensitive fields before returning to the client (see §6.6).

### 6.3 Request mapping

| Tool Belt field | Source in Wizard | Notes |
|-----------------|-----------------|-------|
| `system_kw` | `systemKwp` from §5 (after demand cap) | kWdc — correct unit |
| `annual_consumption_kwh` | `consumoKWH × 12` | Monthly → annual |
| `battery_hours` | `batteryHours` slider state | Must be one of: 0, 4, 8, 12, 16, 24 |
| `voltage` | Derived from `serviceType` — see §4 | |
| `phases` | Derived from `serviceType` — see §4 | |
| `location` | Hardcode `"outdoor"` | All commercial installs are outdoor |
| `tariff` | Normalize `ocrData.tarifa` → lowercase enum | See §6.4 |
| `demand_kva` | `ocrData.carga_contratada_kva` (renamed from `demanda_contratada`) | Optional but strongly recommended |
| `transformer_kva` | Not collected — omit | Future enhancement; see §11 |

### 6.4 Tariff normalization

The OCR returns mixed-case tariff strings. The Tool Belt requires lowercase enum values:

```js
const normalizeTariff = (t) => {
  if (!t) return undefined;
  const s = t.toLowerCase().trim();
  if (s.includes('secundaria'))  return 'secundaria';
  if (s.includes('primaria'))    return 'primaria';
  if (s.includes('transmisi'))   return 'transmision';   // handles accent variants
  if (s.includes('residencial')) return 'residencial';
  return undefined;  // omit the field rather than send an invalid value
};
```

Pass the result as `tariff` only if non-undefined.

### 6.5 Response mapping

| Tool Belt response field | Wizard state | Notes |
|-------------------------|-------------|-------|
| `total_price` | `batteryResult.totalCost` | Direct replacement |
| `system_kwh` | `batteryResult.systemKWH` | Direct replacement |
| `actual_backup_hours` | `batteryResult.actualHours` | Direct replacement |
| `cap_applied` | Surface to rep if present | See §7.2 |

### 6.6 Use `?detail=full`; strip sensitive fields in proxy

Call `POST /api/battery-sizing?detail=full`. The `bom.inverter.model` field replaces the hardcoded `"Sol-Ark XkW/YkWh"` product name string.

Strip sensitive internal pricing fields in the `server.js` proxy before returning to the client:

```js
const sanitizeBOM = (bom) => {
  if (!bom) return null;
  return {
    head: {
      system_kw:     bom.head.system_kw,
      system_kwac:   bom.head.system_kwac,
      battery_hours: bom.head.battery_hours,
      voltage:       bom.head.voltage,
      phases:        bom.head.phases,
    },
    inverter: {
      model:      bom.inverter.model,
      qty:        bom.inverter.qty,
      line_total: bom.inverter.line_total,
    },
    batteries:    bom.batteries.map(b => ({ model: b.model, qty: b.qty, line_total: b.line_total })),
    accessories:  bom.accessories.map(a => ({ name: a.name, qty: a.qty, line_total: a.line_total })),
    shipping:     bom.shipping,
    installation: bom.installation,
  };
};
```

Fields stripped: `unit_cost`, `gm_pct_applied`, `multiplier_applied` — internal pricing per Tool Belt §7 sensitive-field policy.

### 6.7 Slider implementation — batch precomputation with snap-to-value

**Allowed values:** The Tool Belt enforces `battery_hours` must be one of `[0, 4, 8, 12, 16, 24]`. The slider must only ever land on one of these discrete positions:

- Render 6 discrete stops: 0, 4, 8, 12, 16, 24
- Snap to nearest valid value on release — never leave the thumb between stops
- Display: `"Sin almacenamiento"` at 0, `"{N} horas de respaldo"` otherwise
- Never pass an interpolated value to the API

**Batch precomputation:** On EstimateScreen mount, after `systemKwp` is resolved, fire all 5 non-zero positions in parallel. The slider indexes into this cache with zero latency:

```js
const SLIDER_HOURS = [4, 8, 12, 16, 24];
const batteryCache = {};

await Promise.allSettled(
  SLIDER_HOURS.map(async (hours) => {
    const res = await fetch('/api/battery-sizing?detail=full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_kw:              systemKwp,
        annual_consumption_kwh: consumoKWH * 12,
        battery_hours:          hours,
        voltage:                voltage,          // from serviceType mapping
        phases:                 phases,
        location:               'outdoor',
        tariff:                 normalizedTariff,
        demand_kva:             demandaKVA,
      })
    });
    const data = await res.json();
    batteryCache[hours] = res.ok ? data : { error: data.error };
  })
);
```

Slider change handler (zero latency — reads from cache):

```js
const handleSliderChange = (hours) => {
  setBatteryHours(hours);
  setBatteryResult(hours === 0 ? null : batteryCache[hours] ?? null);
};
```

**Loading state:** Solar estimate cards render immediately — they do not depend on battery results. Show "Calculando opciones de respaldo…" while the batch is in flight. Disable the slider until the batch completes or times out.

**Timeout / failure:** If the batch does not resolve within 8 seconds, disable the battery slider and show: *"Estimado de baterías no disponible. Contacte a su coordinador."* Do not block the solar estimate or the "Sí me interesa" CTA.

---

## 7. Error Handling

### 7.1 Standard Tool Belt errors

| Condition | Wizard behavior |
|-----------|----------------|
| Tool Belt unreachable (network error) | Fall back to existing hardcoded values for solar; disable battery slider |
| HTTP 401 (bad API key) | Log server-side; client sees "servicio no disponible" — never expose auth errors to the rep UI |
| HTTP 500 from Tool Belt | Treat as unreachable; fall back |
| HTTP 404 municipality not found | Fall back to default yield (1530 kWh/kWp/yr) and log |
| OCR 413 (file too large) | Show user-facing error: *"La factura excede el tamaño máximo de 4MB. Por favor usa un archivo más pequeño."* — do not crash |

### 7.2 Battery cap_applied

When the Tool Belt returns a `cap_applied` object, surface it to the rep:

> *"El sistema de baterías fue ajustado por los límites de su tarifa LUMA. Respaldo estimado: {actualHours} horas."*

Informational only — does not block flow. `total_price` already reflects the constrained configuration.

### 7.3 Battery 422 errors

| Error code | Wizard behavior |
|------------|----------------|
| `no_inverter_for_voltage` | Hide battery slider; show: *"Almacenamiento no disponible para este tipo de servicio eléctrico."* |
| `capacity_exceeded_kw` | Hide battery slider; show: *"Sistema solar demasiado grande para las opciones de almacenamiento actuales."* |
| `capacity_exceeded_kwh` | Show "—" for the specific hours value that failed; other slider positions may still succeed |
| `no_legal_configuration` | Hide battery slider; show: *"Configuración no disponible. Contacte a su coordinador."* |

---

## 8. Zoho CRM Field Mapping

### 8.1 OCR field renames in Zoho mapping

See §3.4. The Zoho field names themselves do not change — only the OCR source field names that feed them.

### 8.2 Battery fields

| Zoho field | Current source | Post-migration source |
|------------|---------------|----------------------|
| `Baterias` | `parseFloat(leadData.batteryPrice)` | `batteryResult.total_price` from Tool Belt |
| `Battery_System_Size_kWh` | `String(leadData.batteryKWH)` | `String(batteryResult.system_kwh)` |
| `Storage_Size_kWh` | `String(leadData.batteryKWH)` | `String(batteryResult.system_kwh)` |

Product name in `Lead_Notes` — replace hardcoded string with BOM data:

```js
const productName = `${bom.inverter.model} × ${bom.inverter.qty} / ${batteryResult.system_kwh} kWh`;
```

---

## 9. Endpoints Retired from server.js

After migration is complete and tested:

| Endpoint / function | Reason |
|--------------------|--------|
| `POST /api/ocr` | Replaced by direct Tool Belt call from client |
| OCR system prompt constant(s) | Owned by Tool Belt — delete |
| multer (if OCR-only) | No longer needed |
| `GET /api/pricing` proxy | Replaced by `POST /api/price` |
| Hardcoded `CFG_DEFAULTS.epc_table` fallback | Replaced by `POST /api/price` error behavior |

**Do not remove:**
- `GET /api/solar-resource` proxy — still in use
- `GET /api/area-to-system` proxy — still in use
- Hardcoded `specific_yield: 1530` fallback in `/api/solar-resource` — valid safety net

---

## 10. Migration Sequencing

Do these in order. Each step is independently deployable and testable.

**Step 0 — Migrate OCR to Tool Belt** *(execute first — Tool Belt side already done)*
Delete `POST /api/ocr` from `server.js`. Update the upload screen to call Tool Belt directly. Apply all OCR field renames throughout the codebase. Add `TOOLBELT_API_KEY` env var reference. Verify per §3.7 checklist before proceeding. Full execution instructions in `prompt-prequal-migrate-ocr-step4.md`.

**Step 1 — Wire serviceType downstream** *(low risk, no calc changes)*
Merge `serviceType` into `ocrData` on upload completion. Verify it reaches `EstimateScreen`. No visible change to estimates yet.

**Step 2 — Replace solar pricing** *(medium risk)*
Add `POST /api/price` proxy. Replace `getEPC()` + `systemCost` computation with the proxy call. Keep `calcEstimate()` as a wrapper for now — replace only its pricing step. Verify `systemCost` values are consistent with current output before deleting old code.

**Step 3 — Replace battery sizing** *(higher risk — architectural change)*
Add `POST /api/battery-sizing` proxy with sensitive-field stripping. Implement batch-precomputation pattern with snap-to-value discrete slider. Replace `calcBatterySystem()` entirely. Test all 6 slider positions for each `serviceType` value, and simulate a 422 error condition.

**Step 4 — Clean up** *(low risk)*
Remove `calcBatterySystem()`, `BAT_CFG_DEFAULTS`, `resolveBatCfg()`, `getEPC()`, `CFG_DEFAULTS.epc_table`, `MUNICIPIO_YIELDS` (client-side copy only — server fallback stays). Remove `GET /api/pricing` proxy. Fix panel-count display to use `numModules` from area-to-system. Fix the slider subtitle copy. Fix the "Paso 5 de 6" duplicate progress bar.

---

## 11. Open Questions

| # | Item |
|---|------|
| 1 | `no_se` defaults to `bifasico_240` (240V/2-phase). This default may change. When it changes, update only the §4 mapping table — no other code changes required. |
| 2 | `calcFinancing()` stays in the Wizard. When `/api/v1/financing` is added to the Tool Belt, a separate migration document should cover that replacement. |
| 3 | `transformer_kva` is not collected anywhere in the Wizard today. It is an optional field for the battery-sizing endpoint that would improve cap accuracy for large Primaria/Transmisión customers. Consider adding it to the UploadScreen review card in a future pass. |
| 4 | `nombre_negocio` is now available from OCR but is marked unreliable in the Tool Belt spec. Do not display it as a confirmed field or map it to Zoho without a manual confirmation step. |
| 5 | `consumos_mensuales` and `tasas_mensuales` (13-month history arrays) are now available from OCR. Currently unused by the Wizard. Potential future use: display consumption history chart on EstimateScreen to help the rep contextualize the estimate. |

---

*Windmar Commercial — Internal Document — CONFIDENTIAL*
