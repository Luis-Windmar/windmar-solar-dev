You are working on the Windmar Commercial PreQual Solar Wizard, a mobile-first 
tablet-facing React app for solar sales reps in Puerto Rico.

The app is deployed at: windmar-prequal-dev.up.railway.app
Stack: Node.js / Express backend + React frontend (single-page, no router)
Main file: src/ directory contains the wizard screen components
Build script: ./patch_and_build.sh prequal

CURRENT WIZARD FLOW (all screens complete and working):
Screen 1 - WelcomeScreen
Screen 2 - UploadScreen (OCR of LUMA bill via Anthropic API)
Screen 3 - RoofScreen (4 tappable size cards)
Screen 4 - EstimateScreen (solar-only estimate)
Screen 5 - ContactScreen (submits to Zoho CRM)
Screen 6 - ThankYouScreen

TASK: Add battery storage option to the wizard.

NEW FLOW:
Screen 1 - WelcomeScreen (unchanged)
Screen 2 - UploadScreen (unchanged)
Screen 3 - RoofScreen (unchanged)
Screen 3.5 - NEW: BatteryIntentScreen (between Roof and Estimate)
Screen 4 - EstimateScreen (updated to show solar + optional battery breakdown)
Screen 4.5 - NEW: Battery fine-tune slider on EstimateScreen (inline, not a new screen)
Screen 5 - ContactScreen (unchanged)
Screen 6 - ThankYouScreen (unchanged)

════════════════════════════════════════
SCREEN 3.5 — BatteryIntentScreen
════════════════════════════════════════

Headline: "¿Deseas incluir almacenamiento de energía?"

Brief explanation (2 lines max):
"Las baterías te dan respaldo eléctrico durante apagones. 
No reducen tu factura, pero mantienen tu negocio operando."

Slider: "¿Cuántas horas de respaldo deseas?"
- Values: 0, 4, 8, 12, 16, 24
- Default: 0 (no batteries)
- Show selected value as: "X horas de respaldo"
- At 0: show "Sin almacenamiento"

Two CTAs:
- If slider > 0: orange "Ver estimado con baterías →"
- Always available: ghost button "Solo solar por ahora →"

Both buttons proceed to EstimateScreen.
Pass `batteryHours` state (0 = solar only) to EstimateScreen.

════════════════════════════════════════
BATTERY SIZING LOGIC (calcBatterySystem)
════════════════════════════════════════

Add this function to the existing business logic (alongside calcEstimate):

// All prices are Windmar's COST. Apply 1.35x markup for customer price.
// Worst-case assumption: 480V / 3-phase / outdoor (Sol-Ark system)

const AC_DC_CONV        = 1.25;   // DC sizing factor (Variables!B5)
const INV_UNIT_KW       = 60;     // Sol-Ark 60K-3P-480V, kW per inverter
const BAT_UNIT_KWH      = 60;     // L3-HVR-60KWH, kWh per battery
const MAX_BATT_PER_INV  = 6;      // max batteries per inverter (table constraint)
const INV_COST          = 12900;  // cost per inverter
const BAT_COST          = 27700;  // cost per battery (outdoor)
const BAT_SHIP          = 500;    // shipping per battery
const INV_SHIP          = 150;    // shipping per inverter
const BAT_INSTALL_FIRST = 7000;   // installation, first battery
const BAT_INSTALL_NEXT  = 2000;   // installation, each additional battery
const MARKUP            = 1.35;   // equipment markup (35%)

function calcBatterySystem(demandaKVA, avgMonthlyKWH, batteryHours) {
  if (!batteryHours || batteryHours === 0) return null;

  // Power: size inverters from demand
  const requiredKW_dc = demandaKVA * AC_DC_CONV;
  const numInverters  = Math.ceil(requiredKW_dc / INV_UNIT_KW);
  const systemKW      = numInverters * INV_UNIT_KW;

  // Storage: worst case = 24/7 operation
  const hourlyKW      = (avgMonthlyKWH / 30.4375) / 24;
  const requiredKWH   = hourlyKW * batteryHours;

  // Round up to battery units, enforce min (1:1) and max (6:1) constraints
  const rawBatteries  = Math.ceil(requiredKWH / BAT_UNIT_KWH);
  const minBatteries  = numInverters;
  const maxBatteries  = numInverters * MAX_BATT_PER_INV;
  const numBatteries  = Math.min(Math.max(rawBatteries, minBatteries), maxBatteries);
  const systemKWH     = numBatteries * BAT_UNIT_KWH;

  // Pricing (markup on equipment only, services at cost)
  const equipPrice    = (numInverters * INV_COST + numBatteries * BAT_COST) * MARKUP;
  const shipping      = (numBatteries * BAT_SHIP) + (numInverters * INV_SHIP);
  const installation  = BAT_INSTALL_FIRST + ((numBatteries - 1) * BAT_INSTALL_NEXT);
  const totalCost     = equipPrice + shipping + installation;
  const actualHours   = hourlyKW > 0 ? systemKWH / hourlyKW : 0;

  return {
    numInverters,
    numBatteries,
    systemKW,
    systemKWH,
    actualHours: Math.round(actualHours * 10) / 10,
    equipPrice,
    shipping,
    installation,
    totalCost,
    productName: `Sol-Ark ${systemKW}kW/${systemKWH}kWh, 480 Vac, Afuera (outdoor)`,
    capped: numBatteries === maxBatteries
  };
}

