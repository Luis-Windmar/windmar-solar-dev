#!/usr/bin/env bash
# ─── Windmar — Patch & Build Script ──────────────────────────────────────────
# Patches mockOCR → real API fetch, builds both bundles, starts server.
# Usage: ./patch_and_build.sh [prequal|deal|both]
# Default: builds both

set -e
cd "$(dirname "$0")"

TARGET=${1:-both}

# ─── PATCH & BUILD PREQUAL ───────────────────────────────────────────────────
build_prequal() {
  echo "🔧 Patching PreQual..."
  node -e "
const fs = require('fs');
let src = fs.readFileSync('src/PreQual_Solar_api.jsx', 'utf8');

// Fix intro string if broken (unterminated string literal guard)
src = src.replace(
  /const intro = 'Factura procesada[\s\S]*?ayuda';/,
  \"const intro = 'Factura procesada. Veo la siguiente información. Revísala contra tu factura y marca el checkbox de cualquier cantidad que quieras corregir.\\\\n\\\\n• Si leí todo correctamente, escribe: listo\\\\n• Si necesitas corregir algún campo, márcalo y escribe: corregir\\\\n• Si necesitas ayuda para leer la factura, escribe: ayuda';\"
);

// Apply API patch if mockOCR still present
if (src.includes('mockOCR()')) {
  const lines = src.split('\n');

  // Find the setTimeout line dynamically (don't hardcode line 454)
  let startLine = -1;
  lines.forEach((line, i) => {
    if (line.includes('setTimeout(()=>{') && startLine === -1) startLine = i;
  });

  if (startLine === -1) {
    console.log('❌ Could not find setTimeout block');
    process.exit(1);
  }

  // Find the closing },1500); line
  let endLine = -1;
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes('},1500);')) { endLine = i; break; }
  }

  if (endLine === -1) {
    console.log('❌ Could not find end of setTimeout block');
    process.exit(1);
  }

  console.log('Replacing lines ' + (startLine+1) + '-' + (endLine+1));

  const apiBlock = \`    const _fd = new FormData();
    _fd.append('bill', file);
    fetch('/api/ocr', { method: 'POST', body: _fd })
      .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) }))
      .then(({ data: ocr }) => {
        const norm = normalizeAddress(ocr.address || '');
        const mun  = extractMunicipio(norm);
        const newData = {
          ocr,
          address_pending:       norm,
          municipio_pending:     mun || ocr.municipio,
          luma_total_pending:    ocr.total_adeudado,
          tarifa_pending:        ocr.tarifa,
          demanda_pending:       ocr.demanda_contratada,
          cargo_cliente_pending: ocr.cargo_cliente,
          cargo_demanda_pending: ocr.cargo_demanda,
          exceso_kva_pending:    ocr.exceso_demanda_kva,
          exceso_usd_pending:    ocr.exceso_demanda_usd,
          consumo_pending:       ocr.consumo_promedio,
          costo_kwh_pending:     ocr.costo_kwh,
        };
        setData(newData);
        const intro = 'Factura procesada. Veo la siguiente información. Revísala contra tu factura y marca el checkbox de cualquier cantidad que quieras corregir.\\\\n\\\\n• Si leí todo correctamente, escribe: listo\\\\n• Si necesitas corregir algún campo, márcalo y escribe: corregir\\\\n• Si necesitas ayuda para leer la factura, escribe: ayuda';
        say(intro, '7.3.a');
        say('__OCR_REVIEW__', '7.3.a', { type:'ocr_review', ocrData: newData });
        setStep('7.3.a');
        setLoading(false);
      })
      .catch(err => {
        say('❌ Error al leer la factura: ' + err.message, 'BILL_UPLOAD');
        setStep('START');
        setLoading(false);
      });\`;

  const before = lines.slice(0, startLine);
  const after   = lines.slice(endLine + 1);
  src = [...before, apiBlock, ...after].join('\n');
  console.log('✅ API patch applied');
} else {
  console.log('✅ PreQual already patched — skipping mock replacement');
}

fs.writeFileSync('src/PreQual_Solar_api.jsx', src);
console.log('   mockOCR present:', src.includes('mockOCR()'));
console.log('   fetch /api/ocr:', src.includes('/api/ocr'));
"

  echo "📦 Building PreQual bundle..."
  npx esbuild src/prequal_main.jsx \
    --bundle \
    --outfile=public/prequal_bundle.js \
    --platform=browser \
    --target=es2020 \
    --loader:.jsx=jsx \
    --jsx=automatic \
    --define:process.env.NODE_ENV='"production"'
  echo "✅ PreQual bundle built → public/prequal_bundle.js"
}

# ─── BUILD DEAL ───────────────────────────────────────────────────────────────
build_deal() {
  if [ ! -f "src/DealSection_api.jsx" ]; then
    echo "⚠️  src/DealSection_api.jsx not found — skipping Deal build"
    return
  fi
  if [ ! -f "src/deal_main.jsx" ]; then
    echo "⚠️  src/deal_main.jsx not found — skipping Deal build"
    return
  fi
  echo "📦 Building Deal bundle..."
  npx esbuild src/deal_main.jsx \
    --bundle \
    --outfile=public/deal_bundle.js \
    --platform=browser \
    --target=es2020 \
    --loader:.jsx=jsx \
    --define:process.env.NODE_ENV='"production"'
  echo "✅ Deal bundle built → public/deal_bundle.js"
}

# ─── RUN ──────────────────────────────────────────────────────────────────────
if [ "$TARGET" = "prequal" ]; then
  build_prequal
elif [ "$TARGET" = "deal" ]; then
  build_deal
else
  build_prequal
  build_deal
fi

echo ""
echo "🚀 Starting server..."
node server.js
