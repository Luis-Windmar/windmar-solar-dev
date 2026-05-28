# PreQual Estimator — Consumer Spec for Tool Belt API Design
**Audience:** Tool Belt API developers
**Authored:** 2026-05-18
**Source repo (reference only — Tool Belt team should not need to read it):** `windmar-commercial-estimator`

---

## 1. Overview

The **PreQual estimator** is a mobile/tablet-facing web wizard used by Windmar Commercial sales reps in the field in Puerto Rico. A rep holds the tablet, walks a small/medium/industrial business prospect through 5–6 screens, captures their most recent LUMA electricity bill, and produces a rough solar-PV system estimate (size in kWp, % of consumption covered, monthly cash savings, financing scenario, and optional battery storage). The whole flow is in Spanish and is designed to take under five minutes per prospect.

The estimator is **a consumer of data, not a source of truth**. It needs to know: (a) how much solar a given roof in a given Puerto Rico municipality will produce, (b) what Windmar charges per watt for a system of a given size, (c) how to size a battery backup given the customer's contracted demand and desired backup hours, and (d) what the financing terms are. Today some of that data is fetched live from the Tool Belt (EPC tiers, solar resource, area→system) and the rest is **hardcoded** in the React app (panel watts, kwp-per-sqft fallback, full battery sizing config, financing rate/term/fees, demand caps). The goal of this document is to identify everything that should eventually live on the Tool Belt side so the estimator becomes a thin client.

At the end of the flow the estimator: writes a `Commercial_Lead` record in Zoho CRM, attaches the LUMA bill and a generated estimate PDF to that record, and offers the PDF as a download to the rep. Zoho integration and the OCR step (which calls Anthropic directly) are **out of scope** for the Tool Belt — do not plan endpoints for those.

---

## 2. User Flow — Screen by Screen

The wizard has six steps in the progress bar, but only five are currently rendered (see Open Questions §8 — `BatteryIntentScreen` exists as a file but the live flow embeds the battery slider inside `EstimateScreen`). Screens are listed below in the order the user sees them.

### 2.1 WelcomeScreen (Step 1 of 6)

| Input | Type | Required | Used for |
|---|---|---|---|
| "¿Tienes la factura de LUMA a la mano?" | dropdown: `si` / `no` | yes | gating: `si` → continue; `no` → graceful-exit card |
| "¿Qué tipo de servicio eléctrico tienes?" | dropdown: `bifasico_240` / `trifasico_208` / `trifasico_480` / `no_se` | no (defaults to `no_se`) | stored on the OCR data object as `serviceType`; **currently not used downstream** |

On mount, the screen fetches `GET /api/pricing` (server-side proxy → Tool Belt `GET /api/v1/epc-tiers`) and stashes the tier table in component state to pass down to `EstimateScreen`. It also defines a `fetchSolarConfig(municipio, sqft)` callback that bundles `GET /api/solar-resource` + `GET /api/area-to-system` for the estimate screen to call later.

There is also a **demo toggle** at the bottom — when off, the wizard skips Zoho lead creation and just generates the PDF for download. This is a dev/demo concession and will be removed.

No validation beyond "must pick an option to continue."

### 2.2 UploadScreen — OCR (Step 2 of 6)

User uploads one or more files (image and/or PDF) of their most recent LUMA bill. The screen has three internal stages:

1. **Idle** — drop-zone + file picker. Accepts `image/*` and `application/pdf`. Multiple files allowed (e.g. multi-page bills).
2. **Processing** — animated progress bar with four checklist steps (Reading document → Identifying LUMA tariff → Extracting consumption and demand → Calculating cost/kWh). Real work happens in parallel: a `POST /api/ocr` call sends the files to the wizard's own server, which calls Anthropic Claude with a Spanish system prompt.
3. **Review (done)** — editable card displaying every OCR-extracted field. Each field shows the value the model read (`Leído: …`) above an editable input so the rep can correct it. ~20–25% of bills need at least one correction.

**Fields collected on this screen** (each is shown to the rep for review/edit before continuing):

