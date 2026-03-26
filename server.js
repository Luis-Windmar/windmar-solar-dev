require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const crypto    = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure leads directory exists
const LEADS_DIR = path.join(__dirname, 'leads');
if (!fs.existsSync(LEADS_DIR)) fs.mkdirSync(LEADS_DIR);

// ─── ENCRYPTION HELPERS ───────────────────────────────────────────────────────
// Shared key in .env: ENCRYPTION_KEY=any-long-random-string
// Used to encrypt PreQual session data into a single URL parameter ?d=...
// and decrypt it in the Deal Section on load.

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || null;

const encrypt = (obj) => {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not set in .env');
  const text    = JSON.stringify(obj);
  const iv      = crypto.randomBytes(16);
  const key     = crypto.scryptSync(ENCRYPTION_KEY, 'windmar_salt', 32);
  const cipher  = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (token) => {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not set in .env');
  const [ivHex, encHex] = token.split(':');
  const iv  = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'windmar_salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
};

// ─── ROUTES — QUESTIONNAIRES ──────────────────────────────────────────────────

// PreQual → serves prequal.html
app.get('/prequal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'prequal.html'));
});

// Deal Section → serves deal.html
app.get('/deal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'deal.html'));
});

// Root → redirect to prequal
app.get('/', (req, res) => {
  res.redirect('/prequal');
});

// ─── API: ENCRYPT SESSION DATA ────────────────────────────────────────────────
// Called by PreQual at the end of the session.
// POST /api/encrypt  { data: { ...sessionJSON } }
// Returns { token: "abc123..." } — used as ?d=abc123 in the handoff URL.
app.post('/api/encrypt', (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });
    const token = encrypt(data);
    res.json({ success: true, token });
  } catch (err) {
    console.error('Encryption error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── API: DECRYPT SESSION DATA ────────────────────────────────────────────────
// Called by Deal Section on load to decode the ?d= URL parameter.
// POST /api/decrypt  { token: "abc123..." }
// Returns { data: { ...sessionJSON } }
app.post('/api/decrypt', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'No token provided' });
    const data = decrypt(token);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Decryption error:', err.message);
    res.status(400).json({ error: 'Token inválido o expirado.' });
  }
});

// ─── QUOTE COUNTER ────────────────────────────────────────────────────────────
const COUNTER_FILE = path.join(LEADS_DIR, 'counter.json');
const getNextQuoteNumber = () => {
  let counter = { next: 20000 };
  if (fs.existsSync(COUNTER_FILE)) {
    try { counter = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')); } catch (e) {}
  }
  const num = counter.next;
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ next: num + 1 }));
  return num;
};

// ─── API: SAVE LEAD ───────────────────────────────────────────────────────────
// Called by PreQual when customer says "sí" and provides name + phone.
// POST /api/leads  { ...sessionJSON }
// Returns { success: true, leadId: "2025-02-22_Luis_787-555-1234", quoteNumber: "C20001" }
app.post('/api/leads', (req, res) => {
  try {
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    // Generate a human-readable lead ID
    const date    = new Date().toISOString().slice(0, 10);
    const name    = (data.nombre || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
    const phone   = (data.phone  || 'unknown').replace(/[^0-9]/g, '');
    const leadId  = `${date}_${name}_${phone}`;
    const leadFile = path.join(LEADS_DIR, `${leadId}.json`);

    // Generate sequential quote number: C20001, C20002, ...
    const quoteNum    = getNextQuoteNumber();
    const quoteNumber = 'C' + String(quoteNum).padStart(5, '0');

    fs.writeFileSync(leadFile, JSON.stringify({ ...data, leadId, quoteNumber, savedAt: new Date().toISOString() }, null, 2));
    console.log(`✅ Lead saved: ${leadId} (${quoteNumber})`);
    res.json({ success: true, leadId, quoteNumber });
  } catch (err) {
    console.error('Lead save error:', err.message);
    res.status(500).json({ error: 'No se pudo guardar el lead.' });
  }
});

// ─── API: GET LEAD ────────────────────────────────────────────────────────────
// Called by Deal Section to retrieve a saved lead by ID.
// GET /api/leads/:leadId
app.get('/api/leads/:leadId', (req, res) => {
  try {
    const leadFile = path.join(LEADS_DIR, `${req.params.leadId}.json`);
    if (!fs.existsSync(leadFile)) return res.status(404).json({ error: 'Lead no encontrado.' });
    const data = JSON.parse(fs.readFileSync(leadFile, 'utf8'));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer el lead.' });
  }
});

// ─── API: LIST LEADS ──────────────────────────────────────────────────────────
// GET /api/leads — returns list of all saved lead IDs
app.get('/api/leads', (req, res) => {
  try {
    const files = fs.readdirSync(LEADS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort()
      .reverse(); // newest first
    res.json({ success: true, leads: files });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar leads.' });
  }
});

// ─── API: PRICING CONFIG ──────────────────────────────────────────────────────
// GET /api/pricing — returns solar EPC tiers and battery constants
app.get('/api/pricing', (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync('./config/pricing.json', 'utf8')));
  } catch (err) {
    res.status(500).json({ error: 'Pricing config unavailable.' });
  }
});

