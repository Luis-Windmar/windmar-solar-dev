# PreQual Wizard — Backlog

Items recorded during the Tool Belt migration. Not in scope for the current
step; revisit after the active migration sequence (Steps 0–4) is closed.

---

## 1. OCR review card — redundant "Leído" labels
Remove the grey `Leído: X` text from each field on the review card. The
editable input already shows the extracted value; the grey label is
duplicative.

**Files:** `src/UploadScreen.jsx` — review-card render block.

---

## 2. OCR review card — Exceso de demanda missing for Secundaria
Add the **Exceso de demanda** field to the review card for *all* tariff
types, not just demand tariffs. The rep may need to correct a Secundaria
classification to Primaria with excess demand, and the field must be
present to allow that correction.

**Files:** `src/UploadScreen.jsx` — `FIELDS` array (add `excesoKVA`
entry); ensure `handleFieldChange` re-syncs the raw
`exceso_de_demanda_kva` field on edit.

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
