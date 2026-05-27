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

## 4. ~~`/api/health` endpoint~~ — resolved 2026-05-27
Closed by the audit pass. Exhaustive grep across `src/`, `public/`,
`docs/`, `prompts/`, `wrap-ups/`, `package.json`, `patch_and_build.sh`,
`build.js`, `vercel.json`, and `.vercel/project.json` found no live
caller. Only matches outside the route definition itself were
documentation references in `docs/*.md` and `wrap-ups/*.md`, a
historical snippet in `docs/deal_server_reference.js` (not executed),
a stale Claude worktree copy in `.claude/worktrees/`, and a permission
allowlist entry in `.claude/settings.local.json` (a "let me run this
curl if I want" grant, not a runtime caller). No external monitoring
configured via Vercel.

**Resolution:** route removed from `server.js`. The stale
`apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY` field went with
it. The remaining `ANTHROPIC_API_KEY` reference at the startup banner
is still present — that's the scope of item 5 below, not this item.

---

## 5. ~~Dependency cleanup~~ — resolved 2026-05-27
Closed by the cleanup pass.
- `@anthropic-ai/sdk` removed from `package.json` via
  `npm uninstall @anthropic-ai/sdk` (package-lock updated, node_modules
  pruned by ~5 MB).
- `ANTHROPIC_API_KEY` reference removed from the startup banner in
  `server.js`. The corresponding reference inside `/api/health` was
  removed in item 4 along with the route.
- Banner additionally gained a `Zoho RCID` check (read-credentials),
  which was missing — both ZOHO_WRITE_* and ZOHO_READ_* sets are
  actively used by `createZohoLead` / file attachment, so both deserve
  visibility on startup.
- The two remaining grep matches for `anthropic` in `src/` are inside
  legacy files (`PreQual_Solar_api.jsx`, `DealSection_api.jsx`) that
  are not imported by any active code path. They stay as dead reference
  per the migration plan.

---

## 6. ~~Battery slider — `$NaN` on price with storage~~ — resolved by Step 3
Closed 2026-05-26. `calcBatterySystem()` was removed entirely in Step 3
(commit `5025c37`) and replaced with batch-precomputed Tool Belt
`/api/v1/battery-sizing` responses. Successful positions return valid
`total_price`; errored positions surface a per-code message and show
"—" for the price (Step 3 follow-up commit `c3f7fe0`). The `$NaN`
class of bug no longer reachable.

---

## 7. ~~Financing card disappears when battery slider > 0~~ — resolved by Step 3
Closed 2026-05-26. Browser verification confirmed the financing card
now persists across all slider positions when battery pricing is
available. The Step 3 follow-up additionally hides financing only on
errored slider positions (where the price reads "—") so it never
renders against a misleading solar-only total.

---

## 8. ~~Stale `CLAUDE.md` "Last updated" header~~ — resolved 2026-05-27
Closed by the cleanup pass. Targeted edits to `CLAUDE.md`:
- "Last updated" header bumped from 2026-05-05 → 2026-05-27.
- "Tool Belt API Integration" section rewritten as a full Steps 0–3
  status table with all four current wizard-server proxies
  (`/api/ocr-luma-bill`, `/api/solar-resource`, `/api/area-to-system`,
  `/api/price`, `/api/battery-sizing`) mapped to their Tool Belt
  upstream endpoints. Added a "Step 4 Cleanup — IN PROGRESS" section
  citing the most recent backlog closures.
- Tool Belt Architecture table rewritten with current proxy names,
  invocation timing, and fallback behavior per proxy.
- `Important Notes` line about "the existing /api/ocr endpoint"
  corrected — OCR runs through `/api/ocr-luma-bill` now; the original
  was removed in Step 0.
- Historical migration-brief content (the duplicated brief from
  May 4–8 2026) left as-is per the "targeted updates only" rule.
  Two `/api/ocr` references inside that brief stay because they're
  clearly dated historical context, not current documentation.

---

## 9. All-errors battery message — per-code copy when all positions share an error
When all 5 battery slider positions return the **same** error code
(e.g. `capacity_exceeded_kw` on large Primaria accounts where
`serviceType` defaults to `no_se` → 240V/2-phase → Powerwall catalog
won't fit), the wizard currently shows the generic global fallback:
*"Estimado de baterías no disponible. Contacte a su coordinador."*

Problems:
- "Coordinador" doesn't exist in the Windmar organization.
- The message is generic — it doesn't tell the rep **why** sizing
  failed or what to do next.

**Desired:** When all 5 positions fail with the same error code, show
the per-code message instead of the generic fallback. Example for
`capacity_exceeded_kw`: *"No hay opciones de almacenamiento disponibles
para este tamaño de sistema. Selecciona el tipo de servicio eléctrico
para ver más opciones."*

When positions have **mixed** error codes, show the generic message
— but replace "coordinador" with something accurate (product to pick).

**Practical trigger:** Large Primaria accounts (~235+ kWp) where
`serviceType` is `no_se`. Mostly resolved once the service-type
selector is wired more visibly and reps pick `trifasico_480` for
large commercial accounts — but the messaging should still be honest
in the fallback case.

**Files:** `src/EstimateScreen.jsx` — the `allBatteryErrored` block
and `batteryErrorMessage` mapping.

---

## 10. Add static analysis to catch unresolved identifiers pre-deploy
**Background:** Step 3's `normalizeLumaTariff` `ReferenceError` (a
missing named import in `src/EstimateScreen.jsx`) passed all unit
tests and `node build.js` cleanly but exploded at browser runtime.
esbuild does not check for unresolved identifiers, and `node:test`
never imports the JSX component files — so the bug couldn't have
been caught by either of our existing pre-deploy steps.

**Desired:** lightweight static analysis on the build path. Options
in increasing order of effort:

1. **esbuild metafile** check that flags any import resolving to an
   unbundled symbol. Cheapest — adds maybe 30 lines to `build.js`.
2. **ESLint** with the `no-undef` rule scoped to `src/`. No TypeScript
   needed; one `.eslintrc` + a `lint` step in the build script.
3. **`tsc --noEmit --allowJs --checkJs`**. Catches the most but
   adds TypeScript-as-a-tool to the toolchain.

Any of the three would have caught the Step 3 bug. Recommend wiring
into `patch_and_build.sh` so the existing "node build.js" step also
fails on unresolved identifiers, or as a pre-push git hook.

**Files:** `patch_and_build.sh`, possibly new `.eslintrc` or
`tsconfig.json`.

---

## 11. ~~EstimateScreen — slider card height jumps as messages appear / disappear~~ — resolved 2026-05-27
Closed by the layout-stability pass. The slider card now has a fixed
`minHeight: 180` and the below-slider message area is wrapped in a
reserved-space container (`S.messageArea`, `minHeight: 60`) with a
single-slot priority cascade. Moving the slider between positions
with different status messages (loading → cap_applied → per-position
error → no_se warning) no longer shifts layout.

**Resolved in:** `src/EstimateScreen.jsx`.

---

## 12. ~~Financing card appears / disappears based on `totalCost >= 60000`~~ — resolved 2026-05-27
Closed by the layout-stability pass. The financing card is now always
rendered. When `totalCost >= FINANCING_THRESHOLD` it shows the
breakdown (Pronto pago / Pago mensual / Ahorro mensual neto). When
the total falls below threshold, an ineligibility paragraph renders
in the same card with a `minHeight: 130` reservation so the card
height stays roughly constant either way. The `batteryError`-gating
on the financing card was also removed — financing is independent of
battery state per Rule 6 of the layout-stability prompt.

`FINANCING_THRESHOLD = 60000` is now a module-level constant in
`src/EstimateScreen.jsx`, ready for the multi-factor eligibility
work in item 14.

---

## 13. ~~Stale slider subtitle copy "Decide cuánto quieres ahorrarte en tu factura de LUMA"~~ — resolved 2026-05-27
Closed by the layout-stability pass. Subtitle replaced with the
accurate copy: *"Selecciona las horas de respaldo deseadas"* — the
slider controls battery hours, not savings.

**Resolved in:** `src/EstimateScreen.jsx`.

---

## 14. Financing eligibility — extend from single threshold to multi-factor rule
**Current:** `FINANCING_THRESHOLD = 60000` is a single dollar threshold.
Systems at or above $60k get the financing breakdown; below show an
ineligibility message.

**Future:** financing eligibility may depend on additional factors —
system type (solar-only vs solar+battery), tariff class (e.g. only
Primaria / Transmisión qualify), customer profile (commercial vs
residential), credit screen, etc. The Wizard would benefit from
treating eligibility as a function rather than a single comparison.

Implementation sketch when needed:
```js
const isFinancingEligible = ({ totalCost, tariff, customerType, ... }) => {
  if (totalCost < FINANCING_THRESHOLD) return false;
  // … additional rules …
  return true;
};
```

Keep the constant and the eligibility check colocated and easy to
extend. The threshold itself may eventually move to
`config/pricing.json` alongside `dcAcRatio` / `demandMultiplier`.

**Files:** `src/EstimateScreen.jsx` (FINANCING_THRESHOLD + the
financing-card ternary).