// ─── API: OCR ─────────────────────────────────────────────────────────────────
// Accepts a LUMA bill (PDF or image) and returns structured JSON.
app.post('/api/ocr', upload.array('bills', 10), async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) return res.status(400).json({ error: 'No file uploaded' });

  const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  // Validate all files
  for (const f of files) {
    if (!f.mimetype.startsWith('image/') && f.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Unsupported file type. Please upload PDFs or images.' });
    }
  }

  const SYSTEM_PROMPT = `Eres un especialista en extraer datos de facturas de electricidad de LUMA Energy (Puerto Rico).
Tu tarea es analizar la factura y devolver ÚNICAMENTE un objeto JSON con los campos exactos indicados.
No incluyas explicaciones, comentarios, ni markdown — solo el JSON puro.

INSTRUCCIONES IMPORTANTES:
- Para "consumos_mensuales": en la última página, lee el valor de CADA barra del historial de consumo (usualmente 13 meses) en orden cronológico. Devuelve un array con todos los valores en kWh. Usa 0 para meses sin datos visibles.
- Para "tasas_mensuales": en la misma página, lee la tasa de energía en $/kWh correspondiente a cada mes (del gráfico de tasas o tabla de tarifas mensual), en el mismo orden cronológico que consumos_mensuales. Devuelve un array del mismo largo.
- Para "consumo_promedio": suma todos los valores no-cero de consumos_mensuales y divide entre la cantidad de valores no-cero.
- Para "exceso_demanda_kva": extrae la CANTIDAD en kVA, NO el monto en dólares. Si es 0 o no hay exceso, pon 0.
- Para "exceso_demanda_usd": extrae el monto en dólares del cargo por exceso de demanda. Si es 0 o no hay exceso, pon 0.
- Para tarifas Secundaria: los campos de demanda (demanda_contratada, cargo_demanda, exceso_demanda_kva, exceso_demanda_usd) deben ser null.
- Si un campo no aplica o no se encuentra, usa null.
- Todos los montos en dólares deben ser números (float), sin símbolos.
- El municipio debe ser un municipio real de Puerto Rico.`;

  const USER_PROMPT = `Analiza esta factura de LUMA Energy y extrae los siguientes campos en JSON:

{
  "nombre_negocio": "nombre del negocio o empresa (ej. McDonald's, Walgreens, Hospital San Pablo)",
  "address": "dirección completa del negocio",
  "municipio": "municipio de Puerto Rico",
  "total_adeudado": 0.00,
  "tarifa": "Primaria | Secundaria | Transmisión | Agrícola",
  "demanda_contratada": 0,
  "cargo_cliente": 0.00,
  "cargo_demanda": 0.00,
  "exceso_demanda_kva": 0,
  "exceso_demanda_usd": 0.00,
  "consumo_promedio": 0,
  "costo_kwh": 0.0000,
  "consumos_mensuales": [0,0,0,0,0,0,0,0,0,0,0,0,0],
  "tasas_mensuales": [0.0000,0.0000,0.0000,0.0000,0.0000,0.0000,0.0000,0.0000,0.0000,0.0000,0.0000,0.0000,0.0000]
}

Recuerda: solo JSON puro, sin markdown ni explicaciones.`;

  try {
    // Build content blocks — one block per file, then the prompt
    const fileBlocks = files.map((f) => {
      const base64 = f.buffer.toString('base64');
      if (f.mimetype === 'application/pdf') {
        return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
      } else {
        const imageType = validImageTypes.includes(f.mimetype) ? f.mimetype : 'image/jpeg';
        return { type: 'image', source: { type: 'base64', media_type: imageType, data: base64 } };
      }
    });
    const content = [...fileBlocks, { type: 'text', text: USER_PROMPT }];

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const rawText  = response.content[0].text.trim();
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let ocrData;
    try {
      ocrData = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message);
      return res.status(422).json({
        error: 'No se pudo interpretar la respuesta del OCR. Por favor intenta de nuevo.',
        raw: rawText,
      });
    }

    res.json({ success: true, data: ocrData });

  } catch (err) {
    console.error('Anthropic API error:', err.message);
    if (err.status === 401) return res.status(401).json({ error: 'API key inválida o no configurada.' });
    if (err.status === 429) return res.status(429).json({ error: 'Límite de uso alcanzado. Intenta en unos segundos.' });
    res.status(500).json({ error: 'Error al procesar la factura. Por favor intenta de nuevo.' });
  }
});