| Field name (internal) | Label (Spanish) | Type | Unit | Source |
|---|---|---|---|---|
| `nombreNegocio` | Nombre del negocio | text | — | OCR |
| `direccion` | Dirección | text (multi-line) | — | OCR |
| `municipio` | Municipio | text | one of the 78 PR municipios | OCR |
| `tariff` | Tarifa LUMA | text | "Primaria" / "Secundaria" / "Transmisión" / "Agrícola" | OCR |
| `consumoKWH` | Consumo promedio | text formatted as `"38,880 kWh"` | kWh / month (average across non-zero months) | OCR-derived |
| `demandaKVA` | Demanda contratada | text formatted as `"150.00 kVA"` | kVA | OCR |
| `totalFactura` | Total facturado | text formatted as `"$10,599.08"` | USD / month (12-month average) | OCR-derived |
| `costoPorKWH` | Costo por kWh | text formatted as `"0.2479"` | $/kWh (effective energy-only rate after subtracting fixed charges) | OCR-derived |
| `cargoCliente` (hidden) | — | number | USD | OCR |
| `cargoDemanda` (hidden) | — | USD | USD | OCR |
| `excesoUSD` (hidden) | — | number | USD | OCR |
| `excesoKVA` (hidden) | — | number | kVA | OCR |

Two key derived quantities, computed client-side from the OCR arrays:

- `consumoPromedio` = mean of all non-zero entries in `consumos_mensuales[]`.
- `avgMonthlyBill` = Σ (consumo_i × tasa_i) ÷ **total months (12-13)**, **not** ÷ non-zero months — a zero-consumption month still counts toward the annual average.
- `effectiveRate` = (avgMonthlyBill − cargoCliente − cargoDemanda − excesoUSD) ÷ consumoPromedio.

Validation: none. The rep can edit anything before moving on.

### 2.3 RoofScreen (Step 3 of 6)

| Input | Type | Required | Used for |
|---|---|---|---|
| Size preset | one of 4 icon-cards: `small`=2,000 sqft / `medium`=7,500 / `large`=15,000 / `industrial`=50,000 | optional shortcut | Pre-fills the override input |
| "Ingresa o ajusta el área exacta" | numeric text input | yes | The actual value passed to the next screen (must be > 0) |

Output: a single number `sqft` (positive integer, square feet of usable roof). "Continuar" is disabled until the input parses to a positive number.

### 2.4 EstimateScreen (Step 5 of 6 — see Open Questions §8 on numbering)

No new user input collected here **except** a battery-hours slider. The slider snaps to one of `[0, 4, 8, 12, 16, 24]` hours. Default is 0 (no battery).

On mount, this screen:
1. Reads OCR data + sqft + the pricing object from props.
2. Calls `fetchSolarConfig(municipio, sqft)` → fires `GET /api/solar-resource` and `GET /api/area-to-system` in parallel. The responses give `specific_yield` (kWh/kWp/yr) and `kw` (the max system that fits on the roof, with buffer). Falls back silently to hardcoded values if either fetch fails.
3. Runs `calcEstimate()` (see §3.1).
4. Runs `calcBatterySystem()` if `batteryHours > 0` (see §6).
5. Renders: recommended kWp, % coverage, estimated backup hours, monthly cash savings, total cash price, payback period, financing block (only when total ≥ $60,000), and the battery slider.

CTAs: "Sí me interesa" → ContactScreen. "No por ahora" → ThankYouScreen (not-interested branch).

### 2.5 ContactScreen (Step 5 of 6)

| Input | Type | Required | Used for |
|---|---|---|---|
| Nombre completo | text | yes (length > 1) | Zoho `Primary_Contact` |
| Teléfono | text | yes (length ≥ 7) | Zoho `Phone_2` |
| Consultor (rep name) | text | no | Lead notes |
| Consultor email | email | no | Lead notes |

On submit: posts to `POST /api/leads` (writes a JSON record locally if filesystem is writable; on Vercel this is read-only and the lead just gets a quote number). Then routes to ThankYouScreen.

### 2.6 ThankYouScreen (Step 6 of 6 — interested branch)

