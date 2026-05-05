# Session Notes — 2026-05-04 / 2026-05-05

## Overview

This session covered the full migration of the PreQual wizard from the Railway/legacy setup
to a Vercel-hosted Node.js + React app, plus a series of production bug fixes discovered
during live testing.

---

## Files Modified

### `server.js`
- **Tool Belt API integration:** Replaced the static `GET /api/pricing` route (which read from
  `config/pricing.json`) with a live proxy to the Tool Belt's `GET /api/v1/epc-tiers` endpoint.
  Hardcoded fallback tiers are returned if the Tool Belt is unreachable.
- **Vercel serverless fix:** Wrapped `app.listen()` in `if (require.main === module)` and added
  `module.exports = app` so Vercel's `@vercel/node` runtime can import the app as a handler
  without calling listen. Previously the app crashed on every cold start with
  `FUNCTION_INVOCATION_FAILED`.
- **Read-only filesystem fix:** Wrapped `fs.mkdirSync(LEADS_DIR)` in a try/catch that sets
  `LEADS_AVAILABLE = false` on failure. All file writes in `POST /api/leads` and
  `getNextQuoteNumber()` are now guarded by `LEADS_AVAILABLE`. Fixes `EROFS` crash on Vercel.
- **Payload limits:** Raised Express body parser and multer limits from 20 MB to 25 MB.
- **Phone sanitization:** Added `cleanPhone()` helper that strips non-phone characters from
  the phone number before sending to Zoho. Fixes `INVALID_DATA / expected_data_type: phone`
  500 errors from the Zoho API.
- **Server-side PDF generation:** Added `POST /api/generate-and-attach-pdf` route. Accepts JSON
  with lead/estimate data, generates the estimate PDF using `pdf-lib` (reading templates from
  `public/` via `fs.readFileSync`), attaches it directly to the Zoho lead, and returns the PDF
  as base64 for client download. This bypasses Vercel's 4.5 MB inbound edge limit that was
  blocking the old client→server PDF upload approach.

### `src/ThankYouScreen.jsx`
- **Removed client-side PDF generation:** Deleted `generateEstimatePDF()`, `COORDS_FINANCING`,
  `COORDS_CASH`, `fmtUSD`, and all `window.PDFLib` references (~125 lines).
- **Updated both branches of the useEffect:** Both the `generateLead=true` (Zoho) and
  `generateLead=false` (demo) branches now call `POST /api/generate-and-attach-pdf` with a
  small JSON payload instead of uploading a binary PDF blob. The PDF bytes come back as base64
  and are converted to a Blob for the download button.

### `src/EstimateScreen.jsx`
- **Updated `getEPC()` function:** Changed tier lookup from legacy `{ max_kw, price_per_w }`
  format to Tool Belt format `{ kw_from, kw_to, effective_price_per_w }`. Legacy `{ from, to, epc }`
  fallback retained for local dev.

### `src/UploadScreen.jsx`
- **Client-side image compression:** Added `compressImageFile()` async function using the Canvas
  API. Images over 4 MB are scaled down (targeting ~3.7 MB) and re-encoded as JPEG at 88%
  quality before upload. Handles large phone photos that would otherwise hit Vercel's 4.5 MB
  inbound limit on `POST /api/ocr`.
- **Large PDF pre-flight check:** `handleFileChange` is now async. PDFs over 4 MB are blocked
  before upload with a Spanish error message directing users to download from luma.com or use
  a photo instead. (PDFs cannot be compressed in-browser.)
- **Error state:** Added `uploadError` state displayed as a red banner in the idle stage.

### `src/RoofScreen.jsx`
- **Formatted area input:** Added `fmtSqft()` / `parseSqft()` helpers. Tile clicks now set the
  input to a formatted string (e.g. `"50,000 Sq Ft"`). Input type changed from `number` to
  `text` with `inputMode="numeric"`. On focus: strips formatting so the user can type freely.
  On blur: re-formats. Input is right-justified and bold.

### `build.js` *(new file)*
- esbuild build script: bundles `src/prequal_main.jsx` → `public/prequal.bundle.js` and writes
  `public/prequal.html`. Generates a timestamp-based `?v=` cache-busting query string on the
  bundle script tag on every build run.

### `vercel.json`
- Went through several iterations. Final state: uses `builds` only (removed conflicting
  `functions` block that caused deploy failures). `maxDuration: 30` and `memory: 1024` moved
  into the build config object. Routes: `/public/(.*)` → static, everything else → `server.js`.

### `package.json`
- Renamed to `windmar-prequal`. Added `"build": "node build.js"` script. Moved `esbuild` to
  devDependencies. Added `pdf-lib` as a production dependency (server-side PDF generation).
  Removed unused `tailwindcss`, `lucide-react`.

### `.env` / `.env.example`
- Added `TOOLBELT_API_KEY` to both files.

### `patch_and_build.sh`
- Simplified from the old Railway patch script (which patched `PreQual_Solar_api.jsx`) to a
  thin wrapper around `node build.js`.

### `.vercel/project.json` *(new file, gitignored)*
- Points to `prj_zTbG9YQq5q85iSsRid4ClF6x6oNz` (windmar team's `windmar-commercial-estimator`
  project). Required for `npx vercel --prod` to deploy to the correct Vercel project.

---

## External Repo: `Windmar-commercial-toolbelt`

### `server.js` (Tool Belt)
- Added `GET /api/v1/epc-tiers` route. Reads from the Supabase `price_tiers` table (same source
  as the existing `POST /api/v1/price` route) and returns the full tier table shaped as
  `{ kw_from, kw_to, base_epc, misc_adder_pct, effective_price_per_w }`. Uses the existing
  `requireApiKey` middleware.

---

## Architectural Notes

### PDF generation: client → server
The biggest architectural change this session. Previously the browser loaded pdf-lib from a CDN,
generated a ~5 MB PDF, then uploaded it to `/api/zoho-attach`. Vercel's 4.5 MB inbound edge
limit blocked this on every run. The new flow sends a ~2 KB JSON payload to
`/api/generate-and-attach-pdf`; the server does the heavy lifting and streams the base64 PDF
back in the response. The outbound response size is not subject to the same edge limit.

### Vercel deployment pipeline
The project was previously auto-deploying from the old `Luis-Windmar/windmar-solar-dev` GitHub
repo to a different Vercel project (`windmar_dev` under personal scope). The production URL
(`windmar-commercial-estimator.vercel.app`) belongs to the `windmar` team project
`windmar-commercial-estimator`. All code changes committed to GitHub were silently not deploying.
Fixed by linking `.vercel/project.json` to the correct project and deploying directly via
`npx vercel --prod`.

### Tool Belt integration status (partial)
Only EPC pricing tiers are live from the Tool Belt. Panel wattage (410W), sqft→kWp ratio
(45 kWp per 2,500 sqft), and solar yield by municipio remain hardcoded in `EstimateScreen.jsx`.
The Tool Belt endpoints `/api/v1/area-to-system` and `/api/v1/solar-resource` exist and are
ready to use — wiring them in is the next integration milestone.

### Vercel platform limits (reference)
- Inbound request body: **4.5 MB hard limit** on all plans including Pro (edge-level, not configurable)
- Serverless function response body: no practical limit for the wizard's use case
- Image uploads for OCR: solved via client-side Canvas compression before upload
- PDF uploads: solved by moving generation server-side (no upload needed)
- Large PDFs (>4 MB): blocked at file selection with a user-facing error message
