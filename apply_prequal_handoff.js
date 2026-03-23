// apply_prequal_handoff.js
// Inserts a useEffect into Cuestionario_Solar_INTEGRATED.jsx that:
//   1. Reads ?d= from the URL on mount
//   2. POSTs to /api/decrypt to get the full PreQual session JSON
//   3. Merges it into sessionData so the debug panel shows it
//
// Run from project root:  node apply_prequal_handoff.js

const fs = require('fs');

const FILE = 'Cuestionario_Solar_INTEGRATED.jsx';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' Windmar Deal Section — apply PreQual handoff patch');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let src = fs.readFileSync(FILE, 'utf8');

// ── Guard: don't apply twice ──────────────────────────────────────────────────
if (src.includes('api/decrypt')) {
  console.log('✓ Handoff patch already present — nothing to do.\n');
  process.exit(0);
}

// ── The new useEffect to insert ───────────────────────────────────────────────
const NEW_EFFECT = `
  // ── PreQual handoff: decrypt ?d= token on mount ──────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('d');
    if (!token) return;                         // no handoff data — fresh start

    fetch('/api/decrypt', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token })
    })
      .then(r => r.json())
      .then(result => {
        if (!result.success) {
          console.warn('Deal Section: decrypt failed', result.error);
          return;
        }
        // Merge PreQual data into sessionData — visible in debug panel
        setSessionData(prev => ({ ...prev, ...result.data, _from_prequal: true }));
        console.log('Deal Section: PreQual data loaded', result.data);
      })
      .catch(err => console.error('Deal Section: decrypt error', err));
  }, []);
  // ── end PreQual handoff ───────────────────────────────────────────────────

`;

// ── Insert just before the first existing useEffect ───────────────────────────
const ANCHOR = `  useEffect(() => {
    if (messages.length === 0) {`;

if (!src.includes(ANCHOR)) {
  console.error('✗ Could not find insertion point. Has the file changed?\n');
  process.exit(1);
}

src = src.replace(ANCHOR, NEW_EFFECT + ANCHOR);

fs.writeFileSync(FILE, src);

console.log('✓ PreQual handoff useEffect inserted successfully.');
console.log('\nNext steps:');
console.log('  1. cp Cuestionario_Solar_INTEGRATED.jsx src/DealSection_api.jsx');
console.log('  2. ./patch_and_build.sh deal');
console.log('  3. Open the PreQual handoff URL in your browser');
console.log('  4. Enter test mode — you should see PreQual data in the debug panel\n');
