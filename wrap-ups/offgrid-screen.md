# Off-Grid Lead Capture — New Feature

**Date:** 2026-05-28
**Source prompt:** `prompts/prompt-offgrid-screen.md`
**Outcome:** WelcomeScreen now offers a third option, "Quiero un sistema autónomo", that routes to a new standalone `OffGridScreen`. The screen collects name + phone (required) + optional address/municipio/consultor details and submits a Zoho `Commercial_Lead` directly via `POST /api/zoho-lead` (no bill upload, no PDF). On completion the user lands on an inline 🌿 thank-you card inside WelcomeScreen.

---

## 1. Pre-flight note

- **WelcomeScreen current option structure:** the bill-availability `<select>` (lines ~365–373) holds two `<option>`s today — `si` (→ `upload`) and `no` (→ `exit`). The orange CTA's label flips between "Continuar" and "Entendido" based on which is selected. `handleContinue` is the single routing function.
- **ContactScreen submit flow:** the existing `ContactScreen` POSTs to `/api/leads` (a *local* lead persistence layer that returns `{ leadId, quoteNumber }`), NOT `/api/zoho-lead`. The Zoho lead is created later, in `ThankYouScreen`'s mount-only effect, via `POST /api/zoho-lead`. So OffGrid bypasses both `/api/leads` and `ThankYouScreen` entirely and POSTs the Zoho lead inline; no PDF generation, no bill attachments.

---

## 2. Files created and modified

### Created
- `src/OffGridScreen.jsx` — standalone screen with 2 required fields (nombre, telefono), 4 optional fields (direccion, municipio, consultorNombre, consultorEmail). Validates per `isValidName` (≥2 words, each ≥2 chars) and `isValidPhone` (10 digits). Posts directly to `/api/zoho-lead`. No progress bar — this is a side path, not a wizard step.

### Modified
- `src/WelcomeScreen.jsx`:
  - `import OffGridScreen from "./OffGridScreen.jsx"`
  - `screen`-state comment extended with `offgrid` and `offgridThankyou` enum values
  - dropdown gained a third `<option value="offgrid">Quiero un sistema autónomo</option>` and the existing `si` option's label updated to `Sí, tengo mi factura de LUMA`
  - `handleContinue` now switches three ways (`si` → upload, `offgrid` → offgrid, else → exit)
  - new `screen === "offgrid"` branch renders `<OffGridScreen onBack onDone />`
  - new `screen === "offgridThankyou"` branch renders an inline 🌿 thank-you card with a "Volver al inicio" button that calls `handleRestart`

No changes to the normal wizard flow (upload → roof → serviceType → estimate → contact → thankyou-yes). All progress bars unchanged.

---

## 3. Sample submission payload

Test values: `nombre="María González"`, `telefono="787-555-1234"`, `direccion="Carr. 2 km 55, Bo. Centro"`, `municipio="Ponce"`, `consultorNombre="Juan Pérez"`, `consultorEmail="juan.perez@windmar.com"`.

After `formatPhone` and trimming, the `FormData.leadData` JSON sent to `POST /api/zoho-lead`:

```json
{
  "customerName": "María González",
  "phone": "787-555-1234",
  "direccion": "Carr. 2 km 55, Bo. Centro",
  "city": "Ponce",
  "salesRepEmail": "juan.perez@windmar.com",
  "notes": "Cobertura Estimada: off-grid | Costo de energía promedio estimado: off-grid | Consultor en Estimado: Juan Pérez | Rep-email: juan.perez@windmar.com | Tipo: Sistema Autónomo (off-grid)",
  "avgConsumption": null,
  "demandaKVA": null,
  "systemSizeKw": null,
  "roofSizeEstimate": null
}
```

No `billFile` part on the `FormData`.

### Notes string produced

```
Cobertura Estimada: off-grid | Costo de energía promedio estimado: off-grid | Consultor en Estimado: Juan Pérez | Rep-email: juan.perez@windmar.com | Tipo: Sistema Autónomo (off-grid)
```

### What lands in Zoho

`createZohoLead` in `server.js` populates fields from the parsed payload. For an off-grid lead:

