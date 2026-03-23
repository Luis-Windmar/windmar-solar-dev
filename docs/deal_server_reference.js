// windmar-deal/server.js
// Express server for the Windmar Deal Section questionnaire.
// Mirrors the PreQual server pattern exactly.

require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const app    = express();
const PORT   = process.env.PORT || 3002;
const upload = multer({ storage: multer.memoryStorage() });

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// ── OCR endpoint ──────────────────────────────────────────────────────────────
app.post('/api/ocr', upload.single('bill'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const fileBase64  = req.file.buffer.toString('base64');
    const mimeType    = req.file.mimetype || 'application/pdf';

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: fileBase64,
              },
            },
            {
              type: 'text',
              text: `Extract the following fields from this LUMA Puerto Rico electricity bill and return ONLY valid JSON with no additional text:
{
  "address": "full service address as printed on bill",
  "total_adeudado": number (total amount due in USD),
  "tarifa": "Secundaria" | "Primaria" | "Transmisión" | "Agrícola",
  "cargo_cliente": number (monthly client/customer charge in USD),
  "cargo_demanda": number (demand charge in USD, 0 if not present),
  "demanda_contratada": number (contracted demand in kVA, 0 if not present),
  "exceso_demanda_kva": number (excess demand in kVA, 0 if not present),
  "exceso_demanda_usd": number (excess demand charge in USD, 0 if not present),
  "consumo_promedio": number (12-month average consumption in kWh),
  "costo_kwh": number (average cost per kWh as decimal, e.g. 0.2580)
}
Return only the JSON object, no markdown, no explanation.`
            }
          ]
        }
      ]
    });

    const responseText = message.content[0].text.trim();

    // Strip markdown code fences if present
    const jsonText = responseText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const data     = JSON.parse(jsonText);

    res.json({ success: true, data });

  } catch (error) {
    console.error('OCR error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Catch-all: serve index.html for any unmatched route ──────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Windmar Deal Section running at http://localhost:${PORT}`);
  console.log(`API key configured: ${!!process.env.ANTHROPIC_API_KEY}`);
});
