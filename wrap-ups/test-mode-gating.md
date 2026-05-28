# Production Deployment Setup — TEST_MODE Gating + Railway Retirement

**Date:** 2026-05-28
**Source prompt:** `prompts/prompt-test-mode-gating.md`
**Outcome:** `TEST_MODE` env var now gates every test artifact in the dev codebase. Default is `true` (development); set `TEST_MODE=false` in Vercel prod env vars to flip the wizard to production behaviour. `promote_to_prod.sh` updated with pre-flight build + the new Vercel-rather-than-Railway target. **Blocker for the developer:** the `windmar/` directory's git remote points at the wrong repo — must be re-pointed before any prod push.

---

## 1. Pre-flight inventory

| File | Line | Test artifact | What it does |
|---|---|---|---|
| `src/WelcomeScreen.jsx` | 219 | `useState(true)` for `generateLead` | Demo toggle state. When `true`, ContactScreen calls `/api/leads` for local lead persistence and ThankYouScreen runs the Zoho lead-creation effect. When `false`, both are skipped (PDF still generated for download). |
| `src/WelcomeScreen.jsx` | 408–423 | "Generar lead SI/NO" pill button | UI control to flip `generateLead` state. Bottom of WelcomeScreen, dev-only. |
| `src/ContactScreen.jsx` | 106 | `useState("TEST - ")` for `nombre` | Prefills the customer-name field so reps can identify demo records. |
| `src/ContactScreen.jsx` | 109 | `useState("TEST - ")` for `consultorNombre` | Same as above, for the consultor name. |
| `src/UploadScreen.jsx` | 285 | `"TEST - " + data.nombre_negocio` in `normalizeOCR()` | Prefixes every real OCR-extracted business name with `TEST - `. |
| `src/UploadScreen.jsx` | 286 | `"TEST - " + data.direccion` in `normalizeOCR()` | Same, for the OCR-extracted address. |
| `src/UploadScreen.jsx` | 311–321 | `MOCK_OCR` constant | Hardcoded mock OCR payload (with TEST- prefixes baked in) — fed into `handleMockOCR`. |
| `src/UploadScreen.jsx` | 473–475 | `handleMockOCR` function | Skips OCR entirely and injects `MOCK_OCR` into the review-card state. |
| `src/UploadScreen.jsx` | 578–585 | "usar datos de prueba" link | Button that calls `handleMockOCR`. Underlined grey link below "Atrás". |
| `src/OffGridScreen.jsx` | — | (none) | No test artifacts present; this screen was created clean. |

---

## 2. Files changed (one-line each)

| File | Change |
|---|---|
| `server.js` | Added `TEST_MODE` constant at top; added it to startup banner; rewrote `/prequal` route to read `public/prequal.html`, replace `__TEST_MODE__` placeholder with `'true'`/`'false'`, and send the result. |
| `build.js` | Added a `<script>window.__TEST_MODE__ = '__TEST_MODE__';</script>` block to the HTML template ahead of the bundle `<script>`. |
| `src/testMode.js` | NEW — exports `TEST_MODE` boolean read from `window.__TEST_MODE__`. Defaults to `true` (development) when the value is anything other than the literal string `'false'`. |
| `src/WelcomeScreen.jsx` | Imported `TEST_MODE`; wrapped the "Generar lead SI/NO" demo pill in `{TEST_MODE && (...)}`. |
| `src/ContactScreen.jsx` | Imported `TEST_MODE`; `nombre` and `consultorNombre` defaults are now `TEST_MODE ? "TEST - " : ""`. |
| `src/UploadScreen.jsx` | Imported `TEST_MODE`; `normalizeOCR()` now uses `const prefix = TEST_MODE ? "TEST - " : "";` and applies it conditionally. The "usar datos de prueba" link is wrapped in `{TEST_MODE && (...)}`. `MOCK_OCR` and `handleMockOCR` are left intact (unreachable in prod via the gated button). |
| `promote_to_prod.sh` (parent dir) | Rewritten to add a pre-flight `bash patch_and_build.sh` step and a new prod-target note (Vercel env vars + Vercel prod URL placeholder). Executable bit preserved. |

