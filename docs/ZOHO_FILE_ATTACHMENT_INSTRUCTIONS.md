# ZOHO_FILE_ATTACHMENT_INSTRUCTIONS.md
## Claude Code Task: Attach Factura + Estimado to Zoho Lead
### Updated: 2026-03-19

---

## Background & Confirmed Findings

Full API testing was completed. Here is what is confirmed working:

| Credential Set | Create Record | Populate Fields | Read Record | Attach Files | Update Record |
|---|---|---|---|---|---|
| First (`ZOHO_READ_*`) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Second (`ZOHO_WRITE_*`) | ✅ | ✅ | ❌ | ❌ | ❌ |

**Use first credentials (`ZOHO_READ_*`) for all operations.**

Attachment endpoint confirmed working:
```
POST https://www.zohoapis.com/crm/v3/Commercial_Lead/{leadId}/Attachments
```

Two files attach sequentially to the same lead with no issues. ✅

---

## The Two Files to Attach

### 1. Factura (LUMA bill)
- **What it is:** The PDF or image the rep uploaded at the start of the wizard
- **Where it lives:** React state from the moment of upload (`billFile` in UploadScreen)
- **Type:** Browser `File` object
- **How to send:** Pass directly to `FormData.append('billFile', billFile, billFile.name)`

### 2. Estimado (solar estimate PDF)
- **What it is:** PDF generated client-side using jsPDF
- **Where it lives:** Currently only triggers a browser download — not retained in state
- **Type:** Will be a `Blob` object once captured
- **The challenge:** Must be captured before it is discarded by the browser
- **Solution:** See section below

---

## Estimado PDF — Retention Strategy

The estimado is generated using jsPDF. Currently the code calls `doc.save()` which
triggers a download and discards the blob. The fix is to capture the blob first.

### Change to make in the PDF generation function

Find the jsPDF generation code (likely in EstimateScreen or a shared utility).
It currently ends with something like:
```js
doc.save('Estimado_Windmar.pdf');
```

Replace with:
```js
const pdfBlob = doc.output('blob');

// Keep the browser download
const url = URL.createObjectURL(pdfBlob);
const a = document.createElement('a');
a.href = url;
a.download = 'Estimado_Windmar.pdf';
a.click();
URL.revokeObjectURL(url);

// Store blob in React state for Zoho attachment
setEstimatePdfBlob(pdfBlob);
```

### Add to wizard top-level state
```js
const [estimatePdfBlob, setEstimatePdfBlob] = useState(null);
```

Pass `setEstimatePdfBlob` down to whichever screen generates the PDF.

---

## server.js — Token & Attachment Functions

Use a single token helper using first credentials for all operations:

```js
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
```

---

## React — submitToZoho() Function

Call this after contact info is collected (ContactScreen or ThankYouScreen):

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

  // Attach LUMA bill (File object from UploadScreen)
  if (billFile) {
    formData.append('billFile', billFile, billFile.name);
  }

  // Attach estimado PDF blob (captured after jsPDF generation)
  if (estimatePdfBlob) {
    formData.append('estimateFile', estimatePdfBlob, 'Estimado_Windmar.pdf');
  }

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

## Submission Timing

The estimado blob must exist in state before `submitToZoho()` is called.
Recommended sequence:

1. Rep taps "Sí me interesa" on EstimateScreen
2. ContactScreen appears — rep enters customer name + phone
3. Rep taps "Enviar"
4. If estimado blob not yet in state → generate PDF now (triggers download + sets blob)
5. Call `submitToZoho()`
6. Proceed to ThankYouScreen — do not wait for Zoho response to unblock UI

If the rep already tapped "Download Estimate" earlier, the blob is already in state
and step 4 is skipped automatically.

---

## Environment Variables

In `.env` (local) and Railway Variables (production):

```
# First credentials — used for ALL operations
ZOHO_READ_CLIENT_ID=...
ZOHO_READ_CLIENT_SECRET=...
ZOHO_READ_REFRESH_TOKEN=...

# Second credentials — kept for reference, not used in integration
ZOHO_WRITE_CLIENT_ID=...
ZOHO_WRITE_CLIENT_SECRET=...
ZOHO_WRITE_REFRESH_TOKEN=...

# Config
ZOHO_OWNER_USER_ID=4258103001863220103
```

When admin delivers consolidated credentials, replace all six with:
```
ZOHO_CLIENT_ID=...
ZOHO_CLIENT_SECRET=...
ZOHO_REFRESH_TOKEN=...
ZOHO_OWNER_USER_ID=4258103001863220103
```
And update `getZohoFirstToken()` accordingly.

---

## Important Notes

- First credentials (`ZOHO_READ_*`) handle everything — create, read, and attach
- Never block the wizard UI on a Zoho failure — always proceed to ThankYouScreen
- `billFile` is a browser `File` object — pass directly to FormData
- `estimatePdfBlob` is a `Blob` from `doc.output('blob')` — pass directly to FormData
- Both travel as `multipart/form-data` to `/api/zoho-lead` — multer handles the rest
- Token caching is a future optimization — tokens are refreshed fresh per submission for now