════════════════════════════════════════
SCREEN 4 — EstimateScreen UPDATES
════════════════════════════════════════

The existing solar estimate display stays exactly as-is.

IF batteryHours > 0, add a battery section below the solar estimate:

─── Almacenamiento de Energía ───────────
Sistema: Sol-Ark XkW/YkWh
Respaldo: Z horas estimadas
Precio estimado: $XXX,XXX

─── Total Solar + Baterías ──────────────
$XXX,XXX (combined)

Add a second slider BELOW the battery section:
"Ajusta las horas de respaldo:"
- Same values: 0, 4, 8, 12, 16, 24
- Initialized to batteryHours from BatteryIntentScreen
- Updates battery estimate in real time as rep moves slider
- At 0: hides battery section, shows solar-only total
- Label: "X horas de respaldo" (or "Sin almacenamiento" at 0)

IF batteryHours === 0 (came via "Solo solar" button):
- Show solar estimate only (current behavior)
- Add a subtle text link below: "¿Agregar almacenamiento?" 
  that re-shows the battery slider at 4 hours default

════════════════════════════════════════
STATE MANAGEMENT
════════════════════════════════════════

Add to wizard top-level state:
const [batteryHours, setBatteryHours] = useState(0);
const [estimatePdfBlob, setEstimatePdfBlob] = useState(null); // already exists

Pass batteryHours and setBatteryHours through to:
- BatteryIntentScreen (set initial value)
- EstimateScreen (read + allow adjustment)

The battery estimate is calculated client-side in real time.
No server calls needed for battery pricing.

════════════════════════════════════════
ZOHO CRM — add battery fields to submission
════════════════════════════════════════

In submitToZoho(), add these fields to the leadData JSON:
  batteryHours:   batteryHours || 0,
  batteryKWH:     batteryResult?.systemKWH || null,
  batteryKW:      batteryResult?.systemKW  || null,
  batteryPrice:   batteryResult?.totalCost || null,

Map them in server.js createZohoLead() to these Zoho fields
(leave null if no battery selected):
  Baterias:              batteryHours > 0 ? true : false,
  Battery_System_Size_kWh: leadData.batteryKWH || null,
  Storage_Size_kWh:        leadData.batteryKWH || null,

════════════════════════════════════════
DESIGN SYSTEM (match existing screens)
════════════════════════════════════════

Background:     #EBF1FF
Navy primary:   #1B3F8B
Orange accent:  #F5A623
Min font:       16px
Min button:     52px height
Border radius:  10px inputs, 16px cards
Max width:      480px centered
Progress bar:   update to show 5 steps instead of 4
                BatteryIntentScreen = step 3 of 5

Slider styling:
- Track: navy (#1B3F8B)
- Thumb: orange (#F5A623)  
- Large touch target (min 44px)
- Show current value prominently above slider

════════════════════════════════════════
IMPORTANT NOTES
════════════════════════════════════════

- Do NOT modify ContactScreen, ThankYouScreen, or server.js Zoho route 
  beyond the battery fields noted above
- Do NOT modify the OCR endpoint or bill parsing logic
- The wizard is rep-operated on a tablet — all touch targets must be large
- Never block wizard flow on Zoho errors
- Build with: ./patch_and_build.sh prequal
- Test URL: windmar-prequal-dev.up.railway.app/prequal

════════════════════════════════════════
PRICING CONFIG FILE (new)
════════════════════════════════════════

A file exists at ./config/pricing.json containing all solar EPC tiers
and battery pricing constants.

IMPORTANT: Before using the EPC tiers from pricing.json, verify them
against the getEPC() function in PreQual_Solar.jsx and correct any
discrepancies in pricing.json. PreQual_Solar.jsx is the source of truth
for the current EPC values.

In server.js, add this endpoint:
  app.get('/api/pricing', (req, res) => {
    res.json(require('./config/pricing.json'));
  });

In the React app:
- Fetch /api/pricing once on app load (in the top-level component)
- Store in state: const [pricing, setPricing] = useState(null)
- Pass pricing down to EstimateScreen and BatteryIntentScreen
- Replace all hardcoded EPC values in calcEstimate() with pricing.solar.epc_tiers
- Replace all hardcoded battery constants in calcBatterySystem() with pricing.battery.*
- Show a loading state while pricing is being fetched
- If fetch fails, fall back to hardcoded defaults so the wizard never breaks
