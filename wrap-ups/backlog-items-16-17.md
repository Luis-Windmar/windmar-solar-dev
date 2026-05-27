# Backlog Update — Items 16 and 17

**Date:** 2026-05-27
**Source prompt:** `prompts/prompt-backlog-items-16-17.md`
**Scope:** Doc-only — added two new items to `docs/backlog.md`. No source code changes.

---

## 1. Confirmation

Both items added to `docs/backlog.md` after item 14, following the existing item-template structure (heading, background, action, files).

- **Item 16** — Delete `src/createZohoLead.js` and `src/parsing_function.js`. These came up during item 10 (ESLint setup) when they produced 26 spurious syntax errors; they're markdown-formatted snippets, not real modules. `grep -rn` confirmed during item 10 that nothing imports them — the active `createZohoLead` lives in `server.js:455`.
- **Item 17** — Investigate the `// eslint-disable-line react-hooks/exhaustive-deps` directive at `src/ThankYouScreen.jsx:234`. Determine whether the omitted dep is intentional (add explanatory comment) or a stale-closure bug (fix the array).

> No item 15 currently exists in the backlog — items skip from 14 to 16, preserving the prompt's numbering.

---

## 2. Current full backlog item list

| # | Title | Status |
|---|---|---|
| 1 | OCR review card — redundant "Leído" labels | ✅ Closed |
| 2 | OCR review card — audit all field propagation | ✅ Closed |
| 3 | Zoho CRM field mapping audit | 🟡 Open |
| 4 | `/api/health` endpoint removal | ✅ Closed |
| 5 | Dependency cleanup (`@anthropic-ai/sdk` + banner) | ✅ Closed |
| 6 | Battery slider — `$NaN` on price with storage | ✅ Closed (Step 3) |
| 7 | Financing card disappears when battery slider > 0 | ✅ Closed (Step 3) |
| 8 | Stale `CLAUDE.md` "Last updated" header | ✅ Closed |
| 9 | All-errors battery message — per-code copy | ✅ Closed |
| 10 | Add static analysis to catch unresolved identifiers | ✅ Closed |
| 11 | EstimateScreen — slider card height jumps | ✅ Closed |
| 12 | Financing card appears / disappears based on totalCost | ✅ Closed |
| 13 | Stale slider subtitle copy | ✅ Closed |
| 14 | Financing eligibility — multi-factor rule | 🟡 Open |
| 15 | *(reserved / unused)* | — |
| **16** | **Delete `src/createZohoLead.js` and `src/parsing_function.js`** | 🟡 **New — Open** |
| **17** | **Investigate `ThankYouScreen.jsx:234` eslint-disable directive** | 🟡 **New — Open** |

**Totals:** 12 closed, 4 open (3, 14, 16, 17), 1 reserved/unused.

---

## 3. Files touched

| File | Change |
|---|---|
| `docs/backlog.md` | Items 16 and 17 appended after item 14 (~50 lines added). |

No code, no tests, no build artifacts. Committing + pushing per the standing memory.