No user input. On mount, fires:
1. `POST /api/zoho-lead` — creates `Commercial_Lead` in Zoho CRM, attaches the LUMA bill file(s).
2. `POST /api/generate-and-attach-pdf` — server generates a multi-page PDF (cover page from `cotizacion_wrapper.pdf` + estimate page from `Estimate_template_loan.pdf` or `..._cash.pdf` based on whether the total is ≥ $60k + additional wrapper pages), attaches it to the Zoho lead, and returns it base64-encoded for client download.
3. Once the PDF is ready, the "⬇ Descargar estimado" button is enabled.

The not-interested branch just shows a "thank you for your time" card with a restart button.

---

## 3. The Estimation Engine — Current Logic

All logic below lives in `src/EstimateScreen.jsx`.

### 3.1 `calcEstimate(consumoMensual, roofSqft, municipio, billData, epcTable, annualYieldOverride, maxKwpRoofOverride)`

In plain English, in order:

1. **Annual yield** — kWh produced per kWp installed per year for this municipio.
   - **Today:** `liveYield` from `GET /api/solar-resource` if available; otherwise hardcoded `MUNICIPIO_YIELDS` table inside the bundle (78-municipio dictionary with values of 1400, 1530, 1650, or 1750 kWh/kWp/yr). Default 1530 if municipio unknown.
   - **Ideal:** Already wired live. **Tool Belt should remain authoritative.**

2. **Annual consumption** — `consumoMensual × 12` (kWh).
   - User-owned, never API-sourced.

3. **Max kWp the roof can fit** — `maxKwpRoof`.
   - **Today:** `liveMaxKwp` from `GET /api/area-to-system?sqft=…&municipality=…&buffer=true` if available; else hardcoded fallback `(sqft / 2500) × 45 = 18 W/sqft` ≈ 0.018 kWp/sqft.
   - **Ideal:** Already wired live. **Tool Belt should remain authoritative.**

4. **kWp needed to cover 100% of consumption** — `annualConsumption / annualYield`.

5. **Demand-based cap** — limit system size by the customer's contracted demand so the proposal stays within LUMA's grid-tie rules.
   - If `tariff` matches `/secundaria/i`: cap = **60 kVA** (regulatory/utility limit).
   - Otherwise: cap = `(demanda_kva + exceso_kva) × 1.2 × 1.5` kW.
   - **Today:** Constants `1.2` and `1.5` and the Secundaria 60-kVA cap are hardcoded.
   - **Ideal:** These rules come from LUMA tariff policy — Tool Belt should own them as part of a tariff-rules config (see §5, P2).

6. **System size** — `roundToPanels(min(maxKwpRoof, kwpFor100pct, demandCap))`.
   - `roundToPanels(kWp)` rounds **up** to the nearest panel, where each panel = `panel_watts / 1000` kWp.
   - **Today:** `panel_watts = 410` is hardcoded. The live module is 585–600 W (the panel count shown in PDF is therefore wrong).
   - **Ideal:** Tool Belt exposes current module spec.

7. **Annual generation** — `systemKwp × annualYield` (kWh/yr).

8. **Coverage** — `min((annualGen / annualConsumption) × 100, 100)` — clamped to 100%.

9. **EPC price-per-watt** — `getEPC(systemKwp)` looks up the tier table.
   - **Today:** Pulls from the `pricing.solar.epc_tiers` object fetched on WelcomeScreen mount (Tool Belt `GET /api/v1/epc-tiers`). Falls back to an 11-row hardcoded `CFG_DEFAULTS.epc_table` if the proxy fails. Each row has `kw_from`, `kw_to`, and `effective_price_per_w`. Tier is selected where `kwp >= kw_from && kwp < kw_to`; if above the last tier, the last tier's price is used.
   - **Ideal:** Already wired live.

10. **System cost** — `systemKwp × 1000 × epcPerW` (USD).

11. **Average monthly bill (reconstructed)** — `(costo_kwh × consumo_kwh) + cargo_cliente + cargo_demanda + exceso_usd` (USD/mo).

12. **Solar kWh delivered per month** — `min(annualGen / 12, consumo_kwh)`.