// ─── ZOHO CRM INTEGRATION ─────────────────────────────────────────────────────

const FormDataNode = require('form-data');

const parseLeadNotes = (notes) => {
  if (!notes) return {};
  const extract = (pattern) => {
    const match = notes.match(pattern);
    return match ? match[1].replace(/,/g, '').trim() : null;
  };
  return {
    cotizacion:     extract(/Cotización:\s*([^|]+)/),
    tarifa:         extract(/Tarifa:\s*([^|]+)/),
    consumo:        extract(/Consumo:\s*([\d,]+)\s*kWh/),
    demanda:        extract(/Demanda:\s*([\d,]+)\s*kVA/),
    costo:          extract(/Costo\/kWh:\s*([\d.]+)/),
    sistema:        extract(/Sistema:\s*([\d.]+)\s*kWp/),
    cobertura:      extract(/Cobertura:\s*([\d.]+)%/),
    precio:         extract(/Precio est\.\:\s*\$([\d,]+)/),
    techo:          extract(/Techo:\s*([\d,]+)\s*p/),
    consultor:      extract(/Consultor en Estimado:\s*([^|]+)/),
    consultorEmail: extract(/Estimado Rep-email:\s*([^|]+)/),
  };
};

let _zohoWriteCache = { token: null, expiresAt: 0 };
let _zohoReadCache  = { token: null, expiresAt: 0 };

