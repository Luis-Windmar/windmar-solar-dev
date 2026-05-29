# Zoho INVALID_DATA + Wizard-Hang Fix

**Date:** 2026-05-29
**Source prompt:** `prompts/prompt-zoho-fixes.md`
**Outcome:** Two production bugs addressed in tandem. (1) `Battery_System_Size_kWh` and `Storage_Size_kWh` now send integers to Zoho (they were strings, which Zoho rejected as INVALID_DATA). Three other numeric fields tightened to match Zoho's expected types. (2) ThankYouScreen's mount-effect now uses try/catch/**finally** — the rep always advances out of "Preparando estimado…" even when Zoho or PDF generation fails.

---

## 1. Zoho field type conversions (server.js)

All changes are inside `createZohoLead` in `server.js`. The pattern is `parseInt(value, 10)` for integer fields and `parseFloat(value)` for numeric/currency fields, with null safety so missing values stay `null` instead of becoming `NaN`.

| Zoho field | Previous coercion | New coercion | Why |
|---|---|---|---|
| `Battery_System_Size_kWh` | `String(leadData.batteryKWH)` (e.g. `"54"`) | `parseInt(leadData.batteryKWH, 10)` (e.g. `54`) | **Direct cause of the production INVALID_DATA error.** Zoho field type is integer; string was rejected. |
| `Storage_Size_kWh` | `String(leadData.batteryKWH)` | `parseInt(leadData.batteryKWH, 10)` | Same field type as `Battery_System_Size_kWh`. Same fix. |
| `Tama_o_Estimado` | `parseFloat(p.techo)` | `parseInt(p.techo, 10)` | Sqft is an integer; `parseFloat` could send `3500.5` which Zoho may reject. Also added null-safe `parseInt` to the `leadData.roofSqft` fallback (was a bare `\|\| null`). |
| `Consumo_Promedio` | `parseFloat(p.consumo)` | `parseInt(p.consumo, 10)` | Monthly kWh is integer. Same null-safe upgrade on the `leadData.avgConsumption` fallback. |
| `Carga_Contratada_KVA` | `p.demanda \|\| null` (raw string from regex) | `parseFloat(p.demanda)` | Demand contracts can be fractional (e.g. 50.5 kVA), so float is correct. The previous version sent strings, which Zoho may or may not have coerced. |
| `PV_System_Size_kW1` | `String(leadData.systemKwp)` | **unchanged** | Zoho field type confirmed as string in the existing field map; preserves precision like `"30.4"`. |
| `Quote_Amount` | `parseFloat(p.precio)` | **unchanged** | Already float — currency value, decimals expected. |
| `Baterias` | `parseFloat(leadData.batteryPrice)` | **unchanged** | Already float — battery currency. |

All conversions guard against null/undefined with explicit `!= null` checks before converting, so a missing source value flows through as `null` rather than `NaN`.

A 54 kWh battery now sends `54` (integer) instead of `"54"` (string). A 3,500 sqft roof now sends `3500` (integer) instead of `3500` parsed as `parseFloat("3500")` which returned `3500` correctly but could have surfaced `3500.0` from upstream-edited values. The 4,375 monthly kWh average now sends `4375` (integer) instead of `parseFloat("4,375")` which returned `4` (regex extract strips the comma before this point, but the `parseInt` path is the safer canonical form).

## 2. ThankYouScreen mount-effect — try/catch/finally

The mount-effect's existing try/catch was swallowing errors but never advancing the loading state. The "Preparando estimado…" button label was stuck forever whenever Zoho or `/api/generate-and-attach-pdf` failed.

### New state

```jsx
const [submissionDone, setSubmissionDone] = useState(false);
```

Tracks whether the mount-effect's `run()` has finished (success OR failure). Initially `false`; set to `true` exactly once in the `finally` block below.

### The finally block

```jsx
const run = async () => {
  try {
    // ... existing Zoho POST + PDF generation logic ...
  } catch (err) {
    // Non-blocking: log the error and surface a fallback message under the
    // button so the rep knows what happened. The `finally` below ensures
    // the UI always advances out of "Preparando estimado…".
    console.error("Zoho/PDF error (non-blocking):", err.message);
    setPdfError("El estimado no se pudo generar. Un consultor te enviará una copia.");
  } finally {
    // ALWAYS advance the loading state — Zoho or PDF failures must
    // never leave the rep stuck on "Preparando estimado…".
    setSubmissionDone(true);
  }
};
```

### Button render — three-way branch

```jsx
<button
  style={!pdfReady ? S.btnNavyDisabled : S.btnNavy}
  onClick={handleDownload}
  disabled={!pdfReady}
>
  {!submissionDone
    ? "Preparando estimado…"
    : pdfReady
      ? "⬇ Descargar estimado"
      : "Estimado no disponible"}
</button>
```

### Behaviour matrix

| Zoho POST | PDF generation | Result |
|---|---|---|
| OK | OK | "Preparando estimado…" → "⬇ Descargar estimado" (enabled) |
| OK | fails | "Preparando estimado…" → "Estimado no disponible" (disabled). `pdfError` message visible below the button. |
| fails (`success:false`) | (not reached) | "Preparando estimado…" → "Estimado no disponible". `pdfError` message visible. Rep still sees "Completar cuestionario completo" + "Nueva consulta" buttons. |
| network error | (not reached) | Same as Zoho failure case. |

The rep is **never stuck** on "Preparando estimado…" — every path reaches the `finally` and advances the label to a terminal state.

### What's NOT changed

- Happy path is unchanged: same Zoho POST, same PDF generation, same `setPdfReady(true)`.
- `pdfError` was already being set by `handleDownload` when no blob is available; now it's also set in the mount-effect catch with a more user-facing message.
- Off-grid mode is unaffected — the early return `if (offgrid) return;` still fires; the entire download-button block is wrapped in `{!offgrid && (...)}`, so `submissionDone` doesn't matter for that path.

## 3. Verification

```
$ node -c server.js
ok
$ node build.js
✅ Build complete.
$ node --test src/sizing/*.test.js
ℹ tests 40
ℹ pass 40
ℹ fail 0
```

ESLint + esbuild full-pass via `patch_and_build.sh` → clean.

### Code-level walkthrough — Zoho failure simulation

If you temporarily change `server.js`'s `/api/zoho-lead` POST URL to bad value (or comment out the route), the wizard flow is:

1. Rep submits ContactScreen → ThankYouScreen mounts → effect fires → `fetch('/api/zoho-lead')` returns 404.
2. `await res.json()` rejects (or returns `{ success: false }`).
3. `if (!data.success) throw new Error(data.error)` fires the catch.
4. `setPdfError(...)` shows the fallback message.
5. `finally` block: `setSubmissionDone(true)`.
6. Button render: `submissionDone=true && pdfReady=false` → "Estimado no disponible" (disabled).
7. Rep can still tap "Completar cuestionario completo" (SmartSheet) or "Nueva consulta" — both unaffected.

### Code-level walkthrough — Battery field type

For a `batteryResult.system_kwh = 54`:

```js
leadData.batteryKWH = 54   // number, set in ThankYouScreen
                           // (was already a number; the bug was the String() wrap on server)

// server.js / createZohoLead:
Battery_System_Size_kWh: leadData.batteryKWH != null ? parseInt(leadData.batteryKWH, 10) : null
                                                       // → 54 (integer)
```

`JSON.stringify` ships `54` (integer literal). Zoho accepts. INVALID_DATA gone.

## 4. Files touched

| File | Change |
|---|---|
| `server.js` | `createZohoLead`'s field map — 5 type-conversion tightenings + clarifying comments above each. |
| `src/ThankYouScreen.jsx` | `submissionDone` state added; mount-effect now has try/catch/**finally**; download button label is now a three-way branch instead of two. |
| `public/prequal.bundle.js`, `public/prequal.html` | Rebuilt by `node build.js`. |

## 5. What's NOT changed (per the prompt)

- Zoho field names — unchanged. Only the value types.
- Sizing logic — untouched (40/40 tests still pass).
- OCR logic — untouched.
- Normal happy path — works identically. The new state only branches when the catch fires.

## 6. After this is done

`promote_to_prod.sh` was **NOT run this session** per the user's standing instruction. The developer will test on the dev URL (https://windmar-commercial-estimator.vercel.app) first and run the promotion script manually after verifying:

- A full wizard run with a real LUMA bill completes without hanging on "Preparando estimado…"
- The Zoho `Commercial_Lead` is created successfully (no INVALID_DATA error in server logs)
- `Battery_System_Size_kWh` and `Storage_Size_kWh` appear as integers in the CRM record (verify via Zoho web UI on a battery-equipped lead)
- Forcing a Zoho failure (e.g. temporarily corrupt a Zoho token in `.env`) shows "Estimado no disponible" + fallback message, NOT a hang

When ready: `cd ~/Desktop/IQ_Claude/PreQual_Deal && ./promote_to_prod.sh "Zoho INVALID_DATA fix + wizard hang on Zoho error"`

## 7. Status

`windmar_dev` changes committed and pushed below. **`promote_to_prod.sh` NOT run** — left for the developer per instruction.
