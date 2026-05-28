const esbuild = require('esbuild');
const fs      = require('fs');
const path    = require('path');

async function build() {
  // Ensure public/ exists
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  // Cache-bust suffix: epoch seconds, changes on every build
  const v = Math.floor(Date.now() / 1000);

  // Bundle React app
  await esbuild.build({
    entryPoints: ['src/prequal_main.jsx'],
    bundle:      true,
    outfile:     'public/prequal.bundle.js',
    platform:    'browser',
    target:      'es2020',
    loader:      { '.jsx': 'jsx' },
    jsx:         'automatic',
    define:      { 'process.env.NODE_ENV': '"production"' },
    minify:      true,
  });

  // Write HTML shell with cache-busting query string on the bundle
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Windmar — Estimado Solar</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #EBF1FF; font-family: 'Segoe UI', system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // Injected at request time by server.js — placeholder is replaced
    // with 'true' (dev) or 'false' (prod). Read by src/testMode.js.
    window.__TEST_MODE__ = '__TEST_MODE__';
  </script>
  <script src="/prequal.bundle.js?v=${v}"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(publicDir, 'prequal.html'), html);
  console.log('✅ Build complete.');
  console.log('   Bundle  → public/prequal.bundle.js');
  console.log('   HTML    → public/prequal.html');
}

build().catch((err) => { console.error('Build failed:', err); process.exit(1); });
