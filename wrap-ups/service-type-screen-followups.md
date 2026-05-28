# Service-Type Screen — Follow-up Fixes

**Date:** 2026-05-28
**Trigger:** Live-deploy testing of the service-type screen (commit `5111331` from the prior `service-type-screen.md` wrap-up). Three issues surfaced; all fixed in this pass.

---

## 1. Vercel webhook didn't fire on `5111331`

**Symptom:** After pushing `5111331` (the service-type screen feature commit), the live URL still showed the previous version. The Vercel **Deployments** tab's most-recent entry was `4d3c7c0` from 14h earlier — `5111331` was missing entirely.

**Investigation:**
- `git ls-remote origin main` confirmed `5111331` was on GitHub.
- `npx vercel project ls --scope windmar` confirmed `windmar-commercial-estimator` is the right project, last production deploy 14h old.
- `npx vercel project inspect` didn't show a Git section — I incorrectly concluded auto-deploy wasn't wired up at all. **The screenshot of the Deployments tab corrected that** — earlier commits like `4d3c7c0`, `6f7c593`, `05613cf` all show up in the list with their main-branch SHAs, so Git auto-deploy IS connected. The webhook just silently skipped `5111331`.
- Vercel's "Redeploy" button doesn't pull fresh code from GitHub — it re-builds the *same commit source* with the latest project settings. So redeploying any old row would never ship `5111331`.

**Fix:** Pushed an empty commit (`bb6fe12`) to force a fresh webhook event. That triggered a build and shipped `5111331`'s code.

**Likely root cause:** Transient GitHub webhook delivery failure or a Vercel debounce on rapid back-to-back pushes (`4d3c7c0` → `5111331` were minutes apart). Webhook has been firing cleanly on subsequent pushes (`2af071b`, `c70bd46`). No code/config change needed unless it recurs.

---

## 2. Service-type icons rendering as broken-image placeholders

**Symptom:** Live deploy of `5111331` showed broken-image `?` placeholders in all four `ServiceTypeScreen` cards. The `alt` attributes ("480V 3 fases", etc.) were visible as fallback text.

**Root cause:** The 4 PNG files (`480V_outlet_icon.png`, `208V_outlet_icon.png`, `240V_outlet_icon.png`, `no_lo_se_icon.png`) existed in `./public/` locally but were never `git add`-ed — they sat in the untracked list across multiple commits. The Vercel build had no icon files to serve at those URLs.

```
$ git ls-tree -r HEAD --name-only | grep -i "outlet\|no_lo_se"
(empty)
```

**Fix in `2af071b`:** Staged and committed all 4 PNGs.

---

## 3. "No estoy seguro" rendered at split pitch

**Symptom:** The no_se card showed "No estoy" in 16px bold (matching the voltage cards' main label) and "seguro" below it in 14px (matching their sub-label). User feedback: the whole phrase should be one pitch — there's no natural primary/secondary hierarchy for "No estoy seguro" the way "480V / 3 fases" has.

**Fix in `2af071b`:** Restructured the `OPTIONS` array in `src/ServiceTypeScreen.jsx` from `{ line1, line2 }` to `{ label, sub }` where `sub` is optional:

```js
const OPTIONS = [
  { key: "trifasico_480", img: "...", label: "480V", sub: "3 fases" },
  { key: "trifasico_208", img: "...", label: "208V", sub: "3 fases" },
  { key: "bifasico_240",  img: "...", label: "240V", sub: "2 fases" },
  { key: "no_se",         img: "...", label: "No estoy seguro" },  // no sub
];
```

JSX renders `sub` conditionally:

```jsx
<div style={S.cardLabel}>{label}</div>
{sub && <div style={S.cardSub}>{sub}</div>}
```

Voltage cards keep their two-line hierarchy. The no_se card now shows just "No estoy seguro" at the 16px bold `cardLabel` style, wrapping naturally inside the card.

---

## 4. All-errors battery banner firing at slider 0

**Symptom:** On a Primaria bill with `serviceType: trifasico_208`, every battery position errored (capacity_exceeded_kwh or similar). The red banner "La capacidad máxima de almacenamiento disponible no cubre las horas de respaldo seleccionadas" was firing even though the slider was at 0 — i.e., the rep hadn't requested any backup hours, so the alarm was misleading.

User's spec: *"The message should only fire if the slider moves > 0 and there is no product available."*

**Fix in `c70bd46`:** Two changes to `src/EstimateScreen.jsx`:

1. **Gated the banner on `localBatteryHours > 0`** — matches the existing gate on the per-position error message in the cascade below it.

   ```jsx
   // Before:
   ) : allBatteryErrored ? (
   // After:
   ) : allBatteryErrored && localBatteryHours > 0 ? (
   ```

2. **Removed `allBatteryErrored` from the slider's `disabled` condition.** Without this, the slider would be locked at 0 in the all-errors case — and the new gate would render the banner unreachable. Now the rep can drag past 0 and the message appears; back to 0 and it disappears.

   ```jsx
   // Before:
   disabled={batteryCacheLoading || allBatteryErrored}
   style={{ ..., cursor: (batteryCacheLoading || allBatteryErrored) ? "not-allowed" : "pointer" }}
   // After:
   disabled={batteryCacheLoading}
   style={{ ..., cursor: batteryCacheLoading ? "not-allowed" : "pointer" }}
   ```

**Behavior matrix after the fix:**

| Slider | Battery state | Message |
|---|---|---|
| 0 | any | none |
| > 0 | all positions errored, same code | per-code shared message |
| > 0 | all positions errored, mixed codes | "Estimado de baterías no disponible en este momento." |
| > 0 | this position errored, others vary | per-position message |
| > 0 | this position OK | cap_applied warning if any, plus the no_se tariff-default qualifier if no_se |

---

## 5. Commits in this batch

| SHA | Description |
|---|---|
| `bb6fe12` | Empty commit — force Vercel webhook to fire after it silently skipped `5111331` |
| `2af071b` | Commit missing icon PNGs (4 files) + unify "No estoy seguro" pitch |
| `c70bd46` | Gate all-errors battery banner on slider > 0; remove `allBatteryErrored` from slider disabled |

All pushed to `origin/main`. Live deploys confirmed working by the user after each.

---

## 6. Build / test status

- `bash patch_and_build.sh` → clean (ESLint `no-undef` + esbuild both green) on each commit.
- `node --test src/sizing/*.test.js` → 40/40 still pass (no test surface touched).

---

## 7. Open follow-ups (none from this session)

No new backlog items. Both ServiceTypeScreen typography and the EstimateScreen banner are now matching the spec as the rep tests it live.
