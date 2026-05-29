# Zoho Field-Type Audit — Carga_Contratada_KVA Reverted to String

**Date:** 2026-05-29
**Source prompt:** `prompts/prompt-zoho-field-type-audit.md`
**Outcome:** Audited the 5 fields touched by `zoho-fixes.md` against `docs/ZOHO_LEADS_FIELDS_MAP.md`. Map declares all 5 as **Number**, which would suggest no revert. The prompt's production-error signal, however, was specific to `Carga_Contratada_KVA` (`INVALID_DATA expected_data_type: text`). The map is dated 2026-03-19 — Zoho admin may have changed that field to text since. Reverted **only** `Carga_Contratada_KVA` to send as a raw string. The other four Number conversions stay — including the original `Battery_System_Size_kWh` INVALID_DATA fix.

---

## 1. Per-field audit

| Field | Map (2026-03-19) | Previous-fix conversion | New conversion | Decision |
|---|---|---|---|---|
| `Battery_System_Size_kWh` | **Number** | `parseInt(value, 10)` | **unchanged** (`parseInt`) | Keep — map agrees + original String() value triggered the documented INVALID_DATA error |
| `Storage_Size_kWh` | **Number** | `parseInt(value, 10)` | **unchanged** (`parseInt`) | Keep — same as above (twin field) |
| `Tama_o_Estimado` | **Number** | `parseInt(value, 10)` | **unchanged** (`parseInt`) | Keep — map agrees |
| `Consumo_Promedio` | **Number** | `parseInt(value, 10)` | **unchanged** (`parseInt`) | Keep — map agrees |
| `Carga_Contratada_KVA` | **Number** | `parseFloat(value)` | **`p.demanda \|\| null`** (raw string) | **Revert** — production error explicitly says the live field type is `text`. The map is stale for this entry. |

`PV_System_Size_kW1` (already String per map) and `Quote_Amount` / `Baterias` (untouched by both fixes) were not modified.

## 2. Exact change

`server.js` `createZohoLead`:

```diff
-        // Carga_Contratada_KVA: Zoho numeric (can be float, e.g. 50.5).
-        Carga_Contratada_KVA: p.demanda ? parseFloat(p.demanda)     : null,
+        // Carga_Contratada_KVA: live Zoho field is `text` despite the map
+        // showing `Number` (2026-03-19 snapshot). Production rejected the
+        // parseFloat coercion with INVALID_DATA expected_data_type: text;
+        // send the raw extracted string instead.
+        Carga_Contratada_KVA: p.demanda || null,
```

`p.demanda` is sourced from `parseLeadNotes`'s regex `/Demanda:\s*([\d,]+)\s*kVA/`, and `extract()` returns the captured digits with commas stripped and trimmed. So for a `Demanda: 50 kVA` notes segment, `p.demanda` is the string `"50"`. That's what now flows to Zoho — matching the field's actual text type.

## 3. Is the original `Battery_System_Size_kWh` INVALID_DATA still fixed?

**Yes.** That fix is preserved in this audit:

```js
Battery_System_Size_kWh: leadData.batteryKWH != null ? parseInt(leadData.batteryKWH, 10) : null,
Storage_Size_kWh:        leadData.batteryKWH != null ? parseInt(leadData.batteryKWH, 10) : null,
```

Both still send integers, which matches the map's `Number` declaration. A 54 kWh battery still ships as `54`, not `"54"`.

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
```

Full lint+build via `patch_and_build.sh` also clean.

## 5. Risk + follow-up

The map (`docs/ZOHO_LEADS_FIELDS_MAP.md`) is now provably stale on at least one field. Two follow-up actions worth considering:

1. **Re-read the live Zoho schema** (the source line on the map is `Source: Live API read, session 2026-03-19; Record used: 4258103003144630371`). A fresh API read against any current Commercial_Lead record would re-derive the truth. After confirming, update the map's `Carga_Contratada_KVA` row from `Number` to `String` and note the change date.

2. **Watch for other silent type drifts.** Other Number fields in the map may have been similarly retyped. If production reports more `expected_data_type: text` errors on other fields, follow the same revert pattern (and update the map).

## 6. What was NOT changed

- The 4 other Number conversions stay as-is. Map agrees + production has not (yet) reported INVALID_DATA errors on them.
- `ThankYouScreen.jsx` try/catch/**finally** — untouched. The wizard-hang fix is independent of this audit.
- Sizing logic / 40 unit tests — untouched.
- The normal happy path — works identically.

## 7. Status

`windmar_dev` push happens via the commit below. **`promote_to_prod.sh` was NOT run** per the standing instruction — developer will test on the dev URL first and promote manually.
