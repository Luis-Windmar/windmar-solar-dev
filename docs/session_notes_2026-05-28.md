# Session Notes — 2026-05-28

## Overview

Substantial UI / feature day. Shipped two new screens — `ServiceTypeScreen` (the 4-card voltage/phase selector that now slots in as wizard step 4 of 6) and `OffGridScreen` (a side-path on WelcomeScreen for prospects who want an autonomous system and have no LUMA bill). Closed backlog items 15, 16, 17, plus an off-grid Zoho follow-up. Cleaned up the wizard cosmetics — palette unified to a single navy CTA color across all positive actions, multiple copy trims on Welcome / Upload / Estimate / Contact, and the OffGrid completion now lands on the shared "¡Todo listo!" page rather than a placeholder card.

## Files Modified

| File | What changed | Why |
|---|---|---|
| `src/sizing/tariff.js` | `resolveVoltagePhases` rewritten as `(serviceType, tariff)` — explicit picks still win; `'no_se'` now falls into a tariff-based smart default (Primaria/Transmisión → 480V 3φ, Secundaria → 208V 3φ, Residencial/unknown → 240V 2φ) | Replace the old one-size-fits-all `'no_se' → 240V 2φ` default with something that responds to what the bill says |
| `src/sizing/tariff.test.js` | 5 new tests appended (tests 8–12); existing 7 unchanged | Cover the smart-default branches and the explicit-overrides-tariff case |
| `src/WelcomeScreen.jsx` | (1) dropdown now has 3 options instead of 2 — third is "Quiero un sistema autónomo" placed second-to-last, "No, en otro momento" last; (2) intro paragraph trimmed (removed "Para ello necesitamos…"); (3) financing card removed; (4) `serviceType` state + dropdown gone — replaced by the new ServiceTypeScreen; (5) new `offgridThankyou` screen state routes to the shared ThankYouScreen with `offgrid={true}`; (6) `btnGray` renamed to `btnPrimaryDisabled` with navy + 0.4 opacity instead of grey | Add off-grid path; align with the new flow + colour pass |
| `src/UploadScreen.jsx` | (1) third bullet added to "Para mejores resultados..." — "Archivo de menos de 4MB"; (2) `btnOrange` → `btnNavy` (colour unification) | Cosmetic |
| `src/RoofScreen.jsx` | Untouched | (Was already on the navy palette; was the reference pattern for the rest) |
| `src/ServiceTypeScreen.jsx` | NEW — see "New Files Created" | — |
| `src/EstimateScreen.jsx` | (1) `resolveVoltagePhases` call site updated to pass `ocrData?.tariff` as 2nd arg; (2) `no_se` qualifier copy below the slider now dynamically reports which voltage/phase default got applied; (3) all-errors battery banner gated on `localBatteryHours > 0`; (4) slider no longer disabled in the all-errors case (so the rep can drag past 0 to see the message and back to 0 to dismiss it); (5) under-financing-card italic footnote added: "* Windmar te pondrá en contacto con una entidad financiera." (only when financing is offered); (6) `btnOrange` → `btnNavy` | Smart-default plumbing + banner-fires-at-0 fix + financing disclaimer + colour |
| `src/ContactScreen.jsx` | (1) `current` bumped from 5 to 6 (the ServiceType screen now occupies slot 4 of 6, pushing Contact to 6); (2) new required "Correo electrónico" field placed under Teléfono, lenient regex `/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/` (any TLD); (3) inline red error when the field is non-empty but malformed; (4) submit button gated on email present + valid; (5) `customerEmail` added to `contactPayload` and the alternate "Continuar de todas formas" payload | Match the new 6-step progress bar + capture customer email for Zoho |
| `src/ThankYouScreen.jsx` | (1) leadData now maps `contactData.customerEmail → leadData.email` (which server-side `createZohoLead` already wires to Zoho's `Email` field); (2) new `offgrid` prop — when true, the mount-effect skips the Zoho POST (already done in OffGridScreen) and the "⬇ Descargar estimado" button + pdfError/pdfStatus block is hidden; (3) deleted the redundant `btnOrange` + `btnOrangeDisabled` styles and pointed all uses at the existing `btnNavy` + a new `btnNavyDisabled`; (4) inline eslint-disable replaced with documented block-form on the mount effect | Customer email plumbing + off-grid landing page + colour |
| `src/OffGridScreen.jsx` | NEW — see "New Files Created" | — |
| `server.js` | `parseLeadNotes` gained a `tipo: extract(/Tipo:\s*([^|]+)/)` entry; `createZohoLead`'s `condensedNotes` array gained `p.tipo ? \`Tipo: ${p.tipo.trim()}\` : null` — flows the off-grid `Tipo: Sistema Autónomo (off-grid)` marker through to Zoho `Lead_Notes` while normal solar leads (no `Tipo:` in their notes) are unaffected | Make off-grid leads identifiable in CRM |
| `eslint.config.js` | Removed `src/createZohoLead.js` and `src/parsing_function.js` from the ignores list (the files themselves were deleted) | Trim ignore list after dead-file cleanup |
| `docs/backlog.md` | Items 16 + 17 marked resolved with explanation notes | Backlog hygiene |
| `public/prequal.bundle.js`, `public/prequal.html` | Rebuilt on every commit | — |

## New Files Created

| File | Purpose |
|---|---|
| `src/ServiceTypeScreen.jsx` | Wizard step 4 of 6. 4-card 2×2 grid: 480V/3φ, 208V/3φ, 240V/2φ, "No estoy seguro". No text input, navy "Continuar" CTA disabled until a card is tapped, ghost "Atrás" button. `onNext(serviceType)` mirror of RoofScreen's `onNext(sqft)` signature. |
| `src/OffGridScreen.jsx` | Side path off WelcomeScreen for prospects wanting an autonomous (off-grid) system. Required: `nombre`, `telefono` (10 digits → formatted XXX-XXX-XXXX). Optional: `businessName` ("Nombre del negocio" — first field, mirrors the OCR review card's first row), `direccion`, `municipio`, `consultorNombre`, `consultorEmail`. POSTs `leadData` directly to `/api/zoho-lead` (no bill attachment, no PDF, no battery sizing). On submit, lands on the shared `<ThankYouScreen interested offgrid />` with the Zoho download button hidden. |
| `public/208V_outlet_icon.png`, `public/240V_outlet_icon.png`, `public/480V_outlet_icon.png`, `public/no_lo_se_icon.png` | Icons for ServiceTypeScreen's 4 cards. Live in `./public/` directly (not in `./public/icons/` despite what some prompts said) per the rep's standing instruction. Initially missing from git (untracked), causing broken-image placeholders on the first deploy; committed in `2af071b`. |
| `docs/session_notes_2026-05-28.md` | This file |
| `wrap-ups/service-type-screen.md`, `wrap-ups/service-type-screen-followups.md`, `wrap-ups/cleanup-items-16-17.md`, `wrap-ups/offgrid-screen.md`, `wrap-ups/offgrid-tipo-fix.md` | Per-prompt wrap-up docs |

## External Repos Changed

None. Zero changes to the Windmar Commercial Tool Belt repo this session.

## Architectural Notes

### Wizard now has 6 steps (was 5)

Order of progression: **Welcome (1/6) → Upload (2/6) → Roof (3/6) → ServiceType (4/6) → Estimate (5/6) → Contact (6/6)**. ThankYouScreen has no progress bar (terminal).

The screen-state machine in `WelcomeScreen.jsx` holds the routing graph. `screen` enum values now include `serviceType`, `offgrid`, and `offgridThankyou` in addition to the original `welcome | exit | upload | roof | estimate | contact | thankyou-yes | thankyou-no`.

### Off-grid is a side path, not a wizard step

The off-grid flow forks off WelcomeScreen at the dropdown selection level — the `'offgrid'` option opens `OffGridScreen` directly, bypassing the normal Upload/Roof/ServiceType/Estimate/Contact pipeline. It has no progress bar (intentional — it's a side path, not a step within the 6-step sequence). Submission goes directly to `POST /api/zoho-lead`, which creates a `Commercial_Lead` record carrying:

- `customerName`, `businessName`, `phone`, `direccion`, `city`, `salesRepEmail`, `email` (when populated) → Zoho `Primary_Contact`, `Account_Name`, `Phone_2`, `Address`, `City`, etc.
- Notes payload includes a sentinel `Tipo: Sistema Autónomo (off-grid)` segment that now flows into Zoho `Lead_Notes` (see next section)

After submit, `OffGridScreen.handleSubmit` calls `props.onDone()`, which routes to `<ThankYouScreen interested={true} offgrid={true} />`. The `offgrid` prop:

1. Short-circuits the ThankYouScreen mount-effect's `run()` (the Zoho lead was already created in OffGridScreen — don't create a second one)
2. Hides the "⬇ Descargar estimado" button + its surrounding pdfError/pdfStatus block (no PDF was generated)

The "Completar cuestionario completo" SmartSheet CTA and "Nueva consulta" ghost button remain visible — both are useful next steps for off-grid leads too.

### `resolveVoltagePhases` is now tariff-aware

Signature change: `resolveVoltagePhases(serviceType, tariff)` instead of `resolveVoltagePhases(serviceType)`. Used in two places: `EstimateScreen`'s battery-batch precomputation, and the same screen's `no_se` qualifier-message helper.

Behaviour:

| `serviceType` | `tariff` (normalized) | Resolved voltage / phases |
|---|---|---|
| `bifasico_240` | any | 240V / 2-phase |
| `trifasico_208` | any | 208V / 3-phase |
| `trifasico_480` | any | 480V / 3-phase |
| `no_se` (or null / unknown) | `primaria` or `transmision` | 480V / 3-phase |
| `no_se` | `secundaria` | 208V / 3-phase |
| `no_se` | `residencial` or null | 240V / 2-phase |

All 7 original single-arg tests still pass (omitted second arg becomes `undefined`, which `normalizeLumaTariff` returns `null` for, which the function maps to the residencial/unknown default). 5 new tests cover the smart-default branches and the explicit-override-wins case. **Total: 40/40 tests pass.**

### Battery all-errors banner now gated on `localBatteryHours > 0`

Previously the all-errors banner fired whenever the battery cache was fully errored, even at slider 0 where the rep hadn't requested storage. That gave a misleading alarm. Now mirrors the per-position error pattern (`batteryError && localBatteryHours > 0`). The slider's `disabled` was simultaneously relaxed from `(batteryCacheLoading || allBatteryErrored)` to just `batteryCacheLoading` so the rep can drag past 0 to discover the message and back to 0 to dismiss it.

### Positive-action buttons unified to navy

Every primary CTA across the wizard now uses **navy `#1B3F8B`** for active and **navy at `opacity: 0.4` with `cursor: not-allowed`** for disabled. The orange `#F5A623` background and grey `#6b7280` / `#9ca3af` disabled colours that were sprinkled across UploadScreen, EstimateScreen, OffGridScreen, ThankYouScreen, and WelcomeScreen are gone for CTAs. Negative-action buttons (`No por ahora`) and ghost/secondary buttons (`Atrás`, `Nueva consulta`) are intentionally NOT navy — they retain their grey or ghost styling.

Orange is still in the design system for **progress-bar fills** (`shared.jsx` and the OCR processing bar in UploadScreen) and **highlight numbers** on EstimateScreen's main estimate card — those are non-button accent elements.

### Off-grid lead identification in Zoho

`server.js` `parseLeadNotes` + `createZohoLead`'s `condensedNotes` filter now passes a `Tipo:` segment through. The off-grid notes string includes `Tipo: Sistema Autónomo (off-grid)`, so Zoho `Lead_Notes` for an off-grid lead reads like `Consultor en Estimado: Juan Pérez | Tipo: Sistema Autónomo (off-grid)`. Normal solar notes don't include `Tipo:`, so `p.tipo` is `null` and the new array entry filters out — zero impact on existing leads.

This was the cheapest path to Zoho-side off-grid identification given the prompt forbade further server changes. A cleaner long-term option would be to use a distinct `Lead_Source` value (`PreQual - Off-Grid` vs `PreQual`), but that's a future refactor.

### Vercel webhook diagnosis

Earlier in the session I incorrectly concluded GitHub auto-deploy wasn't wired up at all — `npx vercel project inspect` doesn't surface the Git connection. The user's screenshot of the **Deployments** tab showed prior commits being auto-built, confirming the connection IS live. What happened was a transient webhook miss on commit `5111331` — the next push of `bb6fe12` (empty commit) triggered a build and shipped the queued work. All subsequent pushes have fired cleanly. No code/config change needed unless it recurs. **`CLAUDE.md` already states "Deploys are triggered automatically by pushing to GitHub main" — that's still accurate.**

## Known Issues / Follow-ups

| # | Area | Description | Severity |
|---|---|---|---|
| 1 | Backlog #3 | Zoho CRM field mapping audit — several kW/kVA fields suspected to land on incorrect CRM fields. Still open. | medium |
| 2 | Backlog #14 | Financing eligibility — extend from single $60k threshold to multi-factor rule (system type, tariff, customer profile). Still open. | low |
| 3 | Off-grid Lead_Source | Off-grid leads currently use `Lead_Source: 'PreQual'`, same as normal solar. Consider splitting to `'PreQual - Off-Grid'` for cleaner Zoho reporting. Currently identified only via the `Tipo:` segment in `Lead_Notes`. | low |
| 4 | Demo toggle still on Welcome | The "Generar lead SI/NO" pill at the bottom of WelcomeScreen is still present — should be removed before production. Tagged with `TODO: remove before production` comment. | low |
| 5 | ContactScreen test data | `nombre` and `consultorNombre` still default to `"TEST - "`. Tagged with `TODO: remove before production` comments. | low |

## Deployment Status

All 15 commits pushed to `Windmar-Home/windmar-commercial-estimator-dev` `main` and auto-deployed to https://windmar-commercial-estimator.vercel.app via Vercel's GitHub integration. User verified the live deploy on multiple iterations:

- ServiceType screen rendering (initial broken-images caught, icons committed, redeploy verified)
- "No estoy seguro" pitch unified
- All-errors battery banner gated correctly
- Off-grid flow end-to-end (submit → ThankYouScreen with download button hidden)
- Welcome dropdown reorder
- Cosmetic pass + button colour unification
- Email field validation
- Continuar arrow trim on ServiceType and ThankYouScreen

Today's commit list (most recent first):

```
d39695d  ui(thankyou): drop the "→" arrow from the SmartSheet CTA
2bd61d4  ui(service-type): drop the "→" arrow from Continuar CTA
352ca74  feat(offgrid): add Nombre del negocio field, feed it into Zoho Account_Name
7891be6  ui: unify all positive-action buttons to navy; disabled state uses navy + 0.4 opacity
2862bc0  fix(offgrid): relax name validation, rename Enviar → Continuar, land on shared ThankYouScreen
c3d3a80  ui: cosmetic pass — welcome trim, upload tip, financing disclaimer, customer email field
65870e8  fix(zoho): pass Tipo: segment through to Lead_Notes (off-grid leads)
bffc659  ui(welcome): move "No, en otro momento" to last position in the dropdown
b41d7a9  feat(welcome): off-grid lead capture path
d80f05c  chore: backlog items 16 + 17 — remove dead snippet files, document Zoho-lead useEffect intent
a1f9156  docs: wrap-up — service-type screen follow-ups
c70bd46  fix(estimate): suppress all-errors battery banner when slider is at 0
2af071b  fix(service-type): commit missing icon PNGs and unify "No estoy seguro" pitch
bb6fe12  chore: trigger Vercel build for 5111331 (service-type screen)
5111331  feat(wizard): service-type selector screen + tariff-based smart defaults
```
