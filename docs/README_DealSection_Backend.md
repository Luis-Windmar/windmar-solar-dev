# Windmar Deal Section — Build & Deploy Reference

This document explains the full setup and build process for the Windmar Deal Section
backend. Follow the same pattern as the PreQual backend.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + Express |
| Frontend | React (bundled with esbuild) |
| Styling | Tailwind CSS (via CDN in index.html) |
| OCR | Anthropic API (`claude-opus-4-6`) — for bill re-upload if needed |
| Environment | `.env` file via `dotenv` |

---

## Project Structure

```
windmar-deal/
├── server.js                        # Express server — serves static files + /api/ocr endpoint
├── patch_and_build.sh               # ← THE MAIN BUILD SCRIPT (use this every time)
├── .env                             # ANTHROPIC_API_KEY + PORT (not in git)
├── .env.example                     # Template for .env
├── package.json
│
├── Cuestionario_Solar_INTEGRATED.jsx   # Source JSX from Claude sessions (has mockExtractBillData)
│
├── src/
│   ├── main.jsx                     # React entry point — imports DealSection_api.jsx
│   └── DealSection_api.jsx          # Patched version — mock replaced with real fetch('/api/ocr')
│
└── public/                          # Static files served by Express
    ├── index.html                   # HTML shell — loads Tailwind CDN + bundle.js
    ├── bundle.js                    # Built by esbuild (regenerated on each build)
    └── logo.png                     # Windmar Commercial logo (transparent PNG)
```

---

## Key Concept: The Mock → API Patch

`Cuestionario_Solar_INTEGRATED.jsx` contains a `mockExtractBillData()` function
that simulates bill reading with fake data. This is useful for development
in Claude sessions, but the backend needs to call the real Anthropic API.

`patch_and_build.sh` automatically:
1. Copies source JSX to `src/DealSection_api.jsx`
2. Detects if `mockExtractBillData()` is still present
3. Replaces the mock call block with a real `fetch('/api/ocr', ...)` call
4. Runs esbuild to bundle everything into `public/bundle.js`
5. Starts the server

---

## Initial Setup (first time only)

```bash
# 1. Create project directory
mkdir ~/windmar-deal
cd ~/windmar-deal

# 2. Install Node.js dependencies
npm init -y
npm install express multer dotenv

# 3. Install esbuild
npm install --save-dev esbuild

# 4. Create environment file
cp .env.example .env
# Edit .env and set:
#   ANTHROPIC_API_KEY=sk-ant-...
#   PORT=3002

# 5. Place logo in public folder
mkdir -p public src
cp /path/to/WindMar_Commercial_Logo-transparent.png public/logo.png

# 6. Copy source JSX from Claude session
cp ~/Downloads/Cuestionario_Solar_INTEGRATED.jsx .

# 7. Make build script executable
chmod +x patch_and_build.sh
```

---

## Daily Workflow

### Start the server (no code changes)
```bash
node server.js
```
Then open: **http://localhost:3002**

### After updating JSX from a Claude session
```bash
cp ~/Downloads/Cuestionario_Solar_INTEGRATED.jsx .
./patch_and_build.sh
```

### Stop the server
```bash
Ctrl+C
```

### Check if API patch is applied
```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('src/DealSection_api.jsx', 'utf8');
console.log('Has mockExtractBillData:', src.includes('mockExtractBillData'));
console.log('Has fetch /api/ocr:', src.includes('/api/ocr'));
"
```

---

## The patch_and_build.sh Script (full sequence)

```
1. Copy Cuestionario_Solar_INTEGRATED.jsx → src/DealSection_api.jsx
2. If mockExtractBillData() found → replace the mock call with fetch('/api/ocr') block
3. Run esbuild:
   npx esbuild src/main.jsx \
     --bundle \
     --outfile=public/bundle.js \
     --platform=browser \
     --target=es2020 \
     --loader:.jsx=jsx \
     --define:process.env.NODE_ENV='"production"'
4. Start server: node server.js
```

---

## API Endpoints

### POST /api/ocr
Accepts a LUMA bill (PDF or image), calls Anthropic API, returns structured JSON.

**Request:** `multipart/form-data` with field `bill`

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "...",
    "municipio": "Cidra",
    "total_adeudado": 7030.87,
    "tarifa": "Primaria",
    "demanda_contratada": 100,
    "cargo_cliente": 200.00,
    "cargo_demanda": 534.60,
    "exceso_demanda_kva": 0,
    "exceso_demanda_usd": 0.00,
    "consumo_promedio": 27043,
    "costo_kwh": 0.2580
  }
}
```

### GET /api/health
```json
{ "status": "ok", "apiKeyConfigured": true, "timestamp": "..." }
```

---

## index.html Structure

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script src="/bundle.js"></script>
</body>
</html>
```

**Important:** Use `https://cdn.tailwindcss.com` (NOT the old cdnjs version).

---

## Branding (Windmar Commercial)

| Element | Value |
|---------|-------|
| Primary blue | `#1B3F8B` |
| Accent orange | `#F5A623` |
| Background | `#EBF1FF` |
| Banner | White (`#ffffff`) with `3px solid #1B3F8B` bottom border |
| User bubbles | `#1B3F8B` background, white text |
| Assistant bubbles | White background, dark text |
| Logo | `public/logo.png` (transparent PNG, height 52px in banner) |

---

## PreQual → Deal Section Handoff

In development, the Deal Section reads PreQual data from URL params:

```
http://localhost:3002/?lead=Luis&kwh=27043&roof=5000&municipio=Cidra
```

Read them in the component via:
```javascript
const params = new URLSearchParams(window.location.search);
const preQualData = {
  nombre:      params.get('lead'),
  consumo_kwh: Number(params.get('kwh')),
  roof_sqft:   Number(params.get('roof')),
  municipio:   params.get('municipio'),
};
```

See `README_DealSection_Handoff.md` for the full data schema.

---

## Port Assignment

| App | Port |
|-----|------|
| PreQual | 3001 |
| Deal Section | 3002 |

Both can run simultaneously without conflict.