---

## 3. Injection pattern (document for future sessions)

There was no pre-existing `__PLACEHOLDER__` injection pattern in this codebase, so the prompt's described pattern was implemented from scratch:

### Where the placeholder lives

`build.js` writes this `<script>` block into `public/prequal.html` ahead of the bundle:

```html
<script>
  window.__TEST_MODE__ = '__TEST_MODE__';
</script>
<script src="/prequal.bundle.js?v=${v}"></script>
```

### Where the placeholder gets substituted

`server.js`'s `/prequal` route reads the HTML at request time and replaces the literal placeholder:

```js
app.get('/prequal', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'prequal.html');
  const html = fs.readFileSync(htmlPath, 'utf8')
    .replace('__TEST_MODE__', TEST_MODE ? 'true' : 'false');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
```

Each request re-reads the file. This is fine for low traffic; if hot-path latency ever matters, cache the read at module-init.

### Where the client reads it

`src/testMode.js`:

```js
export const TEST_MODE =
  typeof window !== 'undefined' && window.__TEST_MODE__ !== 'false';
```

The "anything other than `'false'` → `true`" semantics mean:
- Missing placeholder (e.g. running against a static-file fallthrough) → `true`
- Literal `'__TEST_MODE__'` placeholder that never got replaced → `true`
- Explicit `'false'` after substitution → `false` (production)

### Adding a future injected var

1. `server.js`: declare the constant at top, add another `.replace('__FOO__', ...)` to the `/prequal` route.
2. `build.js`: add the placeholder line to the HTML template inside the same `<script>` block.
3. `src/testMode.js` (or a new module): export it for the React app.

---

## 4. `windmar/` git remote — BLOCKER

Running `git -C ~/Desktop/IQ_Claude/PreQual_Deal/windmar remote -v` reports:

```
origin  https://github.com/Luis-Windmar/windmar-solar.git (fetch)
origin  https://github.com/Luis-Windmar/windmar-solar.git (push)
```

Expected:

```
origin  https://github.com/Windmar-Home/windmar-commercial-estimator-prod (fetch)
origin  https://github.com/Windmar-Home/windmar-commercial-estimator-prod (push)
```

**Per the prompt's Step 5: I have not run `promote_to_prod.sh`.** The developer must fix the remote before running it. See manual checklist below.

---

## 5. Build + test verification

```
$ bash patch_and_build.sh
→ Running static analysis...
✅ Static analysis passed.
Building PreQual...
✅ Build complete.
   Bundle  → public/prequal.bundle.js
   HTML    → public/prequal.html
Build complete. public/ is ready.
```

```
$ node --test src/sizing/*.test.js
ℹ tests 40
ℹ pass 40
ℹ fail 0
```

```
$ grep "__TEST_MODE__" public/prequal.html
    window.__TEST_MODE__ = '__TEST_MODE__';
```

Placeholder present in the built HTML, ready for substitution at request time.

```
$ node -c server.js
ok
```

