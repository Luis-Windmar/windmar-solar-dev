# Backlog Items 16 & 17 — Cleanup + Hooks Investigation

**Date:** 2026-05-28
**Source prompt:** `prompts/prompt-cleanup-items-16-17.md`
**Outcome:** Two dead snippet files removed from `src/`; ESLint ignores list trimmed accordingly. The `react-hooks/exhaustive-deps` suppression in `ThankYouScreen` confirmed as case (a) — intentional mount-only effect — with the inline disable replaced by a more explicit block-form comment that names the deps and explains why. Backlog items 16 and 17 closed.

---

## 1. Item 16 — Pre-flight grep result

```
$ grep -rn "createZohoLead\|parsing_function" src/ server.js build.js patch_and_build.sh \
    --include="*.js" --include="*.jsx" --include="*.sh"
src/ThankYouScreen.jsx:163:          // (createZohoLead doesn't read it). Populated here so future Zoho
server.js:455:const createZohoLead = async (leadData, token) => {
server.js:572:    const zohoLeadId = await createZohoLead(leadData, writeToken);
```

All three matches refer to the inline `createZohoLead` function defined in `server.js:455` (the active production implementation) or a comment that mentions its name. No `import` or `require` of either `src/createZohoLead.js` or `src/parsing_function.js`. Safe to delete.

## 2. Item 16 — Deletion

```
$ rm src/createZohoLead.js src/parsing_function.js
$ ls src/ | grep -E "createZohoLead|parsing_function"
(empty)
```

`eslint.config.js` `ignores` array trimmed:

```diff
     ignores: [
       "src/PreQual_Solar_api.jsx",
       "src/DealSection_api.jsx",
-      "src/createZohoLead.js",
-      "src/parsing_function.js",
       "public/**",
       "node_modules/**",
     ],
```

## 3. Item 17 — useEffect investigation

`src/ThankYouScreen.jsx` lines 106–234. The effect runs on mount, conditional on `interested && contactData`, and performs:

1. `POST /api/zoho-lead` — creates a Zoho `Commercial_Lead` record and uploads the LUMA bill files (renamed with a `"PreQual - "` prefix).
2. `POST /api/generate-and-attach-pdf` — generates the estimate PDF server-side and attaches it to the just-created Zoho record (or, when `generateLead=false`, just generates the PDF for download without the Zoho attach).

**Closure values read inside the effect:**

| Prop | Where read |
|---|---|
| `interested` | line 107 (guard) |
| `contactData` | guard + `contactData.nombre / .phone / .consultorNombre / .consultorEmail` |
| `ocrData` | tariff, consumoKWH, costoPorKWH, nombreNegocio, municipio, direccion, carga_contratada_kva — many sites |
| `estData` | systemKwp, coverage, systemCost |
| `sqft` | notes string + `leadData.roofSqft` |
| `batteryHours` | `leadData.batteryHours` |
| `batteryResult` | bom.inverter.model/quantity, system_kwh, total_price, actual_backup_hours, bom.system_kwac |
| `billFiles` | iterated into FormData |
| `generateLead` | branch selector |

(Setters `setPdfStatus`, `setPdfReady`, `setPdfError` are stable React setters; refs `blobRef.current` / `leadNameRef.current` are mutable and don't belong in deps.)

**Determination: case (a) — intentional mount-only effect.**

The effect creates an external CRM record. Re-firing on prop changes would create duplicate Zoho leads, duplicate file attachments, and duplicate PDFs. Empty dep array is correct; the prior author's `// eslint-disable-line` was justified — just under-documented.

## 4. Item 17 — Action taken

Replaced the trailing inline disable directive with a block-form comment immediately above the `useEffect` that names the omitted deps and explains the side-effect risk:

```diff
-  // On mount: create Zoho lead (with bill) → get Com_Lead_Name → generate PDF → attach PDF
+  // On mount: create Zoho lead (with bill) → get Com_Lead_Name → generate PDF → attach PDF.
+  // Intentionally omitted from deps: `interested`, `contactData`, `ocrData`, `estData`,
+  // `sqft`, `batteryHours`, `batteryResult`, `billFiles`, `generateLead`. This effect
+  // performs an external side effect (POST to /api/zoho-lead — creates a CRM record
+  // and uploads files) that must run exactly once on mount. Re-running on prop
+  // changes would create duplicate Zoho leads and duplicate attachments.
+  // eslint-disable-next-line react-hooks/exhaustive-deps
   useEffect(() => {
     ...
     run();
-  }, []); // eslint-disable-line react-hooks/exhaustive-deps
+  }, []);
```

Effect body and dep array are otherwise unchanged. No logic touched.

## 5. Verification

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

```
$ node --test src/sizing/*.test.js
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1068.513625
```

Both clean.

## 6. Files touched

| File | Change |
|---|---|
| `src/createZohoLead.js` | **Deleted** |
| `src/parsing_function.js` | **Deleted** |
| `eslint.config.js` | 2 entries removed from `ignores` array |
| `src/ThankYouScreen.jsx` | Inline disable replaced with documented block-form disable + explanatory comment |
| `docs/backlog.md` | Items 16 and 17 marked resolved |
| `public/prequal.bundle.js`, `public/prequal.html` | Rebuilt |

## 7. Backlog status

| # | Title | Status |
|---|---|---|
| 1, 2, 4–13 | (various) | ✅ Closed |
| 3 | Zoho CRM field mapping audit | 🟡 Open |
| 14 | Financing eligibility — multi-factor rule | 🟡 Open |
| 15 | Service-type selector screen | ✅ Closed (2026-05-28) |
| **16** | **Delete dead snippet files** | ✅ **Closed (2026-05-28)** |
| **17** | **Investigate exhaustive-deps suppression** | ✅ **Closed (2026-05-28)** |

Open items: **#3, #14.**

## 8. Status

Committing + pushing per the standing memory.
