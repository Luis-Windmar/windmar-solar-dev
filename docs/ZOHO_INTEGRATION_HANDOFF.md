# Zoho CRM Integration — Claude Code Handoff
## Session date: 2026-03-18

This document should be appended to CLAUDE.md before starting integration work in Claude Code.
It captures everything learned about the Zoho API, field mapping, and credentials strategy.

---

## Objective

When the PreQual wizard completes (after OCR + estimate), automatically:
1. Create a new `Commercial_Lead` record in Zoho CRM
2. Attach the LUMA bill file to that record
3. Attach the PreQual estimate PDF to that record (if generated)
4. Return the new Zoho Lead ID to the wizard UI for confirmation

---

## Credentials Strategy — .env File

### How it works
Credentials are stored in a `.env` file in the project root. This file is:
- ✅ Read by `server.js` at runtime via the `dotenv` package
- ✅ Listed in `.gitignore` — never committed to GitHub
- ✅ Never deployed to Railway — Railway uses its own env var dashboard instead
- ✅ Never visible to Claude Code — it only sees `process.env.VARIABLE_NAME`

### Step 1 — Install dotenv (if not already installed)
```bash
npm install dotenv
```

### Step 2 — Add to top of server.js
```js
require('dotenv').config();
```

### Step 3 — Create .env file in project root
```
# .env — DO NOT COMMIT THIS FILE

# Zoho CRM API Credentials (Write scope)
ZOHO_CLIENT_ID=your_client_id_here
ZOHO_CLIENT_SECRET=your_client_secret_here
ZOHO_REFRESH_TOKEN=your_refresh_token_here

# Zoho CRM Config
ZOHO_OWNER_USER_ID=4258103001863220103
```

### Step 4 — Verify .gitignore contains .env
Open `.gitignore` and confirm this line exists (add it if not):
```
.env
```

### Step 5 — Set variables on Railway
In Railway dashboard → your project → Variables tab, add the same four keys:
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_OWNER_USER_ID`

---

## Zoho API — Confirmed Details

### Region
- **Zoho account region:** US
- **Auth domain:** `https://accounts.zoho.com`
- **API domain:** `https://www.zohoapis.com`

### API Scopes (confirmed working on write credentials)
- `ZohoCRM.modules.CREATE` — create records in any module
- `ZohoCRM.modules.attachments.CREATE` — attach files to records

### Module
- **UI name:** Clientes Potenciales (Commercial Leads)
- **API name:** `Commercial_Lead` ← use this in all API calls
- **Internal Zoho URL name:** `CustomModule84` ← do NOT use this in API calls

---

## API Flow — Three Steps

### Step 1: Get Access Token
```
POST https://accounts.zoho.com/oauth/v2/token
```
```js
const getZohoToken = async () => {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
  });
  const res = await fetch(`https://accounts.zoho.com/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Zoho token refresh failed: ' + JSON.stringify(data));
  return data.access_token;
};
```

### Step 2: Create Commercial_Lead Record
```
POST https://www.zohoapis.com/crm/v3/Commercial_Lead
```
Returns a `Lead ID` — save this for Step 3.

### Step 3: Attach File(s) to Lead
```
POST https://www.zohoapis.com/crm/v3/Commercial_Lead/{leadId}/Attachments
```
Use `multipart/form-data` with the file buffer. Call once per file.

---

## Field Map — PreQual Wizard → Zoho API

| PreQual Data | Zoho API Field | Type | Notes |
|---|---|---|---|
| Customer full name | `Primary_Contact` | String | "Juan Alberto Pinto Suarez" |
| Business name | `Account_Name` | String | "Colegio de Abogados de PR" |
| Main phone | `Phone_2` | String | UI label: "Main Phone" |
| Secondary phone | `Phone_3` | String | UI label: "Secondary Phone" |
| Email | `Email` | String | Primary email field |
| Address | `Address` | String | Street address |
| City | `City` | String | Municipality |
| Zip | `Zip_Code` | String | Note: NOT `Zip` |
| Roof size estimate | `Tama_o_Estimado` | Number | Numeric sq ft value |
| Avg consumption kWh | `Consumo_Promedio` | Number | Monthly avg from bill |
| System size kW | `PV_System_Size_kW1` | String | Estimated system size |
| Sales rep email | `Sales_Rep_Email` | String | Rep using the tablet |
| Notes / bill summary | `Lead_Notes` | String | Free text, OCR summary |

### Hardcoded values (always set these)
| Zoho API Field | Value | Notes |
|---|---|---|
| `Lead_Status` | `"New Lead"` | Starting status |
| `Lead_Source` | `"PreQual Wizard"` | ⚠️ Confirm this is valid picklist value |
| `Owner` | `{ "id": process.env.ZOHO_OWNER_USER_ID }` | Back-office coordinator |

### ⚠️ Outstanding items to confirm with Zoho admin
1. Is `"PreQual Wizard"` a valid picklist value for `Lead_Source`? If not, what value to use?
2. Which user account do the write API credentials belong to? (Affects auto-assigned Owner)

---

## Complete server.js Integration Code

Add this to `server.js`:

```js
// ─── ZOHO CRM INTEGRATION ─────────────────────────────────────────────────