| Zoho field | Value | Source |
|---|---|---|
| `Primary_Contact` | `María González` | `leadData.customerName` |
| `Phone_2` | `787-555-1234` | `leadData.phone` (after `cleanPhone`) |
| `Address` | `Carr. 2 km 55, Bo. Centro` | `leadData.direccion` |
| `City` | `Ponce` | `leadData.city` |
| `Lead_Notes` | `Consultor en Estimado: Juan Pérez \| Estimado Rep-email: …` (see caveat below) | filtered from `notes` via `parseLeadNotes` + `createZohoLead`'s condensedNotes |
| `Lead_Status` | `New Lead` | hardcoded |
| `Lead_Source` | `PreQual` | hardcoded |
| `Owner` | `process.env.ZOHO_OWNER_USER_ID` | env |

All solar/battery/roof fields (`PV_System_Size_kW1`, `Consumo_Promedio`, `Tama_o_Estimado`, etc.) end up `null`, which is correct for off-grid — there's no system sizing or roof estimate to record.

**Caveat — "off-grid" tag does NOT survive into Zoho `Lead_Notes`:**

`createZohoLead` builds Zoho's `Lead_Notes` field from `parseLeadNotes`'s extracted matches and a hardcoded filter:

```js
const condensedNotes = [
  p.cobertura      ? `Cobertura Estimada: ${p.cobertura}%`           : null,
  p.costo          ? `Costo de energia promedio estimado: ${p.costo}` : null,
  p.consultor      ? `Consultor en Estimado: ${p.consultor}`          : null,
  p.consultorEmail ? `Estimado Rep-email: ${p.consultorEmail}`        : null,
].filter(Boolean).join(' | ') || null;
```

- `Cobertura Estimada: off-grid` — `parseLeadNotes` regex is `/Cobertura:\s*([\d.]+)%/`, so `p.cobertura` is `null`.
- `Costo de energía promedio estimado: off-grid` — regex is `/Costo\/kWh:\s*([\d.]+)/`, so `p.costo` is `null`.
- `Consultor en Estimado: Juan Pérez` — matches → `p.consultor = "Juan Pérez"`. ✅
- `Rep-email: …` — regex is `/Estimado Rep-email:\s*([^|]+)/`, so `p.consultorEmail` is `null` (our notes use `Rep-email:` without the `Estimado ` prefix).
- `Tipo: Sistema Autónomo (off-grid)` — no matching regex anywhere.

So the Zoho `Lead_Notes` field ends up containing only `Consultor en Estimado: Juan Pérez` (or `null` if no consultor was entered). The "off-grid" / "Sistema Autónomo" markers ARE in the raw `leadData.notes` payload sent to the server (visible in server logs) but get filtered out before reaching the CRM record.

The prompt's `## Verification` §2 expected `Lead_Notes` to contain `"off-grid"` and `"Sistema Autónomo"`. To actually achieve that, `server.js` `createZohoLead`'s condensedNotes filter would need to be relaxed — e.g. pass through any line that doesn't already extract into a typed Zoho field. The prompt's `## What NOT to Change` forbids `server.js` edits, so I left it as-is and flagged here. **Follow-up:** decide whether off-grid leads need a distinct `Lead_Source` (e.g. `"PreQual - Off-Grid"`) or whether `Lead_Notes` should include the off-grid tag.

---

## 4. Normal wizard flow unaffected

- `selection === "si"` still routes to `upload` (unchanged condition path).
- `handleRestart` clears all state and resets `screen` to `"welcome"` — unchanged.
- No screen-state transitions inside the normal flow touch the new `offgrid`/`offgridThankyou` screens.
- All `ProgressBar current/total` values unchanged across the six wizard screens (Welcome 1/6 → Upload 2/6 → Roof 3/6 → ServiceType 4/6 → Estimate 5/6 → Contact 6/6).

---

## 5. `patch_and_build.sh` pass

```
$ bash patch_and_build.sh
→ Running static analysis...
✅ Static analysis passed.
Building PreQual...
✅ Build complete.
   Bundle  → public/prequal.bundle.js
   HTML    → public/prequal.html
Build complete. public/ is ready.

To deploy to Vercel: vercel --prod
```

ESLint `no-undef` clean. esbuild bundle generated without warnings.

---

## 6. Unit test results

```
$ node --test src/sizing/*.test.js
ℹ tests 40
ℹ pass 40
ℹ fail 0
…
```

40/40. No test surface touched.

---

## 7. Status

Committing + pushing per the standing memory.
