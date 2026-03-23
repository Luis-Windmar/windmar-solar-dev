# README_ZOHO_INTEGRATION.md
## Windmar PreQual Wizard — Zoho CRM Integration
### Status as of 2026-03-19 (updated after full test session)

---

## Objective

When the PreQual wizard completes (rep taps "Sí me interesa" and submits ContactScreen), automatically:
1. Create a new `Commercial_Lead` record in Zoho CRM with all collected data
2. Attach the LUMA bill file to that record
3. Attach the PreQual estimate PDF to that record
4. Return the new Zoho Lead ID to the wizard UI for confirmation

---

## What's Been Tested & Confirmed

| Capability | Status | Notes |
|---|---|---|
| Get access token via refresh token | ✅ Working | Both credential sets |
| Create `Commercial_Lead` record (POST) | ✅ Working | Both credential sets |
| Populate all 15 fields on creation | ✅ Working | Both credential sets |
| `Lead_Source: "PreQual Wizard"` picklist | ✅ Valid | Confirmed accepted |
| Owner auto-assignment | ✅ Working | Assigns to `ventas.comerciales@windmarenergy.com` |
| Read existing records (GET) | ✅ Working | First credentials only |
| Attach files to existing lead | ✅ Working | First credentials only |
| Attach two files sequentially | ✅ Working | First credentials only |
| Update existing records (PUT) | ❌ Blocked | Neither credential set — needed for future workflow |

---

## Credentials

### Current Setup — Two Credential Sets

Testing revealed that the two credential sets have different capabilities:

**First credentials** (`ZOHO_READ_*` in `.env`):
- ✅ Create records, populate fields, read records, attach files
- ❌ Cannot update existing records

**Second credentials** (`ZOHO_WRITE_*` in `.env`):
- ✅ Create records, populate fields
- ❌ Cannot read, attach files, or update existing records

**Key finding:** First credentials alone are sufficient for the entire current integration.
Second credentials add nothing that first credentials don't already cover.

### Pending: Credential Consolidation

Admin has been asked to provide a single consolidated credential set with scopes:
```
ZohoCRM.modules.ALL,ZohoCRM.modules.attachments.CREATE
```
This will also add UPDATE capability needed for a future workflow (returning prospects).

Until then, use **first credentials (`ZOHO_READ_*`) for all operations**.

### .env Structure

```
# First credentials — used for ALL operations currently
ZOHO_READ_CLIENT_ID=...
ZOHO_READ_CLIENT_SECRET=...
ZOHO_READ_REFRESH_TOKEN=...

# Second credentials — create/populate only, kept for reference
ZOHO_WRITE_CLIENT_ID=...
ZOHO_WRITE_CLIENT_SECRET=...
ZOHO_WRITE_REFRESH_TOKEN=...

# Config
ZOHO_OWNER_USER_ID=4258103001863220103
```

Same variables must be set in Railway dashboard → Variables tab.

**Note:** All records created via API show `Created_By: JJ Gonzalez` (zoho.admin@windmarhome.com)
but are owned by `ventas.comerciales@windmarenergy.com` (ID: 4258103001863220103).

---

## Zoho API Details

| Item | Value |
|---|---|
| Auth domain | `https://accounts.zoho.com` |
| API domain | `https://www.zohoapis.com` |
| Module UI name | Clientes Potenciales |
| Module API name | `Commercial_Lead` ← use this in all calls |
| Module internal name | `CustomModule84` ← do NOT use |
| Region | US |
| Attachment endpoint | `POST /crm/v3/Commercial_Lead/{id}/Attachments` |

---

## Field Map — Wizard State → Zoho API

| Wizard Data | Zoho API Field | Type | Notes |
|---|---|---|---|
| Customer full name | `Primary_Contact` | String | From ContactScreen |
| Business name | `Account_Name` | String | From ContactScreen |
| Main phone | `Phone_2` | String | From ContactScreen |
| Secondary phone | `Phone_3` | String | From ContactScreen (optional) |
| Email | `Email` | String | From ContactScreen (optional) |
| Address | `Address` | String | From OCR review |
| City / municipio | `City` | String | From OCR review |
| Zip code | `Zip_Code` | String | Note: NOT `Zip` |
| Roof size sq ft | `Tama_o_Estimado` | Number | From RoofScreen |
| Avg kWh consumption | `Consumo_Promedio` | Number | From OCR review |
| Demand kVA | `Carga_Contratada_KVA` | Number | From OCR review |
| System size kW | `PV_System_Size_kW1` | String | From estimate calculation |
| Sales rep email | `Sales_Rep_Email` | String | Rep using the tablet |
| OCR notes / summary | `Lead_Notes` | String | Condensed — see notes parsing below |

### Hardcoded values (always set)

