# Session Notes — 2026-05-05

## Overview

This session completed the Tool Belt API integration (solar yield + area-to-system),
fixed a series of production bugs discovered during live testing on Vercel, and resolved
a root-cause filesystem detection bug that caused false 500 errors on the ContactScreen.

---

## Files Modified

### `server.js`
- **Two new Tool Belt proxy routes:**
  - `GET /api/solar-resource?municipality=X` — proxies Tool Belt `/api/v1/solar-resource`.
    Returns `{ municipality, specific_yield, unit }`. Fallback: 1530 kWh/kWp/year.
  - `GET /api/area-to-system?sqft=X&municipality=X&buffer=true` — proxies Tool Belt
    `/api/v1/area-to-system`. Returns `{ kw, modules, specific_yield, module, ... }`.
    Fallback: hardcoded `(sqft / 2500) * 45` ratio.
  - Both routes keep the API key server-side; client never contacts Tool Belt directly.
- **LEADS_AVAILABLE write-probe fix:** The previous check only tested `existsSync`, which
  returned `true` on Vercel because `leads/` is included in the deployment package. This
  caused `LEADS_AVAILABLE = true` at startup, then a runtime `EROFS` crash when the actual
  write was attempted, producing a 500 on every `POST /api/leads` call. Fixed by writing
  and immediately deleting a `.write_probe` file on startup — if that throws, `LEADS_AVAILABLE`
  is correctly set to `false`.

### `src/EstimateScreen.jsx`
- **Added `import { useState, useEffect } from "react"`** — hooks were missing; needed for
  the new live data fetch.
- **`calcEstimate` signature extended:** Added two optional override parameters:
  - `annualYieldOverride` — uses live Tool Belt yield when available; falls back to
    hardcoded `MUNICIPIO_YIELDS` table.
  - `maxKwpRoofOverride` — uses live Tool Belt `area-to-system` kW value when available;
    falls back to `(sqft / 2500) * 45`.
- **`liveSolarConfig` state + `useEffect`** added inside `EstimateScreenInner`. On mount,
  calls `fetchSolarConfig(municipio, sqft)` (passed from WelcomeScreen). While the API call
  is in-flight, the hardcoded fallback values are used. On response, the component re-renders
  with live yield and live max kW. Typical latency is <300ms; transition is seamless.

### `src/WelcomeScreen.jsx`
- **`useCallback` added** to React import.
- **`fetchSolarConfig` callback** added: makes parallel calls to `/api/solar-resource` and
  `/api/area-to-system`, returns `{ solarData, areaData }` or `null` on failure. Memoized
  with `useCallback` so it doesn't re-create on every render.
- **`fetchSolarConfig` passed to `<EstimateScreen>`** as a prop.
- **`generateLead` passed to `<ContactScreen>`** as a prop — previously missing, which caused
  ContactScreen to always call `/api/leads` even in test/demo mode.

### `src/ContactScreen.jsx`
- **Accepts `generateLead` prop** (default `true`).
- **Test/demo mode bypass:** When `generateLead=false`, `handleSubmit` skips the
  `/api/leads` API call entirely and calls `onNext` directly with a `null` leadId.
  Eliminates the false 500 error that previously blocked testing.
- **Improved error handling for real failures:** When `generateLead=true` and the server
  returns an error, the message now reads:
  > *"No se pudo registrar la visita (Error del servidor.). Puedes continuar — el estimado
  PDF se generará de todas formas."*
- **"Continuar de todas formas →" button** appears when an error is shown, allowing the
  user to proceed without being blocked. PDF generation and Zoho lead creation in
  ThankYouScreen are independent of `/api/leads` and will still run.

### `src/RoofScreen.jsx`
- **Formatted area input:** Added `fmtSqft()` / `parseSqft()` helpers. Tile clicks set
  the input to a formatted value (e.g. `"50,000 Sq Ft"`). Input type changed from `number`
  to `text` with `inputMode="numeric"`. `onFocus` strips formatting; `onBlur` re-formats.
  Input is right-justified and bold.

### `src/UploadScreen.jsx`
- **Client-side image compression:** Added `compressImageFile()` using the Canvas API.
  Images over 4 MB are scaled and re-encoded as JPEG at 88% quality before upload.
  Targets ~3.7 MB to stay under Vercel's 4.5 MB inbound edge limit.
- **Large PDF pre-flight check:** `handleFileChange` is now async. PDFs over 4 MB are
  blocked immediately with an actionable Spanish error message.
- **Improved PDF error message** (updated during session):
  > *"El PDF es demasiado grande (X MB). Las facturas de LUMA no deben exceder 4 MB.
  Descarga la factura directamente desde luma.com, o toma una foto con tu teléfono..."*

### `build.js`
- **Cache-busting:** HTML shell now embeds a timestamp-based `?v=` query string on the
  bundle script tag on every build run, preventing CDN and browser caching of stale bundles.
- **Removed pdf-lib CDN tag** — PDF generation moved server-side in the previous session;
  the CDN script was no longer needed.

### `vercel.json`
- **Removed conflicting `functions` + `builds` co-existence** — Vercel CLI rejected the
  combination. `maxDuration: 30` and `memory: 1024` moved into the `builds[0].config`
  object, which is valid.

### `.vercel/project.json` *(gitignored)*
- Relinked to the correct Vercel project: `windmar-commercial-estimator`
  (`prj_zTbG9YQq5q85iSsRid4ClF6x6oNz`) in the `windmar` team. Previous link was to a
  personal-scope `windmar_dev` project, which is why GitHub auto-deploys were silently
  going to the wrong project.

---

## Architectural Notes

### Tool Belt integration — now complete for estimation inputs

| Data | Source |
|---|---|
| EPC $/W tiers | Tool Belt `/api/v1/epc-tiers` ✅ |
| Solar yield by municipio | Tool Belt `/api/v1/solar-resource` ✅ |
| Max kW from roof area | Tool Belt `/api/v1/area-to-system` ✅ |
| Panel wattage for count display | Hardcoded 410W (cosmetic only) |

All three Tool Belt calls are server-side proxies — the API key never reaches the browser.
All three have hardcoded fallbacks so the wizard degrades gracefully if Tool Belt is down.

The `area-to-system` endpoint returns the live module spec (`SUNPRO POWER SPDG 585/600W`)
which produces different roof-to-kW ratios than the old hardcoded 410W Qcells assumption.
Panel *count* display (`numPanels` in the estimate) still uses the hardcoded 410W value
and is cosmetically wrong — this is a known follow-up item.

### LEADS_AVAILABLE detection (root cause of ContactScreen 500s)

The `leads/` directory is committed to the repo and included in every Vercel deployment
at `/var/task/leads/`. The original `existsSync` check returned `true`, so `mkdirSync`
was never called and `LEADS_AVAILABLE` was set to `true`. Actual writes then hit the
read-only filesystem at runtime and threw `EROFS`, caught as a 500.

Fixed by probing actual writability at startup (write + delete a temp file). This is the
correct pattern for any filesystem-dependent feature deployed to a serverless environment.

### Vercel deployment — direct CLI deploy now required

GitHub auto-deploys are NOT set up for the `windmar-commercial-estimator` project.
All production deployments require running `npx vercel --prod` from the repo directory.
The `.vercel/project.json` file (gitignored) must be present and point to the correct
project. If it's missing, run `npx vercel link` and select `windmar-commercial-estimator`
under the `windmar` team.