const getZohoToken = async () => {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
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

const createZohoLead = async (leadData, token) => {
  const res = await fetch('https://www.zohoapis.com/crm/v3/Commercial_Lead', {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: [{
        Primary_Contact: leadData.customerName,
        Account_Name: leadData.businessName,
        Phone_2: leadData.phone,
        Phone_3: leadData.phoneSecondary || null,
        Email: leadData.email || null,
        Address: leadData.address || null,
        City: leadData.city || null,
        Zip_Code: leadData.zip || null,
        Tama_o_Estimado: leadData.roofSizeEstimate || null,
        Consumo_Promedio: leadData.avgConsumption || null,
        PV_System_Size_kW1: leadData.systemSizeKw ? String(leadData.systemSizeKw) : null,
        Sales_Rep_Email: leadData.salesRepEmail || null,
        Lead_Notes: leadData.notes || null,
        Lead_Status: 'New Lead',
        Lead_Source: 'PreQual Wizard',
        Owner: { id: process.env.ZOHO_OWNER_USER_ID }
      }]
    })
  });
  const data = await res.json();
  const result = data?.data?.[0];
  if (result?.code !== 'SUCCESS') throw new Error('Zoho lead creation failed: ' + JSON.stringify(data));
  return result.details.id; // Returns the new Lead ID
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

// ─── API ROUTE: POST /api/zoho-lead ──────────────────────────────────────────
// Called after OCR completes. Expects multipart/form-data with:
//   - leadData (JSON string)
//   - billFile (file, optional)
//   - estimateFile (file, optional)

app.post('/api/zoho-lead', upload.fields([
  { name: 'billFile', maxCount: 1 },
  { name: 'estimateFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const leadData = JSON.parse(req.body.leadData);
    const token = await getZohoToken();

    // Step 1: Create the lead
    const leadId = await createZohoLead(leadData, token);
    console.log('✅ Zoho lead created:', leadId);

    // Step 2: Attach LUMA bill if provided
    if (req.files?.billFile?.[0]) {
      const bill = req.files.billFile[0];
      await attachFileToLead(leadId, bill.buffer, bill.originalname, bill.mimetype, token);
      console.log('✅ LUMA bill attached to lead:', leadId);
    }

    // Step 3: Attach estimate if provided
    if (req.files?.estimateFile?.[0]) {
      const estimate = req.files.estimateFile[0];
      await attachFileToLead(leadId, estimate.buffer, estimate.originalname, estimate.mimetype, token);
      console.log('✅ Estimate attached to lead:', leadId);
    }

    res.json({ success: true, leadId });

  } catch (err) {
    console.error('❌ Zoho lead creation error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
```

---

## Notes & Outstanding Items

1. **`form-data` package** — run `npm install form-data` if not already installed
2. **`Lead_Source` picklist** — confirm `"PreQual Wizard"` is a valid value in Zoho, or ask admin what value to use. A safe fallback is `"Web Site"` which is a standard Zoho value.
3. **Owner auto-assignment** — the first test create via API will reveal which user gets auto-assigned. Check the created record in Zoho UI.
4. **Token caching** — for production, cache the token and only refresh when expired (3600s) rather than refreshing on every call.
5. **File storage** — bill files are currently held in memory (multer memoryStorage). They do NOT need to be saved to disk or R2 — they go directly from memory buffer to Zoho attachment. The Cloudflare R2 plan is no longer needed.