| Zoho API Field | Value |
|---|---|
| `Lead_Status` | `"New Lead"` |
| `Lead_Source` | `"PreQual Wizard"` |
| `Owner` | `{ "id": process.env.ZOHO_OWNER_USER_ID }` |

### Notes String Parsing

The wizard produces a summary string like:
```
Cotización: C20000 | Tarifa: Primaria | Consumo: 24,801 kWh | Demanda: 125 kVA | Costo/kWh: 0.2311 | Sistema: 194.3 kWp | Cobertura: 100% | Precio est.: $485,850 | Techo: 50,000 p²
```

Parse this string and map values to proper fields:

| Parsed value | Zoho field |
|---|---|
| `Consumo` | `Consumo_Promedio` |
| `Demanda` | `Carga_Contratada_KVA` |
| `Sistema` | `PV_System_Size_kW1` |
| `Techo` | `Tama_o_Estimado` |
| `Cotización` | `Lead_Number` |
| Remaining (Tarifa, Cobertura, Precio, Costo/kWh) | `Lead_Notes` condensed |

---

## Integration Code for server.js

Add the following block to `server.js`. It is self-contained — no changes to existing endpoints needed.

```js
// ─── ZOHO CRM INTEGRATION ─────────────────────────────────────────────────────

// NOTE: First credentials (ZOHO_READ_*) handle ALL operations currently.
// Second credentials (ZOHO_WRITE_*) are kept in .env for reference.
// When admin delivers consolidated credentials, replace both helpers
// with a single getZohoToken() using the new unified credential vars.

const getZohoFirstToken = async () => {
  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     process.env.ZOHO_READ_CLIENT_ID,
    client_secret: process.env.ZOHO_READ_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_READ_REFRESH_TOKEN,
  });
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Zoho token refresh failed: ' + JSON.stringify(data));
  return data.access_token;
};

const parseLeadNotes = (notes) => {
  if (!notes) return {};
  const extract = (pattern) => {
    const match = notes.match(pattern);
    return match ? match[1].replace(/,/g, '').trim() : null;
  };
  return {
    consumo:    extract(/Consumo:\s*([\d,]+)\s*kWh/),
    demanda:    extract(/Demanda:\s*([\d,]+)\s*kVA/),
    sistema:    extract(/Sistema:\s*([\d.]+)\s*kWp/),
    techo:      extract(/Techo:\s*([\d,]+)\s*p/),
    cotizacion: extract(/Cotización:\s*([^|]+)/),
    tarifa:     extract(/Tarifa:\s*([^|]+)/),
    cobertura:  extract(/Cobertura:\s*([\d.]+)%/),
    precio:     extract(/Precio est\.:\s*\$([\d,]+)/),
    costo:      extract(/Costo\/kWh:\s*([\d.]+)/),
  };
};

const createZohoLead = async (leadData, token) => {
  const parsed = parseLeadNotes(leadData.notes);
  const res = await fetch('https://www.zohoapis.com/crm/v3/Commercial_Lead', {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: [{
        Primary_Contact:      leadData.customerName,
        Account_Name:         leadData.businessName,
        Phone_2:              leadData.phone,
        Phone_3:              leadData.phoneSecondary          || null,
        Email:                leadData.email                   || null,
        Address:              leadData.address                 || null,
        City:                 leadData.city                    || null,
        Zip_Code:             leadData.zip                     || null,
        Tama_o_Estimado:      parsed.techo     ? parseFloat(parsed.techo)   : (leadData.roofSizeEstimate || null),
        Consumo_Promedio:     parsed.consumo   ? parseFloat(parsed.consumo) : (leadData.avgConsumption   || null),
        Carga_Contratada_KVA: parsed.demanda   ? parseFloat(parsed.demanda) : (leadData.demandaKVA       || null),
        PV_System_Size_kW1:   parsed.sistema   || (leadData.systemSizeKw ? String(leadData.systemSizeKw) : null),
        Lead_Number:          parsed.cotizacion || null,
        Sales_Rep_Email:      leadData.salesRepEmail           || null,
        Lead_Notes:           [parsed.tarifa, parsed.cobertura && `Cobertura: ${parsed.cobertura}%`, parsed.precio && `Precio est.: $${parsed.precio}`, parsed.costo && `Costo/kWh: ${parsed.costo}`]
                                .filter(Boolean).join(' | ')   || leadData.notes || null,
        Lead_Status:          'New Lead',
        Lead_Source:          'PreQual Wizard',
        Owner:                { id: process.env.ZOHO_OWNER_USER_ID }
      }]
    })
  });
  const data = await res.json();
  const result = data?.data?.[0];
  if (result?.code !== 'SUCCESS') throw new Error('Zoho lead creation failed: ' + JSON.stringify(data));
  return result.details.id;
};

const attachFileToLead = async (leadId, fileBuffer, fileName, mimeType, token) => {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fileBuffer, { filename: fileName, contentType: mimeType });
  const res = await fetch(`https://www.zohoapis.com/crm/v3/Commercial_Lead/${leadId}/Attachments`, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      ...form.getHeaders()
    },
    body: form
  });
  const data = await res.json();
  const result = data?.data?.[0];
  if (result?.code !== 'SUCCESS') throw new Error('Zoho attachment failed: ' + JSON.stringify(data));
  return result.details.id;
};

