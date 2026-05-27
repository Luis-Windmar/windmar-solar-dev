# Backlog Item 10 — Static Analysis Pre-Deploy

**Date:** 2026-05-27
**Source prompt:** `prompts/prompt-static-analysis-setup.md`
**Outcome:** ESLint with `no-undef` wired into `patch_and_build.sh`. Build now fails fast on unresolved identifiers — the exact class of bug that bit us in Step 3. Backlog item 10 closed.

---

## 1. Option chosen and why

**Option B — ESLint with `no-undef`.**

Tried Option A first per prompt order. Installed TypeScript, dropped the suggested `tsconfig.json` in. Three problems made it untenable:

1. The prompt's `tsconfig.json` uses `"moduleResolution": "node"` — alias for the deprecated `node10`. TS 5.x errors hard on that with a deprecation message. Switched to `"node16"`.
2. `tsc` with `node16` + `allowJs/checkJs` produced **~330 errors** on the current `src/`. Most were noise outside the bug class we care about:
   - `Cannot find name 'process' / 'Buffer' / '__dirname'` — needs `@types/node` (server-side files weren't supposed to be in scope but `tsc` followed them anyway).
   - `This JSX tag requires 'React' to be in scope` — needs `"jsx": "react-jsx"` rather than `"react"`, plus React type defs.
   - Sizing-module strict object-shape errors (`Property 'roof_kw_cap' is missing` against the `tariff.js` JSDoc type) — these are legitimate type narrowings we'd have to fix or suppress.
3. Per the prompt: *"If it produces more than ~5 errors that require real fixes, consider option B instead."* 330 ≫ 5, and only the `TS2304 Cannot find name` subset matches the Step 3 bug class. ESLint's `no-undef` is the targeted equivalent.

Cleaned up: removed `tsconfig.json`, uninstalled TypeScript.

## 2. Real errors found on the current codebase

**Zero.** `npx eslint src/` exits clean on the post-Step-3 source. (One transient noise issue: the inline `// eslint-disable-line react-hooks/exhaustive-deps` directive at `src/ThankYouScreen.jsx:234` referenced a rule ESLint didn't know about — fixed by installing `eslint-plugin-react-hooks` and registering it in the config. The rule itself is not enabled; the plugin is only there so the directive resolves.)

## 3. Config files added / changed

### `eslint.config.js` (new — flat config; ESLint 10 requires it)

```js
const js = require("@eslint/js");
const globals = require("globals");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = [
  {
    ignores: [
      "src/PreQual_Solar_api.jsx",
      "src/DealSection_api.jsx",
      "src/createZohoLead.js",
      "src/parsing_function.js",
      "public/**",
      "node_modules/**",
    ],
  },
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "no-undef": "error",
    },
  },
];
```

**Deviations from the prompt's suggested config**, and why:
- **Flat config (`eslint.config.js`)** instead of `.eslintrc.json`. ESLint 10 dropped legacy `.eslintrc.*` support — flat is now the only supported format.
- **`createZohoLead.js` and `parsing_function.js` added to ignores.** These files in `src/` are markdown-formatted code snippets / documentation, not real modules. `grep -rn "createZohoLead\|parsing_function" src/ server.js build.js` confirmed nothing imports them; the real `createZohoLead` is defined inline in `server.js:455`. Without exclusion they produce 26 spurious syntax errors. Recommend deleting these two files in a future cleanup pass — they predate the migration.
- **`react-hooks` plugin loaded but unused.** Solely to register the rule namespace so the inline disable directive in `ThankYouScreen.jsx:234` doesn't crash ESLint with `Definition for rule … was not found`.
- **`reportUnusedDisableDirectives: "off"`.** ESLint 10 defaults this to `warn`. Three existing disable directives in `EstimateScreen.jsx` (lines 488, 498, 596) referenced rules not in our config — flipping this to `off` keeps the check focused on `no-undef` only.

### `package.json` devDependencies added

`eslint`, `@eslint/js`, `globals`, `eslint-plugin-react-hooks`.

### `patch_and_build.sh` — exact lines added

```bash
echo "→ Running static analysis..."
npx eslint src/
if [ $? -ne 0 ]; then
  echo "❌ Static analysis failed. Fix errors before deploying."
  exit 1
fi
echo "✅ Static analysis passed."
```

Inserted between the opening `set -e` / banner and the `node build.js` invocation.

> Note: `set -e` already makes the script exit on the failing `npx eslint`
> command, so the `if [ $? -ne 0 ]` block is belt-and-suspenders. Kept verbatim
> from the prompt for clarity in CI logs.

## 4. End-to-end build confirmation

```
$ bash patch_and_build.sh
→ Running static analysis...
✅ Static analysis passed.
Building PreQual...
✅ Build complete.
   Bundle  → public/prequal.bundle.js
   HTML    → public/prequal.html
Build complete. public/ is ready.

To deploy to Vercel: vercel --prod

exit=0
```

Sizing tests still pass:
```
$ node --test src/sizing/*.test.js
ℹ tests 35
ℹ pass 35
ℹ fail 0
```

## 5. Smoke test — deliberate unresolved identifier

Inserted into `src/EstimateScreen.jsx` line 7:
```js
const __ESLINT_SMOKE_TEST = thisIdentifierDoesNotExist;
```

Then `bash patch_and_build.sh`:
```
→ Running static analysis...

…/src/EstimateScreen.jsx
  7:29  error  'thisIdentifierDoesNotExist' is not defined  no-undef

✖ 1 problem (1 error, 0 warnings)

real exit=1
```

`build.js` was never reached, exit code is 1, and the unbundled output was not overwritten. Confirmed the exact Step 3 bug class (a missing destructured import named `normalizeLumaTariff`) would be caught the same way.

Smoke-test edit reverted; final `bash patch_and_build.sh` exits 0 with a green bundle.

## 6. Backlog status

Item 10 → closed. `docs/backlog.md` updated with resolution notes pointing at this wrap-up.

Open items now: **#3** (Zoho field mapping audit), **#14** (financing eligibility multi-factor).

## 7. Files touched

| File | Change |
|---|---|
| `package.json` | `eslint`, `@eslint/js`, `globals`, `eslint-plugin-react-hooks` added to devDependencies. |
| `package-lock.json` | Generated by npm. |
| `eslint.config.js` | New — flat-config ESLint setup. |
| `patch_and_build.sh` | 5 lines added before the build step. |
| `docs/backlog.md` | Item 10 marked resolved. |

No source-file changes, no API changes, no logic changes. esbuild bundle output unchanged.

## 8. Status

Committing + pushing per the standing memory.
