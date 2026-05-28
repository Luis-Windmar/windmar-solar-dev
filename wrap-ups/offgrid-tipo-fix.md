# Off-Grid Follow-up — Pass `Tipo` Through to Zoho `Lead_Notes`

**Date:** 2026-05-28
**Source prompt:** `prompts/prompt-offgrid-tipo-fix.md`
**Outcome:** Two-line change to `server.js`. `parseLeadNotes` now extracts a `Tipo:` segment, and `createZohoLead`'s `condensedNotes` array appends it when present. Off-grid leads will now carry the `Tipo: Sistema Autónomo (off-grid)` tag into Zoho's `Lead_Notes` field; normal solar leads are unaffected.

---

## 1. Exact lines added

### `server.js` — `parseLeadNotes` return object

```diff
     consultor:      extract(/Consultor en Estimado:\s*([^|]+)/),
     consultorEmail: extract(/Estimado Rep-email:\s*([^|]+)/),
+    tipo:           extract(/Tipo:\s*([^|]+)/),
   };
 };
```

### `server.js` — `createZohoLead`'s `condensedNotes` assembly

```diff
   const condensedNotes = [
     p.cobertura      ? `Cobertura Estimada: ${p.cobertura}%`           : null,
     p.costo          ? `Costo de energia promedio estimado: ${p.costo}` : null,
     p.consultor      ? `Consultor en Estimado: ${p.consultor}`          : null,
     p.consultorEmail ? `Estimado Rep-email: ${p.consultorEmail}`        : null,
+    p.tipo           ? `Tipo: ${p.tipo.trim()}`                         : null,
   ].filter(Boolean).join(' | ') || null;
```

That's the entire change. Used `p.tipo` (object-key access) for consistency with the other entries; the prompt's pseudocode used a local `const tipo`, but the rest of the file reads from the object so `p.tipo` matches the surrounding style.

---

## 2. Verification

### `node -c server.js`

```
$ node -c server.js && echo exit=$?
exit=0
```

Syntax-clean.

### Behavioural check (inline copy of the modified functions)

```
$ node -e "<inline parseLeadNotes + condensedNotes assembly>"
OFF-GRID: Consultor en Estimado: Juan Pérez | Tipo: Sistema Autónomo (off-grid)
SOLAR:    Cobertura Estimada: 95% | Costo de energia promedio estimado: 0.28 | Consultor en Estimado: Juan | Estimado Rep-email: juan@windmar.com
```

- **Off-grid input** (the notes string OffGridScreen produces): the new `Tipo: Sistema Autónomo (off-grid)` segment is now preserved in `condensedNotes`, alongside the consultor name. Previously this string was reduced to just `Consultor en Estimado: Juan Pérez`.
- **Normal solar input** (sample ThankYouScreen notes string with no `Tipo:` segment): the regex returns `null`, the new array entry is filtered out, output is identical to before. **Zero impact on existing solar leads.**

---

## 3. What was NOT changed

- No UI changes — `src/OffGridScreen.jsx`, `src/WelcomeScreen.jsx`, `src/ThankYouScreen.jsx` all untouched.
- No test changes — the sizing test suite covers `src/sizing/*.js` only; `server.js` isn't unit-tested. The prompt explicitly forbade test changes.
- No bundle rebuild needed — `server.js` is not part of the esbuild bundle, so `public/prequal.bundle.js` and `public/prequal.html` are unchanged.

---

## 4. Status

Committing + pushing per the standing memory.