// ─── ROUTE: POST /api/zoho-lead ───────────────────────────────────────────────
// Called after ContactScreen submits. Expects multipart/form-data:
//   - leadData      (JSON string, required)
//   - billFile      (file, optional) — uploaded LUMA bill
//   - estimateFile  (file, optional) — jsPDF estimado blob

app.post('/api/zoho-lead', upload.fields([
  { name: 'billFile',     maxCount: 1 },
  { name: 'estimateFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const leadData = JSON.parse(req.body.leadData);
    const token = await getZohoFirstToken();

    // Step 1: Create the lead record
    const leadId = await createZohoLead(leadData, token);
    console.log('✅ Zoho lead created:', leadId);

    // Step 2: Attach LUMA bill
    if (req.files?.billFile?.[0]) {
      const bill = req.files.billFile[0];
      await attachFileToLead(leadId, bill.buffer, bill.originalname, bill.mimetype, token);
      console.log('✅ LUMA bill attached:', leadId);
    }

    // Step 3: Attach estimado PDF
    if (req.files?.estimateFile?.[0]) {
      const estimate = req.files.estimateFile[0];
      await attachFileToLead(leadId, estimate.buffer, estimate.originalname, estimate.mimetype, token);
      console.log('✅ Estimado attached:', leadId);
    }

    res.json({ success: true, leadId });

  } catch (err) {
    console.error('❌ Zoho lead error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
```

---

## npm Packages Required

```bash
npm install dotenv form-data
```

Verify `server.js` has at the very top:
```js
require('dotenv').config();
```

---

## React Integration — What to Wire Up

```js
const submitToZoho = async () => {
  const formData = new FormData();

  formData.append('leadData', JSON.stringify({
    customerName:     contactName,
    businessName:     businessName,
    phone:            contactPhone,
    phoneSecondary:   contactPhoneSecondary  || null,
    email:            contactEmail           || null,
    address:          ocrData.address,
    city:             ocrData.municipio,
    zip:              ocrData.zip            || null,
    roofSizeEstimate: roofSqft,
    avgConsumption:   ocrData.consumoKWH,
    demandaKVA:       ocrData.demandaKVA     || null,
    systemSizeKw:     estimate.systemSizeKw,
    salesRepEmail:    salesRepEmail          || null,
    notes:            ocrData.rawSummary     || null,
  }));

  if (billFile)        formData.append('billFile',     billFile,        billFile.name);
  if (estimatePdfBlob) formData.append('estimateFile', estimatePdfBlob, 'Estimado_Windmar.pdf');

  try {
    const res  = await fetch('/api/zoho-lead', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) console.log('✅ Zoho lead created:', data.leadId);
    else              console.error('❌ Zoho error:', data.error);
  } catch (err) {
    console.error('❌ Zoho submission failed:', err.message);
  }
  // IMPORTANT: Never block the wizard flow on Zoho errors.
  // Always proceed to ThankYouScreen regardless of outcome.
};
```

---

## Test Scripts

| Script | Purpose |
|---|---|
| `test_zoho_scope.sh` | Token introspection + read + create tests |
| `test_zoho_write_read_compare.sh` | Create lead + read back + side-by-side field comparison |
| `test_zoho_create_lead_full.sh` | Create lead with all fields filled |
| `test_zoho_file_attach.sh` | 4-way attachment test (WRITE/READ × existing/new lead) |
| `test_zoho_attach_both.sh` | Attach both factura + estimado to a single lead |

All scripts read from `.env` automatically. Run from project root.

---

## Outstanding Items

1. **Credential consolidation** — admin message sent. When received, replace `ZOHO_READ_*` and `ZOHO_WRITE_*` with single `ZOHO_CLIENT_*` set. Update `.env`, Railway, and simplify `getZohoFirstToken()` to `getZohoToken()`.
2. **UPDATE capability** — needed for future workflow (returning prospects). Covered by consolidated credentials above.
3. **Bill file retention** — verify `billFile` is passed through wizard state from UploadScreen all the way to ContactScreen.
4. **Sales rep email source** — `Sales_Rep_Email` field needs a value. Options: entered on WelcomeScreen, hardcoded per device, or added in a future login step.
5. **`Com_Lead_Name` on estimate PDF** — to print CRM record number (e.g. "CL1059") on the estimado, a GET call is needed after record creation. Decide if needed for v1 or future enhancement.
