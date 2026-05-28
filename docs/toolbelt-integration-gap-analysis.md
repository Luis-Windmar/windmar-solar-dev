# Estimator → Tool Belt Integration: Gap Analysis

**Status:** Read-only audit — no code or commits produced.
**Repos referenced:** `windmar-commercial-estimator` (this repo) and `windmar-commercial-toolbelt` (the Tool Belt, not read directly — only its public API as documented in `docs/toolbelt_migration_brief.md` and `CLAUDE.md`).

---

## Document health note

Two of the source docs the prompt asked me to ground in (`CLAUDE.md` and `docs/toolbelt_migration_brief.md`) are **partially stale**. The migration brief describes the "before" state (e.g. `GET /api/pricing` reads `config/pricing.json`, `getYield()` is hardcoded) and was never rewritten after the live integration shipped. The live code path is the opposite — Tool Belt is already the source of truth for EPC tiers, solar yield, and area-to-system, with the local values acting as fallbacks only. Where this report disagrees with those docs, the code is authoritative and the docs need updating.

---

## Section 1 — Current Data Sources Inventory

Legend for the "Status" column:
- ✅ already on Tool Belt and consumed live
- ⚠️ Tool Belt is the primary, but a hardcoded fallback still lives in the codebase
- ❌ purely hardcoded / locally calculated, no Tool Belt source today
- 🪦 dead code (still in the repo, no longer read at runtime)

### 1.1 Pricing-related