(Server can't be runtime-smoke-tested without spinning up the express app; the banner change will appear on `node server.js` startup as e.g. `TEST_MODE: 🧪 development`.)

---

## 6. Manual developer checklist

These can't be done from code — they need dashboard / shell access. Do them in this order:

### A. Fix the `windmar/` git remote (BLOCKER)

```bash
cd ~/Desktop/IQ_Claude/PreQual_Deal/windmar
git remote set-url origin https://github.com/Windmar-Home/windmar-commercial-estimator-prod.git
git remote -v   # verify both fetch + push now point at the prod repo
```

After this, the `windmar/` working tree may need a `git fetch` + reconciliation depending on whether the histories match the new remote. Inspect before running `promote_to_prod.sh`.

### B. Vercel dev project — add `TEST_MODE=true`

1. Open https://vercel.com/windmar/windmar-commercial-estimator/settings/environment-variables
2. Add a new env var:
   - **Name:** `TEST_MODE`
   - **Value:** `true`
   - **Environments:** Production, Preview, Development (all)
3. Click **Save**.
4. Trigger a redeploy (push any commit or use Deployments → ⋯ → Redeploy on the latest entry — but uncheck "Use existing Build Cache" so the env var picks up).
5. Verify by visiting https://windmar-commercial-estimator.vercel.app/prequal — the "Generar lead SI/NO" toggle should still appear at the bottom of WelcomeScreen, the OCR review card fields should still come back prefixed `TEST - `, and the "usar datos de prueba" link should still be present.

### C. Vercel prod project — add all env vars

Open https://vercel.com/windmar/windmar-commercial-estimator-prod/settings/environment-variables (or wherever the production Vercel project lives — confirm the exact slug under the `windmar` team).

Add the following env vars (Production environment):

| Name | Value | Source |
|---|---|---|
| `TEST_MODE` | `false` | New |
| `TOOLBELT_API_KEY` | (same as windmar_dev) | Copy from `windmar_dev/.env` |
| `ANTHROPIC_API_KEY` | (same as windmar_dev) | Copy from `windmar_dev/.env` |
| `ENCRYPTION_KEY` | (same as windmar_dev) | Copy from `windmar_dev/.env` |
| `ZOHO_WRITE_CLIENT_ID` | (same) | Copy |
| `ZOHO_WRITE_CLIENT_SECRET` | (same) | Copy |
| `ZOHO_WRITE_REFRESH_TOKEN` | (same) | Copy |
| `ZOHO_READ_CLIENT_ID` | (same) | Copy |
| `ZOHO_READ_CLIENT_SECRET` | (same) | Copy |
| `ZOHO_READ_REFRESH_TOKEN` | (same) | Copy |
| `ZOHO_OWNER_USER_ID` | (same) | Copy |

Then confirm under **Settings → Git**:
- Repository is `Windmar-Home/windmar-commercial-estimator-prod`
- Production branch is `main`

### D. First prod push

After (A), (B), (C) are done:

```bash
cd ~/Desktop/IQ_Claude/PreQual_Deal
./promote_to_prod.sh "Initial cutover from Railway: TEST_MODE gating + Vercel prod"
```

Watch Vercel's prod-project Deployments tab for the build. Once it goes `● Ready`, visit the prod URL and verify:

- **Welcome:** "Generar lead SI/NO" pill is NOT present.
- **Upload review card:** OCR-extracted business name + address show WITHOUT the `TEST - ` prefix; "usar datos de prueba" link is NOT present.
- **Contact:** "Nombre completo" and "¿Quién es tu consultor?" fields default to empty (no `TEST - ` prefill).
- **server logs (Vercel function logs):** banner shows `TEST_MODE: 🚀 production`.

### E. Railway retirement (only after D is verified)

1. Railway dashboard → `windmar-solar-production` project.
2. Confirm no traffic is hitting it (Vercel prod URL is the new authoritative endpoint).
3. **Pause** the service first (not delete), to leave a rollback path for ~1 week.
4. Once you're confident the Vercel prod URL is stable, delete the Railway service to stop billing.
5. Update CLAUDE.md's "Deployed at" line to point to the Vercel prod URL (if different from the dev URL).

---

## 7. Files NOT touched (per the prompt)

- All business logic, API endpoints, Zoho mapping, sizing module, sizing tests — untouched.
- `MOCK_OCR` constant and `handleMockOCR` function body — untouched; the button that calls them is gated, but the implementations remain for dev use.
- `src/sizing/*.test.js` — 40/40 still pass.

---

## 8. Status

Committing + pushing the code changes per the standing memory. The `promote_to_prod.sh` change is in a parent directory outside the windmar_dev repo so it won't auto-commit; that file is a local developer tool — the developer can decide separately whether to version-control it (e.g. in a meta-repo).