const _fetchZohoToken = async (clientId, clientSecret, refreshToken, label) => {
  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho ${label} token refresh failed: ` + JSON.stringify(data));
  console.log(`🔑 Zoho ${label} token refreshed, valid for ~58 min`);
  return data.access_token;
};

const getZohoWriteToken = async () => {
  const now = Date.now();
  if (_zohoWriteCache.token && now < _zohoWriteCache.expiresAt) return _zohoWriteCache.token;
  const token = await _fetchZohoToken(process.env.ZOHO_WRITE_CLIENT_ID, process.env.ZOHO_WRITE_CLIENT_SECRET, process.env.ZOHO_WRITE_REFRESH_TOKEN, 'WRITE');
  _zohoWriteCache = { token, expiresAt: now + (3500 * 1000) };
  return token;
};

const getZohoReadToken = async () => {
  const now = Date.now();
  if (_zohoReadCache.token && now < _zohoReadCache.expiresAt) return _zohoReadCache.token;
  const token = await _fetchZohoToken(process.env.ZOHO_READ_CLIENT_ID, process.env.ZOHO_READ_CLIENT_SECRET, process.env.ZOHO_READ_REFRESH_TOKEN, 'READ');
  _zohoReadCache = { token, expiresAt: now + (3500 * 1000) };
  return token;
};

const createZohoLead = async (leadData, token) => {
  const p = parseLeadNotes(leadData.notes);
  const condensedNotes = [
    p.cobertura      ? `Cobertura Estimada: ${p.cobertura}%`           : null,
    p.costo          ? `Costo de energia promedio estimado: ${p.costo}` : null,
    p.consultor      ? `Consultor en Estimado: ${p.consultor}`          : null,
    p.consultorEmail ? `Estimado Rep-email: ${p.consultorEmail}`        : null,
  ].filter(Boolean).join(' | ') || null;

  const res = await fetch('https://www.zohoapis.com/crm/v3/Commercial_Lead', {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      data: [{
        Primary_Contact:    leadData.customerName                              || null,
        Account_Name:       leadData.businessName                             || null,
        Phone_2:            leadData.phone                                    || null,
        Phone_3:            leadData.phoneSecondary                           || null,
        Email:              leadData.email                                    || null,
        Address:            leadData.address                                  || null,
        City:               leadData.city                                     || null,
        Zip_Code:           leadData.zip                                      || null,
        // Lead_Number intentionally left blank (auto-assigned by Zoho)
        Tama_o_Estimado:    p.techo     ? parseFloat(p.techo)     : (leadData.roofSqft       || null),
        Consumo_Promedio:   p.consumo   ? parseFloat(p.consumo)   : (leadData.avgConsumption || null),
        Carga_Contratada_KVA: p.demanda                            || null,
        PV_System_Size_kW1: p.sistema                              || (leadData.systemKwp ? String(leadData.systemKwp) : null),
        Tipo_de_Tarifa:          p.tarifa                                     || null,
        Quote_Amount:            p.precio ? parseFloat(p.precio) : null,
        Baterias:                leadData.batteryPrice ? parseFloat(leadData.batteryPrice) : null,
        Battery_System_Size_kWh: leadData.batteryKWH != null ? String(leadData.batteryKWH) : null,
        Storage_Size_kWh:        leadData.batteryKWH != null ? String(leadData.batteryKWH) : null,
        Lead_Notes:              condensedNotes,
        Lead_Status:             'New Lead',
        Lead_Source:        'PreQual',
        Owner:              { id: process.env.ZOHO_OWNER_USER_ID },
      }],
    }),
  });
  const data = await res.json();
  const result = data?.data?.[0];
  if (result?.code !== 'SUCCESS') throw new Error('Zoho lead creation failed: ' + JSON.stringify(data));
  return result.details.id;
};

const attachFileToZohoLead = async (leadId, fileBuffer, fileName, mimeType, token) => {
  // Use native FormData + Blob (compatible with Node 18+ built-in fetch)
  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  form.append('file', blob, fileName);
  const res = await fetch(`https://www.zohoapis.com/crm/v3/Commercial_Lead/${leadId}/Attachments`, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      // Content-Type is set automatically by fetch with the correct multipart boundary
    },
    body: form,
  });
  const data = await res.json();
  const result = data?.data?.[0];
  if (result?.code !== 'SUCCESS') throw new Error('Zoho attachment failed: ' + JSON.stringify(data));
  return result.details.id;
};