| Item | File · Line | Sourcing today | Tool Belt endpoint? | Status |
|---|---|---|---|---|
| EPC tier table (live) | `server.js:193–207` (`GET /api/pricing` proxy) | Calls Tool Belt `GET /api/v1/epc-tiers` and re-emits as `{ solar: { epc_tiers: [...] } }` | `GET /api/v1/epc-tiers` (or `POST /api/v1/price` per-job) | ✅ |
| EPC tier table (server fallback) | `server.js:212–224` | 11-row hardcoded array used only if the Tool Belt fetch fails | n/a (it's a fallback) | ⚠️ |
| EPC tier table (client fallback) | `src/EstimateScreen.jsx:26–42` (`CFG_DEFAULTS.epc_table`) | Used by `getEPC()` if `pricing.solar.epc_tiers` is missing from the prop | n/a | ⚠️ |
| `getEPC(kwp)` tier lookup | `src/EstimateScreen.jsx:44–54` | Local `find()` over the tier array; supports both Tool Belt shape (`kw_from`/`kw_to`/`effective_price_per_w`) and the legacy hardcoded shape (`from`/`to`/`epc`) | `POST /api/v1/price` would replace the whole function | ⚠️ Logic still client-side, but pulls live tier data |
| `config/pricing.json` | `config/pricing.json` (whole file) | **Not read by any runtime code.** Only `scripts/csv_to_pricing.js` writes it. `server.js` has no reference. | n/a | 🪦 dead code |
| `scripts/csv_to_pricing.js` + `config/pricing.csv` + `config/pricing_correction.csv` | `scripts/csv_to_pricing.js`, `config/pricing*.csv` | Local CSV→JSON build pipeline for the dead `pricing.json` | n/a | 🪦 dead code |

### 1.2 Solar resource (yield by municipality)

| Item | File · Line | Sourcing today | Tool Belt endpoint? | Status |
|---|---|---|---|---|
| Live solar yield | `server.js:233–250` (`GET /api/solar-resource` proxy) | Calls Tool Belt `GET /api/v1/solar-resource?municipality=…` | `GET /api/v1/solar-resource` | ✅ |
| Server-side fallback yield | `server.js:248` | `1530 kWh/kWp/year` constant returned when the upstream call fails | n/a | ⚠️ |
| Client-side `MUNICIPIO_YIELDS` table | `src/EstimateScreen.jsx:5–23` | 78-municipio dictionary, used by `getYield(m)` if `liveYield` is null | n/a | ⚠️ Drift risk — values may diverge from Tool Belt over time |
| `getYield(municipio)` fallback | `src/EstimateScreen.jsx:24` | Returns `MUNICIPIO_YIELDS[m] ?? 1530` | n/a | ⚠️ |

### 1.3 Roof-area → system sizing

| Item | File · Line | Sourcing today | Tool Belt endpoint? | Status |
|---|---|---|---|---|
| Live max-kWp from sqft | `server.js:255–274` (`GET /api/area-to-system` proxy) | Calls Tool Belt `GET /api/v1/area-to-system?sqft=…&municipality=…&buffer=true` | `GET /api/v1/area-to-system` | ✅ |
| Server-side fallback formula | `server.js:271–273` | `(sqft / 2500) × 45` ≈ 0.018 kWp/sqft, hardcoded `specific_yield: 1530` | n/a | ⚠️ |
| Client-side fallback formula | `src/EstimateScreen.jsx:80` | `(roofSqft / 2500) × CFG_DEFAULTS.kwp_per_2500sqft` where `kwp_per_2500sqft = 45` (`CFG_DEFAULTS:27`) | n/a | ⚠️ |
| Panel watts constant | `src/EstimateScreen.jsx:27` (`CFG_DEFAULTS.panel_watts = 410`) | Used to compute `numPanels` (line 94) and `roundToPanels()` (line 56–59) | None today — would need new Tool Belt endpoint or have `area-to-system` return module spec | ❌ Stale: live module is 585–600 W per `CLAUDE.md` |
| `roundToPanels(kwp)` rounding | `src/EstimateScreen.jsx:56–59` | `Math.ceil(kwp / (panel_watts/1000)) × (panel_watts/1000)` | n/a — pure calc | ❌ Local calc, depends on panel watts |

### 1.4 Demand-cap rules (LUMA / Windmar policy)

| Item | File · Line | Sourcing today | Tool Belt endpoint? | Status |
|---|---|---|---|---|
| Secundaria cap = 60 kVA | `src/EstimateScreen.jsx:83` (`isSecundaria ? 60 : …`) | Inline constant; tariff detected via regex `/secundaria/i` (line 82) | None | ❌ |
| Demand-cap multipliers `1.2 × 1.5` | `src/EstimateScreen.jsx:83` | `(demanda_kva + exceso_kva) × 1.2 × 1.5` | None | ❌ |
| `demandaKVA` floor of 50 | `src/EstimateScreen.jsx:352` | `Math.max(parseNum(ocrData?.demandaKVA), 50)` — used as a regulatory minimum and OCR-miss safety net | None | ❌ |

### 1.5 Financing

| Item | File · Line | Sourcing today | Tool Belt endpoint? | Status |
|---|---|---|---|---|
| Rate (9% APR), term (180 mo), balloon (mo 83), doc fee ($500) | `src/EstimateScreen.jsx:62` (`calcFinancing`) | Hardcoded constants | None | ❌ |
| Facility fee 2% of `base/0.95` | `src/EstimateScreen.jsx:64` | Hardcoded gross-up | None | ❌ |
| Security deposit 3% of `base/0.95` | `src/EstimateScreen.jsx:65` | Hardcoded gross-up | None | ❌ |
| Monthly payment + balloon math | `src/EstimateScreen.jsx:68–71` | Standard amortization formula computed client-side | None | ❌ |
| `$60,000` financing-display threshold | `src/EstimateScreen.jsx:445` (`totalCost >= 60000 ? … : null`) | Hardcoded gate | None | ❌ |

### 1.6 Battery / storage

| Item | File · Line | Sourcing today | Tool Belt endpoint? | Status |
|---|---|---|---|---|
| `BAT_CFG_DEFAULTS` (every battery constant) | `src/EstimateScreen.jsx:109–121` | Hardcoded fallback object (AC_DC_CONV 1.25, INV_UNIT_KW 60, BAT_UNIT_KWH 60, MAX_BATT_PER_INV 6, INV_COST $12,900, BAT_COST $27,700, BAT_SHIP $500, INV_SHIP $150, BAT_INSTALL_FIRST $7,000, BAT_INSTALL_NEXT $2,000, MARKUP 1.35) | None today, but the code is **already pre-wired** to consume a `pricing.battery` block — see `resolveBatCfg(pricing)` (line 123–140). The proxy just doesn't return it. | ⚠️ Will become ✅ the day Tool Belt returns a battery block |
| `calcBatterySystem()` sizing algorithm | `src/EstimateScreen.jsx:142–180` | Full local algorithm: inverter count, battery count, shipping, install, markup, SMA substitution | None | ❌ Algorithm could live in either place; Tool Belt is the better home |
| `SLIDER_HOURS = [0,4,8,12,16,24]` | `src/EstimateScreen.jsx:182` and `src/BatteryIntentScreen.jsx:4` | Hardcoded UI choice | None | ❌ |

### 1.7 Computations that are not Tool Belt candidates

These live in the estimator and should stay there — they're either pure presentation or are the wizard's own data shaping.

| Item | File · Line | What it is |
|---|---|---|
| `normalizeOCR()` (kWh averaging, zero-exclusion, effective-rate calc) | `src/UploadScreen.jsx:220–266` | Estimator-specific massaging of raw OCR JSON into the review-card shape |
| OCR review-card field set + display strings | `src/UploadScreen.jsx:28–37` (`FIELDS`) | Pure UI |
| `calcEstimate()` orchestration | `src/EstimateScreen.jsx:75–106` | Wraps several Tool Belt-sourced inputs into the screen's display object; the orchestration belongs in the client — the inputs do not |
| Quote-number counter | `server.js:114–127` (`getNextQuoteNumber`) | Local sequential counter, only meaningful in the estimator's own DB |
| `encrypt` / `decrypt` session payload helpers | `server.js:43–62` | Session handoff to the Deal section, estimator-specific |
| Zoho lead creation / attachments / notes | `server.js:373–607` | CRM integration — not a Tool Belt concern |
| PDF generation + template overlay | `server.js:612–727` (`/api/generate-and-attach-pdf`) | Customer-facing artifact, estimator-specific |
| OCR endpoint and Anthropic call | `server.js:276–369` (`/api/ocr`) | See §2 — open question whether this should migrate |

---

## Section 2 — OCR Upload Path

### 2.1 Current flow

1. **Initiator file:** `src/UploadScreen.jsx`. The drop-zone is rendered in the `idle` stage (lines 408–476). On file drop or pick, `handleFileChange(files)` is called (lines 369–386).
2. **Client-side pre-flight** (`handleFileChange` and `compressImageFile`, lines 287–310, 369–386):
   - PDFs > 4 MB are blocked locally with a Spanish error (4 MB is the Vercel inbound serverless edge limit, with 0.5 MB margin).
   - Images > 4 MB are scaled down via an HTML canvas re-encode at JPEG 0.88 quality.
3. **Upload call:** `runProcessing(selectedFiles)` (lines 333–367) posts to **`POST /api/ocr`** on the estimator's own Express server (`fetch('/api/ocr', { method: 'POST', body: fd })`). The body is a multipart `FormData` with files appended under the field name `"bills"`.
4. **Server handler:** `server.js:278–369`. Uses Multer (memory storage, 25 MB per file). Validates each file is `image/*` or `application/pdf`. Builds Anthropic `messages.create` content blocks (`type: 'document'` for PDFs, `type: 'image'` for images), then appends the Spanish user prompt.
5. **Model:** `claude-opus-4-6`, `max_tokens: 1024`, with a Spanish system prompt instructing the model to return JSON only.
6. **Response parsing:** Strips ``` ```json ``` ``` fences, JSON-parses the response. On parse failure returns HTTP 422 with the raw text. On Anthropic 401/429 returns mapped Spanish errors. Otherwise returns `{ success: true, data: ocrData }`.

### 2.2 Response shape returned to the client

The endpoint returns this envelope:

```json
{ "success": true, "data": { /* see below */ } }
```

The `data` object contains the keys the model is told to emit (server.js:308–323):

```
nombre_negocio       string | null
address              string | null
municipio            string | null            (one of the 78 PR municipios)
total_adeudado       number | null            (USD)
tarifa               "Primaria" | "Secundaria" | "Transmisión" | "Agrícola" | null
demanda_contratada   number | null            (kVA; null on Secundaria)
cargo_cliente        number | null            (USD)
cargo_demanda        number | null            (USD; null on Secundaria)
exceso_demanda_kva   number | null            (kVA quantity, not USD)
exceso_demanda_usd   number | null            (USD)
consumo_promedio     number | null            (kWh/month avg)
costo_kwh            number | null            ($/kWh, 4 decimals)
consumos_mensuales   number[]                 (13 monthly kWh bars, chronological, 0 for missing)
tasas_mensuales      number[]                 ($/kWh per month, same length & order)
```

### 2.3 What the frontend does with the response

`UploadScreen.jsx:344–366` passes `ocrResult` through `normalizeOCR()` (lines 220–266), which:
- Recomputes `consumo_promedio` as the mean of **non-zero** entries in `consumos_mensuales`.
- Recomputes `avgMonthlyBill` as `Σ(consumo_i × tasa_i) / consumos.length` (divides by total months, **not** non-zero months).
- Recomputes an effective per-kWh rate by subtracting `cargo_cliente + cargo_demanda + exceso_usd` from the average bill.
- Formats display strings (`"38,880 kWh"`, `"150.00 kVA"`, `"$10,599.08"`, `"0.2479"`).
- Drops the monthly arrays — they're not part of the object passed downstream.
- Returns `nombreNegocio, direccion, municipio, tariff, consumoKWH, demandaKVA, totalFactura, costoPorKWH` (all strings, all editable in the review card) plus four pass-through hidden numbers (`cargoCliente, cargoDemanda, excesoUSD, excesoKVA`) used by `calcEstimate` later.

The review card then renders the 8 visible fields as editable inputs (lines 552–575). When the rep taps "Todo bien. Listo" the **fields object the rep sees** — not the raw OCR response — is what flows to the next screen via `onNext(fields, file)`.

### 2.4 What would change to route through the Tool Belt OCR endpoint

- The estimator already has a Tool Belt API key configured (`TOOLBELT_API_KEY` is read at `server.js:196, 239, 261`). So API-key auth is in place if the Tool Belt OCR endpoint accepts it.
- The change would be local to `server.js:278–369`: replace the Anthropic SDK call with a `fetch` to `${TOOLBELT_BASE}/api/v1/ocr` (or whatever the actual path is), forwarding the multipart body and `X-API-Key` header, then re-emit the response under the same `{ success, data }` envelope so `UploadScreen` does not change.
- Whatever the Tool Belt returns must **be a superset of the fields listed in §2.2**, since `normalizeOCR()` and the downstream `EstimateScreen` consume them by name. Specifically, downstream code reads: `consumos_mensuales[]`, `tasas_mensuales[]`, `nombre_negocio`, `address`, `municipio`, `tarifa`, `demanda_contratada`, `cargo_cliente`, `cargo_demanda`, `exceso_demanda_kva`, `exceso_demanda_usd`. None can silently disappear.

### 2.5 Auth model — flag for Tool Belt-side confirmation

- **The prompt asserts** that the Tool Belt's `POST /api/ocr` requires either `wm_session` cookie or `X-API-Key`. The estimator can satisfy `X-API-Key` (the key is in env). It cannot satisfy session auth — estimator users are prospects, not Tool Belt users.
- **However, `docs/toolbelt_migration_brief.md` does not document an OCR endpoint at all.** The brief only lists `/price`, `/epc-tiers`, `/solar-resource`, `/area-to-system`, `/system-to-area`, and (added May 8) `/construction-service`. It explicitly says (line 376): *"OCR endpoint (`POST /api/ocr`) — uses app's own Anthropic key, no changes needed."*
- **Open questions for the Tool Belt team:**
  1. Does Tool Belt actually expose `POST /api/v1/ocr` (or any OCR endpoint) today?
  2. Does it accept `X-API-Key`, or is it session-only?
  3. What is the exact response shape? Is it field-for-field compatible with the estimator's current schema, or will the estimator need an adapter?
  4. If it does not exist today, is it on the roadmap? — see §4.

### 2.6 Field gaps to close on the Tool Belt side (assuming Tool Belt OCR exists and the estimator switches over)

These fields are consumed by the estimator and would need to be returned by the Tool Belt OCR endpoint:

- `nombre_negocio` (business name)
- `address`
- `municipio` (must be one of the 78 PR municipios — used for solar-resource lookup)
- `tarifa` (must match `/secundaria/i` to trigger the 60 kVA cap)
- `demanda_contratada` (kVA)
- `cargo_cliente`, `cargo_demanda`, `exceso_demanda_kva`, `exceso_demanda_usd`
- `consumo_promedio`
- `costo_kwh`
- `consumos_mensuales[]`, `tasas_mensuales[]` — the monthly bars; the estimator uses these to recompute its own averages and effective rate
- `total_adeudado` — used as a fallback when monthly rates are absent

If the Tool Belt OCR returns a stripped-down or differently-shaped object, an adapter layer in `server.js` would need to fill the gaps before forwarding to `UploadScreen`.

---

## Section 3 — Estimate Screen Data Requirements

Every value displayed on the customer-facing estimate, with its current source and the Tool Belt endpoint that would supply it post-migration.

| Displayed value | Where it appears | Current source | Post-migration source |
|---|---|---|---|
| Recommended system size (`X kWp`) | "Generación" row, `EstimateScreen.jsx:411` | `calcEstimate.systemKwp` — `min(maxKwpRoof, kwpFor100pct, demandCap)` rounded to nearest panel | Inputs from `/area-to-system` (max kWp from roof) + computed locally OR replaced by a new `/system-sizing` endpoint (see §4.1) |
| % of consumption covered | "Cubre" row, line 415 | `est.coverage` = `min((annualGen / annualConsumption) × 100, 100)` | Same — pure local calc once kWp and yield are known |
| Estimated backup hours | "Respaldo estimado" row, line 419 | `batteryResult.actualHours` from `calcBatterySystem` | Would come from a `/battery-sizing` endpoint (see §4.2) |
| Monthly cash savings | Big orange number, line 429 | `est.savingsCash` = `costo_kwh × min(annualGen/12, consumo_kwh)` | Same — pure local calc from OCR + solar yield |
| Total cash price | "Precio de contado" row, line 437 | `est.systemCost + batteryResult.totalCost` where `systemCost = systemKwp × 1000 × epcPerW` | `POST /api/v1/price` for solar; battery price from `/battery-sizing` |
| Payback period | "Recuperas la inversión en X años" row, line 440 | `Math.ceil(totalCost / (est.savingsCash × 12))` | Same — pure local calc |
| Down payment (financing) | "Pronto pago: $0" row, line 451 | Hardcoded `$0` | Tool Belt `/financing-terms` (see §4.3) |
| Monthly payment (financing) | "Pago mensual" row, line 455 | `calcFinancing(totalCost).monthlyPmt` | `/financing-terms` + local amortization, **or** a `/financing-payment` endpoint that returns `{ monthly_pmt, balloon, facility_fee, security_deposit }` |
| Net monthly savings (financed) | "Ahorro mensual neto" row, line 459 | `est.savingsCash − totalFin.monthlyPmt` | Same — local calc after the two inputs are sourced |
| Battery slider position | Slider, lines 481–495 | UI state, choices from local `SLIDER_HOURS` array | Same — pure UI; the **set of valid hours** could come from the Tool Belt if Windmar wants product flexibility |
| (PDF) Number of panels | Estimate PDF — server-side, `server.js:632` (writes `negocioName` etc., though `numPanels` not actually in the PDF coords map) | `Math.round(systemKwp × 1000 / panel_watts)` with `panel_watts = 410` (stale) | Either a `module-spec` endpoint, or have `/area-to-system` and `/system-sizing` include `module_watts` |

Three values are **always** the right ones to compute client-side because they're combinations of Tool Belt-sourced inputs and OCR-sourced inputs: `coverage`, `savingsCash`, `paybackYears`. The migration goal is to source every **input** from the Tool Belt, not to push these combinations server-side.

---

## Section 4 — Endpoints That May Need to Be Created on the Tool Belt

### 4.1 P1 — `POST /api/v1/battery-sizing`
**Blocking** the most expensive remaining hardcoded path (`BAT_CFG_DEFAULTS`, `calcBatterySystem`, 11 line items of supplier cost + markup).

- **Inputs:** `demanda_kva` (number, kVA), `avg_monthly_kwh` (number, kWh/month), `desired_backup_hours` (number, one of the supported slider values).
- **Response:** `num_inverters`, `num_batteries`, `system_kw`, `system_kwh`, `requested_hours`, `actual_hours`, `capped` (bool), `product_name` (string, e.g. `"Sol-Ark 240kW / 300kWh"`), `line_items` (object: `inverter_substitution, batteries, shipping, installation, subtotal, markup, total`), `config_version` (string for auditability).
- Estimator side: replace the `calcBatterySystem(...)` body with a single fetch.

### 4.2 P1 — `GET /api/v1/financing-terms`
**Blocking** because financing parameters change occasionally and there is no way to update them without a code deploy today.

- **Inputs:** optional `?product=15yr_solar_balloon` for future product variants. None today.
- **Response:** `products[]` with each product carrying `id`, `rate_apr`, `amort_months`, `balloon_month`, `doc_fee_usd`, `facility_fee_pct_of_base`, `security_deposit_pct_of_base`, `gross_up_divisor`, `display_threshold_usd`, `label` (Spanish display label).
- Estimator side: replace the constants in `calcFinancing` (`EstimateScreen.jsx:62`) and the `>= 60000` gate on line 445.

### 4.3 P1 — `GET /api/v1/module-spec` (or extend existing endpoints)
**Blocking** correctness of the PDF panel count (currently uses 410 W; live module is 585–600 W).

- **Option A — dedicated endpoint:** returns `{ module, watts_per_panel, sqft_per_panel, kwh_per_kwp_year_typical }`.
- **Option B — additive change:** add `module_watts` to existing `/area-to-system` and `/system-to-area` responses, since they already return the `module` string. Lower-effort, no new endpoint.

### 4.4 P2 — `GET /api/v1/tariff-rules` (LUMA caps & multipliers)
Not strictly blocking but currently hardcoded with no documented source of truth.

- **Inputs:** optional `?tariff=Secundaria`.
- **Response:** `rules[]` with each rule carrying `tariff`, `max_kva_grid_tie` (e.g. 60 for Secundaria, `null` otherwise), `demand_multiplier_chain` (e.g. `[1.2, 1.5]`), and an explanatory `note`.
- Estimator side: replace `isSecundaria ? 60 : (demanda_kva + exceso_kva) * 1.2 * 1.5` on `EstimateScreen.jsx:83`.

### 4.5 P2 — `POST /api/v1/ocr` (LUMA bill OCR)
**Status uncertain** — see §2.5. If Tool Belt either already has an OCR endpoint or wants to centralize it, this would be it. Otherwise the estimator should keep using Anthropic directly, and `docs/toolbelt_migration_brief.md`'s "leave untouched" note (line 376) is correct.

- **Inputs:** multipart upload of one or more `image/*` or `application/pdf` files (≤ 4 MB each, to fit Vercel edge limits), under field name `bills` (or whatever the Tool Belt chooses — the estimator can rename).
- **Auth:** `X-API-Key` header, since estimator users are not Tool Belt users.
- **Response:** must include every field listed in §2.6 to be a drop-in.

### 4.6 P3 — `POST /api/v1/system-sizing` (combined sizing call)
Nice-to-have convenience to replace two round-trips (`/solar-resource` + `/area-to-system`) and embed the demand-cap arithmetic.

- **Inputs:** `sqft`, `municipality`, `tariff`, `demanda_kva`, `exceso_kva`, `annual_consumption_kwh`, `buffer`.
- **Response:** `specific_yield`, `max_kwp_from_roof`, `max_kwp_from_demand`, `kwp_for_100pct_offset`, `recommended_kwp`, `module_watts`, `num_panels`, `annual_generation_kwh`, `coverage_pct`.
- Without this, the existing two endpoints + client-side combine are fine.

### 4.7 P3 — Battery config block on `/api/pricing` (alternative to §4.1)
The estimator's `resolveBatCfg(pricing)` helper (`EstimateScreen.jsx:123–140`) is **already written** to consume a `pricing.battery` block. If the Tool Belt is reluctant to own the sizing algorithm and only wants to own the cost numbers, it could simply return a `battery` block alongside `epc_tiers` and the estimator keeps doing the sizing locally. This is less clean than §4.1 but is a faster intermediate step.

---

## Section 5 — Migration Risk and Dependencies

### 5.1 Auth-model mismatches
- The estimator already calls Tool Belt with `X-API-Key` (see `server.js:197, 242, 264`). All proxied endpoints (`/epc-tiers`, `/solar-resource`, `/area-to-system`) accept this and have been verified in production.
- **The unresolved auth question is OCR.** If/when the Tool Belt exposes an OCR endpoint, it must accept `X-API-Key` — the estimator's users cannot satisfy session auth.

### 5.2 Response shape mismatches
- **EPC tier rows:** Tool Belt now returns `kw_from`/`kw_to`/`effective_price_per_w`; the estimator's local fallback uses `from`/`to`/`epc`. `getEPC()` (EstimateScreen.jsx:44–54) handles **both** shapes. If the Tool Belt ever renames `effective_price_per_w`, the client code needs to follow.
- **Battery block on `/api/pricing`:** `resolveBatCfg()` expects a `pricing.battery` block with a very specific nested shape (`batt_inv_60.kw_per_unit`, `batt_unit.kwh_per_unit`, `batt_unit.max_per_inverter`, etc., lines 127–139). If the Tool Belt eventually returns a battery block, it must match this shape or the estimator silently falls back to `BAT_CFG_DEFAULTS` and no one notices the misalignment.
- **`unit` annotations** (added May 8) on Tool Belt responses are additive; the estimator ignores them today, so no risk.

### 5.3 Estimator-specific logic that should NOT move to the Tool Belt
- Spanish microcopy, formatting (`fmtUSD`, `fmtSqft`, kWh comma formatting)
- The OCR review card field set, the editable inputs, and the slider hours selection — all UI choices
- `normalizeOCR()` post-processing (recomputed averages, zero-month exclusion, effective rate) — this is the estimator's specific way of presenting the bill back to the rep
- Quote-number counter (`server.js:115`) — estimator-local sequential ID
- All Zoho CRM mapping and attachment logic (`server.js:373–607`)
- PDF generation and template overlay (`server.js:612–727`) — including the coordinate maps for the estimate template
- Session encryption helpers (`server.js:43–62`) — for the Deal section handoff
- Local lead file write (`server.js:133–160`) and the writable-fs probe (`server.js:23–34`)

### 5.4 Zoho CRM independence — confirmed
The Zoho integration (token caching, lead creation, attachments, notes, `Com_Lead_Name` readback, field mapping in `createZohoLead`) reads from the OCR `data` object and the `estData` object the wizard already has in memory. It does not call the Tool Belt or read pricing config. Migrating pricing/OCR sources does **not** require Zoho changes. The only ambient risk: if any new Tool Belt response shape changes a field name (e.g. `systemKwp` → `system_kwp`), the mapping in `createZohoLead` (server.js:439–485) would need a matching tweak — but that risk is downstream of the current estimator, not of the Tool Belt change itself.

### 5.5 Dead code that should be removed (separately from the migration)
- `config/pricing.json` — never read at runtime
- `config/pricing.csv`, `config/pricing_correction.csv`, `scripts/csv_to_pricing.js` — only feed the dead JSON
- `src/PreQual_Solar_api.jsx` (~55 KB), `docs/PreQual_Solar.jsx`, `src/DealSection_api.jsx` (~263 KB) — legacy reference files not imported anywhere
- `src/BatteryIntentScreen.jsx` — exists but never routed to; the slider is rendered inline in `EstimateScreen`
- Both client- and server-side EPC fallback tables — once the Tool Belt's uptime is trusted, the duplicated hardcoded tier arrays are drift bait

Removing these is independent of the Tool Belt migration but worth doing in the same housekeeping pass.

---

## Section 6 — Recommended Migration Sequence

Each step is independently deployable. Dependencies are explicit.

1. **Tool Belt: ship `GET /api/v1/financing-terms`.** Estimator-side change is then trivial — replace constants in `calcFinancing` with a fetched config object cached at app boot alongside `/api/pricing`.

2. **Tool Belt: ship `POST /api/v1/battery-sizing` (preferred) or add a `battery` block to the existing `/api/pricing`-equivalent response (fallback).** Estimator-side either swaps `calcBatterySystem` for a single fetch (preferred) or merely populates `pricing.battery` so the existing `resolveBatCfg` plumbing lights up (fallback).

3. **Tool Belt: include `module_watts` in `/area-to-system` and `/system-to-area` responses** (or ship a dedicated `/module-spec`). Estimator-side: replace `CFG_DEFAULTS.panel_watts = 410` with the live value, which also fixes the panel count on the PDF.

4. **Tool Belt: confirm OCR endpoint status** — either expose `POST /api/v1/ocr` with `X-API-Key` auth and a superset of the §2.6 fields, OR formally document that OCR stays in the estimator. Without this confirmation, do not touch `server.js:276–369`.

5. **(Conditional on #4 being "yes") Estimator: swap the Anthropic call for the Tool Belt OCR call** behind the existing `/api/ocr` route so `UploadScreen` does not change.

6. **Tool Belt: ship `GET /api/v1/tariff-rules`.** Estimator-side: replace the Secundaria-60-kVA / `1.2 × 1.5` line with a lookup keyed by `tariff`.

7. **Estimator housekeeping pass (no Tool Belt dependency).** Delete `config/pricing.json`, `config/pricing*.csv`, `scripts/csv_to_pricing.js`, `src/PreQual_Solar_api.jsx`, `src/DealSection_api.jsx`, `docs/PreQual_Solar.jsx`, `src/BatteryIntentScreen.jsx` (or route to it again). Reduce fallback tier tables to single-line "service unavailable" errors once Tool Belt uptime is trusted.

8. **Optional: Tool Belt ships `POST /api/v1/system-sizing`** (combined call). Estimator collapses the two parallel `fetchSolarConfig` calls in `WelcomeScreen.jsx:229–241` into one.

9. **Documentation refresh.** Rewrite `docs/toolbelt_migration_brief.md` to reflect the **current** integration (not the pre-migration state) and the **post-migration** integration. Update `CLAUDE.md`'s "Known Follow-ups" and "Tool Belt API Architecture" sections to match.

Steps 1, 2, 3, 4 can proceed in any order. 5 depends on 4. 6 is independent. 7 and 9 are independent.

---

## Notes / observations made while writing this report (per the prompt's "note, don't fix" instruction)

- The active `calcFinancing` uses `BALLOON_MO = 83` (balloon due *after* month 84). `config/pricing.json` (dead) says `"balloon_month": 84`. Verify whether the canonical answer is 83 or 84 when Tool Belt ships `/financing-terms`.
- `config/pricing.json`'s EPC tiers do **not** match the server's hardcoded fallback or the client's `CFG_DEFAULTS.epc_table`. All three tables would diverge from the live Tool Belt tier table over time. The dead `pricing.json` should be deleted to remove ambiguity.
- `docs/toolbelt_migration_brief.md:348` (the "Migration Plan" table) says `server.js:170` reads `config/pricing.json`. The current code at `server.js:193–207` does not. The brief was not updated when migration shipped.
- The OCR system prompt instructs the model to return `null` for `demanda_contratada` on Secundaria tariffs, but the review card seeds an empty input rather than blocking entry. `EstimateScreen.jsx:352` then floors any `demandaKVA < 50` up to 50 — which silently converts a missing Secundaria value to "50 kVA" regardless of the actual service. Worth confirming this is the desired behavior.
- The `pricing` proxy is fetched once on `WelcomeScreen` mount (`WelcomeScreen.jsx:221–227`) and cached for the session. Tier changes mid-session are not picked up. Low impact today; worth noting if `config_version` / cache headers are added on the Tool Belt side.
