# PreQual Wizard — Backlog

Items recorded during the Tool Belt migration. Not in scope for the current
step; revisit after the active migration sequence (Steps 0–4) is closed.

---

## 1. ~~OCR review card — redundant "Leído" labels~~ — resolved by Fix F
Closed in Step 0 Fix F (2026-05-26). The grey "Leído: X" line was removed
from every field in the review-card render in `src/UploadScreen.jsx`.

---

## 2. ~~OCR review card — audit all field propagation~~ — resolved 2026-05-27
Closed by browser verification. All sizing rules respond correctly to
edits across the OCR review fields (`consumo_promedio`, `costo_kwh`,
`municipio`, `exceso_de_demanda_kva`) at every tariff type. The
generic `setFields({ ...prev, [key]: value })` pattern in
`handleFieldChange` plus the targeted raw-numeric sync for
`carga_contratada_kva` and `exceso_de_demanda_kva` (added in Fix A)
were sufficient — no additional code changes needed.

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

## 9. ~~All-errors battery message — per-code copy when all positions share an error~~ — resolved 2026-05-27
Closed by the battery-error-messages pass.

`src/EstimateScreen.jsx` now derives `sharedErrorCode` when
`allBatteryErrored` fires — checks whether all 5 cached errors share
a single code. When the codes match, the all-errored banner shows the
per-code message via a new `batteryAllErroredMessage(code)` helper
(parallel to the existing `batteryErrorMessage` but with
`capacity_exceeded_kwh`-specific copy for the all-failed case). When
codes differ, the banner falls back to a neutral message:
*"Estimado de baterías no disponible en este momento."*

Per-code copy was also tightened (all "coordinador" / "consultor"
references are gone — the new copy points at actionable directions
like verifying the service type instead).

---

## 10. ~~Add static analysis to catch unresolved identifiers pre-deploy~~ — resolved 2026-05-27
Closed by wiring ESLint `no-undef` into `patch_and_build.sh` ahead of
`node build.js`. Option B from the prompt — `tsc --noEmit --allowJs
--checkJs` produced ~330 errors (Node globals, React-in-JSX-scope,
type strictness on the sizing module) that are not in the bug class
we care about. ESLint with just `no-undef` produced 0 real errors and
catches the exact class of bug we hit (missing named import resolving
to an undefined identifier).

**Config:** `eslint.config.js` (flat config — ESLint 10 requires it),
ignores the two legacy `*_api.jsx` files and the markdown-formatted
`createZohoLead.js` / `parsing_function.js` documentation files
(neither is actually imported — the real `createZohoLead` lives in
`server.js`). Plugin: `eslint-plugin-react-hooks` registered so the
existing `// eslint-disable-line react-hooks/exhaustive-deps`
directive resolves; rule itself is not enabled. `reportUnusedDisableDirectives`
disabled to keep the check focused.

**Build line added** (`patch_and_build.sh`):
```bash
npx eslint src/
if [ $? -ne 0 ]; then
  echo "❌ Static analysis failed. Fix errors before deploying."
  exit 1
fi
```

**Smoke test:** inserting `const __test = undefinedThing;` into
`EstimateScreen.jsx` causes `bash patch_and_build.sh` to exit 1 with
`'undefinedThing' is not defined  no-undef` and never invokes
`build.js`. Reverted after confirming.

**Files:** `eslint.config.js` (new), `patch_and_build.sh` (5 lines
added), `package.json` devDependencies (`eslint`, `@eslint/js`,
`globals`, `eslint-plugin-react-hooks`).

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

---

## 16. ~~Delete `src/createZohoLead.js` and `src/parsing_function.js`~~ — resolved 2026-05-28
Both files deleted. Pre-flight grep confirmed no active imports — only
non-import matches in `server.js:455` (the inline `createZohoLead` function
definition), `server.js:572` (the call site), and `src/ThankYouScreen.jsx:163`
(a comment that mentions the function name). `eslint.config.js` ignores list
trimmed to drop the two filenames; build still clean.

---

## 17. ~~Investigate `ThankYouScreen.jsx:234` eslint-disable directive~~ — resolved 2026-05-28
**Finding: case (a) — intentional mount-only effect.** The hook at the top of
`ThankYouScreen` performs an external side effect (`POST /api/zoho-lead` creates
a CRM record and uploads files; follow-up `POST /api/generate-and-attach-pdf`
generates and attaches the PDF). It must run exactly once on mount. Re-running
on prop changes would create duplicate Zoho leads, duplicate file attachments,
and duplicate PDFs.

**Closure deps the rule flagged:** `interested`, `contactData`, `ocrData`,
`estData`, `sqft`, `batteryHours`, `batteryResult`, `billFiles`, `generateLead`
— all props passed in once at mount.

**Action taken:** Replaced the inline `// eslint-disable-line` on the closing
`}, []);` line with a block-form `// eslint-disable-next-line` placed
immediately above the `useEffect(`, plus a multi-line comment listing the
omitted deps and explaining the duplicate-side-effect risk.