13. **Cash monthly savings** — `costo_kwh × solarKwhMonthly` (USD/mo).

14. **Financing** — see §3.2.

15. **Number of panels** — `round(systemKwp × 1000 / panel_watts)`.

Outputs returned: `systemKwp, numPanels, coverage, systemCost, avgMonthlyBill, savingsCash, monthlyPmt, savingsFinanced, balloon`.

### 3.2 `calcFinancing(systemCost)`

Currently hardcoded. Computes a 15-year loan with a balloon payment at month 84.

| Constant | Current value | Meaning |
|---|---|---|
| `RATE` | 0.09 | 9% APR |
| `AMORT` | 180 | months (15 yr) |
| `BALLOON_MO` | 83 | balloon due after month 84 |
| `DOC_FEE` | 500 | USD flat fee added to financed amount |
| Facility fee | `(base / 0.95) × 0.02` where base = systemCost + DOC_FEE | 2% gross-up |
| Security deposit | `(base / 0.95) × 0.03` | 3% gross-up |

Outputs: `facilityFee, secDeposit, financed, monthlyPmt, balloon`.

The financing block on the screen only renders if `totalCost ≥ $60,000` (another hardcoded gate).

**Ideal:** All financing parameters (rate, amort, balloon month, doc fee, facility/security gross-up %, $60k display threshold) move to a Tool Belt `GET /api/v1/financing-terms` endpoint.

### 3.3 Constants summary (current hardcoded values)

| Constant | Value | Location | Where it should live |
|---|---|---|---|
| `panel_watts` | 410 | EstimateScreen `CFG_DEFAULTS` | Tool Belt module catalog |
| `kwp_per_2500sqft` | 45 (= 0.018 kWp/sqft) | EstimateScreen `CFG_DEFAULTS` | Tool Belt (already partly: `/area-to-system` returns `kw` directly) |
| EPC tier table | 11 rows, 0–100,000 kWp | server.js fallback + EstimateScreen fallback | Tool Belt `/epc-tiers` ✅ live |
| MUNICIPIO_YIELDS | 78 rows | EstimateScreen fallback | Tool Belt `/solar-resource` ✅ live |
| Secundaria demand cap | 60 kVA | EstimateScreen `calcEstimate` | Tool Belt tariff-rules |
| Demand multiplier | `1.2 × 1.5` | EstimateScreen `calcEstimate` | Tool Belt tariff-rules |
| `RATE` | 0.09 | EstimateScreen `calcFinancing` | Tool Belt financing |
| `AMORT` | 180 | EstimateScreen `calcFinancing` | Tool Belt financing |
| `BALLOON_MO` | 83 | EstimateScreen `calcFinancing` | Tool Belt financing |
| `DOC_FEE` | 500 | EstimateScreen `calcFinancing` | Tool Belt financing |
| Facility fee % | 0.02 of base/0.95 | EstimateScreen `calcFinancing` | Tool Belt financing |
| Security deposit % | 0.03 of base/0.95 | EstimateScreen `calcFinancing` | Tool Belt financing |
| Financing-display threshold | $60,000 | EstimateScreen | Tool Belt financing |

---

## 4. Current API Integration Status

