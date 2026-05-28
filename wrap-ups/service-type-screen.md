# Item 15 — Service Type Selector Screen

**Date:** 2026-05-28
**Source prompt:** `prompts/prompt-service-type-screen.md`
**Outcome:** New `ServiceTypeScreen.jsx` slots in between RoofScreen and EstimateScreen as step 4 of 6. Welcome dropdown is gone. `resolveVoltagePhases` rewritten as a two-argument function with tariff-based smart defaults for `no_se`. EstimateScreen battery-batch call site and the `no_se` qualifier copy below the slider both updated. Backlog item 15 closed.

---

## 1. Pre-flight note

- **`serviceType` state in WelcomeScreen** lived at `src/WelcomeScreen.jsx:208` as `useState("no_se")`, rendered as a `<select>` dropdown (lines 367–377), and threaded through `handleRestart` for reset.
- **Flow into `ocrData`:** WelcomeScreen merged `serviceType` into `ocrData` inside `UploadScreen`'s `onNext` callback (line 269) — `setOcrData({ ...data, serviceType })`. After this change `serviceType` is *not* part of `ocrData` until the user reaches the new screen after Roof.
- **RoofScreen `onNext` signature:** `onNext(effectiveSqft)` — a single number argument. The new screen mirrors that shape: `onNext(serviceType)` — a single string.

---

## 2. Files created and modified

### Created
- `src/ServiceTypeScreen.jsx` — new screen, modeled on `RoofScreen.jsx`. 4 cards in a 2×2 grid, no text input, navy "Continuar →" CTA disabled until a card is selected, ghost "Atrás" button.

### Modified
- `src/sizing/tariff.js` — `resolveVoltagePhases` now takes `(serviceType, tariff)`. Explicit selections (`bifasico_240` / `trifasico_208` / `trifasico_480`) always win. `no_se` (or any other value) routes through `normalizeLumaTariff(tariff)` to pick a default.
- `src/sizing/tariff.test.js` — 5 new tests appended (tests 8–12). The existing 7 single-arg tests pass unchanged.
- `src/WelcomeScreen.jsx` —
  - `import ServiceTypeScreen from "./ServiceTypeScreen.jsx";`
  - removed `serviceType` state + `setServiceType` reset in `handleRestart`
  - removed the entire `<select>` dropdown (label + options) for service type
  - changed UploadScreen `onNext` from `setOcrData({ ...data, serviceType })` to `setOcrData(data)` — the new screen sets it later
  - changed RoofScreen `onNext` from `setScreen("estimate")` to `setScreen("serviceType")`
  - added new `screen === "serviceType"` branch rendering `<ServiceTypeScreen>` with `onNext(selectedServiceType) → setOcrData(prev => ({ ...prev, serviceType: selectedServiceType })); setScreen("estimate")`
  - EstimateScreen's `onBack` now goes to `"serviceType"` instead of `"roof"` (so the back chain stays consistent)
  - screen-states comment in the `useState` updated to include `serviceType`
- `src/EstimateScreen.jsx` —
  - battery-batch call site: `resolveVoltagePhases(ocrData?.serviceType ?? 'no_se', ocrData?.tariff)`
  - `no_se` qualifier copy below the battery slider now reads the smart default dynamically:
    ```jsx
    const { voltage: dv, phases: dp } = resolveVoltagePhases('no_se', ocrData?.tariff);
    const defaultLabel = dv === 480 ? '480V / 3 fases'
                       : dv === 208 ? '208V / 3 fases'
                       : '240V / 2 fases';
    // → "Batería seleccionada basada en la tarifa (480V / 3 fases)."
    ```
- `src/ContactScreen.jsx` — `ProgressBar current={5}` → `current={6}` (was already at 5 of 6; with ServiceType taking slot 4, Contact moves to slot 6).

---

## 3. Icon location

Per the standing instruction for this session, the four icon PNGs live directly in `./public/` (not in `./public/icons/`). Referenced in JSX as:

```jsx
<img src="/480V_outlet_icon.png" .../>
<img src="/208V_outlet_icon.png" .../>
<img src="/240V_outlet_icon.png" .../>
<img src="/no_lo_se_icon.png" .../>
```

Confirmed present:

```
$ ls public/*outlet_icon.png public/no_lo_se_icon.png
public/208V_outlet_icon.png
public/240V_outlet_icon.png
public/480V_outlet_icon.png
public/no_lo_se_icon.png
```

---

## 4. Old WelcomeScreen dropdown removed

```
$ grep -n "serviceType.*dropdown\|select.*serviceType" src/WelcomeScreen.jsx
(empty)
```

Remaining `serviceType` mentions in `WelcomeScreen.jsx` are all the new screen-routing references (screen-name comment, the `"serviceType"` screen branch, `setOcrData(prev => ({ ...prev, serviceType: ... }))`, and the `onBack` from estimate back to the new screen).

---

## 5. Smart defaults applied for `no_se`

| Tariff (LUMA) | Default voltage | Default phases | UI label shown below slider |
|---|---|---|---|
| `primaria` | 480 | 3 | 480V / 3 fases |
| `transmision` | 480 | 3 | 480V / 3 fases |
| `secundaria` | 208 | 3 | 208V / 3 fases |
| `residencial` | 240 | 2 | 240V / 2 fases |
| unknown / null | 240 | 2 | 240V / 2 fases |

Any explicit selection (`bifasico_240`, `trifasico_208`, `trifasico_480`) always overrides the tariff-based default — verified by test 12 (`resolveVoltagePhases('trifasico_480', 'secundaria')` returns `{ voltage: 480, phases: 3 }`).

---

## 6. Unit test results

```
$ node --test src/sizing/caps.test.js src/sizing/tariff.test.js src/sizing/battery.test.js
…
✔ 11. resolveVoltagePhases(no_se, null) → 240V / 2-phase (0.072417ms)
✔ 12. resolveVoltagePhases(trifasico_480, secundaria) → 480V / 3-phase (explicit overrides tariff default) (0.0495ms)
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 262.471209
```

**40/40 pass.** 35 existing + 5 new. All 7 original tariff tests still green — the single-arg signature still resolves correctly because the second positional arg becomes `undefined`, which `normalizeLumaTariff` returns `null` for, which the function maps to the residencial/unknown default (240V / 2-phase).

---

## 7. `patch_and_build.sh` end-to-end

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
```

ESLint `no-undef` passes clean; esbuild bundle generates without warnings.

---

## 8. Progress-bar step counts verified

```
$ grep -n "ProgressBar current" src/{Welcome,Upload,Roof,ServiceType,Estimate,Contact}Screen.jsx
src/WelcomeScreen.jsx:353:    <ProgressBar current={1} total={6} />
src/UploadScreen.jsx:525:    <ProgressBar current={2} total={6} />
src/UploadScreen.jsx:599:    <ProgressBar current={2} total={6} />
src/UploadScreen.jsx:657:    <ProgressBar current={2} total={6} />
src/RoofScreen.jsx:146:     <ProgressBar current={3} total={6} />
src/ServiceTypeScreen.jsx:119: <ProgressBar current={4} total={6} />
src/EstimateScreen.jsx:620: <ProgressBar current={5} total={6} />
src/EstimateScreen.jsx:672: <ProgressBar current={5} total={6} />
src/ContactScreen.jsx:165:  <ProgressBar current={6} total={6} />
```

All six screens line up with the prompt's table.

---

## 9. Status

Committing + pushing per the standing memory.