const getZohoLeadName = async (leadId, readToken) => {
  const res = await fetch(`https://www.zohoapis.com/crm/v3/Commercial_Lead/${leadId}?fields=Com_Lead_Name`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${readToken}` },
  });
  const data = await res.json();
  return data?.data?.[0]?.Com_Lead_Name || null;
};

// POST /api/zoho-lead
// Creates lead, attaches bill, reads back Com_Lead_Name
// Returns { success, zohoLeadId, commercialLeadName }
app.post('/api/zoho-lead', upload.fields([{ name: 'billFile', maxCount: 10 }]), async (req, res) => {
  try {
    const leadData   = JSON.parse(req.body.leadData);
    const writeToken = await getZohoWriteToken();
    const readToken  = await getZohoReadToken();

    const zohoLeadId = await createZohoLead(leadData, writeToken);
    console.log('✅ Zoho lead created:', zohoLeadId);

    if (req.files?.billFile?.length) {
      for (const bill of req.files.billFile) {
        try {
          await attachFileToZohoLead(zohoLeadId, bill.buffer, bill.originalname, bill.mimetype, readToken);
          console.log('✅ Bill attached to Zoho lead:', zohoLeadId);
        } catch (attachErr) {
          console.warn('⚠️ Bill attachment failed:', attachErr.message);
        }
      }
    }

    let commercialLeadName = null;
    try {
      commercialLeadName = await getZohoLeadName(zohoLeadId, readToken);
      console.log('✅ Commercial Lead Name:', commercialLeadName);
    } catch (nameErr) {
      console.warn('⚠️ Could not read Com_Lead_Name:', nameErr.message);
    }

    res.json({ success: true, zohoLeadId, commercialLeadName });
  } catch (err) {
    console.error('❌ Zoho error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/zoho-attach
// Attaches the estimado PDF after it's been generated client-side
app.post('/api/zoho-attach', upload.single('file'), async (req, res) => {
  try {
    const { leadId } = req.body;
    const file = req.file;
    if (!leadId || !file) return res.status(400).json({ success: false, error: 'Missing leadId or file' });
    const readToken = await getZohoReadToken();
    await attachFileToZohoLead(leadId, file.buffer, file.originalname, file.mimetype, readToken);
    console.log('✅ Estimado attached to Zoho lead:', leadId);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Zoho attach error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: HEALTH CHECK ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured:     !!process.env.ANTHROPIC_API_KEY,
    encryptionConfigured: !!process.env.ENCRYPTION_KEY,
    zohoConfigured: {
      clientId:     !!process.env.ZOHO_WRITE_CLIENT_ID,
      clientSecret: !!process.env.ZOHO_WRITE_CLIENT_SECRET,
      refreshToken: !!process.env.ZOHO_WRITE_REFRESH_TOKEN,
      ownerId:      !!process.env.ZOHO_OWNER_USER_ID,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── API: ZOHO TOKEN TEST ─────────────────────────────────────────────────────
app.get('/api/zoho-test', async (req, res) => {
  try {
    _zohoTokenCache = { token: null, expiresAt: 0 }; // force fresh fetch
    const token = await getZohoToken();
    res.json({ success: true, tokenPrefix: token.substring(0, 8) + '...' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 404 FALLBACK ─────────────────────────────────────────────────────────────
app.get(/.*/, (req, res) => {
  res.status(404).send('Not found. Try <a href="/prequal">/prequal</a> or <a href="/deal">/deal</a>');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🌞 Windmar server running on http://localhost:${PORT}`);
  console.log(`   PreQual  → http://localhost:${PORT}/prequal`);
  console.log(`   Deal     → http://localhost:${PORT}/deal`);
  console.log(`   API Key  : ${process.env.ANTHROPIC_API_KEY          ? '✅ configured' : '❌ MISSING'}`);
  console.log(`   Encrypt  : ${process.env.ENCRYPTION_KEY             ? '✅ configured' : '❌ MISSING'}`);
  console.log(`   Zoho CID : ${process.env.ZOHO_WRITE_CLIENT_ID       ? '✅ configured' : '❌ MISSING'}`);
  console.log(`   Zoho SEC : ${process.env.ZOHO_WRITE_CLIENT_SECRET   ? '✅ configured' : '❌ MISSING'}`);
  console.log(`   Zoho RT  : ${process.env.ZOHO_WRITE_REFRESH_TOKEN   ? '✅ configured' : '❌ MISSING'}`);
  console.log(`   Zoho OWN : ${process.env.ZOHO_OWNER_USER_ID         ? '✅ configured' : '❌ MISSING'}`);
  console.log(`   Zoho RCID: ${process.env.ZOHO_READ_CLIENT_ID        ? '✅ configured' : '❌ MISSING'}`);
  console.log(`   Zoho RSEC: ${process.env.ZOHO_READ_CLIENT_SECRET    ? '✅ configured' : '❌ MISSING'}`);
  console.log(`   Zoho RRT : ${process.env.ZOHO_READ_REFRESH_TOKEN    ? '✅ configured' : '❌ MISSING'}\n`);
});