| Data Point | Current source | Ideal source | Status |
|---|---|---|---|
| EPC price-per-W tiers | Tool Belt `GET /api/v1/epc-tiers` (proxied via wizard `/api/pricing`) | Tool Belt | ✅ done |
| Solar yield per municipio (kWh/kWp/yr) | Tool Belt `GET /api/v1/solar-resource` | Tool Belt | ✅ done |
| Max kWp from roof area (with 20% buffer) | Tool Belt `GET /api/v1/area-to-system` | Tool Belt | ✅ done |
| Panel watt rating | Hardcoded 410 W | Tool Belt | ❌ stale (live module is 585–600 W) |
| kWp per 2500 sqft (fallback only) | Hardcoded 45 | Tool Belt (already returned in `/area-to-system`) | ✅ live path uses Tool Belt |
| Secundaria demand cap (60 kVA) | Hardcoded | Tool Belt tariff-rules | ❌ |
| Demand multiplier (1.2 × 1.5) | Hardcoded | Tool Belt tariff-rules | ❌ |
| Financing rate (9%) | Hardcoded | Tool Belt financing | ❌ |
| Financing term (180 mo) | Hardcoded | Tool Belt financing | ❌ |
| Balloon month (83) | Hardcoded | Tool Belt financing | ❌ |
| Doc fee ($500) | Hardcoded | Tool Belt financing | ❌ |
| Facility fee (2% gross-up) | Hardcoded | Tool Belt financing | ❌ |
| Security deposit (3% gross-up) | Hardcoded | Tool Belt financing | ❌ |
| Financing-display threshold ($60k) | Hardcoded | Tool Belt financing | ❌ |
| Battery inverter unit kW | Hardcoded 60 | Tool Belt battery config | ❌ |
| Battery unit kWh | Hardcoded 60 | Tool Belt battery config | ❌ |
| Max batteries per inverter | Hardcoded 6 | Tool Belt battery config | ❌ |
| Inverter cost / SMA substitution cost | Hardcoded $12,900 / $0 | Tool Belt battery config | ❌ |
| Battery cost | Hardcoded $27,700 | Tool Belt battery config | ❌ |
| Battery shipping | Hardcoded $500/unit | Tool Belt battery config | ❌ |
| Inverter shipping | Hardcoded $150/unit | Tool Belt battery config | ❌ |
| Install cost (first/next battery) | Hardcoded $7,000 / $2,000 | Tool Belt battery config | ❌ |
| AC→DC conversion factor | Hardcoded 1.25 | Tool Belt battery config | ❌ |
| Markup | Hardcoded 1.35 | Tool Belt battery config | ❌ |
| OCR (LUMA bill → JSON) | Wizard's own `/api/ocr` → Anthropic | Stay in wizard | n/a |
| Zoho lead creation / attachment | Wizard's own `/api/zoho-lead`, `/api/zoho-attach`, `/api/generate-and-attach-pdf` | Stay in wizard | n/a |

The wizard already supports the partial structure: when it fetches `/api/pricing`, it can receive a `solar.epc_tiers` block, and the `resolveBatCfg(pricing)` helper inside `EstimateScreen` is **already written** to consume a `pricing.battery` block — that block just isn't being returned today.

---

## 5. Proposed API Endpoints Needed

P1 = blocks completion of the current product roadmap. P2 = important but the estimator can ship without it (fallbacks exist). P3 = nice to have.

### 5.1 `GET /api/v1/module-spec` — current panel rating
**Priority:** P1 (the displayed panel count is currently wrong).

**Inputs:** none (or optional `?at=2026-05-18` for time-travel).

**Response:**
```
{
  "module": "Qcells Q.PEAK DUO BLK ML-G10+",
  "watts_per_panel": 600,
  "kwh_per_kwp_year_typical": 1530,
  "sqft_per_panel": 17.3
}
```

**Consumed by:** EstimateScreen — replaces hardcoded `panel_watts: 410`.

---

### 5.2 `POST /api/v1/system-sizing` — combined sizing call (optional convenience)
**Priority:** P3.

A single round trip replacing the two parallel calls (`solar-resource` + `area-to-system`) the wizard makes on EstimateScreen mount, plus the demand-cap logic.

**Inputs:**
```
{
  "sqft": 10000,
  "municipality": "Ponce",
  "tariff": "Primaria",
  "demanda_kva": 150,
  "exceso_kva": 0,
  "annual_consumption_kwh": 466560,
  "buffer": true
}
```

**Response:**
```
{
  "specific_yield_kwh_per_kwp_year": 1700,
  "max_kwp_from_roof": 168.0,
  "max_kwp_from_demand": 270.0,
  "kwp_for_100pct_offset": 274.4,
  "recommended_kwp": 168.0,
  "module_watts": 600,
  "num_panels": 280,
  "annual_generation_kwh": 285600,
  "coverage_pct": 61.2
}
```

If P3 is rejected, the existing two endpoints + a client-side combiner are fine.

---

### 5.3 `GET /api/v1/tariff-rules` — utility/regulatory caps
**Priority:** P2.

