# Zoho Schema Refresh — Storage_Size_kWh String + Field Map Update

**Date:** 2026-05-29
**Source prompt:** `prompts/prompt-storage-size-fix.md`
**Source data:** Live Zoho schema read 2026-05-29, record `4258103003219198921`
**Outcome:** One-line fix in `server.js` to send `Storage_Size_kWh` as a string (was integer); `docs/ZOHO_LEADS_FIELDS_MAP.md` updated to reflect the 2026-05-29 schema, with three rows flipped from Number → String (`Carga_Contratada_KVA`, `Storage_Size_kWh`, `Tama_o_del_Transformador_KVA`).

---

## 1. The one-line server.js change

```diff
-        // Battery_System_Size_kWh / Storage_Size_kWh: Zoho integer (kWh).
-        // Previously sent as String() which Zoho rejected with INVALID_DATA.
-        Battery_System_Size_kWh: leadData.batteryKWH != null ? parseInt(leadData.batteryKWH, 10) : null,
-        Storage_Size_kWh:        leadData.batteryKWH != null ? parseInt(leadData.batteryKWH, 10) : null,
+        // Battery_System_Size_kWh: Zoho Number (confirmed 2026-05-29 schema read).
+        Battery_System_Size_kWh: leadData.batteryKWH != null ? parseInt(leadData.batteryKWH, 10) : null,
+        // Storage_Size_kWh: Zoho text/String (confirmed 2026-05-29 schema read).
+        // Despite the matching name, this field is text — wrap the integer in String().
+        Storage_Size_kWh:        leadData.batteryKWH != null ? String(parseInt(leadData.batteryKWH, 10)) : null,
```

A 54 kWh battery now ships `Battery_System_Size_kWh: 54` (integer) and `Storage_Size_kWh: "54"` (string) — each matching its Zoho field's confirmed type.

## 2. Updated field-type table (all wizard-used fields)

| API Field | Confirmed type | What server.js sends | Confirmed on |
|---|---|---|---|
| `Primary_Contact` | String | string | 2026-03-19 |
| `Account_Name` | String | string | 2026-03-19 |
| `Phone_2` | String | string (`cleanPhone`) | 2026-03-19 |
| `Email` | String | string | 2026-03-19 |
| `Address` | String | string | 2026-03-19 |
| `City` | String | string | 2026-03-19 |
| `Zip_Code` | String | string | 2026-03-19 |
| `Tama_o_Estimado` | **Number** | integer (`parseInt`) | **2026-05-29** |
| `Consumo_Promedio` | **Number** | integer (`parseInt`) | **2026-05-29** |
| `Carga_Contratada_KVA` | **String** (was Number) | string (raw `p.demanda`) | **2026-05-29** |
| `PV_System_Size_kW1` | String | string | **2026-05-29** |
| `Tipo_de_Tarifa` | Picklist | string | 2026-03-19 |
| `Quote_Amount` | Number | float (`parseFloat`) | 2026-03-19 |
| `Baterias` | Boolean | float (likely WRONG — see §5) | 2026-03-19 |
| `Battery_System_Size_kWh` | **Number** | integer (`parseInt`) | **2026-05-29** |
| `Storage_Size_kWh` | **String** (was Number) | string-wrapped integer | **2026-05-29** |
| `Lead_Notes` | String | string | 2026-03-19 |
| `Lead_Status` | Picklist | string `"New Lead"` | 2026-03-19 |
| `Lead_Source` | Picklist | string `"PreQual"` | 2026-03-19 |
| `Owner` | Lookup | `{ id: ZOHO_OWNER_USER_ID }` | 2026-03-19 |

(Bold rows = confirmed by the 2026-05-29 schema refresh. Non-bold rows were not re-read in this refresh and still date to 2026-03-19.)

## 3. Field map document updates

Top of `docs/ZOHO_LEADS_FIELDS_MAP.md`:

```markdown
> **Last schema refresh: 2026-05-29**
> **Record used: 4258103003219198921**
> Note: Field types are confirmed from live API read. Some fields differ from
> the original 2026-03-19 map — Zoho admin changed field types between March
> and May 2026. Rows tagged "Confirmed 2026-05-29" reflect the refresh.
```

Three rows flipped Number → String:

| Row | Before | After |
|---|---|---|
| `Carga_Contratada_KVA` | `Number` | **`String`** + "Was Number in 2026-03-19 snapshot; now String — Confirmed 2026-05-29" |
| `Storage_Size_kWh` | `Number` | **`String`** + same note |
| `Tama_o_del_Transformador_KVA` | `Number` | **`String`** + same note |

Four rows confirmed unchanged (types match the 2026-03-19 snapshot — added "Confirmed 2026-05-29" tag):

- `Consumo_Promedio` — Number
- `Tama_o_Estimado` — Number
- `PV_System_Size_kW1` — String
- `Battery_System_Size_kWh` — Number

## 4. Verification

```
$ node -c server.js
ok
$ node build.js
✅ Build complete.
   Bundle  → public/prequal.bundle.js
   HTML    → public/prequal.html
$ node --test src/sizing/*.test.js
ℹ tests 40
ℹ pass 40
ℹ fail 0
$ bash patch_and_build.sh
✅ Static analysis passed.
✅ Build complete.
```

`Battery_System_Size_kWh` INVALID_DATA fix from `zoho-fixes.md` remains intact — it still ships as an integer, matching its confirmed Number type. `Carga_Contratada_KVA` INVALID_DATA fix from `zoho-field-type-audit.md` also intact — still ships as the raw string.

## 5. Known follow-up (NOT acted on this session)

`Baterias` is documented as Boolean in the map but `createZohoLead` currently sends `parseFloat(leadData.batteryPrice)` (a number — the battery's total price). That's a probable type mismatch — if the field rejects, the symptom would be INVALID_DATA on `Baterias`. No production error reported for it yet, so leaving alone for now. Worth a re-read on the next schema refresh.

## 6. Status

`windmar_dev` push happens via the commit below. **`promote_to_prod.sh` NOT run** — developer tests on the dev URL first and promotes manually after verifying:

- Full wizard run with battery hours > 0 → Zoho lead creates with no INVALID_DATA error
- Optionally verify in the Zoho web UI that `Storage_Size_kWh` displays as the string `"54"` for a 54 kWh battery

When ready: `cd ~/Desktop/IQ_Claude/PreQual_Deal && ./promote_to_prod.sh "Storage_Size_kWh → string + field-map refresh"`
