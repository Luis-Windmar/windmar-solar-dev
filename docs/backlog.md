# PreQual Wizard — Backlog

Items recorded during the Tool Belt migration. Not in scope for the current
step; revisit after the active migration sequence (Steps 0–4) is closed.

---

## 1. ~~OCR review card — redundant "Leído" labels~~ — resolved by Fix F
Closed in Step 0 Fix F (2026-05-26). The grey "Leído: X" line was removed
from every field in the review-card render in `src/UploadScreen.jsx`.

---

## 2. OCR review card — audit all field propagation
Now that tarifa and demand fields are reactive (Fix E), audit every
other editable field on the review card to confirm its edited value
propagates correctly to EstimateScreen sizing logic and the Zoho
payload. Fields to audit: `consumo_promedio`, `costo_kwh`, `municipio`,
`exceso_de_demanda_kva`.

For each field: trace the rep edit through `handleFieldChange` →
`fields` state → `onNext(fields, file)` → `ocrData` → EstimateScreen
reads / ThankYouScreen Zoho payload. Confirm the edited value is the
one actually used downstream, not the original OCR value.

---

## 3. Zoho CRM field mapping audit
Several kW/kVA fields appear to be landing on incorrect CRM fields.
Investigate and correct separately after Step 0 is fully closed.

**Files:** `server.js` — `createZohoLead()` and the field map table in
`CLAUDE.md` / `docs/ZOHO_LEADS_FIELDS_MAP.md`.

---

## 4. `/api/health` endpoint
Investigate all callers in the codebase and the Vercel deployment. If
unused, remove in Step 4 cleanup along with the stale
`ANTHROPIC_API_KEY` reference it reports.

**Files:** `server.js:730–743` (health route); `server.js:765–770`
(startup banner).

---

## 5. Dependency cleanup
Remove `@anthropic-ai/sdk` from `package.json` and all dead
`ANTHROPIC_API_KEY` references from `server.js` (startup banner,
`/api/health`) in Step 4 cleanup. The require + client init in
`server.js` were already removed in Step 0; only the env-var-reporting
strings remain.

**Files:** `package.json`, `server.js`.

---

## 6. Battery slider — `$NaN` on price with storage
`calcBatterySystem()` returns NaN for total price when any storage hours
are selected, causing `$NaN` display and a broken payback calculation.
Pre-existing bug — will be resolved automatically when Step 3 replaces
`calcBatterySystem()` with the Tool Belt `/api/v1/battery-sizing`
endpoint. **Do not fix independently.**

**Files:** `src/EstimateScreen.jsx` — `calcBatterySystem()`.

---

## 7. Financing card disappears when battery slider > 0
Likely intentional from a previous session but incorrect product
behavior — combined solar + battery pricing should still offer a
financing view. Will be re-implemented in Step 3 with the correct
combined price from the Tool Belt response.

**Files:** `src/EstimateScreen.jsx` — the `totalCost >= 60000`
financing-block conditional.

---

## 8. Stale `CLAUDE.md` "Last updated" header
The `Last updated:` date at the top of `CLAUDE.md` predates several
recent edits. Update during the next session-notes pass.

**Files:** `CLAUDE.md:3`.