**Inputs:** none (returns full set; or `?tariff=Secundaria` to filter).

**Response:**
```
{
  "rules": [
    {
      "tariff": "Secundaria",
      "max_kva_grid_tie": 60,
      "demand_multiplier_chain": [1.2, 1.5],
      "note": "LUMA Secundaria service is capped at 60 kVA grid-tie"
    },
    {
      "tariff": "Primaria",
      "max_kva_grid_tie": null,
      "demand_multiplier_chain": [1.2, 1.5]
    }
  ]
}
```

**Consumed by:** EstimateScreen `calcEstimate` — replaces the hardcoded `isSecundaria ? 60 : (demanda_kva + exceso_kva) * 1.2 * 1.5` line.

---

### 5.4 `GET /api/v1/financing-terms` — financing config
**Priority:** P1 (these change periodically and there's no current way to update them without a deploy).

**Inputs:** none, or optional `?product=15yr_solar` for future variants.

**Response:**
```
{
  "products": [
    {
      "id": "15yr_solar_balloon",
      "rate_apr": 0.09,
      "amort_months": 180,
      "balloon_month": 83,
      "doc_fee_usd": 500,
      "facility_fee_pct_of_base": 0.02,
      "security_deposit_pct_of_base": 0.03,
      "gross_up_divisor": 0.95,
      "display_threshold_usd": 60000,
      "label": "15 años · 9% · sin pronto"
    }
  ]
}
```

**Consumed by:** EstimateScreen `calcFinancing`.

---

### 5.5 `POST /api/v1/battery-sizing` — sized battery system + price
**Priority:** P1 (current battery price is the single largest hardcoded number in the estimator and is on the customer-facing PDF).

This is the most complex remaining hardcoded calc. See §6 for the full spec — request/response shape, algorithm, and edge cases.

---

### 5.6 (Already shipped — listed for completeness)

| Endpoint | Status |
|---|---|
| `GET /api/v1/epc-tiers` | ✅ in use via wizard `/api/pricing` |
| `GET /api/v1/solar-resource?municipality=…` | ✅ in use |
| `GET /api/v1/area-to-system?sqft=…&municipality=…&buffer=…` | ✅ in use |
| `POST /api/v1/price` | exists but **not consumed** — wizard uses `/epc-tiers` + local tier lookup instead |
| `POST /api/v1/system-to-area` | exists but **not consumed** — wizard only ever goes sqft→system |

---

## 6. The Battery/Storage Calculator — Detailed Spec

This is currently in `EstimateScreen.jsx`, function `calcBatterySystem(demandaKVA, avgMonthlyKWH, batteryHours, pricing)`. It's the most expensive piece of hardcoded logic and the next priority for migration.

### 6.1 Inputs

| Input | Source today | Unit |
|---|---|---|
| `demandaKVA` | OCR `demanda_contratada`, **floor 50 kVA** (regulatory minimum for Secundaria + safety fallback if OCR missed it) | kVA |
| `avgMonthlyKWH` | OCR-derived `consumoPromedio` | kWh/mo |
| `batteryHours` | User-picked slider value from `[4, 8, 12, 16, 24]` (0 means no battery → return null) | hours |
| `pricing.battery` config block | Currently null → uses hardcoded `BAT_CFG_DEFAULTS` | various |

### 6.2 The sizing algorithm, step by step

1. **Convert AC demand to DC required power.** `requiredKW_dc = demandaKVA × AC_DC_CONV` (with `AC_DC_CONV = 1.25`).
2. **Choose inverter count.** `numInverters = ceil(requiredKW_dc / INV_UNIT_KW)` where `INV_UNIT_KW = 60` (Sol-Ark 60 kW units).
3. **Inverter system size.** `systemKW = numInverters × INV_UNIT_KW`.
4. **Hourly load.** `hourlyKW = (avgMonthlyKWH / 30.4375) / 24` — the customer's average kW draw over a typical month (30.4375 = 365.25 ÷ 12).
5. **Required kWh of storage.** `requiredKWH = hourlyKW × batteryHours`.
6. **Raw battery count.** `rawBatteries = ceil(requiredKWH / BAT_UNIT_KWH)` with `BAT_UNIT_KWH = 60`.
7. **Apply minimum + maximum constraints.**
   - Minimum = `numInverters` (each inverter needs ≥ 1 battery).
   - Maximum = `numInverters × MAX_BATT_PER_INV` (`MAX_BATT_PER_INV = 6`).
   - `numBatteries = clamp(rawBatteries, min, max)`.
   - If clamped to max, set `capped = true` so the UI can show a warning that real backup hours fall short of the requested hours.
8. **Battery system size.** `systemKWH = numBatteries × BAT_UNIT_KWH`.
9. **Inverter substitution pricing.** The base solar EPC price already includes a comparable SMA inverter. When the customer adds storage, Sol-Ark replaces SMA. So the inverter line-item charges only the **difference**: `invSubCost = INV_COST − INV_SMA_COST` (`INV_COST = $12,900`, `INV_SMA_COST = $0` today — see Open Questions).
10. **Shipping.** `shipping = numBatteries × BAT_SHIP + numInverters × INV_SHIP` (`BAT_SHIP = $500`, `INV_SHIP = $150`).
11. **Installation.** `installation = BAT_INSTALL_FIRST + (numBatteries − 1) × BAT_INSTALL_NEXT` (`$7,000` for the first battery, `$2,000` for each additional).
12. **Total cost (with markup).** `totalCost = (numInverters × invSubCost + numBatteries × BAT_COST + shipping + installation) × MARKUP` with `MARKUP = 1.35`. `BAT_COST = $27,700`.
13. **Actual backup hours delivered.** `actualHours = systemKWH / hourlyKW` (rounded to 1 decimal) — only differs from `batteryHours` when capping applied.

### 6.3 Outputs

| Field | Unit | Notes |
|---|---|---|
| `numInverters` | count | |
| `numBatteries` | count | |
| `systemKW` | kW (AC) | inverter side |
| `systemKWH` | kWh | battery side |
| `actualHours` | hours, 1 decimal | may be < requested if capped |
| `shipping` | USD | |
| `installation` | USD | |
| `totalCost` | USD, rounded to integer | the customer-facing battery price |
| `productName` | string | e.g. `"Sol-Ark 60kW / 60kWh"` |
| `capped` | bool | true if request exceeded `MAX_BATT_PER_INV × numInverters` |

### 6.4 Edge cases

- `batteryHours === 0` → return `null` (no battery quoted).
- `demandaKVA = 0` from OCR → floor at 50 kVA before entering this function.
- `hourlyKW <= 0` → `actualHours` = 0 (avoid divide-by-zero).
- If `capped` is true, the UI shows `actualHours` (the truth) rather than the requested hours.

### 6.5 Ideal API shape

**`POST /api/v1/battery-sizing`**

Request:
```
{
  "demanda_kva": 150,
  "avg_monthly_kwh": 38880,
  "desired_backup_hours": 8
}
```

Response:
```
{
  "num_inverters": 4,
  "num_batteries": 5,
  "system_kw": 240,
  "system_kwh": 300,
  "requested_hours": 8,
  "actual_hours": 5.6,
  "capped": false,
  "product_name": "Sol-Ark 240kW / 300kWh",
  "line_items": {
    "inverter_substitution": 51600,
    "batteries": 138500,
    "shipping": 3100,
    "installation": 15000,
    "subtotal": 208200,
    "markup": 1.35,
    "total": 281070
  },
  "config_version": "2026-05-01"
}
```

The estimator should treat this endpoint as the single source of truth and stop carrying any of the constants.

---

## 7. Data the Estimator Will Always Own

The Tool Belt does **not** need to provide any of the following:

### 7.1 OCR-extracted (from the LUMA bill, via the wizard's own Anthropic call)
- `nombre_negocio` (business name)
- `address` (street address)
- `municipio` (PR municipality — passed back into Tool Belt as a parameter, but never returned by it)
- `tarifa` (LUMA tariff name)
- `demanda_contratada` (kVA)
- `cargo_cliente`, `cargo_demanda`, `exceso_demanda_kva`, `exceso_demanda_usd` (the non-solar-offsetable line items)
- `consumos_mensuales[]` (13-element kWh array) and `tasas_mensuales[]` (matching $/kWh rate array)
- `costo_kwh` (effective rate, $/kWh)

### 7.2 User-entered in the wizard
- `serviceType` (WelcomeScreen — bifásico 240 / trifásico 208 / trifásico 480 / no sé) — currently unused downstream
- `sqft` (RoofScreen — usable roof area)
- `batteryHours` (EstimateScreen slider — one of 0/4/8/12/16/24)
- `nombre`, `phone`, `consultorNombre`, `consultorEmail` (ContactScreen)

### 7.3 Wizard-side concerns
- Zoho CRM integration (lead creation, attachments, field mapping)
- PDF generation and template rendering
- Lead numbering / `Com_Lead_Name`
- Local lead storage (`leads/*.json` on disk when filesystem is writable)
- Session encryption helpers (`/api/encrypt`, `/api/decrypt`)

---

## 8. Open Questions

These are items where the right answer isn't obvious from the code and a product/engineering decision is needed before the Tool Belt should commit to an interface.

1. **`serviceType` collection vs usage.** WelcomeScreen captures whether the service is bifásico 240, trifásico 208, trifásico 480, or unknown — but nothing downstream uses it. Either (a) wire it into demand-cap or inverter-selection logic, (b) plumb it through to Zoho on a new field, or (c) remove the question. The Tool Belt may want this as a sizing input.

2. **`BatteryIntentScreen` is dead code.** The file `src/BatteryIntentScreen.jsx` implements a standalone battery-hours screen at step 4 of 6, but `WelcomeScreen.jsx` never routes there — the battery slider is rendered inline inside `EstimateScreen` instead. As a result the progress bar skips from "Paso 3 de 6" (Roof) directly to "Paso 5 de 6" (Estimate). Decide: delete the file, or restore the dedicated screen and renumber.

3. **`panel_watts = 410` is stale.** The current Q.PEAK module is 585–600 W. Updating the constant fixes the `numPanels` display in the PDF. The Tool Belt should either expose `module-spec` or assume the wizard hardcodes the latest value and accepts that this drifts.

4. **Surface-type assumption.** The estimator always treats the roof as flat (`surface_type: "unknown"` is the documented value, which maps to `flat_roof` pricing on the Tool Belt). Should the wizard ever quote carports, ground-mount, or multistory in the same job? The current data model does not support multi-surface quotes — `RoofScreen` returns a single sqft number.

5. **Demand-cap multipliers (`1.2 × 1.5`).** Are these LUMA-published constants, Windmar engineering rules-of-thumb, or arbitrary safety factors? The answer changes whether they belong in a `tariff-rules` endpoint or in an internal sizing-policy config.

6. **`INV_SMA_COST = 0` in the substitution-pricing math.** The code reads it from `pricing.battery.batt_inv_60.sma_cost ?? 0`. If SMA's actual cost is non-zero, the inverter line-item is currently over-charging the customer by the SMA price (which is already paid for in the EPC). Confirm the right number and decide whether SMA cost should live alongside Sol-Ark cost in the same `/battery-sizing` config.

7. **Financing terms vs financing products.** Are there going to be multiple financing products (e.g. 10-yr no-balloon, 15-yr balloon, lease), or is "15-yr 9% balloon" effectively permanent? This decides whether `/financing-terms` returns a single object or a `products[]` array.

8. **`config_version` / cache strategy.** Today the wizard hits `/api/pricing` once at app boot and caches the EPC tiers for the session — meaning a tier change mid-session is not reflected. Should responses carry a `config_version` or `etag` the wizard can show in the PDF for auditability? (Especially important for the PDF that goes into Zoho.)

9. **Demand-cap behavior when OCR misses `demandaKVA`.** The estimator floors it at 50 kVA. Is that the right floor? Should the Tool Belt do this clamping instead of the client?

10. **Battery slider hours `[0, 4, 8, 12, 16, 24]`.** These are arbitrary. Should the Tool Belt return the valid set, or is this purely a UI choice?
