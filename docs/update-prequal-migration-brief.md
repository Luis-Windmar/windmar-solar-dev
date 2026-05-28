# Prompt: Update PreQual Migration Brief — API v1 Changes

## Context
You are working on the PreQual estimator repo at:
`~/Desktop/IQ_Claude/PreQual_Deal/windmar_dev`

Read these files before making any changes:
- `docs/toolbelt_migration_brief.md` — existing migration brief
- `CLAUDE.md` — existing context file

Do NOT touch any other files. This is a documentation-only update.

---

## Task

Append two sections to `docs/toolbelt_migration_brief.md`.

Add them after the existing endpoint documentation and before any
"What NOT to change" section (if present). If the file ends with the
endpoint docs, append at the end.

---

## Section to append: Units Annotation (all existing endpoints)

```markdown
## API v1 — Units Annotation (added May 8, 2026)

All existing endpoints now include a `units` object in their responses.
This is a purely additive change — no existing fields were modified.
No changes required in PreQual to consume existing endpoints.

The `units` field documents what unit system each response value uses:

### POST /api/v1/price
```json
{
  "units": {
    "kw": "kWdc",
    "price_per_watt": "USD/Wdc",
    "total_price": "USD"
  }
}
```

### GET /api/v1/solar-resource
```json
{
  "units": {
    "specific_yield": "kWh/kWp/year"
  }
}
```

### GET /api/v1/area-to-system
```json
{
  "units": {
    "sqft": "ft²",
    "effective_sqft": "ft²",
    "kw": "kWdc",
    "monthly_gen_kwh": "kWh/month"
  }
}
```

### POST /api/v1/system-to-area
```json
{
  "units": {
    "kw": "kWdc",
    "sqft": "ft²",
    "sqft_with_buffer": "ft²"
  }
}
```

### GET /api/v1/epc-tiers
```json
{
  "units": {
    "kw_from": "kWdc",
    "kw_to": "kWdc",
    "base_epc": "USD/Wdc",
    "effective_price_per_w": "USD/Wdc"
  }
}
```
```

---

## Section to append: New endpoint — construction-service

```markdown
## API v1 — New Endpoint: GET /api/v1/construction-service

Added May 8, 2026. **PreQual does not use this endpoint today.**
Documented here for future reference when construction pricing is needed.

### Purpose
Returns the total price for a construction service given a quantity.
Handles variable unit pricing (per ft, per day, per W, lump sum, etc.)
with built-in quantity validation and self-correcting error responses.

### Authentication
Same as all v1 endpoints — X-API-Key header required.

### Request
```
GET /api/v1/construction-service?name={service_name}&quantity={number}&unit={unit}
```

All three parameters are required.

### Units enum
| Value | Meaning |
|-------|---------|
| `per_ft` | Per lineal foot |
| `per_day` | Per day (8hr) |
| `per_watt` | Per watt |
| `per_kw` | Per kilowatt |
| `per_unit` | Per unit/each |
| `per_sqft` | Per square foot |
| `lump_sum` | Flat fee, quantity ignored |

### Success response (200)
```json
{
  "service": "Excavación — zanja",
  "quantity": 1000,
  "unit": "per_ft",
  "unit_price": 1500,
  "quantity_basis": 200,
  "effective_rate": 7.50,
  "effective_rate_label": "$7.50 / ft",
  "total": 7500,
  "units": {
    "quantity": "ft",
    "price": "USD",
    "total": "USD"
  }
}
```

**Formula:** `total = (quantity / quantity_basis) * unit_price`

For `lump_sum`: `total = unit_price` regardless of quantity.

### Error responses

**Missing quantity (400):**
```json
{
  "error": "quantity_required",
  "message": "Este servicio se cotiza en per_ft. Debes enviar quantity (número de ft).",
  "unit": "per_ft",
  "quantity_basis": 200
}
```

**Wrong unit submitted (400):**
```json
{
  "error": "unit_mismatch",
  "message": "Este servicio se cotiza en per_ft. Enviaste per_day.",
  "expected_unit": "per_ft",
  "quantity_basis": 200
}
```

**Service not found (404):**
```json
{
  "error": "service_not_found",
  "message": "No se encontró el servicio 'Excavación' o no está activo."
}
```

### Usage pattern (when PreQual needs it)
```javascript
// Example: price a 500ft trench
const res = await fetch(
  `${TOOLBELT_BASE}/api/v1/construction-service?name=Excavación — zanja&quantity=500&unit=per_ft`,
  { headers: { 'X-API-Key': process.env.TOOLBELT_API_KEY } }
);
const data = await res.json();
if (!res.ok) {
  // data.error tells you exactly what's wrong and what to fix
  console.error(data.message);
  return;
}
// data.total is the price to use
console.log(data.total); // 3750
```

### Important
- Service names are case-insensitive (uses ilike match)
- Only active services (`is_active = true`) are returned
- The `quantity_basis` in the error response tells you the pricing unit
  so you can correct your call without reading documentation
```
```

---

## After completing changes

Commit and push from the PreQual repo:
```bash
cd ~/Desktop/IQ_Claude/PreQual_Deal/windmar_dev
git add docs/toolbelt_migration_brief.md
git commit -m "docs: update migration brief with API v1 units annotation and construction-service endpoint"
git push origin main
```

## Do NOT
- Modify any .js, .jsx, .json, or .env files
- Change CLAUDE.md
- Touch server.js or any application code
- Make any changes to the Tool Belt repo
