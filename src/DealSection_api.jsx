import React, { useState, useRef, useEffect } from 'react';
import { Send, Download, Upload, Loader2 } from 'lucide-react';

// ─── OCR FORMATTERS (module-level) ───────────────────────────────────────────
const fmtUSD = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(n);
const fmtKWH = (n) => new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n)+' kWh';
const fmtKVA = (n) => new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(n)+' kVA';

const classifyOCRIntent = (txt) => {
  const r = txt.toLowerCase().trim();
  const LISTO    = ['listo','dale','si','sí','ok','okay','bien','perfecto','correcto','exacto',
    'todo bien','todo correcto','está bien','esta bien','adelante','confirmo','continua',
    'seguimos','yes','todo ok','todo está bien'];
  const CORREGIR = ['corregir','correg','no','malo','error','errores','incorrecto','equivocado',
    'mal','falla','falló','fallo','wrong','bad','fix','arreglar','modificar','cambiar',
    'no se ve bien','no está bien','no esta bien','hay error','tiene error'];
  const AYUDA    = ['ayuda','help','como','cómo','que','qué','auxilio','no entiendo','no sé',
    'no se','explicame','explícame','dónde','donde','no encuentro'];
  if (CORREGIR.some(w => r.includes(w))) return 'corregir';
  if (AYUDA.some(w =>    r.includes(w))) return 'ayuda';
  if (LISTO.some(w =>    r.includes(w))) return 'listo';
  return null;
};

const FIELD_DEFS_DEMAND = [
  { id:'address',       pendingKey:'address_pending',       label:'Dirección del negocio',       hint:'',                                                                                        fixStep:'FIX_ADDRESS'      },
  { id:'municipio',     pendingKey:'municipio_pending',     label:'Municipio',                   hint:'Extráelo de la dirección (ciudad antes del "PR").',                                       fixStep:'FIX_MUNICIPIO'    },
  { id:'luma_total',    pendingKey:'luma_total_pending',    label:'Cantidad total adeudada',     hint:'Primera página, esquina superior izquierda, junto al logo de LUMA.',                      fixStep:'FIX_TOTAL'        },
  { id:'tarifa',        pendingKey:'tarifa_pending',        label:'Tarifa',                      hint:'Tercera página, sección "Información del Medidor".',                                      fixStep:'FIX_TARIFA'       },
  { id:'demanda',       pendingKey:'demanda_pending',       label:'Carga contratada (kVA)',       hint:'Tercera página, sección "Información del Medidor".',                                     fixStep:'FIX_DEMANDA'      },
  { id:'cargo_cliente', pendingKey:'cargo_cliente_pending', label:'Cargo por cliente',           hint:'Tercera página, sección "Detalles de Cargos Corrientes".',                               fixStep:'FIX_CARGO_CLIENTE'},
  { id:'cargo_demanda', pendingKey:'cargo_demanda_pending', label:'Cargo por demanda',           hint:'Sección "Detalles de Cargos Corrientes".',                                               fixStep:'FIX_CARGO_DEMANDA'},
  { id:'exceso_kva',    pendingKey:'exceso_kva_pending',    label:'Exceso de demanda (kVA)',     hint:'Sección "Detalles de Cargos Corrientes".',                                               fixStep:'FIX_EXCESO_KVA'   },
  { id:'exceso_usd',    pendingKey:'exceso_usd_pending',    label:'Monto por exceso de demanda', hint:'Sección "Detalles de Cargos Corrientes".',                                               fixStep:'FIX_EXCESO_USD'   },
  { id:'consumo',       pendingKey:'consumo_pending',       label:'Promedio de consumo mensual', hint:'Barras del historial de consumo al fondo de la factura.',                                fixStep:'FIX_CONSUMO'      },
  { id:'costo_kwh',     pendingKey:'costo_kwh_pending',     label:'Costo promedio de energía',   hint:'Debajo de las barras del historial de consumo.',                                         fixStep:'FIX_COSTO_KWH'   },
];
const FIELD_DEFS_SECONDARY = [
  { id:'address',       pendingKey:'address_pending',       label:'Dirección del negocio',       hint:'',                                                                                        fixStep:'FIX_ADDRESS'      },
  { id:'municipio',     pendingKey:'municipio_pending',     label:'Municipio',                   hint:'Ciudad antes del "PR" en la dirección.',                                                  fixStep:'FIX_MUNICIPIO'    },
  { id:'luma_total',    pendingKey:'luma_total_pending',    label:'Cantidad total adeudada',     hint:'Primera página, esquina superior izquierda.',                                             fixStep:'FIX_TOTAL'        },
  { id:'tarifa',        pendingKey:'tarifa_pending',        label:'Tarifa',                      hint:'Tercera página, sección "Información del Medidor".',                                      fixStep:'FIX_TARIFA'       },
  { id:'cargo_cliente', pendingKey:'cargo_cliente_pending', label:'Cargo por cliente',           hint:'Tercera página, sección "Detalles de Cargos Corrientes".',                               fixStep:'FIX_CARGO_CLIENTE'},
  { id:'consumo',       pendingKey:'consumo_pending',       label:'Promedio de consumo mensual', hint:'Barras del historial de consumo.',                                                       fixStep:'FIX_CONSUMO'      },
  { id:'costo_kwh',     pendingKey:'costo_kwh_pending',     label:'Costo promedio de energía',   hint:'Debajo de las barras del historial de consumo.',                                         fixStep:'FIX_COSTO_KWH'   },
];

const getFieldDefs = (tarifa) => tarifa === 'Secundaria' ? FIELD_DEFS_SECONDARY : FIELD_DEFS_DEMAND;

const getFieldValue = (d, pendingKey) => {
  const v = d[pendingKey];
  if (v === undefined || v === null) return '—';
  if (pendingKey === 'luma_total_pending')    return fmtUSD(v);
  if (pendingKey === 'tarifa_pending')        return String(v);
  if (pendingKey === 'demanda_pending')       return fmtKVA(v);
  if (pendingKey === 'cargo_cliente_pending') return fmtUSD(v);
  if (pendingKey === 'cargo_demanda_pending') return fmtUSD(v);
  if (pendingKey === 'exceso_kva_pending')    return fmtKVA(v);
  if (pendingKey === 'exceso_usd_pending')    return fmtUSD(v);
  if (pendingKey === 'consumo_pending')       return fmtKWH(v);
  if (pendingKey === 'costo_kwh_pending')     return fmtUSD(v)+'/kWh';
  return String(v);
};

function OCRReviewCard({ data, checkedFields, onToggle, disabled }) {
  const defs = getFieldDefs(data.tarifa_pending ?? data.ocr?.tarifa);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden w-full max-w-lg">
      <div className="bg-orange-50 border-b border-orange-100 px-4 py-3">
        <p className="text-sm font-semibold text-orange-800">Datos de tu factura LUMA</p>
        <p className="text-xs text-orange-600 mt-0.5">Marca los campos que necesitan corrección</p>
      </div>
      <div className="divide-y divide-gray-100">
        {defs.map((f) => {
          const checked = checkedFields.includes(f.id);
          return (
            <label
              key={f.id}
              className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-orange-50'
              } ${checked ? 'bg-red-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => !disabled && onToggle(f.id)}
                className="mt-0.5 accent-red-500 w-4 h-4 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500">{f.label}: </span>
                <span className={`text-xs font-semibold break-words ${checked ? 'text-red-600 line-through' : 'text-gray-800'}`}>
                  {getFieldValue(data, f.pendingKey)}
                </span>
              </div>
            </label>
          );
        })}
      </div>
      {!disabled && (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          Escribe <span className="font-semibold text-orange-600">listo</span> para continuar ·{' '}
          <span className="font-semibold text-red-600">corregir</span> si marcaste campos ·{' '}
          <span className="font-semibold text-blue-600">ayuda</span> si necesitas orientación
        </div>
      )}
    </div>
  );
}

export default function SolarQuestionnaire() {
  const [messages, setMessages] = useState([]);
  const [checkedFields, setCheckedFields] = useState([]);
  const [fixQueue,      setFixQueue]      = useState([]);
  const [guidedMode,    setGuidedMode]    = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState({});
  const [currentStep, setCurrentStep] = useState('1.1');
  const [quoteGenerated, setQuoteGenerated] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [questionnaireComplete, setQuestionnaireComplete] = useState(false);
  const [askingToRestart, setAskingToRestart] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const MAX_ATTEMPTS = 3;

  // Validation helper functions
  // ---------------------------------------------------------------------------
  // Municipal solar yield lookup (kWh/kWdc)
  // Source: municipio_yields.csv — update that file to change values.
  // Keys are canonical municipio names (same as extractMunicipio output).
  // ---------------------------------------------------------------------------
  const MUNICIPIO_YIELDS = {
    'Adjuntas': 1530, 'Aguada': 1530, 'Aguadilla': 1530, 'Aguas Buenas': 1530,
    'Aibonito': 1530, 'Añasco': 1530, 'Arecibo': 1530, 'Arroyo': 1650,
    'Barceloneta': 1530, 'Barranquitas': 1530, 'Bayamón': 1530, 'Cabo Rojo': 1650,
    'Caguas': 1530, 'Camuy': 1530, 'Canóvanas': 1530, 'Carolina': 1530,
    'Cataño': 1530, 'Cayey': 1530, 'Ceiba': 1650, 'Ciales': 1400,
    'Cidra': 1530, 'Coamo': 1530, 'Comerío': 1530, 'Corozal': 1530,
    'Culebra': 1530, 'Dorado': 1530, 'Fajardo': 1650, 'Florida': 1530,
    'Guánica': 1650, 'Guayama': 1750, 'Guayanilla': 1650, 'Guaynabo': 1530,
    'Gurabo': 1530, 'Hatillo': 1530, 'Hormigueros': 1530, 'Humacao': 1650,
    'Isabela': 1650, 'Jayuya': 1530, 'Juana Díaz': 1650, 'Juncos': 1650,
    'Lajas': 1650, 'Lares': 1530, 'Las Marías': 1530, 'Las Piedras': 1530,
    'Loíza': 1530, 'Luquillo': 1530, 'Manatí': 1530, 'Maricao': 1530,
    'Maunabo': 1530, 'Mayagüez': 1530, 'Moca': 1530, 'Morovis': 1530,
    'Naguabo': 1650, 'Naranjito': 1530, 'Orocovis': 1400, 'Patillas': 1530,
    'Peñuelas': 1650, 'Ponce': 1650, 'Quebradillas': 1530, 'Rincón': 1530,
    'Río Grande': 1530, 'Sabana Grande': 1530, 'Salinas': 1650, 'San Germán': 1530,
    'San Juan': 1530, 'San Lorenzo': 1530, 'San Sebastián': 1530, 'Santa Isabel': 1650,
    'Toa Alta': 1530, 'Toa Baja': 1530, 'Trujillo Alto': 1530, 'Utuado': 1530,
    'Vega Alta': 1530, 'Vega Baja': 1530, 'Vieques': 1530, 'Villalba': 1530,
    'Yabucoa': 1530, 'Yauco': 1650,
  };
  const DEFAULT_YIELD = 1530; // fallback if municipio not found

  const getYield = (municipio) => MUNICIPIO_YIELDS[municipio] ?? DEFAULT_YIELD;

  const validateYesNo = (input) => {
    const response = input.toLowerCase().trim();

    // YES words — checked via includes so "correcto!" and "si, adelante" both work
    const YES_WORDS = [
      'correcto', 'exacto', 'afirmativo', 'efectivamente',
      'por supuesto', 'definitivamente', 'confirmo', 'confirmado',
      'así es', 'eso es', 'está bien', 'esta bien',
      'adelante', 'dale', 'claro', 'listo', 'vamos', 'empecemos',
      'okay', 'ok', 'yes', 'ajá', 'aja'
    ];

    // NO words — checked via includes
    const NO_WORDS = [
      'nope', 'nel', 'negativo', 'incorrecto', 'equivocado',
      'regreso luego', 'mejor no', 'ahora no',
      'todavía no', 'todavia no', 'aún no', 'aun no',
      'más tarde', 'mas tarde', 'después', 'despues', 'luego'
    ];

    // 'sí'/'si' and 'no' are tested as whole words to avoid false matches
    // (e.g. "notable" contains "no", "nosotros" contains "no")
    const hasBareYes = /\b(s[ií])\b/.test(response);
    const hasBareNo  = /\bno\b/.test(response);

    let isYes = hasBareYes || YES_WORDS.some(w => response.includes(w));
    let isNo  = hasBareNo  || NO_WORDS.some(w => response.includes(w));

    // If both triggered, prefer NO (safer to re-ask than to confirm wrongly)
    if (isYes && isNo) { isYes = false; }

    return { isYes, isNo, isUnclear: !isYes && !isNo };
  };

  // Normalizes Puerto Rican addresses to a consistent format for display/confirmation.
  // Handles LUMA billing address formats: CAR/K M/K20/H 1/BY PASS/BO./etc.
  const normalizeAddress = (input) => {
    let s = input.trim().toUpperCase();

    // Protect decimal numbers (e.g. KM 55.8) from period-cleanup rules
    s = s.replace(/(\d)\.(\d)/g, '$1§$2');

    // Spacing
    s = s.replace(/\s+/g, ' ');
    s = s.replace(/\s*,\s*/g, ', ');

    // Road type abbreviations
    s = s.replace(/\bCE\s+CAR\b/g, 'CARR');          // CE CAR → CARR (LUMA prefix)
    s = s.replace(/\bCAR\b(?!\s*R)/g, 'CARR');        // CAR → CARR (bare abbreviation)
    s = s.replace(/\bCARRETERA\b/g, 'CARR');
    s = s.replace(/\bAVENIDA\b/g, 'AVE');

    // Kilometre markers
    s = s.replace(/\bK\s+M\b/g, 'KM');               // K M → KM
    s = s.replace(/\bKM\.\s*/g, 'KM ');              // KM. → KM
    s = s.replace(/\bK(\d)/g, 'KM $1');              // K20 → KM 20

    // Hectometre / house number
    s = s.replace(/\bH\s+(\d)/g, 'H$1');             // H 1 → H1

    // Bypass variants
    s = s.replace(/\bBY[-\s]PASS\b/g, 'BYPASS');

    // Barrio
    s = s.replace(/\bBO\.\s*/g, 'BO. ');
    s = s.replace(/\bBO\b(?!\.)/g, 'BO.');

    // Common abbreviations
    s = s.replace(/\bPTO\.?\b/g, 'PTO.');
    s = s.replace(/\bURB\.?\b/g, 'URB.');
    s = s.replace(/\bSTE\.?\b/g, 'STE.');

    // Puerto Rico state + ZIP: ensure ", PR XXXXX" format
    s = s.replace(/\bPR\s+(\d{5}(-\d{4})?)\b/, ', PR $1');
    s = s.replace(/\bPR$/, ', PR');
    s = s.replace(/,\s*,/g, ',');                     // remove double comma

    // Restore decimal points
    s = s.replace(/§/g, '.');

    // Final cleanup
    s = s.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();

    return s;
  };

  // Extracts the most likely Puerto Rico municipality from an address string.
  // Picks the rightmost match (closest to "PR" at tail) to avoid false matches
  // like "AVE PONCE DE LEON" being confused for the municipality of Ponce.
  const extractMunicipio = (address) => {
    const MUNICIPIOS = [
      'Adjuntas','Aguada','Aguadilla','Aguas Buenas','Aibonito','Añasco','Arecibo','Arroyo',
      'Barceloneta','Barranquitas','Bayamón','Cabo Rojo','Caguas','Camuy','Canóvanas',
      'Carolina','Cataño','Cayey','Ceiba','Ciales','Cidra','Coamo','Comerío','Corozal',
      'Culebra','Dorado','Fajardo','Florida','Guánica','Guayama','Guayanilla','Guaynabo',
      'Gurabo','Hatillo','Hormigueros','Humacao','Isabela','Jayuya','Juana Díaz','Juncos',
      'Lajas','Lares','Las Marías','Las Piedras','Loíza','Luquillo','Manatí','Maricao',
      'Maunabo','Mayagüez','Moca','Morovis','Naguabo','Naranjito','Orocovis','Patillas',
      'Peñuelas','Ponce','Quebradillas','Rincón','Río Grande','Sabana Grande','Salinas',
      'San Germán','San Juan','San Lorenzo','San Sebastián','Santa Isabel','Toa Alta',
      'Toa Baja','Trujillo Alto','Utuado','Vega Alta','Vega Baja','Vieques','Villalba',
      'Yabucoa','Yauco'
    ];
    const upper = address.toUpperCase();
    let bestMatch = null;
    let bestPos = -1;
    for (const mun of MUNICIPIOS) {
      const variants = [
        mun.toUpperCase(),
        mun.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      ];
      if (mun.includes(' ')) variants.push(mun.toUpperCase().replace(/\s+/g, ''));
      for (const v of variants) {
        const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        let m;
        while ((m = re.exec(upper)) !== null) {
          if (m.index > bestPos) { bestPos = m.index; bestMatch = mun; }
        }
      }
    }
    return bestMatch; // null if not found
  };

  const validateEmail = (email) => {
    const trimmed = email.trim();
    
    // Check for invalid characters (only allow alphanumeric, @, ., -, _)
    const invalidChars = /[^a-zA-Z0-9@.\-_]/;
    if (invalidChars.test(trimmed)) {
      return { valid: false, formatted: null, error: 'El correo electrónico contiene caracteres inválidos. Solo se permiten letras, números, @, punto, guión y guión bajo.' };
    }
    
    // Email regex: basic structure check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmed)) {
      return { valid: false, formatted: null, error: 'Por favor proporciona un correo electrónico válido (ej: nombre@ejemplo.com).' };
    }
    
    // Check for valid TLD (common + country codes)
    const validTLDs = [
      'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co', 'info', 'biz', 'tech', 'app', 'dev',
      'pr', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'es', 'it', 'mx', 'mex', 'br', 'ar', 'cl', 'co', 've', 'pe', 'ec',
      'jp', 'cn', 'in', 'ru', 'nl', 'be', 'ch', 'at', 'dk', 'se', 'no', 'fi', 'pl', 'cz', 'pt', 'gr', 'tr',
      // Multi-part TLDs
      'co.uk', 'co.jp', 'co.in', 'com.au', 'com.br', 'com.mx', 'com.ar', 'com.co',
      'gov.uk', 'gov.au', 'ac.uk', 'edu.au', 'org.uk', 'net.au'
    ];
    
    const emailParts = trimmed.toLowerCase().split('@');
    if (emailParts.length !== 2) {
      return { valid: false, formatted: null, error: 'Por favor proporciona un correo electrónico válido (ej: nombre@ejemplo.com).' };
    }
    
    const domain = emailParts[1];
    const domainParts = domain.split('.');
    
    // Check single TLD (last part)
    const tld = domainParts[domainParts.length - 1];
    // Check multi-part TLD (last two parts)
    const multiPartTLD = domainParts.length >= 2 ? `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}` : null;
    
    if (!validTLDs.includes(tld) && !validTLDs.includes(multiPartTLD)) {
      return { valid: false, formatted: null, error: 'Por favor proporciona un correo electrónico con un dominio válido (ej: .com, .org, .edu, .pr, etc.).' };
    }
    
    return { valid: true, formatted: trimmed.toLowerCase(), error: null };
  };

  const validatePhoneNumber = (phone) => {
    const trimmed = phone.trim();
    // Remove all non-digit characters
    const digitsOnly = trimmed.replace(/\D/g, '');
    
    // Check for minimum 10 digits (US/PR format)
    if (digitsOnly.length < 10) {
      return { valid: false, formatted: null, error: 'Por favor proporciona un número de teléfono válido con al menos 10 dígitos.' };
    }
    
    // Format based on length
    if (digitsOnly.length === 10) {
      // Standard US format: XXX-XXX-XXXX
      const formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
      return { valid: true, formatted: formatted, error: null };
    } else if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
      // US with country code: 1-XXX-XXX-XXXX
      const formatted = `1-${digitsOnly.slice(1, 4)}-${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7, 11)}`;
      return { valid: true, formatted: formatted, error: null };
    } else {
      // International or other format - keep digits with dashes every 3-4 digits
      const formatted = digitsOnly.match(/.{1,3}/g).join('-');
      return { valid: true, formatted: formatted, error: null };
    }
  };

  const validateName = (name) => {
    const trimmed = name.trim();
    
    // Check for "nobody" patterns
    const nobodyPatterns = ['nadie', 'ninguno', 'yo solo', 'no', 'vine solo', 'nobody', 'none', 'no one'];
    if (nobodyPatterns.some(pattern => trimmed.toLowerCase().includes(pattern))) {
      return { valid: true, isNobody: true, formatted: null, error: null };
    }
    
    // Check for obviously invalid patterns (like "Contacto Alterno", "N/A", etc.)
    const invalidPatterns = ['contacto', 'alterno', 'tecnico', 'técnico', 'n/a', 'na', 'ninguno', 'desconocido', 'unknown'];
    if (invalidPatterns.some(pattern => trimmed.toLowerCase().includes(pattern))) {
      return { valid: false, isNobody: false, formatted: null, error: 'Por favor proporciona un nombre real (nombre y apellido).' };
    }
    
    // Split into words
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    
    // Require at least 2 words (first name + last name)
    if (words.length < 2) {
      return { valid: false, isNobody: false, formatted: null, error: 'Necesito que me proveas el nombre y el apellido. Ingrésalos ahora:' };
    }
    
    // Check for single-character words (likely initials) - reject them
    const hasSingleCharWord = words.some(word => word.length === 1);
    if (hasSingleCharWord) {
      return { valid: false, isNobody: false, formatted: null, error: 'Por favor proporciona el nombre completo (sin iniciales). Necesito al menos el nombre y apellido completos.' };
    }
    
    // Capitalize each word (first letter uppercase, rest lowercase)
    const capitalized = words.map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    return { valid: true, isNobody: false, formatted: capitalized, error: null };
  };

  const validateBusinessName = (name) => {
    const trimmed = name.trim();
    
    // Require minimum length
    if (trimmed.length < 2) {
      return { valid: false, formatted: null, error: 'Por favor proporciona el nombre del negocio.' };
    }
    
    // Capitalize each word
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    const capitalized = words.map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    return { valid: true, formatted: capitalized, error: null };
  };

  const parseSpanishNumber = (input) => {
    const text = input.toLowerCase().trim();
    
    // First check: reject if input contains a minus sign (negative number)
    if (text.includes('-')) {
      return null; // Let the calling code handle the negative number error
    }
    
    // Try to parse as regular number first (including decimals)
    // Make regex stricter: must match entire meaningful part, no trailing letters
    const numMatch = text.match(/^[\d,]+\.?\d*$/);
    if (numMatch) {
      const num = parseFloat(numMatch[0].replace(/,/g, ''));
      if (!isNaN(num) && num >= 0) {
        return num;
      }
    }
    
    // Spanish number words
    const numberWords = {
      'cero': 0, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
      'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
      'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
      'dieciséis': 16, 'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18,
      'diecinueve': 19, 'veinte': 20, 'veintiuno': 21, 'veintidos': 22,
      'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25,
      'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60,
      'setenta': 70, 'ochenta': 80, 'noventa': 90,
      'cien': 100, 'ciento': 100, 'doscientos': 200, 'trescientos': 300,
      'cuatrocientos': 400, 'quinientos': 500, 'seiscientos': 600,
      'setecientos': 700, 'ochocientos': 800, 'novecientos': 900,
      'mil': 1000, 'dos mil': 2000, 'tres mil': 3000, 'cuatro mil': 4000, 'cinco mil': 5000
    };
    
    // Check for exact match
    if (numberWords[text]) {
      return numberWords[text];
    }
    
    // Check for compound numbers like "ciento cincuenta" = 150
    if (text.includes('ciento') || text.includes('mil')) {
      let total = 0;
      const words = text.split(/\s+/);
      
      for (let i = 0; i < words.length; i++) {
        if (words[i] === 'mil') {
          const prev = i > 0 && numberWords[words[i-1]] ? numberWords[words[i-1]] : 1;
          total += prev * 1000;
        } else if (words[i] === 'ciento' || words[i] === 'cien') {
          total += 100;
        } else if (numberWords[words[i]]) {
          total += numberWords[words[i]];
        }
      }
      
      if (total > 0) return total;
    }
    
    return null;
  };

  const toggleField = (id) => {
    setCheckedFields(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const commitAllOCR = (sd) => ({
    ...sd,
    luma_total:         sd.luma_total_pending,    luma_total_pending:    undefined,
    tarifa:             sd.tarifa_pending,         tarifa_pending:        undefined,
    demanda_contratada: sd.demanda_pending,        demanda_pending:       undefined,
    cargo_cliente:      sd.cargo_cliente_pending,  cargo_cliente_pending: undefined,
    cargo_demanda:      sd.cargo_demanda_pending,  cargo_demanda_pending: undefined,
    exceso_kva:         sd.exceso_kva_pending,     exceso_kva_pending:    undefined,
    exceso_usd:         sd.exceso_usd_pending,     exceso_usd_pending:    undefined,
    consumo_kwh:        sd.consumo_pending,        consumo_pending:       undefined,
    costo_kwh:          sd.costo_kwh_pending,      costo_kwh_pending:     undefined,
    address:            sd.address_pending,        address_pending:       undefined,
    municipio:          sd.municipio_pending,      municipio_pending:     undefined,
  });

  const startNextFix = (queue, currentData, guided) => {
    setGuidedMode(guided);
    if (queue.length === 0) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'He actualizado los datos. Revisa que todo esté correcto:', timestamp: new Date(), step: 'BILL_REVIEW' }]);
      setMessages(prev => [...prev, { role: 'assistant', content: '__OCR_REVIEW__', timestamp: new Date(), step: 'BILL_REVIEW', type: 'ocr_review', ocrData: currentData }]);
      setCurrentStep('BILL_REVIEW'); setCheckedFields([]); setAttemptCount(0); setLoading(false);
      return;
    }
    const [next, ...rest] = queue;
    setFixQueue(rest);
    const defs = getFieldDefs(currentData.tarifa_pending ?? currentData.tarifa);
    const fieldDef = defs.find(f => f.fixStep === next);
    if (!fieldDef) { startNextFix(rest, currentData, guided); return; }
    const prompt = (guided && fieldDef.hint) ? `${fieldDef.label}:\n${fieldDef.hint}` : `${fieldDef.label}:`;
    setMessages(prev => [...prev, { role: 'assistant', content: prompt, timestamp: new Date(), step: next }]);
    setCurrentStep(next); setLoading(false);
  };

  // Formatting helper functions for LUMA bill data
  const formatUSD = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return null;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatKVA = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return null;
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num) + ' kVA';
  };

  const formatKWH = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return null;
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num) + ' kWh';
  };

  // Map user input to standardized tariff types
  const mapTariffType = (input) => {
    const normalized = input.toLowerCase().trim();
    
    // Primaria
    if (normalized.includes('primaria') || normalized.includes('primary')) {
      return 'Primaria';
    }
    // Secundaria
    if (normalized.includes('secundaria') || normalized.includes('secondary') || normalized.includes('secundario')) {
      return 'Secundaria';
    }
    // Transmisión
    if (normalized.includes('transmision') || normalized.includes('transmisión') || normalized.includes('transmission')) {
      return 'Transmisión';
    }
    // Agrícola
    if (normalized.includes('agricola') || normalized.includes('agrícola') || normalized.includes('agricultural') || normalized.includes('agro')) {
      return 'Agricola';
    }
    // Alumbrado
    if (normalized.includes('alumbrado') || normalized.includes('lighting') || normalized.includes('iluminacion') || normalized.includes('iluminación')) {
      return 'Alumbrado';
    }
    // Residencial
    if (normalized.includes('residencial') || normalized.includes('residential') || normalized.includes('casa') || normalized.includes('hogar')) {
      return 'Residencial';
    }
    
    // Default to "Otra" if no match
    return 'Otra';
  };

  // Parse cost per kWh - handles dollars that should be cents (29 → 0.29)
  const parseCostPerKWH = (input) => {
    const text = input.toLowerCase().trim();
    
    // Remove common text patterns
    const cleanText = text
      .replace(/centavos?/g, '')
      .replace(/cents?/g, '')
      .replace(/\$/g, '')
      .replace(/usd/g, '')
      .trim();
    
    // Try to parse as number first
    let parsed = parseSpanishNumber(cleanText);
    
    if (parsed !== null) {
      // If number is >= 1, assume user meant cents (e.g., 29 → 0.29)
      if (parsed >= 1) {
        parsed = parsed / 100;
      }
      
      // Validate range: must be between 0 and 1
      if (parsed > 0 && parsed < 1) {
        return parsed;
      }
    }
    
    // Try parsing with explicit decimal point (e.g., .29)
    if (text.startsWith('.')) {
      const withZero = '0' + text;
      const num = parseFloat(withZero);
      if (!isNaN(num) && num > 0 && num < 1) {
        return num;
      }
    }
    
    return null;
  };

  // MOCK OCR FUNCTION - Uses real LUMA bill data for realistic testing
  // In production, this will be replaced by actual API call to backend
  const mockExtractBillData = (fileName) => {
    // Using actual data from sample LUMA bill (Transmisión tariff)
    // Add slight random variation (±2%) to simulate OCR confidence/errors
    const variance = () => 0.98 + (Math.random() * 0.04); // 98% to 102%
    
    const mockData = {
      total_adeudado: 391092.94 * variance(),
      tarifa: "Transmisión", // Could also randomly use other tariffs for testing
      cargo_cliente: 450.00,
      cargo_demanda: 640.50,
      demanda_contratada: 4500,
      exceso_demanda_kva: 100,
      exceso_demanda_usd: 960.00,
      consumo_promedio: Math.round(1300000 * variance()),
      costo_promedio_kwh: 0.24 * variance()
    };
    
    // Occasionally test with Secundaria tariff (10% chance)
    if (Math.random() < 0.1) {
      mockData.tarifa = "Secundaria";
      mockData.demanda_contratada = 0;
      mockData.exceso_demanda_kva = 0;
      mockData.exceso_demanda_usd = 0;
      mockData.cargo_cliente = 5.00; // Typical residential amount
      mockData.total_adeudado = 150 + (Math.random() * 200); // Smaller bill
      mockData.consumo_promedio = Math.round(800 + (Math.random() * 400));
      mockData.costo_promedio_kwh = 0.28 + (Math.random() * 0.04);
    }
    
    return mockData;
  };

  const logicTree = [
    { id: "1.1", section: "Admin", prompt: "¿Quieres activar el modo de prueba? (sí/no)", next: "Jump", field: "test_mode" },
    { id: "Jump", section: "Admin", prompt: "Modo de prueba activado. ¿A qué sección quieres saltar? (o escribe 'continuar' para el flujo normal)", next: "2.1", field: null },
    { id: "2.1", section: "Introducción", prompt: "DYNAMIC", next: "3.1", field: "primera_vez" },
    { id: "3.1", section: "Referidor", prompt: "¿Estás trabajando con un consultor de Windmar? (si la respuesta es \"sí\", ingresa su nombre completo). Si no, simplemente ingresa \"nadie\"", next: "3.2", field: "referido_por" },
    { id: "3.2", section: "Referidor", prompt: "Por favor compártenos su correo electrónico:", next: "4.1", field: "referido_email" },
    { id: "4.1", section: "Identidad del negocio", prompt: "¿Cuál es el nombre de tu negocio?", next: "4.2", field: "business_name" },
    { id: "4.2", section: "Identidad del negocio", prompt: "¿Y cuál es tu nombre (contacto principal)?", next: "4.3", field: "cliente_nombre" },
    { id: "4.3", section: "Identidad del negocio", prompt: "¿Cuál es tu número de teléfono?", next: "4.4", field: "cliente_telefono" },
    { id: "4.4", section: "Identidad del negocio", prompt: "¿Y tu correo electrónico?", next: "4.5", field: "cliente_email" },
    { id: "4.5", section: "Identidad del negocio", prompt: "¿Habrá un contacto alterno que se encargue de la interacción con nosotros? (sí/no)", next: "4.10", field: "has_alternate_contact" },
    { id: "4.6", section: "Identidad del negocio", prompt: "Perfecto. ¿Cuál es el nombre del contacto alterno?", next: "4.7", field: "alternate_contact_nombre" },
    { id: "4.7", section: "Identidad del negocio", prompt: "¿Su número de teléfono?", next: "4.8", field: "alternate_contact_telefono" },
    { id: "4.8", section: "Identidad del negocio", prompt: "¿Y su correo electrónico?", next: "4.9", field: "alternate_contact_email" },
    { id: "4.9", section: "Identidad del negocio", prompt: "¿Habrá un contacto técnico (por ejemplo, un ingeniero) para las preguntas técnicas? (sí/no)", next: "4.10", field: "has_technical_contact" },
    { id: "4.10", section: "Identidad del negocio", prompt: "Entendido. ¿Cuál es el nombre del contacto técnico?", next: "4.11", field: "technical_contact_nombre" },
    { id: "4.11", section: "Identidad del negocio", prompt: "¿Su número de teléfono?", next: "4.12", field: "technical_contact_telefono" },
    { id: "4.12", section: "Identidad del negocio", prompt: "¿Y su correo electrónico?", next: "4.13", field: "technical_contact_email" },
    { id: "4.13", section: "Identidad del negocio", prompt: "¿Qué tipo de entidad es tu negocio? (ej: LLC, Corporación, Individuo, etc.)", next: "4.14", field: "is_for_profit" },
    { id: "4.14", section: "Identidad del negocio", prompt: "¿A qué se dedica principalmente tu negocio?", next: "4.15", field: "high_risk_activity" },
    { id: "4.15", section: "Identidad del negocio", prompt: "¿Tu negocio realiza actividades de alto riesgo? (ej: cultivo o comercialización de cannabis, entretenimiento para adultos, criptomonedas)", next: "5.1", field: "high_risk_type" },
    { id: "5.1", section: "Servicios", prompt: "¿Qué servicios te interesan? Puedes seleccionar varios: paneles solares (con o sin baterías, eso te lo preguntamos después), baterías portátiles (sin paneles), reparaciones, o sellado de techo.", next: "6.1", field: "services_selected" },
    { id: "5.2.hormigon", section: "Servicios", prompt: null, next: "5.2.roof_count", field: "sellado_hormigon" },
    { id: "5.2.roof_count", section: "Servicios", prompt: null, next: "5.2.size", field: "sellado_roof_count" },
    { id: "5.2.size", section: "Servicios", prompt: null, next: "5.2.condition", field: null },
    { id: "5.2.condition", section: "Servicios", prompt: null, next: "6.1", field: null },
    { id: "5.2", section: "Servicios", prompt: "Por favor indica la superficie aproximada que deseas sellar, por ejemplo '5,000 pies cuadrados'", next: "6.1", field: "sellado_superficie" },
    { id: "5.2a", section: "Servicios", prompt: "¿Cuántas baterías Anker estás pensando?", next: "6.1", field: "cuantas_baterias_anker" },
    { id: "5.3", section: "Servicios", prompt: "¿Tu negocio requiere respaldo de baterías? Salvo en ocasiones especiales, la respuesta es 'no', ya que muchos negocios usan generadores como respaldo.", next: "5.4", field: "requiere_respaldo" },
    { id: "5.4", section: "Servicios", prompt: "Respaldar todo el negocio generalmente resulta demasiado costoso. Te recomendamos respaldar únicamente tus cargas críticas. ¿Qué porcentaje del negocio quieres respaldar? (por ejemplo: 100%, 50%, 25%)", next: "6.1", field: "porcentaje_respaldo" },
    { id: "5.5", section: "Servicios", prompt: "¿Tienes un sistema solar existente que necesita reparación?", next: "5.6", field: "repair_has_existing_asset" },
    { id: "5.6", section: "Servicios", prompt: "¿Qué tipo de equipo necesita reparación? (paneles solares, inversor, baterías, estructura, cableado, etc.)", next: "5.7", field: "repair_asset_type" },
    { id: "5.6.1", section: "Servicios", prompt: "Por favor indica la marca de las baterías que requieren diagnóstico o reparación, por ejemplo 'Tesla', 'SolArk', etc.", next: "5.7", field: "diagnose_battery_marca" },
    { id: "5.7", section: "Servicios", prompt: "¿Cuál es el problema que estás experimentando?", next: "5.8", field: "repair_problem_description" },
    { id: "5.8", section: "Servicios", prompt: "¿Qué tan urgente es la reparación? (emergencia, pronto, rutina)", next: "6.1", field: "repair_urgency" },
    { id: "6.1", section: "Ubicación", prompt: "Por favor proporciona la dirección de tu negocio. Puedes escribirla (ej: Road 867 Km 2.0, Toa Baja, PR) o pegar un Plus Code o enlace de Google Maps.", next: "6.1.municipio", field: "business_address" },
    { id: "6.1.municipio", section: "Ubicación", prompt: null, next: "6.2", field: "municipio" },
    { id: "6.2", section: "Ubicación", prompt: "El número de CRIM debe tener 13 dígitos. Formato: NNN-NNN-NNN-NN-NNN o NNNNNNNNNNNNN. Por favor ingrésalo acá:", next: "7.1", field: "crim_number" },
    { id: "7.1", section: "Consumo", prompt: "Perfecto. Continuemos con el consumo eléctrico. Para dimensionar tu sistema, ¿prefieres que usemos tu factura de LUMA o darnos un estimado del consumo del negocio?", next: "7.2", field: "dimensioning_method" },
    { id: "7.2", section: "Consumo", prompt: "¿Cuántos medidores de LUMA tiene tu negocio?", next: "7.3", field: "luma_meter_count" },
    { id: "7.3", section: "Consumo", prompt: "Por favor, sube una foto de tu factura más reciente o dime: ¿cuántos kWh consumes mensualmente en promedio?", next: "7.4", field: null, allowUpload: true },
    { id: "7.4", section: "Consumo", prompt: "¿Esta factura refleja el consumo típico de tu negocio durante el último año? ¿O hubo algo inusual?", next: "8", field: "luma_bill_is_typical" },
    { id: "8", section: "Techos", prompt: "Ahora hablemos de los techos de tu propiedad.\n\nPrimero, definamos qué entendemos por \"techo\": tienes un solo techo si la superficie es continua y podrías caminarla completa sin levantar los pies (ej. un techo a dos aguas). Si para pasar de una sección a otra tienes que brincar un petril, subir un escalón, si las superficies son de diferentes materiales (ej. hormigón y galvalume), o si las áreas están en distintos niveles — entonces son más de un techo.\n\nPara cada techo te preguntaremos el área aproximada, el material, la condición, y algunas cosas más.\n\n¿Cuántos techos tienes? (máximo 10)", next: "8.1.size", field: "roof_count" },
    { id: "8.1.size", section: "Techos", prompt: null, next: "8.1.material", field: null },
    { id: "8.1.material", section: "Techos", prompt: null, next: "8.1.condition", field: null },
    { id: "8.1.condition", section: "Techos", prompt: null, next: "8.1.size", field: null },
    { id: "9.1",  section: "Pago",           prompt: "¡Listo! Ya tenemos toda la información del sistema. ¿Cómo planeas pagar?\n\n• Contado — pago único, sin intereses\n• Financiamiento — cuotas mensuales, cero pronto\n• No sé — te explico ambas opciones\n\n(escribe: contado, financiamiento, o no sé)", next: null, field: "payment_selection" },
    { id: "10.1", section: "Financiamiento", prompt: "¿Tu negocio tiene acceso a crédito comercial actualmente? (sí/no)", next: null, field: "tiene_credito_comercial" },
    { id: "10.2", section: "Financiamiento", prompt: "¿Cuál es el nombre de tu institución bancaria o cooperativa?", next: "10.3", field: "banco_nombre" },
    { id: "10.3", section: "Financiamiento", prompt: "¿Tienes relación con un oficial de crédito en ese banco? (sí/no)", next: null, field: "tiene_oficial_credito" },
    { id: "10.4", section: "Financiamiento", prompt: "¿Cuál es el nombre de ese oficial de crédito?", next: "10.5", field: "oficial_credito_nombre" },
    { id: "10.5", section: "Financiamiento", prompt: "¿Estarías dispuesto a trabajar con Windmar para solicitar crédito a través de un banco? (sí/no)", next: "11.1", field: "windmar_finance_interest" },
    { id: "11.1", section: "Cotización",     prompt: null, next: "12.1", field: null, calculate: true },
    { id: "12.1", section: "Decisión",       prompt: null, next: null,   field: "customer_decision" },
    { id: "12.2", section: "Decisión",       prompt: "¿Cuándo sería un buen momento para que un consultor te llame? (ej: mañana en la mañana, viernes después del mediodía)", next: "13.1", field: "callback_time" },
    { id: "12.3", section: "Decisión",       prompt: "Perfecto. Para apartar el sistema, requerimos un depósito del 20% del costo total. Un consultor te contactará para coordinar ese pago. ¿Confirmas que quieres proceder?", next: "13.1", field: "deposit_intent" },
    { id: "13.1", section: "Cierre",         prompt: null, next: null,   field: "notes_additional" }
  ];

  const showExitMessage = () => {
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: 'Pareces estar teniendo problemas con el cuestionario. Terminemos esta sesión. Te sugiero te pongas en contacto con un consultor de Windmar para que te asista a responder este cuestionario. Que tengas muy buen día.', 
      timestamp: new Date(),
      step: 'EXIT'
    }]);
    
    // Don't end session - allow user to use /restart, /exit, or /quit to try again
    setLoading(false);
  };


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

  // Helper: returns the correct 2.1 welcome prompt based on lead type
  const getWelcomePrompt = (sd) => {
    if (sd._from_prequal) {
      const firstName = (sd.nombre || sd.cliente_nombre || '').split(' ')[0];
      return `¡Bienvenido${firstName ? ' ' + firstName : ''}! Voy a hacerte algunas preguntas adicionales para darte un estimado más exacto. Si sigues interesado, un miembro de nuestro equipo te hará llegar una cotización firme en poco tiempo. ¿Listo para empezar?`;
    }
    return '¡Bienvenido! Voy a hacerte algunas preguntas para prepararte un estimado personalizado. Si los números lucen bien, un miembro de nuestro equipo te hará llegar una cotización firme en poco tiempo. ¿Listo para empezar?';
  };

  useEffect(() => {
    if (messages.length === 0) {
      const firstQ = logicTree.find(s => s.id === '1.1');
      setMessages([{ role: 'assistant', content: firstQ.prompt, timestamp: new Date(), step: '1.1' }]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const calculateQuote = (data) => {
    const consumptionRaw = data.avg_consumo_mensual_kwh || '1000';
    const roofAreaRaw = data.techo_sqft || '1000';
    
    const consumptionMatch = String(consumptionRaw).match(/\d+/);
    const consumption = consumptionMatch ? parseFloat(consumptionMatch[0]) : 1000;
    
    const roofMatch = String(roofAreaRaw).match(/\d+/);
    const roofArea = roofMatch ? parseFloat(roofMatch[0]) : 1000;
    
    const wdcPerSqft = 15;
    const monthlyYieldPerKwdc = 130;
    const costPerWdc = 2.5;
    const utilityRate = 0.25;
    
    const maxKwdc = (roofArea * wdcPerSqft) / 1000;
    const requiredKwdc = consumption / monthlyYieldPerKwdc;
    const systemKwdc = Math.min(maxKwdc, requiredKwdc);
    const systemCost = systemKwdc * 1000 * costPerWdc;
    const monthlyProduction = systemKwdc * monthlyYieldPerKwdc;
    const coveragePct = Math.min((monthlyProduction / consumption) * 100, 100);
    const monthlySavings = monthlyProduction * utilityRate;
    
    return {
      pv_size_kwdc: systemKwdc.toFixed(2),
      pv_max_kwdc_por_techo: maxKwdc.toFixed(2),
      energy_coverage_pct: coveragePct.toFixed(1),
      pv_cost_usd: systemCost.toFixed(2),
      gross_monthly_savings_usd: monthlySavings.toFixed(2),
      implied_rate_usd_per_kwh: utilityRate,
      quote_confidence: coveragePct > 80 ? 'Alto' : coveragePct > 50 ? 'Medio' : 'Bajo',
      assumptions_version: '1.0'
    };
  };

  // ── showQuote: builds and displays Section 11 quote message, then moves to 12.1
  const showQuote = (data) => {
    setCurrentStep('11.1');
    const fromPrequal = data._from_prequal === true && data.estimate;
    const paymentMethod = data.payment_selection || 'cash';

    let est;
    if (fromPrequal) {
      est = data.estimate;
    } else {
      const consumoMensual = parseFloat(data.avg_consumo_mensual_kwh) || parseFloat(data.consumo_kwh) || 1000;
      const roofSqft       = parseFloat(data.techo_sqft) || 1000;
      const municipio      = data.municipio || 'San Juan';
      const billData = {
        luma_total:    parseFloat(data.luma_total) || 0,
        cargo_demanda: parseFloat(data.cargo_demanda) || 0,
        exceso_usd:    parseFloat(data.exceso_usd) || 0,
        consumo_kwh:   consumoMensual,
      };
      const PANEL_WATTS = 410;
      const annualYield   = getYield(municipio);
      const annualConsump = consumoMensual * 12;
      const maxKwpRoof    = (roofSqft / 2500) * 45;
      const kwpFor100     = annualConsump / annualYield;
      const panelKwp      = PANEL_WATTS / 1000;
      const systemKwp     = Math.floor(Math.min(maxKwpRoof, kwpFor100) / panelKwp) * panelKwp;
      const annualGen     = systemKwp * annualYield;
      const coverage      = Math.min((annualGen / annualConsump) * 100, 100);
      const EPC_TABLE = [
        { from:     0, to:     5, epc: 3.20 },
        { from:     5, to:    35, epc: 2.90 },
        { from:    35, to:    50, epc: 2.80 },
        { from:    50, to:   100, epc: 2.70 },
        { from:   100, to:   500, epc: 2.50 },
        { from:   500, to:  1000, epc: 2.40 },
        { from:  1000, to:  2000, epc: 2.30 },
        { from:  2000, to:  6000, epc: 2.20 },
        { from:  6000, to: 12000, epc: 2.10 },
        { from: 12000, to: 24000, epc: 1.95 },
        { from: 24000, to:100000, epc: 1.70 },
      ];
      const epcRow     = EPC_TABLE.find(row => systemKwp >= row.from && systemKwp < row.to) || EPC_TABLE[EPC_TABLE.length - 1];
      const epcPerW    = epcRow.epc;
      const systemCost = systemKwp * 1000 * epcPerW;
      const nonDemandUSD    = billData.luma_total - billData.cargo_demanda - billData.exceso_usd;
      const nonDemandTariff = nonDemandUSD / (billData.consumo_kwh || 1);
      const solarKwhMo      = Math.min(annualGen / 12, consumoMensual);
      const savingsCash     = nonDemandTariff * solarKwhMo;
      const RATE = 0.09; const AMORT = 180; const BALLOON_MO = 83; const DOC_FEE = 500;
      const base        = systemCost + DOC_FEE;
      const facilityFee = Math.round(((base / 0.95) * 0.02) * 100) / 100;
      const secDeposit  = Math.round(((base / 0.95) * 0.03) * 100) / 100;
      const financed    = systemCost + facilityFee + secDeposit + DOC_FEE;
      const r           = RATE / 12;
      const monthlyPmt  = Math.round((r * financed / (1 - Math.pow(1 + r, -AMORT))) * 100) / 100;
      const balloon     = Math.round((financed * Math.pow(1+r, BALLOON_MO+1) + monthlyPmt * ((Math.pow(1+r, BALLOON_MO+1) - 1) / r) - monthlyPmt) * (-1) * 100) / 100;
      const savingsFinanced = savingsCash - monthlyPmt;
      const roiMonths   = savingsCash > 0 ? Math.round(systemCost / savingsCash) : null;
      est = {
        systemKwp:       systemKwp.toFixed(1),
        numPanels:       Math.round(systemKwp * 1000 / PANEL_WATTS),
        panelWatts:      PANEL_WATTS,
        coverage:        coverage.toFixed(0),
        epcPerW:         epcPerW.toFixed(2),
        systemCost:      systemCost.toFixed(0),
        monthlyGen:      Math.round(annualGen / 12),
        savingsCash:     savingsCash.toFixed(0),
        roiYears:        roiMonths ? Math.floor(roiMonths / 12) : null,
        roiMonths:       roiMonths ? roiMonths % 12 : null,
        financed:        financed.toFixed(0),
        facilityFee:     facilityFee.toFixed(0),
        secDeposit:      secDeposit.toFixed(0),
        monthlyPmt:      monthlyPmt.toFixed(2),
        balloon:         balloon.toFixed(0),
        savingsFinanced: savingsFinanced.toFixed(0),
      };
    }

    setSessionData(prev => ({ ...prev, estimate: est, quote_source: fromPrequal ? 'prequal' : 'calculated' }));
    setQuoteGenerated(true);

    const cost      = parseFloat(est.systemCost || 0);
    const savings   = parseFloat(est.savingsCash || 0);
    const pmt       = parseFloat(est.monthlyPmt || 0);
    const netSavFin = parseFloat(est.savingsFinanced || 0);
    const balloon   = parseFloat(est.balloon || 0);
    const deposit20 = cost * 0.20;
    const roiStr    = est.roiYears != null ? `${est.roiYears} años${est.roiMonths > 0 ? ` y ${est.roiMonths} meses` : ''}` : 'N/A';

    let quoteMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COTIZACIÓN PRELIMINAR WINDMAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ SISTEMA SOLAR
   ${est.systemKwp} kWp  |  ${est.numPanels} paneles de ${est.panelWatts}W
   Cobertura estimada: ${est.coverage}%
   Generación mensual: ${(est.monthlyGen || 0).toLocaleString()} kWh/mes

💰 PRECIO DEL SISTEMA
   ${formatUSD(cost)}
`;

    if (paymentMethod === 'cash') {
      const pay50 = cost * 0.50;
      const pay30 = cost * 0.30;
      quoteMsg += `
💵 OPCIÓN CONTADO
   Ahorro mensual:               ${formatUSD(savings)}/mes
   Retorno de inversión:         ${roiStr}

   Estructura de pagos:
   • Depósito inicial (20%):     ${formatUSD(deposit20)}
   • Pago antes de instalación (50%): ${formatUSD(pay50)}
   • Pago al culminar (30%):     ${formatUSD(pay30)}
`;
    } else {
      quoteMsg += `
📅 OPCIÓN FINANCIAMIENTO (Windmar Finance)
   Cuota mensual:          ${formatUSD(pmt)}/mes
   Ahorro mensual neto:    ${netSavFin >= 0 ? formatUSD(netSavFin) + ' ✅' : formatUSD(Math.abs(netSavFin)) + ' ⚠️ (cuota > ahorro)'}
   Pago balloon (mes 84):    ${formatUSD(balloon)}
   Tasa: 9% anual  |  Amortización: 15 años

   (Para referencia — contado)
   Ahorro mensual:         ${formatUSD(savings)}/mes
   Retorno de inversión:   ${roiStr}
`;
    }

    quoteMsg += `
¿Cómo quieres proceder?
• sí — quiero proceder
• necesito pensarlo — me llaman luego
• no — por ahora no`;

    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: quoteMsg, timestamp: new Date(), step: '11.1' }]);
      setCurrentStep('12.1');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }, 800);
  };

  // ── showClosing: displays Section 13 closing message and moves to 13.1 ────────
  const showClosing = (data) => {
    const decision    = data.customer_decision || 'thinking';
    const nombre      = data.nombre || data.cliente_nombre || '';
    const negocio     = data.business_name || '';
    const callback    = data.callback_time || '';
    const depositConf = data.deposit_intent === 'confirmed';

    let nextSteps = '';
    if (decision === 'ready_to_proceed' && depositConf) {
      nextSteps = '📋 PRÓXIMOS PASOS\n   1. Un consultor te contactará en las próximas 24 horas\n   2. Coordinaremos el pago del depósito (20%)\n   3. Prepararemos tu propuesta formal con planos de ingeniería\n   4. Te enviaremos un contrato para firma digital';
    } else if (decision === 'thinking' && callback) {
      nextSteps = `📋 PRÓXIMOS PASOS\n   1. Un consultor te llamará el ${callback}\n   2. Prepararemos tu propuesta formal\n   3. Cuando estés listo, coordinamos el depósito`;
    } else {
      nextSteps = '📋 PRÓXIMOS PASOS\n   1. Prepararemos tu propuesta formal\n   2. Un consultor estará disponible para cualquier pregunta\n   3. Cuando desees proceder, contáctanos';
    }

    const greeting = nombre ? `, ${nombre}` : '';
    const bizLine  = negocio ? ` Fue un placer conocer a ${negocio}.` : '';
    const closingMsg = `¡Gracias${greeting}!${bizLine}\n\n${nextSteps}\n\n📱 CONTÁCTANOS\n   WhatsApp: 787-900-0000\n   windmarenergy.com\n\n¿Tienes alguna nota o pregunta adicional antes de terminar? (escribe lo que desees, o "ninguna")`;

    setMessages(prev => [...prev, { role: 'assistant', content: closingMsg, timestamp: new Date(), step: '13.1' }]);
    setCurrentStep('13.1');
    setQuestionnaireComplete(true);
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const handleSend = async () => {
    if (!input.trim() && !loading) return;


    const userMessage = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setLoading(true);

    setTimeout(() => { inputRef.current?.focus(); }, 100);

    // Global commands: /restart, /exit, /quit (work in both test and production mode)
    if (userInput.toLowerCase() === '/restart' || userInput.toLowerCase() === '/exit' || userInput.toLowerCase() === '/quit') {
      setMessages([]);
      setSessionData({});
      setCurrentStep('1.1');
      setQuoteGenerated(false);
      setSessionEnded(false);
      setAskingToRestart(false);
      setAttemptCount(0);
      setQuestionnaireComplete(false);
      setTimeout(() => {
        const firstQ = logicTree.find(s => s.id === '1.1');
        setMessages([{ role: 'assistant', content: firstQ.prompt, timestamp: new Date(), step: '1.1' }]);
        setLoading(false);
      }, 500);
      return;
    }

    // Handle restart question
    if (askingToRestart) {
      const validation = validateYesNo(userInput);
      
      if (validation.isYes) {
        setMessages([]);
        setSessionData({});
        setCurrentStep('1.1');
        setQuoteGenerated(false);
        setSessionEnded(false);
        setAskingToRestart(false);
        setAttemptCount(0);
        setTimeout(() => {
          const firstQ = logicTree.find(s => s.id === '1.1');
          setMessages([{ role: 'assistant', content: firstQ.prompt, timestamp: new Date(), step: '1.1' }]);
          setLoading(false);
        }, 500);
        return;
      } else if (validation.isNo) {
        setMessages(prev => [...prev, { role: 'assistant', content: '¡Gracias por tu tiempo! Que tengas un excelente día. 👋', timestamp: new Date(), step: 'END' }]);
        setSessionEnded(true);
        setAskingToRestart(false);
        setLoading(false);
        return;
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor responde sí o no.', timestamp: new Date(), step: 'RESTART' }]);
        setLoading(false);
        return;
      }
    }

    // Test mode commands
    if (sessionData.test_mode === 'on') {
      if (userInput.toLowerCase() === '/list' || userInput.toLowerCase() === '/sections') {
        const sections = {};
        logicTree.forEach(s => {
          if (!sections[s.section]) {
            sections[s.section] = s.id;
          }
        });
        const sectionList = Object.entries(sections)
          .map(([name, id]) => `${id}: ${name}`)
          .join('\n');
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `📋 Secciones disponibles:\n\n${sectionList}\n\nUsa /jump [número] para saltar a una sección.`, 
          timestamp: new Date(),
          step: 'COMMAND'
        }]);
        setLoading(false);
        return;
      }
      
      if (userInput.toLowerCase().startsWith('/jump ')) {
        const target = userInput.slice(6).trim().toLowerCase();
        const targetStep = logicTree.find(s => 
          s.id.toLowerCase() === target || 
          s.section.toLowerCase() === target ||
          s.id.split('.')[0] === target
        );
        
        if (targetStep) {
          setCurrentStep(targetStep.id);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `✅ Saltando a: ${targetStep.section} (${targetStep.id})\n\n${targetStep.id === '2.1' ? getWelcomePrompt(sessionData) : targetStep.prompt}`, 
            timestamp: new Date(),
            step: targetStep.id
          }]);
          setLoading(false);
          return;
        } else {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: '❌ Sección no encontrada. Usa /sections para ver todas las secciones.', 
            timestamp: new Date(),
            step: 'ERROR'
          }]);
          setLoading(false);
          return;
        }
      }
    }

    // Step 1.1: Test mode activation
    if (currentStep === '1.1') {
      const response = userInput.toLowerCase();
      if (response.includes('sí') || response.includes('si') || response === 's') {
        setSessionData(prev => ({ ...prev, test_mode: 'on' }));
        
        // Build section list with subsections (including new 7.3.a-f steps)
        const sectionMap = {};
        logicTree.forEach(s => {
          if (!sectionMap[s.section]) {
            sectionMap[s.section] = [];
          }
          if (s.prompt && s.id !== 'Jump') {
            sectionMap[s.section].push(s.id);
          }
        });
        
        // Add the new Section 7 detailed bill collection steps (7.3.a-f)
        if (sectionMap['Consumo']) {
          const consumoSteps = sectionMap['Consumo'];
          // Insert 7.3.a-f after 7.3 if not already present
          const index73 = consumoSteps.indexOf('7.3');
          if (index73 !== -1 && !consumoSteps.includes('7.3.a')) {
            consumoSteps.splice(index73 + 1, 0, '7.3.a', '7.3.b', '7.3.c', '7.3.d', '7.3.e', '7.3.f');
          }
        }
        
        const sectionList = Object.entries(sectionMap)
          .map(([name, steps]) => {
            const stepsStr = steps.length > 0 ? ` (${steps.join(', ')})` : '';
            return `• ${name}${stepsStr}`;
          })
          .join('\n');
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Modo de prueba activado. ✅\n\n📋 Secciones y pasos disponibles:\n\n${sectionList}\n\n¿A qué sección quieres saltar? (escribe el número de sección, paso específico, o "continuar" para el flujo normal)`, 
          timestamp: new Date(), 
          step: 'Jump' 
        }]);
        setCurrentStep('Jump');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      } else {
        setSessionData(prev => ({ ...prev, test_mode: 'off' }));
        setMessages(prev => [...prev, { role: 'assistant', content: getWelcomePrompt(sessionData), timestamp: new Date(), step: '2.1' }]);
        setCurrentStep('2.1');
        setLoading(false);
        return;
      }
    }

    // Jump step (test mode)
    if (currentStep === 'Jump') {
      if (userInput.toLowerCase() === 'continuar') {
        setMessages(prev => [...prev, { role: 'assistant', content: getWelcomePrompt(sessionData), timestamp: new Date(), step: '2.1' }]);
        setCurrentStep('2.1');
        setLoading(false);
        return;
      } else {
        const target = userInput.toLowerCase();
        const targetStep = logicTree.find(s => 
          s.id.toLowerCase() === target || 
          s.section.toLowerCase() === target ||
          s.id.split('.')[0] === target
        );
        
        if (targetStep) {
          setCurrentStep(targetStep.id);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Saltando a: ${targetStep.section}\n\n${targetStep.id === '2.1' ? getWelcomePrompt(sessionData) : targetStep.prompt}`, 
            timestamp: new Date(),
            step: targetStep.id
          }]);
          setLoading(false);
          return;
        } else {
          // Show available sections on invalid input with subsections
          const sectionMap = {};
          logicTree.forEach(s => {
            if (!sectionMap[s.section]) {
              sectionMap[s.section] = [];
            }
            if (s.prompt && s.id !== 'Jump') {
              sectionMap[s.section].push(s.id);
            }
          });
          
          // Add the new Section 7 detailed bill collection steps (7.3.a-f)
          if (sectionMap['Consumo']) {
            const consumoSteps = sectionMap['Consumo'];
            const index73 = consumoSteps.indexOf('7.3');
            if (index73 !== -1 && !consumoSteps.includes('7.3.a')) {
              consumoSteps.splice(index73 + 1, 0, '7.3.a', '7.3.b', '7.3.c', '7.3.d', '7.3.e', '7.3.f');
            }
          }
          
          const sectionList = Object.entries(sectionMap)
            .map(([name, steps]) => {
              const stepsStr = steps.length > 0 ? ` (${steps.join(', ')})` : '';
              return `• ${name}${stepsStr}`;
            })
            .join('\n');
          
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Sección no válida. Escribe el número de sección o "continuar".\n\n📋 Secciones y pasos disponibles:\n\n${sectionList}\n\nPuedes saltar a una sección completa (ej: "7") o a un paso específico (ej: "7.2")`, 
            timestamp: new Date(),
            step: 'Jump'
          }]);
          setLoading(false);
          return;
        }
      }
    }

    // SERVICES SECTION - INTEGRATED ADVANCED LOGIC
    // Step 5.1: Service selection with NLP
    if (currentStep === '5.1') {
      const response = userInput.toLowerCase();
      
      // Check if we're in confirmation mode (user already saw "¿Quieres decir...?")
      if (sessionData.services_pending) {
        // User is responding to confirmation
        const validation = validateYesNo(userInput);
        
        if (validation.isYes) {
          // Confirmed - set up tracking and proceed
          setAttemptCount(0); // Reset attempts on success
          const pending = sessionData.services_pending;
          setSessionData(prev => ({ 
            ...prev,
            services_selected: userInput,
            services_pending: null,
            services_tracking: {
              batteries: pending.batteries, solar: pending.solar, repairs: pending.repairs, sellado: pending.sellado,
              batteries_done: false, solar_done: false, repairs_done: false, sellado_done: false
            }
          }));
          
          if (pending.batteries) {
            const q = logicTree.find(s => s.id === '5.2a');
            setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]);
            setCurrentStep('5.2a');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          }
          if (pending.solar) {
            const q = logicTree.find(s => s.id === '5.3');
            setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]);
            setCurrentStep('5.3');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          }
          if (pending.repairs) {
            setSessionData(prev => ({ ...prev, repair_has_existing_asset: 'yes' }));
            const q = logicTree.find(s => s.id === '5.6');
            setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]);
            setCurrentStep('5.6');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          }
          if (pending.sellado) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Nuestros tratamientos de sellado funcionan únicamente para techos de hormigón en estos momentos (no para techos de membrana, galvalume, u otros materiales). ¿Tienes un techo de hormigón?', timestamp: new Date(), step: '5.2.hormigon' }]);
            setCurrentStep('5.2.hormigon');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          }
        } else {
          // Not confirmed - clear pending and ask again
          setSessionData(prev => ({ ...prev, services_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor indica qué servicios te interesan: paneles solares (con o sin baterías, eso te lo preguntamos después), baterías portátiles (sin paneles), reparaciones, o sellado de techo.', timestamp: new Date(), step: '5.1' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Not in confirmation mode - parse the service request
      setSessionData(prev => ({ ...prev, services_selected: userInput }));
      
      // Check for "todo" (all services)
      const isTodo = response.includes('todo') || response.includes('todos') || response.includes('all') || response.includes('everything');
      
      if (isTodo) {
        // User wants all services
        setSessionData(prev => ({ ...prev, services_pending: { batteries: true, solar: true, repairs: true, sellado: true } }));
        setMessages(prev => [...prev, { role: 'assistant', content: '¿Quieres decir paneles solares, baterías portátiles, reparaciones y sellado de techo?', timestamp: new Date() }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Detect each service type with natural language variants
      const hasBatteries = response.includes('batería') || response.includes('bateria') || response.includes('anker') || response.includes('portátil') || response.includes('portatil') || response.includes('battery');
      const hasSolar = response.includes('panel') || response.includes('solar') || response.includes('pv') || response.includes('placa') || response.includes('módulo') || response.includes('modulo') || response.includes('fotovoltaic');
      const hasRepairs = response.includes('reparación') || response.includes('reparacion') || response.includes('reparar') || response.includes('repair') || response.includes('arreglo');
      const hasSellado = response.includes('sellado') || response.includes('sellar') || response.includes('techo') || response.includes('roof') || response.includes('impermeabili') || response.includes('weatheriz');
      
      // Check if at least one valid service was detected
      if (!hasBatteries && !hasSolar && !hasRepairs && !hasSellado) {
        // Increment attempt counter
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        
        // Check if there are words that don't match any service (potential invalid input)
        const words = response.split(/\s+|,|y/).filter(w => w.length > 2);
        const hasInvalidWords = words.some(word => {
          // Skip common words
          if (['los', 'las', 'una', 'unos', 'unas', 'del', 'de', 'la', 'el', 'con', 'sin', 'para', 'por', 'nada', 'ninguno'].includes(word)) return false;
          // Check if word matches any service
          const matchesSolar = word.includes('panel') || word.includes('solar') || word.includes('plac') || word.includes('modul') || word.includes('fotovoltaic');
          const matchesBattery = word.includes('bater') || word.includes('anker') || word.includes('portát') || word.includes('portat');
          const matchesRepair = word.includes('reparac') || word.includes('reparar') || word.includes('repair') || word.includes('arreglo');
          const matchesSellado = word.includes('sellad') || word.includes('sellar') || word.includes('techo') || word.includes('roof') || word.includes('impermeabili');
          return !(matchesSolar || matchesBattery || matchesRepair || matchesSellado);
        });
        
        if (hasInvalidWords) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'No entendí algunos de los servicios que mencionaste. Los servicios disponibles son: paneles solares, baterías portátiles, reparaciones, o sellado de techo. ¿Cuáles te interesan?', timestamp: new Date(), step: '5.1' }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: 'No entendí qué servicios te interesan. Por favor selecciona al menos uno: paneles solares, baterías portátiles, reparaciones, o sellado de techo.', timestamp: new Date(), step: '5.1' }]);
        }
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid service detected - reset attempt counter
      setAttemptCount(0);
      
      // Build confirmation message for detected services
      const services = [];
      if (hasSolar) services.push('paneles solares');
      if (hasBatteries) services.push('baterías portátiles');
      if (hasRepairs) services.push('reparaciones');
      if (hasSellado) services.push('sellado de techo');
      
      // Ask for confirmation
      const servicesList = services.length === 1 ? services[0] : 
                          services.length === 2 ? `${services[0]} y ${services[1]}` :
                          `${services.slice(0, -1).join(', ')} y ${services[services.length - 1]}`;
      
      setSessionData(prev => ({ ...prev, services_pending: { batteries: hasBatteries, solar: hasSolar, repairs: hasRepairs, sellado: hasSellado } }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${servicesList}?`, timestamp: new Date(), step: '5.1' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 5.2a: Battery quantity
    if (currentStep === '5.2a') {
      const num = parseInt(userInput.trim());
      if (isNaN(num) || num < 0 || userInput.trim() !== num.toString()) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor indica un número entero válido (por ejemplo: 2, 5, 10).', timestamp: new Date(), step: '5.2a' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, cuantas_baterias_anker: num.toString(), services_tracking: { ...prev.services_tracking, batteries_done: true } }));
      const t = sessionData.services_tracking || {};
      if (t.solar && !t.solar_done) { 
        const q = logicTree.find(s => s.id === '5.3'); 
        setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
        setCurrentStep('5.3'); 
        setLoading(false); 
        setTimeout(() => inputRef.current?.focus(), 200); 
        return; 
      }
      if (t.repairs && !t.repairs_done) { 
        setSessionData(prev => ({ ...prev, repair_has_existing_asset: 'yes' })); 
        const q = logicTree.find(s => s.id === '5.6'); 
        setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
        setCurrentStep('5.6'); 
        setLoading(false); 
        setTimeout(() => inputRef.current?.focus(), 200); 
        return; 
      }
      if (t.sellado && !t.sellado_done) { 
        setMessages(prev => [...prev, { role: 'assistant', content: 'Nuestros tratamientos de sellado funcionan únicamente para techos de hormigón en estos momentos (no para techos de membrana, galvalume, u otros materiales). ¿Tienes un techo de hormigón?', timestamp: new Date(), step: '5.2.hormigon' }]); 
        setCurrentStep('5.2.hormigon'); 
        setLoading(false); 
        setTimeout(() => inputRef.current?.focus(), 200); 
        return; 
      }
      const _step61 = logicTree.find(s => s.id === '6.1');
      if (sessionData._from_prequal && sessionData.address && sessionData.municipio) {
        setSessionData(prev => ({ ...prev, business_address: prev.address }));
        const _step62 = logicTree.find(s => s.id === '6.2');
        setMessages(prev => [...prev, { role: 'assistant', content: _step62.prompt, timestamp: new Date(), step: '6.2' }]);
        setCurrentStep('6.2');
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: _step61.prompt, timestamp: new Date(), step: '6.1' }]);
        setCurrentStep('6.1');
      }
      setLoading(false);
      return;
    }

    // Step 5.3: Battery backup required?
    if (currentStep === '5.3') {
      const r = userInput.toLowerCase();
      const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
      const isNo = r.includes('no');
      
      if (isYes) { 
        setAttemptCount(0); 
        setSessionData(prev => ({ ...prev, requiere_respaldo: 'yes' })); 
        const q = logicTree.find(s => s.id === '5.4'); 
        setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
        setCurrentStep('5.4'); 
        setLoading(false); 
        setTimeout(() => inputRef.current?.focus(), 200); 
        return; 
      }
      
      if (isNo) { 
        setAttemptCount(0); 
        setSessionData(prev => ({ ...prev, requiere_respaldo: 'no', services_tracking: { ...prev.services_tracking, solar_done: true } })); 
        const t = sessionData.services_tracking || {}; 
        if (t.repairs && !t.repairs_done) { 
          setSessionData(prev => ({ ...prev, repair_has_existing_asset: 'yes' })); 
          const q = logicTree.find(s => s.id === '5.6'); 
          setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
          setCurrentStep('5.6'); 
          setLoading(false); 
          setTimeout(() => inputRef.current?.focus(), 200); 
          return; 
        } 
        if (t.sellado && !t.sellado_done) { 
          setMessages(prev => [...prev, { role: 'assistant', content: 'Nuestros tratamientos de sellado funcionan únicamente para techos de hormigón en estos momentos (no para techos de membrana, galvalume, u otros materiales). ¿Tienes un techo de hormigón?', timestamp: new Date(), step: '5.2.hormigon' }]); 
          setCurrentStep('5.2.hormigon'); 
          setLoading(false); 
          setTimeout(() => inputRef.current?.focus(), 200); 
          return; 
        } 
        const _step61 = logicTree.find(s => s.id === '6.1');
        if (sessionData._from_prequal && sessionData.address && sessionData.municipio) {
          setSessionData(prev => ({ ...prev, business_address: prev.address }));
          const _step62 = logicTree.find(s => s.id === '6.2');
          setMessages(prev => [...prev, { role: 'assistant', content: _step62.prompt, timestamp: new Date(), step: '6.2' }]);
          setCurrentStep('6.2');
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: _step61.prompt, timestamp: new Date(), step: '6.1' }]);
          setCurrentStep('6.1');
        }
        setLoading(false); 
        return; 
      }
      
      // Ambiguous answer
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);
      if (newAttemptCount >= MAX_ATTEMPTS) {
        showExitMessage();
        return;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: '¿Eso es sí o no? Por favor confirma.', timestamp: new Date(), step: '5.3' }]); 
      setLoading(false); 
      return;
    }

    // Step 5.4: Backup percentage
    if (currentStep === '5.4') {
      // Check if we're in confirmation mode
      if (sessionData.porcentaje_respaldo_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, porcentaje_respaldo: prev.porcentaje_respaldo_pending, porcentaje_respaldo_pending: null, services_tracking: { ...prev.services_tracking, solar_done: true } }));
          const t = sessionData.services_tracking || {};
          if (t.repairs && !t.repairs_done) { 
            setSessionData(prev => ({ ...prev, repair_has_existing_asset: 'yes' })); 
            const q = logicTree.find(s => s.id === '5.6'); 
            setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
            setCurrentStep('5.6'); 
            setLoading(false); 
            setTimeout(() => inputRef.current?.focus(), 200); 
            return; 
          }
          if (t.sellado && !t.sellado_done) { 
            setMessages(prev => [...prev, { role: 'assistant', content: 'Nuestros tratamientos de sellado funcionan únicamente para techos de hormigón en estos momentos (no para techos de membrana, galvalume, u otros materiales). ¿Tienes un techo de hormigón?', timestamp: new Date(), step: '5.2.hormigon' }]); 
            setCurrentStep('5.2.hormigon'); 
            setLoading(false); 
            setTimeout(() => inputRef.current?.focus(), 200); 
            return; 
          }
          const _step61x = logicTree.find(s => s.id === '6.1');
          if (sessionData._from_prequal && sessionData.address && sessionData.municipio) {
            setSessionData(prev => ({ ...prev, business_address: prev.address }));
            const _step62x = logicTree.find(s => s.id === '6.2');
            setMessages(prev => [...prev, { role: 'assistant', content: _step62x.prompt, timestamp: new Date(), step: '6.2' }]);
            setCurrentStep('6.2');
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: _step61x.prompt, timestamp: new Date(), step: '6.1' }]);
            setCurrentStep('6.1');
          }
          setLoading(false); 
          return;
        } else {
          setSessionData(prev => ({ ...prev, porcentaje_respaldo_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor indica el porcentaje que deseas respaldar (por ejemplo: 50, 25%, 100).', timestamp: new Date(), step: '5.4' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Not in confirmation mode - parse the percentage
      const num = parseFloat(userInput.trim().replace('%', ''));
      if (isNaN(num) || num < 0 || num > 100) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor indica un porcentaje válido entre 0% y 100% (por ejemplo: 50, 25%, 100).', timestamp: new Date(), step: '5.4' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Always ask for confirmation
      setSessionData(prev => ({ ...prev, porcentaje_respaldo_pending: num.toString() }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${num}%?`, timestamp: new Date(), step: '5.4' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 5.6: Repair asset type
    if (currentStep === '5.6') {
      const response = userInput.toLowerCase();
      
      // Check if we're in confirmation mode
      if (sessionData.repair_asset_type_pending) {
        const validation = validateYesNo(userInput);
        
        if (validation.isYes) {
          const assetType = sessionData.repair_asset_type_pending;
          setSessionData(prev => ({ ...prev, repair_asset_type: assetType, repair_asset_type_pending: null }));
          setAttemptCount(0);
          
          const hasBatt = assetType.toLowerCase().includes('batería') || assetType.toLowerCase().includes('bateria') || assetType.toLowerCase().includes('battery');
          if (hasBatt) { 
            const q = logicTree.find(s => s.id === '5.6.1'); 
            setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
            setCurrentStep('5.6.1'); 
            setLoading(false); 
            setTimeout(() => inputRef.current?.focus(), 200); 
            return; 
          }
          
          const q = logicTree.find(s => s.id === '5.7'); 
          setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
          setCurrentStep('5.7'); 
          setLoading(false); 
          setTimeout(() => inputRef.current?.focus(), 200); 
          return;
        } else {
          setSessionData(prev => ({ ...prev, repair_asset_type_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor indica qué tipo de equipo necesita reparación.', timestamp: new Date(), step: '5.6' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Parse equipment type
      const isTodo = response.includes('todo') || response.includes('todos') || response.includes('everything') || response.includes('all');
      
      if (isTodo) {
        const assetType = 'paneles solares, inversor, baterías, estructura y cableado';
        setSessionData(prev => ({ ...prev, repair_asset_type_pending: assetType }));
        setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${assetType}?`, timestamp: new Date() }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Detect equipment types
      const equipmentTypes = [];
      
      if (response.includes('panel') || response.includes('placa') || response.includes('módulo') || response.includes('modulo')) {
        equipmentTypes.push('paneles solares');
      }
      if (response.includes('inversor') || response.includes('inverter')) {
        equipmentTypes.push('inversor');
      }
      if (response.includes('batería') || response.includes('bateria') || response.includes('battery')) {
        equipmentTypes.push('baterías');
      }
      if (response.includes('estructura') || response.includes('structure') || response.includes('rack')) {
        equipmentTypes.push('estructura');
      }
      if (response.includes('cableado') || response.includes('cable') || response.includes('wiring')) {
        equipmentTypes.push('cableado');
      }
      
      if (equipmentTypes.length > 0) {
        const assetType = equipmentTypes.join(', ');
        setSessionData(prev => ({ ...prev, repair_asset_type_pending: assetType }));
        setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${assetType}?`, timestamp: new Date() }]);
        setAttemptCount(0);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // No equipment type detected
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);
      if (newAttemptCount >= MAX_ATTEMPTS) {
        showExitMessage();
        return;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor indica qué tipo de equipo necesita reparación (paneles solares, inversor, baterías, estructura, cableado).', timestamp: new Date(), step: '5.6' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 5.6.1: Battery brand
    if (currentStep === '5.6.1') {
      setSessionData(prev => ({ ...prev, diagnose_battery_marca: userInput }));
      const q = logicTree.find(s => s.id === '5.7'); 
      setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
      setCurrentStep('5.7'); 
      setLoading(false); 
      setTimeout(() => inputRef.current?.focus(), 200); 
      return;
    }

    // Step 5.7: Problem description
    if (currentStep === '5.7') {
      setSessionData(prev => ({ ...prev, repair_problem_description: userInput }));
      const q = logicTree.find(s => s.id === '5.8'); 
      setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
      setCurrentStep('5.8'); 
      setLoading(false); 
      setTimeout(() => inputRef.current?.focus(), 200); 
      return;
    }

    // Step 5.8: Repair urgency (with confirmation)
    if (currentStep === '5.8') {
      const urgencyLabels = { emergencia: 'emergencia 🚨', pronto: 'pronto (esta semana) 📅', rutina: 'rutina (cuando haya disponibilidad) 🗓️' };

      // ── CONFIRMATION MODE ─────────────────────────────────────────────────
      if (sessionData.repair_urgency_pending) {
        const { isYes, isNo, isUnclear } = validateYesNo(userInput);
        if (isUnclear) {
          const newAttemptCount = attemptCount + 1;
          setAttemptCount(newAttemptCount);
          if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
          setMessages(prev => [...prev, { role: 'assistant', content: '¿Es correcto? (sí / no)', timestamp: new Date(), step: '5.8' }]);
          setLoading(false); setTimeout(() => inputRef.current?.focus(), 200); return;
        }
        if (isNo) {
          setSessionData(prev => ({ ...prev, repair_urgency_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: '¿Qué tan urgente es la reparación? (emergencia, pronto, rutina)', timestamp: new Date(), step: '5.8' }]);
          setLoading(false); setTimeout(() => inputRef.current?.focus(), 200); return;
        }
        // Confirmed — save and advance
        setAttemptCount(0);
        const urgency = sessionData.repair_urgency_pending;
        setSessionData(prev => ({ ...prev, repair_urgency: urgency, repair_urgency_pending: null, services_tracking: { ...prev.services_tracking, repairs_done: true } }));
        const t = sessionData.services_tracking || {};
        if (t.sellado && !t.sellado_done) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Nuestros tratamientos de sellado funcionan únicamente para techos de hormigón en estos momentos (no para techos de membrana, galvalume, u otros materiales). ¿Tienes un techo de hormigón?', timestamp: new Date(), step: '5.2.hormigon' }]);
          setCurrentStep('5.2.hormigon');
          setLoading(false); setTimeout(() => inputRef.current?.focus(), 200); return;
        }
        if (sessionData._from_prequal && sessionData.address && sessionData.municipio) {
          setSessionData(prev => ({ ...prev, business_address: prev.address }));
          const _next62 = logicTree.find(s => s.id === '6.2');
          setMessages(prev => [...prev, { role: 'assistant', content: _next62.prompt, timestamp: new Date(), step: '6.2' }]);
          setCurrentStep('6.2');
        } else {
          const _next61 = logicTree.find(s => s.id === '6.1');
          setMessages(prev => [...prev, { role: 'assistant', content: _next61.prompt, timestamp: new Date(), step: '6.1' }]);
          setCurrentStep('6.1');
        }
        setLoading(false); return;
      }

      // ── ENTRY MODE ────────────────────────────────────────────────────────
      const r = userInput.toLowerCase();
      const isEmergencia = r.includes('emergencia') || r.includes('urgente') || r.includes('ya') || r.includes('inmediato');
      const isPronto = r.includes('pronto') || r.includes('rapido') || r.includes('rápido') || r.includes('esta semana') || r.includes('semana');
      const isRutina = r.includes('rutina') || r.includes('normal') || r.includes('cuando pueda') || r.includes('no urgente');

      if (!isEmergencia && !isPronto && !isRutina) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, { role: 'assistant', content: '¿Qué tan urgente es? Por favor responde: emergencia, pronto, o rutina.', timestamp: new Date(), step: '5.8' }]);
        setLoading(false); setTimeout(() => inputRef.current?.focus(), 200); return;
      }

      setAttemptCount(0);
      const urgency = isEmergencia ? 'emergencia' : isPronto ? 'pronto' : 'rutina';
      setSessionData(prev => ({ ...prev, repair_urgency_pending: urgency }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿La urgencia es: ${urgencyLabels[urgency]}? (sí/no)`, timestamp: new Date(), step: '5.8' }]);
      setLoading(false); return;
    }


    // ============================================================================
    // SECTION 5.2: SELLADO ROOF QUALIFICATION FLOW
    // 5.2.hormigon → 5.2.roof_count → loop(5.2.size → 5.2.condition) → next service
    // ============================================================================

    // Helper: navigate to the next pending service after sellado is done
    const selladoAdvance = () => {
      const t = sessionData.services_tracking || {};
      setSessionData(prev => ({ ...prev, services_tracking: { ...prev.services_tracking, sellado_done: true } }));
      if (t.batteries && !t.batteries_done) {
        const q = logicTree.find(s => s.id === '5.2a');
        setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]);
        setCurrentStep('5.2a');
        setLoading(false); setTimeout(() => inputRef.current?.focus(), 200); return;
      }
      if (t.solar && !t.solar_done) {
        const q = logicTree.find(s => s.id === '5.3');
        setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]);
        setCurrentStep('5.3');
        setLoading(false); setTimeout(() => inputRef.current?.focus(), 200); return;
      }
      if (t.repairs && !t.repairs_done) {
        setSessionData(prev => ({ ...prev, repair_has_existing_asset: 'yes' }));
        const q = logicTree.find(s => s.id === '5.6');
        setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]);
        setCurrentStep('5.6');
        setLoading(false); setTimeout(() => inputRef.current?.focus(), 200); return;
      }
      const _step61 = logicTree.find(s => s.id === '6.1');
      if (sessionData._from_prequal && sessionData.address && sessionData.municipio) {
        setSessionData(prev => ({ ...prev, business_address: prev.address }));
        const _step62 = logicTree.find(s => s.id === '6.2');
        setMessages(prev => [...prev, { role: 'assistant', content: _step62.prompt, timestamp: new Date(), step: '6.2' }]);
        setCurrentStep('6.2');
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: _step61.prompt, timestamp: new Date(), step: '6.1' }]);
        setCurrentStep('6.1');
      }
      setLoading(false);
    };

    // Step 5.2.hormigon: Confirm roof is hormigón
    if (currentStep === '5.2.hormigon') {
      const validation = validateYesNo(userInput);
      if (validation.isYes) {
        setAttemptCount(0);
        setSessionData(prev => ({ ...prev, sellado_hormigon: 'si' }));
        // Show roof definition + ask count
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Perfecto. Para darte un estimado preciso, necesitamos saber cuántos techos tienes.\n\nRecuerda: tienes un solo techo si la superficie es continua y podrías caminarla completa sin levantar los pies. Si hay petriles, escalones, distintos niveles o materiales, son más de un techo.\n\n¿Cuántos techos de hormigón deseas sellar? (máximo 10)',
          timestamp: new Date(),
          step: '5.2.roof_count'
        }]);
        setCurrentStep('5.2.roof_count');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      } else if (validation.isNo) {
        setAttemptCount(0);
        setSessionData(prev => ({ ...prev, sellado_hormigon: 'no' }));
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Entendido. Por el momento nuestro servicio de sellado es exclusivo para techos de hormigón, así que no podemos incluirlo en tu cotización. Continuemos con los demás servicios.',
          timestamp: new Date(),
          step: '5.2.hormigon'
        }]);
        selladoAdvance();
        return;
      } else {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor responde sí o no. ¿Tienes un techo de hormigón?',
          timestamp: new Date(),
          step: '5.2.hormigon'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
    }

    // Helper: sellado roof context
    const getSelladoRoofContext = () => {
      const num = sessionData.sellado_current_roof || 1;
      const total = parseInt(sessionData.sellado_roof_count) || 1;
      return { num, total };
    };

    // Step 5.2.roof_count: How many hormigón roofs
    if (currentStep === '5.2.roof_count') {

      // ── CONFIRMATION MODE ──────────────────────────────────────────────────
      if (sessionData.sellado_roof_count_pending !== undefined) {
        const validation = validateYesNo(userInput);
        if (validation.isYes) {
          setAttemptCount(0);
          const count = sessionData.sellado_roof_count_pending;
          setSessionData(prev => ({ ...prev, sellado_roof_count: count, sellado_roof_count_pending: undefined, sellado_current_roof: 1 }));
          const label = count === 1 ? 'un techo' : `${count} techos`;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Perfecto, ${label}. Empecemos${count === 1 ? '' : ' con el primero'}.\n\n🏠 Techo 1 de ${count}\n¿Cuál es el tamaño aproximado? Ingresa un número en pies² o:\n• pequeño — menos de 2,500 pies²\n• mediano — 2,500–5,000 pies²\n• grande — 5,000–10,000 pies²\n• industrial — 10,000–50,000 pies²`,
            timestamp: new Date(),
            step: '5.2.size'
          }]);
          setCurrentStep('5.2.size');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else if (validation.isNo) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, sellado_roof_count_pending: undefined }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Entendido. ¿Cuántos techos de hormigón deseas sellar? (máximo 10)',
            timestamp: new Date(),
            step: '5.2.roof_count'
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, sellado_roof_count_pending: undefined }));
          // Fall through to re-parse
        }
      }

      // ── ENTRY MODE ─────────────────────────────────────────────────────────
      const parsed = parseSpanishNumber(userInput);
      const roofCount = parsed !== null ? Math.round(parsed) : null;

      if (roofCount === null || roofCount < 1 || roofCount > 10 || !Number.isInteger(roofCount)) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor ingresa un número entre 1 y 10.',
          timestamp: new Date(),
          step: '5.2.roof_count'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, sellado_roof_count_pending: roofCount }));
      const countLabel = roofCount === 1 ? '1 techo' : `${roofCount} techos`;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `¿Tienes ${countLabel} de hormigón? (sí/no)`,
        timestamp: new Date(),
        step: '5.2.roof_count'
      }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 5.2.size: Sellado roof size (same logic as 8.1.size, no material)
    if (currentStep === '5.2.size') {
      const { num } = getSelladoRoofContext();
      const fieldKey = `sellado_roof_${num}_size`;

      // ── CONFIRMATION MODE ──────────────────────────────────────────────────
      if (sessionData[`${fieldKey}_pending`] !== undefined) {
        const validation = validateYesNo(userInput);
        if (validation.isYes) {
          setAttemptCount(0);
          const confirmed = sessionData[`${fieldKey}_pending`];
          setSessionData(prev => ({ ...prev, [fieldKey]: confirmed, [`${fieldKey}_pending`]: undefined }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '¿En qué condición está el techo? (excelente, buena, regular, mala)',
            timestamp: new Date(),
            step: '5.2.condition'
          }]);
          setCurrentStep('5.2.condition');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else if (validation.isNo) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: undefined }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Entendido. ¿Cuál es el tamaño del techo? Ingresa un número en pies² o: pequeño, mediano, grande, industrial.',
            timestamp: new Date(),
            step: '5.2.size'
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: undefined }));
          // Fall through to re-parse
        }
      }

      // ── ENTRY MODE ─────────────────────────────────────────────────────────
      const r = userInput.toLowerCase().trim();
      const LABEL_MAP = {
        pequeño: { value: 1500, display: 'pequeño' }, pequeno: { value: 1500, display: 'pequeño' }, small: { value: 1500, display: 'pequeño' },
        mediano: { value: 3750, display: 'mediano' }, medium: { value: 3750, display: 'mediano' },
        grande:  { value: 7500, display: 'grande' },  large:  { value: 7500, display: 'grande' },
        industrial: { value: 30000, display: 'industrial' },
      };

      let sizeValue = null;
      let confirmText = null;
      const matchedLabel = Object.keys(LABEL_MAP).find(k => r.includes(k));
      if (matchedLabel) {
        sizeValue = LABEL_MAP[matchedLabel].value;
        confirmText = LABEL_MAP[matchedLabel].display;
      } else {
        const sqftParsed = parseSpanishNumber(userInput);
        if (sqftParsed !== null && sqftParsed > 0 && sqftParsed <= 500000) {
          sizeValue = Math.round(sqftParsed);
          confirmText = `${sizeValue.toLocaleString()} pies²`;
        }
      }

      if (sizeValue === null) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'No entendí el tamaño. Por favor ingresa un número en pies² (ej: 3,500) o:\n• pequeño — menos de 2,500 pies²\n• mediano — 2,500–5,000 pies²\n• grande — 5,000–10,000 pies²\n• industrial — 10,000–50,000 pies²',
          timestamp: new Date(),
          step: '5.2.size'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: sizeValue }));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `¿El tamaño del techo es ${confirmText}? (sí/no)`,
        timestamp: new Date(),
        step: '5.2.size'
      }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 5.2.condition: Sellado roof condition
    if (currentStep === '5.2.condition') {
      const { num, total } = getSelladoRoofContext();
      const fieldKey = `sellado_roof_${num}_condition`;

      // ── CONFIRMATION MODE ──────────────────────────────────────────────────
      if (sessionData[`${fieldKey}_pending`] !== undefined) {
        const validation = validateYesNo(userInput);
        if (validation.isYes) {
          setAttemptCount(0);
          const confirmed = sessionData[`${fieldKey}_pending`];
          setSessionData(prev => ({ ...prev, [fieldKey]: confirmed, [`${fieldKey}_pending`]: undefined }));

          if (num < total) {
            // Advance to next roof
            const nextNum = num + 1;
            setSessionData(prev => ({ ...prev, sellado_current_roof: nextNum }));
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `🏠 Techo ${nextNum} de ${total}\n¿Cuál es el tamaño aproximado? Ingresa un número en pies² o:\n• pequeño — menos de 2,500 pies²\n• mediano — 2,500–5,000 pies²\n• grande — 5,000–10,000 pies²\n• industrial — 10,000–50,000 pies²`,
              timestamp: new Date(),
              step: '5.2.size'
            }]);
            setCurrentStep('5.2.size');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          } else {
            // All roofs done — clear temp state, advance to next service
            setSessionData(prev => ({ ...prev, sellado_current_roof: null }));
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `¡Listo! Registré los ${total} techo(s) para sellado.`,
              timestamp: new Date(),
              step: '5.2.condition'
            }]);
            selladoAdvance();
            return;
          }
        } else if (validation.isNo) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: undefined }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Entendido. ¿En qué condición está el techo? (excelente, buena, regular, mala)',
            timestamp: new Date(),
            step: '5.2.condition'
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: undefined }));
          // Fall through to re-parse
        }
      }

      // ── ENTRY MODE ─────────────────────────────────────────────────────────
      const r = userInput.toLowerCase();
      const isExcellent = r.includes('excelente') || r.includes('excellent') || r.includes('perfecto') || r.includes('muy buen') || r.includes('nuevo');
      const isGood      = r.includes('buen') || r.includes('good') || r.includes('bien');
      const isFair      = r.includes('regular') || r.includes('fair');
      const isPoor      = r.includes('mal') || r.includes('poor') || r.includes('deteriorad') || r.includes('dañad') || r.includes('bad');

      let conditionValue = null;
      if (isExcellent)   conditionValue = 'excelente';
      else if (isGood)   conditionValue = 'buena';
      else if (isFair)   conditionValue = 'regular';
      else if (isPoor)   conditionValue = 'mala';

      if (!conditionValue) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor indica la condición del techo: excelente, buena, regular, o mala.',
          timestamp: new Date(),
          step: '5.2.condition'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: conditionValue }));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `¿La condición del techo es ${conditionValue}? (sí/no)`,
        timestamp: new Date(),
        step: '5.2.condition'
      }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // ============================================================================
    // END SECTION 5.2 SELLADO ROOF QUALIFICATION
    // ============================================================================

    // Step 5.2: Sellado surface area
    if (currentStep === '5.2') {
      // Check if we're in confirmation mode
      if (sessionData.sellado_superficie_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, sellado_superficie: prev.sellado_superficie_pending, sellado_superficie_pending: null, services_tracking: { ...prev.services_tracking, sellado_done: true } }));
          const t = sessionData.services_tracking || {};
          if (t.batteries && !t.batteries_done) { 
            const q = logicTree.find(s => s.id === '5.2a'); 
            setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
            setCurrentStep('5.2a'); 
            setLoading(false); 
            setTimeout(() => inputRef.current?.focus(), 200); 
            return; 
          }
          if (t.solar && !t.solar_done) { 
            const q = logicTree.find(s => s.id === '5.3'); 
            setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
            setCurrentStep('5.3'); 
            setLoading(false); 
            setTimeout(() => inputRef.current?.focus(), 200); 
            return; 
          }
          if (t.repairs && !t.repairs_done) { 
            setSessionData(prev => ({ ...prev, repair_has_existing_asset: 'yes' })); 
            const q = logicTree.find(s => s.id === '5.6'); 
            setMessages(prev => [...prev, { role: 'assistant', content: q.prompt, timestamp: new Date(), step: q.id }]); 
            setCurrentStep('5.6'); 
            setLoading(false); 
            setTimeout(() => inputRef.current?.focus(), 200); 
            return; 
          }
          const _step61y = logicTree.find(s => s.id === '6.1');
          if (sessionData._from_prequal && sessionData.address && sessionData.municipio) {
            setSessionData(prev => ({ ...prev, business_address: prev.address }));
            const _step62y = logicTree.find(s => s.id === '6.2');
            setMessages(prev => [...prev, { role: 'assistant', content: _step62y.prompt, timestamp: new Date(), step: '6.2' }]);
            setCurrentStep('6.2');
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: _step61y.prompt, timestamp: new Date(), step: '6.1' }]);
            setCurrentStep('6.1');
          }
          setLoading(false); 
          return;
        } else {
          setSessionData(prev => ({ ...prev, sellado_superficie_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor indica la superficie en pies cuadrados (por ejemplo: 5000, 4 mil, 3000 sqft).', timestamp: new Date(), step: '5.2' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Parse natural language for square footage
      let sqft = null;
      const cleaned = userInput.toLowerCase().replace(/,/g, '').trim();
      
      // Parse Spanish number words
      const spanishNumbers = {
        'cero': 0, 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
        'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
        'veinte': 20, 'treinta': 30, 'cuarenta': 40, 'cincuenta': 50,
        'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90,
        'cien': 100, 'ciento': 100, 'doscientos': 200, 'trescientos': 300,
        'cuatrocientos': 400, 'quinientos': 500, 'seiscientos': 600,
        'setecientos': 700, 'ochocientos': 800, 'novecientos': 900,
        'mil': 1000, 'thousand': 1000
      };
      
      // Try to parse word numbers like "cinco mil"
      let wordValue = 0;
      const words = cleaned.split(/\s+/);
      for (let i = 0; i < words.length; i++) {
        if (spanishNumbers[words[i]]) {
          if (words[i] === 'mil' || words[i] === 'thousand') {
            wordValue = (wordValue || 1) * 1000;
          } else {
            wordValue += spanishNumbers[words[i]];
          }
        }
      }
      if (wordValue > 0) {
        sqft = wordValue;
      }
      
      // Try direct number parse
      if (!sqft) {
        const directNum = parseInt(cleaned);
        if (!isNaN(directNum) && directNum >= 0) {
          sqft = directNum;
        }
      }
      
      // Try "X mil" or "X thousand" patterns
      if (!sqft) {
        const milMatch = cleaned.match(/(\d+\.?\d*)\s*(mil|thousand|k)/);
        if (milMatch) {
          sqft = Math.round(parseFloat(milMatch[1]) * 1000);
        }
      }
      
      // Extract number even if it has units
      if (!sqft) {
        const numMatch = cleaned.match(/(\d+)/);
        if (numMatch) {
          sqft = parseInt(numMatch[1]);
        }
      }
      
      if (sqft === null || sqft < 0) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor indica la superficie en pies cuadrados (por ejemplo: 5000, 4 mil, 3000 sqft).', timestamp: new Date(), step: '5.2' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Always ask for confirmation
      setSessionData(prev => ({ ...prev, sellado_superficie_pending: sqft.toString() }));
      const formatted = sqft.toLocaleString('en-US');
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${formatted} pies cuadrados?`, timestamp: new Date() }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }
    // END SERVICES SECTION

    // SECTION 6: LOCATION - Address validation with confirmation
    // Step 6.1: Address validation (accepts traditional, Plus Code, or Google Maps link)
    if (currentStep === '6.1') {
      // Skip for pre-qual leads — address and municipio already captured
      if (sessionData._from_prequal && sessionData.address && sessionData.municipio) {
        setSessionData(prev => ({ ...prev, business_address: prev.address }));
        const nextStep = logicTree.find(s => s.id === '6.2');
        setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '6.2' }]);
        setCurrentStep('6.2');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      // Check if we're in confirmation mode
      if (sessionData.address_pending) {
        const validation = validateYesNo(userInput);
        if (validation.isYes) {
          setAttemptCount(0);
          const confirmedAddress = sessionData.address_pending;
          setSessionData(prev => ({ ...prev, business_address: confirmedAddress, address_pending: null }));
          // Extract municipio from confirmed address and go to municipio confirmation
          const extracted = extractMunicipio(confirmedAddress);
          if (extracted) {
            setSessionData(prev => ({ ...prev, municipio_pending: extracted }));
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `¿Me confirmas el municipio? ¿Es ${extracted}?`,
              timestamp: new Date(),
              step: '6.1.municipio'
            }]);
          } else {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: '¿En qué municipio está ubicado tu negocio?',
              timestamp: new Date(),
              step: '6.1.municipio'
            }]);
          }
          setCurrentStep('6.1.municipio');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else if (validation.isNo) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, address_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Entendido. Por favor proporciona la dirección correcta.', timestamp: new Date(), step: '6.1' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Unclear — user may have typed a new address instead of sí/no
          // Clear pending and fall through to re-parse as a new entry
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, address_pending: null }));
        }
      }
      
      // Validate address format
      const addressInput = userInput.trim();
      
      // Check minimum length
      if (addressInput.length < 10) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: 'La dirección parece muy corta. Por favor proporciona una dirección completa, un código Plus de Google, o un vínculo de Google Maps.', timestamp: new Date(), step: '6.1' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      const lowerAddr = addressInput.toLowerCase();
      // Normalise common LUMA formatting variations before matching:
      // "K M" → "km" (space-split kilometre), "CAR " → "carr " (bare carretera abbreviation)
      const normAddr = lowerAddr
        .replace(/\bk\s+m\b/g, 'km')
        .replace(/\bcar\b/g, 'carr');

      let isValidFormat = false;
      
      // Format 1: Google Maps link
      if (
        addressInput.includes('maps.app.goo.gl') || 
        addressInput.includes('goo.gl/maps') || 
        addressInput.includes('maps.google.com') ||
        addressInput.includes('google.com/maps')
      ) {
        isValidFormat = true;
      }
      
      // Format 2: Google Plus Code (XXXX+XX or XXXX+XXX)
      const plusCodePattern = /[A-Z0-9]{4}\+[A-Z0-9]{2,3}/i;
      if (plusCodePattern.test(addressInput)) {
        isValidFormat = true;
      }
      
      // Format 3: Puerto Rican address — street indicator + "PR" present
      const hasPRstate  = /\bPR\b/.test(addressInput);
      const hasPRzip    = /\b00[6-9]\d{2}(-\d{4})?\b/.test(addressInput);

      const hasStreetIndicator =
        normAddr.includes('calle')        ||
        normAddr.includes('avenida')      ||
        normAddr.includes('ave ')         ||  // "AVE " with trailing space avoids false match on "avel"
        normAddr.includes('ave.')         ||
        normAddr.includes('carretera')    ||
        normAddr.includes('carr')         ||  // catches CAR, CARR, CARRETERA after normalisation
        normAddr.includes('road')         ||
        normAddr.includes('route')        ||
        /\brd\b/.test(normAddr)           ||
        normAddr.includes('urbanización') ||
        normAddr.includes('urbanizacion') ||
        normAddr.includes('urb')          ||
        normAddr.includes('km')           ||  // catches KM and normalised "K M"
        /\bk\d/.test(normAddr)            ||  // K20, K3 — kilometre marker without "KM"
        normAddr.includes('kilómetro')    ||
        normAddr.includes('kilometro')    ||
        normAddr.includes('sector')       ||
        normAddr.includes('residencial')  ||
        normAddr.includes('condominio')   ||
        normAddr.includes('bypass')       ||
        normAddr.includes('by pass')      ||
        normAddr.includes('by-pass')      ||
        /\bbo\b/.test(normAddr)           ||  // barrio (BO. BAYAMON, etc.)
        /\bpda\b/.test(normAddr);             // parada (San Juan street markers)

      if ((hasStreetIndicator || hasPRzip) && hasPRstate) {
        isValidFormat = true;
      }
      
      if (!isValidFormat) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona una dirección válida:\n• Una dirección tradicional (Calle, Ave, Carretera/CAR, KM, URB, etc.) seguida de "PR"\n• Un código Plus de Google (ej: CRH5+2J)\n• O un vínculo de Google Maps', timestamp: new Date(), step: '6.1' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid address — normalize then ask for confirmation
      setAttemptCount(0);
      const normalizedAddress = normalizeAddress(addressInput);
      setSessionData(prev => ({ ...prev, address_pending: normalizedAddress }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir "${normalizedAddress}"?`, timestamp: new Date(), step: '6.1' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 6.1.municipio: Confirm or manually enter municipio
    if (currentStep === '6.1.municipio') {

      // ── CONFIRMATION MODE (extracted municipio shown to user) ──────────────
      if (sessionData.municipio_pending) {
        const validation = validateYesNo(userInput);
        if (validation.isYes) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, municipio: prev.municipio_pending, municipio_pending: null }));
          const nextStep = logicTree.find(s => s.id === '6.2');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '6.2' }]);
          setCurrentStep('6.2');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else if (validation.isNo) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, municipio_pending: null }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '¿En qué municipio está ubicado tu negocio?',
            timestamp: new Date(),
            step: '6.1.municipio'
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Unclear — fall through to parse as manual municipio entry
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, municipio_pending: null }));
        }
      }

      // ── ENTRY MODE (user types municipio manually) ─────────────────────────
      const MUNICIPIOS = [
        'Adjuntas','Aguada','Aguadilla','Aguas Buenas','Aibonito','Añasco','Arecibo','Arroyo',
        'Barceloneta','Barranquitas','Bayamón','Cabo Rojo','Caguas','Camuy','Canóvanas',
        'Carolina','Cataño','Cayey','Ceiba','Ciales','Cidra','Coamo','Comerío','Corozal',
        'Culebra','Dorado','Fajardo','Florida','Guánica','Guayama','Guayanilla','Guaynabo',
        'Gurabo','Hatillo','Hormigueros','Humacao','Isabela','Jayuya','Juana Díaz','Juncos',
        'Lajas','Lares','Las Marías','Las Piedras','Loíza','Luquillo','Manatí','Maricao',
        'Maunabo','Mayagüez','Moca','Morovis','Naguabo','Naranjito','Orocovis','Patillas',
        'Peñuelas','Ponce','Quebradillas','Rincón','Río Grande','Sabana Grande','Salinas',
        'San Germán','San Juan','San Lorenzo','San Sebastián','Santa Isabel','Toa Alta',
        'Toa Baja','Trujillo Alto','Utuado','Vega Alta','Vega Baja','Vieques','Villalba',
        'Yabucoa','Yauco'
      ];

      const inputUpper = userInput.trim().toUpperCase();
      const inputNoAccent = inputUpper.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const matched = MUNICIPIOS.find(mun => {
        const munUpper = mun.toUpperCase();
        const munNoAccent = munUpper.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return inputUpper === munUpper || inputNoAccent === munNoAccent ||
               munUpper.startsWith(inputUpper) || munNoAccent.startsWith(inputNoAccent);
      });

      if (!matched) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'No reconocí ese municipio. Por favor escribe el nombre completo, por ejemplo: "San Juan", "Ponce", "Mayagüez".',
          timestamp: new Date(),
          step: '6.1.municipio'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      // Valid — confirm the matched canonical name
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, municipio_pending: matched }));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `¿El municipio es ${matched}?`,
        timestamp: new Date(),
        step: '6.1.municipio'
      }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 6.2: CRIM validation with formatting
    if (currentStep === '6.2') {
      // Check if we're in confirmation mode
      if (sessionData.crim_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, crim_number: prev.crim_pending, crim_pending: null }));
          const nextStep = logicTree.find(s => s.id === '7.1');
          // Prequal: auto-advance past method selection — bill is already available
          if (sessionData._from_prequal) {
            const _total71 = sessionData.luma_total;
            const _fmt71 = _total71 ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(parseFloat(_total71)) : 'el total de tu factura';
            setSessionData(prev => ({ ...prev, dimensioning_method: 'factura', luma_meter_count: '1', current_meter_upload: 1 }));
            setMessages(prev => [...prev, { role: 'assistant', content: `Veo que tienes un medidor, con un total adeudado de ${_fmt71}. ¿Tienes más de un contador? (sí / no, solo uno)`, timestamp: new Date(), step: '7.1.prequal' }]);
            setCurrentStep('7.1.prequal');
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '7.1' }]);
            setCurrentStep('7.1');
          }
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, crim_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el número de CRIM de nuevo.', timestamp: new Date(), step: '6.2' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Parse and validate CRIM format
      let crimInput = userInput.trim().replace(/\s+/g, ''); // Remove spaces
      
      // Check if user said they don't have it
      const lowerInput = crimInput.toLowerCase();
      if (lowerInput === 'no' || lowerInput === 'no lo tengo' || lowerInput === 'no tengo') {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: 'El número de CRIM es necesario para continuar. Por favor ubícalo en el catastro digital o tus documentos de propiedad e ingrésalo aquí.', timestamp: new Date(), step: '6.2' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Remove existing dashes for validation
      const crimDigitsOnly = crimInput.replace(/-/g, '');
      
      // Validate: must be exactly 13 digits
      if (!/^\d{13}$/.test(crimDigitsOnly)) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: 'El número de CRIM debe tener 13 dígitos. Formato: XXX-XXX-XXX-XX-XXX o XXXXXXXXXXXXX. Por favor verifica e ingrésalo de nuevo.', timestamp: new Date(), step: '6.2' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Format CRIM with dashes: XXX-XXX-XXX-XX-XXX
      const formattedCrim = `${crimDigitsOnly.slice(0, 3)}-${crimDigitsOnly.slice(3, 6)}-${crimDigitsOnly.slice(6, 9)}-${crimDigitsOnly.slice(9, 11)}-${crimDigitsOnly.slice(11, 13)}`;
      
      // Valid CRIM - ask for confirmation with formatted version
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, crim_pending: formattedCrim }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${formattedCrim}?`, timestamp: new Date(), step: '6.2' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }
    // END SECTION 6

    // SECTION 2: INTRODUCTION
    // Step 2.1: Ready to start validation
    if (currentStep === '2.1') {
      const validation = validateYesNo(userInput);
      
      if (validation.isYes) {
        // Ready to start - proceed
        setAttemptCount(0);
        setSessionData(prev => ({ ...prev, primera_vez: 'yes' }));
        const nextStep = logicTree.find(s => s.id === '3.1');
        setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '3.1' }]);
        setCurrentStep('3.1');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      if (validation.isNo) {
        // Not ready - graceful exit
        setAttemptCount(0);
        setSessionData(prev => ({ ...prev, primera_vez: 'no' }));
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Perfecto. Regresa a este cuestionario cuando estés listo. Acá estaré listo para ayudarte.', 
          timestamp: new Date(),
          step: '2.1'
        }]);
        setSessionEnded(true);
        setLoading(false);
        return;
      }
      
      // Ambiguous/unclear response
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);
      if (newAttemptCount >= MAX_ATTEMPTS) {
        showExitMessage();
        return;
      }
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'No estoy seguro de que entendí tu respuesta. ¿Sí o no?', 
        timestamp: new Date(),
        step: '2.1'
      }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // SECTION 3 & 4: NAME AND CONTACT VALIDATION
    // Step 4.1: Business name validation
    if (currentStep === '4.1') {
      // Check if we're in confirmation mode
      if (sessionData.business_name_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, business_name: prev.business_name_pending, business_name_pending: null }));
          // If PreQual already has name+phone, skip 4.2 and 4.3
          if (sessionData._from_prequal && (sessionData.nombre || sessionData.cliente_nombre)) {
            const name = sessionData.nombre || sessionData.cliente_nombre;
            setSessionData(prev => ({ ...prev, business_name: prev.business_name_pending, business_name_pending: null, cliente_nombre: name }));
            const nextStep = logicTree.find(s => s.id === '4.4');
            const _firstName44 = name.split(' ')[0];
            const _prompt44 = `Perfecto, ${_firstName44}. ¿Nos compartes tu correo electrónico?`;
            setSessionData(prev => ({ ...prev, _4_4_prompt_shown: true }));
            setMessages(prev => [...prev, { role: 'assistant', content: _prompt44, timestamp: new Date(), step: '4.4' }]);
            setCurrentStep('4.4');
          } else {
          const nextStep = logicTree.find(s => s.id === '4.2');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.2' }]);
          setCurrentStep('4.2');
          }
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, business_name_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el nombre del negocio de nuevo.', timestamp: new Date(), step: '4.1' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate business name
      const nameValidation = validateBusinessName(userInput);
      
      if (!nameValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: nameValidation.error, timestamp: new Date(), step: '4.1' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid business name - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, business_name_pending: nameValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿El nombre del negocio es ${nameValidation.formatted}?`, timestamp: new Date(), step: '4.1' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 3.1: Referral consultant name validation
    if (currentStep === '3.1') {
      // Check if we're in confirmation mode
      if (sessionData.referido_name_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, referido_por: prev.referido_name_pending, referido_name_pending: null }));
          const nextStep = logicTree.find(s => s.id === '3.2');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '3.2' }]);
          setCurrentStep('3.2');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, referido_name_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el nombre del consultor de nuevo.', timestamp: new Date(), step: '3.1' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate name
      const nameValidation = validateName(userInput);
      
      if (nameValidation.isNobody) {
        // Nobody referred - skip to business info
        setAttemptCount(0);
        setSessionData(prev => ({ ...prev, referido_por: null, referido_email: null }));
        const nextStep = logicTree.find(s => s.id === '4.1');
        setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.1' }]);
        setCurrentStep('4.1');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      if (!nameValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: nameValidation.error, timestamp: new Date(), step: '3.1' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid name - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, referido_name_pending: nameValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Estás trabajando con ${nameValidation.formatted}?`, timestamp: new Date(), step: '3.1' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 4.2: Main contact name validation
    if (currentStep === '4.2') {
      // Skip for pre-qual leads — name was already collected
      if (sessionData._from_prequal && (sessionData.nombre || sessionData.cliente_nombre)) {
        const name = sessionData.nombre || sessionData.cliente_nombre;
        setSessionData(prev => ({ ...prev, cliente_nombre: name }));
        const nextStep = logicTree.find(s => s.id === '4.4'); // skip phone too (4.3)
        const _fn44 = (sessionData.nombre || sessionData.cliente_nombre || '').split(' ')[0];
        const _p44 = _fn44 ? `Perfecto, ${_fn44}. ¿Nos compartes tu correo electrónico?` : nextStep.prompt;
        setMessages(prev => [...prev, { role: 'assistant', content: _p44, timestamp: new Date(), step: '4.4' }]);
        setSessionData(prev => ({ ...prev, _4_4_prompt_shown: true }));
        setCurrentStep('4.4');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      // Check if we're in confirmation mode
      if (sessionData.cliente_name_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, cliente_nombre: prev.cliente_name_pending, cliente_name_pending: null }));
          const nextStep = logicTree.find(s => s.id === '4.3');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.3' }]);
          setCurrentStep('4.3');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, cliente_name_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona tu nombre de nuevo.', timestamp: new Date(), step: '4.2' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate name
      const nameValidation = validateName(userInput);
      
      if (!nameValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: nameValidation.error, timestamp: new Date(), step: '4.2' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid name - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, cliente_name_pending: nameValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Tu nombre es ${nameValidation.formatted}?`, timestamp: new Date(), step: '4.2' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 4.6: Alternate contact name validation
    if (currentStep === '4.6') {
      // Check if we're in confirmation mode
      if (sessionData.alternate_name_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, alternate_contact_nombre: prev.alternate_name_pending, alternate_name_pending: null }));
          const nextStep = logicTree.find(s => s.id === '4.7');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.7' }]);
          setCurrentStep('4.7');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, alternate_name_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el nombre del contacto alterno de nuevo.', timestamp: new Date(), step: '4.6' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate name
      const nameValidation = validateName(userInput);
      
      if (!nameValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: nameValidation.error, timestamp: new Date(), step: '4.6' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid name - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, alternate_name_pending: nameValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿El nombre del contacto alterno es ${nameValidation.formatted}?`, timestamp: new Date(), step: '4.6' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 4.10: Technical contact name validation
    if (currentStep === '4.10') {
      // Check if we're in confirmation mode
      if (sessionData.technical_name_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, technical_contact_nombre: prev.technical_name_pending, technical_name_pending: null }));
          const nextStep = logicTree.find(s => s.id === '4.11');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.11' }]);
          setCurrentStep('4.11');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, technical_name_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el nombre del contacto técnico de nuevo.', timestamp: new Date(), step: '4.10' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate name
      const nameValidation = validateName(userInput);
      
      if (!nameValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: nameValidation.error, timestamp: new Date(), step: '4.10' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid name - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, technical_name_pending: nameValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿El nombre del contacto técnico es ${nameValidation.formatted}?`, timestamp: new Date(), step: '4.10' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // SECTION 4: CONTACT VALIDATION
    // Step 4.3: Main contact phone validation
    if (currentStep === '4.3') {
      // Skip for pre-qual leads — phone was already collected
      if (sessionData._from_prequal && sessionData.phone) {
        setSessionData(prev => ({ ...prev, cliente_telefono: prev.phone }));
        const nextStep = logicTree.find(s => s.id === '4.4');
        setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.4' }]);
        setCurrentStep('4.4');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      // Check if we're in confirmation mode
      if (sessionData.phone_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, cliente_telefono: prev.phone_pending, phone_pending: null }));
          const nextStep = logicTree.find(s => s.id === '4.4');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.4' }]);
          setCurrentStep('4.4');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, phone_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el número de teléfono de nuevo.', timestamp: new Date(), step: '4.3' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate phone
      const phoneValidation = validatePhoneNumber(userInput);
      
      if (!phoneValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: phoneValidation.error, timestamp: new Date(), step: '4.3' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid phone - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, phone_pending: phoneValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${phoneValidation.formatted}?`, timestamp: new Date(), step: '4.3' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 4.4: Main contact email validation
    if (currentStep === '4.4') {
      // Prequal: personalized prompt (already shown via transition, but patch any direct entry)
      if (sessionData._from_prequal && !sessionData._4_4_prompt_shown) {
        const firstName = (sessionData.nombre || sessionData.cliente_nombre || '').split(' ')[0];
        const personalPrompt = firstName
          ? `Perfecto, ${firstName}. ¿Nos compartes tu correo electrónico?`
          : '¿Nos compartes tu correo electrónico?';
        setSessionData(prev => ({ ...prev, _4_4_prompt_shown: true }));
        setMessages(prev => [...prev, { role: 'assistant', content: personalPrompt, timestamp: new Date(), step: '4.4' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      // Check if we're in confirmation mode
      if (sessionData.email_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, cliente_email: prev.email_pending, email_pending: null }));
          const nextStep = logicTree.find(s => s.id === '4.5');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.5' }]);
          setCurrentStep('4.5');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, email_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el correo electrónico de nuevo.', timestamp: new Date(), step: '4.4' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate email
      const emailValidation = validateEmail(userInput);
      
      if (!emailValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: emailValidation.error, timestamp: new Date(), step: '4.4' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid email - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, email_pending: emailValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${emailValidation.formatted}?`, timestamp: new Date(), step: '4.4' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 3.2: Referral consultant email validation
    if (currentStep === '3.2') {
      // Check if we're in confirmation mode
      if (sessionData.referido_email_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, referido_email: prev.referido_email_pending, referido_email_pending: null }));
          const nextStep = logicTree.find(s => s.id === '4.1');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.1' }]);
          setCurrentStep('4.1');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, referido_email_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el correo electrónico de nuevo.', timestamp: new Date(), step: '3.2' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate email
      const emailValidation = validateEmail(userInput);
      
      if (!emailValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: emailValidation.error, timestamp: new Date(), step: '3.2' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid email - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, referido_email_pending: emailValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${emailValidation.formatted}?`, timestamp: new Date(), step: '3.2' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 4.7: Alternate contact phone validation
    if (currentStep === '4.7') {
      // Check if we're in confirmation mode
      if (sessionData.alternate_phone_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, alternate_contact_telefono: prev.alternate_phone_pending, alternate_phone_pending: null }));
          const nextStep = logicTree.find(s => s.id === '4.8');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.8' }]);
          setCurrentStep('4.8');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, alternate_phone_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el número de teléfono de nuevo.', timestamp: new Date(), step: '4.7' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate phone
      const phoneValidation = validatePhoneNumber(userInput);
      
      if (!phoneValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: phoneValidation.error, timestamp: new Date(), step: '4.7' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid phone - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, alternate_phone_pending: phoneValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${phoneValidation.formatted}?`, timestamp: new Date(), step: '4.7' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 4.8: Alternate contact email validation
    if (currentStep === '4.8') {
      // Check if we're in confirmation mode
      if (sessionData.alternate_email_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, alternate_contact_email: prev.alternate_email_pending, alternate_email_pending: null }));
          const nextStep = logicTree.find(s => s.id === '4.9');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.9' }]);
          setCurrentStep('4.9');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, alternate_email_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el correo electrónico de nuevo.', timestamp: new Date(), step: '4.8' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate email
      const emailValidation = validateEmail(userInput);
      
      if (!emailValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: emailValidation.error, timestamp: new Date(), step: '4.8' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid email - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, alternate_email_pending: emailValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${emailValidation.formatted}?`, timestamp: new Date(), step: '4.8' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 4.11: Technical contact phone validation
    if (currentStep === '4.11') {
      // Check if we're in confirmation mode
      if (sessionData.technical_phone_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, technical_contact_telefono: prev.technical_phone_pending, technical_phone_pending: null }));
          const nextStep = logicTree.find(s => s.id === '4.12');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.12' }]);
          setCurrentStep('4.12');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, technical_phone_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el número de teléfono de nuevo.', timestamp: new Date(), step: '4.11' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate phone
      const phoneValidation = validatePhoneNumber(userInput);
      
      if (!phoneValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: phoneValidation.error, timestamp: new Date(), step: '4.11' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid phone - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, technical_phone_pending: phoneValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${phoneValidation.formatted}?`, timestamp: new Date(), step: '4.11' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 4.12: Technical contact email validation
    if (currentStep === '4.12') {
      // Check if we're in confirmation mode
      if (sessionData.technical_email_pending) {
        const r = userInput.toLowerCase();
        const isYes = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('claro') || r.includes('dale') || r.includes('ok');
        
        if (isYes) {
          // Confirmed
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, technical_contact_email: prev.technical_email_pending, technical_email_pending: null }));
          const nextStep = logicTree.find(s => s.id === '4.13');
          setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.13' }]);
          setCurrentStep('4.13');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, technical_email_pending: null }));
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor proporciona el correo electrónico de nuevo.', timestamp: new Date(), step: '4.12' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Validate email
      const emailValidation = validateEmail(userInput);
      
      if (!emailValidation.valid) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: emailValidation.error, timestamp: new Date(), step: '4.12' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid email - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, technical_email_pending: emailValidation.formatted }));
      setMessages(prev => [...prev, { role: 'assistant', content: `¿Quieres decir ${emailValidation.formatted}?`, timestamp: new Date(), step: '4.12' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }
    // END SECTION 4 CONTACT VALIDATION

    // SECTION 7: CONSUMPTION - COMPREHENSIVE VALIDATION
    // Step 7.1: Dimensioning method (factura or estimado)
    if (currentStep === '7.1') {
      // Pre-qual: skip method selection, auto-set to factura, show total from link
      if (sessionData._from_prequal) {
        const total = sessionData.luma_total;
        const fmtTotal = total ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(parseFloat(total)) : 'el total de tu factura';
        setSessionData(prev => ({ ...prev, dimensioning_method: 'factura', luma_meter_count: '1', current_meter_upload: 1 }));
        const promptText = `Veo que tienes un medidor, con un total adeudado de ${fmtTotal}. ¿Tienes más de un contador? (sí / no, solo uno)`;
        setMessages(prev => [...prev, { role: 'assistant', content: promptText, timestamp: new Date(), step: '7.1.prequal' }]);
        setCurrentStep('7.1.prequal');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      // Check if we're in confirmation mode
      if (sessionData.dimensioning_method_pending) {
        const validation = validateYesNo(userInput);
        
        if (validation.isYes) {
          // Confirmed
          setAttemptCount(0);
          const method = sessionData.dimensioning_method_pending;
          setSessionData(prev => ({ ...prev, dimensioning_method: method, dimensioning_method_pending: null }));
          
          if (method === 'estimado') {
            // Ask clarifying question about off-grid
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: 'Ok, estimado: ¿quieres decir que tu negocio no está interconectado con LUMA? o ¿que no tienes la factura a la mano? Puedes responder "sistema off-grid", si el sistema no está interconectado, o "no la tengo", si estás conectado pero simplemente no la tienes a la mano.', 
              timestamp: new Date(), 
              step: '7.1.1' 
            }]);
            setCurrentStep('7.1.1');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          } else {
            // Method is factura - proceed to meter count
            const nextStep = logicTree.find(s => s.id === '7.2');
            setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '7.2' }]);
            setCurrentStep('7.2');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          }
        } else {
          // Not confirmed - ask again
          setSessionData(prev => ({ ...prev, dimensioning_method_pending: null }));
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Por favor indícanos si prefieres usar tu factura de LUMA o hacer un estimado.', 
            timestamp: new Date(), 
            step: '7.1' 
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Parse natural language input
      const response = userInput.toLowerCase();
      let method = null;
      
      // Detect "factura"
      if (response.includes('factura') || response.includes('recibo') || response.includes('luma') || 
          response.includes('bill') || response.includes('cuenta')) {
        method = 'factura';
      }
      // Detect "estimado"
      else if (response.includes('estimado') || response.includes('estimar') || response.includes('estimate') ||
               response.includes('aproximado') || response.includes('calculo') || response.includes('cálculo')) {
        method = 'estimado';
      }
      
      if (!method) {
        // Could not map to factura or estimado
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'No entendí tu respuesta. Por favor indica si prefieres usar tu "factura" de LUMA o hacer un "estimado" de consumo.', 
          timestamp: new Date(), 
          step: '7.1' 
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid method detected - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, dimensioning_method_pending: method }));
      const confirmText = method === 'factura' ? '¿Quieres usar la factura?' : '¿Quieres usar un estimado?';
      setMessages(prev => [...prev, { role: 'assistant', content: confirmText, timestamp: new Date(), step: '7.1' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 7.1.prequal: pre-qual lead confirms meter count
    // If they say "no / solo uno" → skip upload for meter 1 (use prequal data), go to 7.2 only if >1
    // If they say "sí" → update meter count and ask for additional bills
    if (currentStep === '7.1.prequal') {
      const { isYes, isNo, isUnclear } = validateYesNo(userInput);
      if (isUnclear) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, { role: 'assistant', content: '¿Tienes más de un medidor de LUMA? (sí / no, solo uno)', timestamp: new Date(), step: '7.1.prequal' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      setAttemptCount(0);
      if (isNo) {
        // Only one meter — show prequal bill data in card for user to verify
        setSessionData(prev => ({ ...prev, luma_meter_count: '1', prequal_bill_used: true }));
        const ocrReviewData = {
          address_pending:       sessionData.address,
          municipio_pending:     sessionData.municipio,
          luma_total_pending:    sessionData.luma_total,
          tarifa_pending:        sessionData.tarifa,
          demanda_pending:       sessionData.demanda_contratada,
          cargo_cliente_pending: sessionData.cargo_cliente,
          cargo_demanda_pending: sessionData.cargo_demanda,
          exceso_kva_pending:    sessionData.exceso_kva,
          exceso_usd_pending:    sessionData.exceso_usd,
          consumo_pending:       sessionData.consumo_kwh,
          costo_kwh_pending:     sessionData.costo_kwh,
        };
        setSessionData(prev => ({ ...prev, _ocr_review_data: ocrReviewData, ...ocrReviewData }));
        setCheckedFields([]);
        setMessages(prev => [...prev,
          {
            role: 'assistant',
            content: 'Estos son los datos de tu factura del pre-cuestionario. Verifica que sigan siendo correctos — las facturas cambian cada mes.\n\n• Si todo está igual: escribe listo\n• Si algo cambió: márcalo y escribe corregir\n• Si necesitas ayuda: escribe ayuda',
            timestamp: new Date(), step: 'BILL_REVIEW'
          },
          {
            role: 'assistant', content: '__OCR_REVIEW__',
            timestamp: new Date(), step: 'BILL_REVIEW',
            type: 'ocr_review', ocrData: ocrReviewData
          }
        ]);
        setCurrentStep('BILL_REVIEW');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      } else {
        // More than one meter — ask how many and upload the rest
        setMessages(prev => [...prev, { role: 'assistant', content: 'Si tienes más de un medidor, ingresa el número aquí. Si solo uno, ingresa 1.', timestamp: new Date(), step: '7.2' }]);
        setCurrentStep('7.2');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
    }

    // Step 7.1.1: Off-grid clarification (only reached if method = estimado)
    if (currentStep === '7.1.1') {
      const response = userInput.toLowerCase();
      let isOffGrid = null;
      
      // Detect off-grid patterns
      if (response.includes('offgrid') || response.includes('off-grid') || response.includes('off grid') ||
          response.includes('no está interconectado') || response.includes('no esta interconectado') ||
          response.includes('no tengo luma') || response.includes('sin luma') ||
          (response === 'no' && !response.includes('no la tengo') && !response.includes('no tengo la factura'))) {
        isOffGrid = true;
      }
      // Detect has-meter-but-no-bill patterns
      else if (response.includes('no la tengo') || response.includes('no tengo la factura') ||
               response.includes('no tengo factura') || response.includes('no está a la mano') ||
               response.includes('no esta a la mano') || response.includes('no la encuentro') ||
               response.includes('a la mano')) {
        isOffGrid = false;
      }
      
      if (isOffGrid === null) {
        // Unclear response
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'No entendí tu respuesta. ¿Tu negocio NO está conectado a LUMA (off-grid)? O ¿simplemente no tienes la factura a la mano?', 
          timestamp: new Date(), 
          step: '7.1.1' 
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid response - store it and proceed with confirmation message
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, off_grid: isOffGrid ? 'yes' : 'no' }));
      
      if (isOffGrid) {
        // Off-grid system - skip meter count, go straight to estimate
        setSessionData(prev => ({ ...prev, luma_meter_count: '0' }));
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Entendido, sistema off-grid. Por favor indícanos el consumo estimado mensual en kWh.', 
          timestamp: new Date(), 
          step: '7.3' 
        }]);
        setCurrentStep('7.3');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      } else {
        // Has meters but no bill - proceed to meter count with conversational confirmation
        const nextStep = logicTree.find(s => s.id === '7.2');
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Ok, el sistema está interconectado pero no tienes la factura. Está bien. Dinos: ${nextStep.prompt}`, 
          timestamp: new Date(), 
          step: '7.2' 
        }]);
        setCurrentStep('7.2');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
    }

    // Step 7.2: LUMA meter count (0-100)
    if (currentStep === '7.2') {
      // Pre-qual: no confirmation needed — accept number directly
      if (sessionData._from_prequal && sessionData.meter_count_pending === undefined) {
        const parsed = parseInt(userInput.trim());
        if (isNaN(parsed) || parsed < 1 || parsed > 100) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor ingresa un número válido (1–100).', timestamp: new Date(), step: '7.2' }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
        setSessionData(prev => ({ ...prev, luma_meter_count: parsed.toString(), current_meter_upload: 1 }));
        if (parsed === 1) {
          // Only 1 meter total — use prequal data, skip upload, go to Section 8
          setSessionData(prev => ({ ...prev, prequal_bill_used: true }));
          const step8 = logicTree.find(s => s.id === '8');
          setMessages(prev => [...prev, { role: 'assistant', content: `Perfecto. Usaremos los datos de tu factura del pre-cuestionario.

${step8.prompt}`, timestamp: new Date(), step: '8' }]);
          setCurrentStep('8');
        } else {
          // More than 1 meter — meter 1 is from prequal, ask for remaining bills
          const remaining = parsed - 1;
          setSessionData(prev => ({ ...prev, prequal_bill_used: true, current_meter_upload: 2 }));
          setMessages(prev => [...prev, { role: 'assistant', content: `Entendido, ${parsed} medidores. Tenemos la factura del medidor 1. Por favor sube la factura del medidor 2 de ${parsed}.`, timestamp: new Date(), step: '7.3' }]);
          setCurrentStep('7.3');
        }
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      // Check if we're in confirmation mode
      if (sessionData.meter_count_pending !== undefined) {
        const validation = validateYesNo(userInput);
        
        if (validation.isYes) {
          // Confirmed
          setAttemptCount(0);
          const count = sessionData.meter_count_pending;
          setSessionData(prev => ({ ...prev, luma_meter_count: count.toString(), meter_count_pending: undefined }));
          
          // Special case: if count is 0, it means off-grid
          if (count === 0) {
            setSessionData(prev => ({ ...prev, dimensioning_method: 'estimado', off_grid: 'yes' }));
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: 'Entendido, sistema off-grid sin medidores de LUMA. Por favor indícanos el consumo estimado mensual en kWh.', 
              timestamp: new Date(), 
              step: '7.3' 
            }]);
            setCurrentStep('7.3');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          }
          
          // Count > 0, proceed to bill upload/estimate based on dimensioning_method
          if (sessionData.dimensioning_method === 'factura') {
            setSessionData(prev => ({ ...prev, current_meter_upload: 1 }));
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `Por favor, sube una foto de tu factura más reciente para el medidor 1 de ${count}.`, 
              timestamp: new Date(), 
              step: '7.3' 
            }]);
          } else {
            setSessionData(prev => ({ ...prev, current_meter_estimate: 1 }));
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `Por favor, indícanos el consumo estimado mensual (en kWh) del medidor 1 de ${count}.`, 
              timestamp: new Date(), 
              step: '7.3' 
            }]);
          }
          setCurrentStep('7.3');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Not confirmed
          setSessionData(prev => ({ ...prev, meter_count_pending: undefined }));
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Por favor indica cuántos medidores de LUMA tiene tu negocio (0 si es off-grid).', 
            timestamp: new Date(), 
            step: '7.2' 
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      // Parse natural language input for meter count
      const response = userInput.toLowerCase().trim();
      let count = null;
      
      // Detect zero/off-grid patterns
      if (response === '0' || response === 'cero' || response === 'ninguno' ||
          response.includes('offgrid') || response.includes('off-grid') || response.includes('off grid') ||
          response.includes('sistema off') || response.includes('sin medidor')) {
        count = 0;
      }
      // Detect Spanish number words (uno through diez)
      else if (response === 'uno' || response === 'un' || response.includes('solo uno') || response.includes('uno nada') || response.includes('un medidor')) {
        count = 1;
      }
      else if (response === 'dos') count = 2;
      else if (response === 'tres') count = 3;
      else if (response === 'cuatro') count = 4;
      else if (response === 'cinco') count = 5;
      else if (response === 'seis') count = 6;
      else if (response === 'siete') count = 7;
      else if (response === 'ocho') count = 8;
      else if (response === 'nueve') count = 9;
      else if (response === 'diez') count = 10;
      else if (response === 'once') count = 11;
      else if (response === 'doce') count = 12;
      else if (response === 'trece') count = 13;
      else if (response === 'catorce') count = 14;
      else if (response === 'quince') count = 15;
      else if (response === 'dieciséis' || response === 'dieciseis') count = 16;
      else if (response === 'diecisiete') count = 17;
      else if (response === 'dieciocho') count = 18;
      else if (response === 'diecinueve') count = 19;
      else if (response === 'veinte') count = 20;
      // Try to parse as number
      else {
        const parsed = parseInt(response);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          count = parsed;
        }
      }
      
      if (count === null) {
        // Invalid input
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Por favor proporciona un número válido entre 1 y 100. Por ejemplo: 1, 2, 3, etc.', 
          timestamp: new Date(), 
          step: '7.2' 
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid count - ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, meter_count_pending: count }));
      const confirmText = count === 0 
        ? '¿Tu sistema es off-grid (sin medidores de LUMA)?' 
        : count === 1 
        ? '¿Tu negocio tiene 1 medidor?' 
        : `¿Tu negocio tiene ${count} medidores?`;
      setMessages(prev => [...prev, { role: 'assistant', content: confirmText, timestamp: new Date(), step: '7.2' }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 7.3.1: Process "is typical" response after bill upload
    if (currentStep === '7.3.1') {
      const meterCount = parseInt(sessionData.luma_meter_count || '1');
      const currentMeterNumber = sessionData.awaiting_typical_response_for_meter;
      
      // Check if we're in confirmation mode
      if (sessionData.typical_pending !== undefined) {
        const validation = validateYesNo(userInput);
        
        if (validation.isYes) {
          // Confirmed
          setAttemptCount(0);
          const isTypical = sessionData.typical_pending;
          const billTypicalData = sessionData.luma_bill_is_typical || {};
          billTypicalData[`meter_${currentMeterNumber}`] = {
            is_typical: isTypical ? 'yes' : 'no',
            atypical_reason: isTypical ? null : sessionData.atypical_reason_pending || null
          };
          
          setSessionData(prev => ({ 
            ...prev, 
            luma_bill_is_typical: billTypicalData,
            typical_pending: undefined,
            atypical_reason_pending: undefined
          }));
          
          // Check if we need more bills
          if (currentMeterNumber < meterCount) {
            // More meters to upload
            setSessionData(prev => ({ 
              ...prev, 
              current_meter_upload: currentMeterNumber + 1,
              awaiting_typical_response_for_meter: null
            }));
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `Ok, el consumo del medidor ${currentMeterNumber} es ${isTypical ? 'típico' : 'atípico'}, vamos adelante. Por favor, sube una foto de tu factura más reciente para el medidor ${currentMeterNumber + 1} de ${meterCount}.`, 
              timestamp: new Date(),
              step: '7.3'
            }]);
            setCurrentStep('7.3');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          } else {
            // All meters uploaded and processed - proceed to next section
            setSessionData(prev => ({ 
              ...prev, 
              luma_bill_uploaded: JSON.stringify(prev.uploaded_bills || {}),
              awaiting_typical_response_for_meter: null
            }));
            
            const nextStep = logicTree.find(s => s.id === '8');
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: meterCount > 1 
                ? `Hemos procesado las ${meterCount} facturas.\n\n${nextStep.prompt}` 
                : `${nextStep.prompt}`, 
              timestamp: new Date(),
              step: '8'
            }]);
            setCurrentStep('8');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          }
        } else {
          // Not confirmed - ask again
          setSessionData(prev => ({ ...prev, typical_pending: undefined, atypical_reason_pending: undefined }));
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: '¿Esta factura refleja el consumo típico de tu negocio? Por favor responde sí o no.', 
            timestamp: new Date(), 
            step: '7.3.1' 
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }
      
      const response = userInput.toLowerCase();
      let isTypical = null;
      
      // Detect atypical patterns FIRST (must check before typical patterns)
      if (response.includes('no es tipico') || response.includes('no es típico') ||
          response.includes('no tipico') || response.includes('no típico') ||
          response.includes('no es normal') || response.includes('inusual') || 
          response.includes('atípico') || response.includes('atipico') ||
          (response === 'no' || response.startsWith('no '))) {
        isTypical = false;
      }
      // Detect typical patterns AFTER
      else if (response.includes('sí') || response.includes('si') || response.includes('yes') || 
          response.includes('típico') || response.includes('tipico') || response.includes('normal') ||
          response.includes('usual') || response === 's' || response === 'es tipico' || 
          response === 'es típico') {
        isTypical = true;
      }
      
      if (isTypical === null) {
        // Unclear response
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'No entendí tu respuesta. ¿Esta factura refleja el consumo típico del negocio? Por favor responde sí o no.', 
          timestamp: new Date(), 
          step: '7.3.1' 
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Valid response detected
      setAttemptCount(0);
      
      if (isTypical) {
        // Typical - ask for confirmation
        setSessionData(prev => ({ ...prev, typical_pending: true }));
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `¿Quieres decir que el consumo del medidor ${currentMeterNumber} es típico?`, 
          timestamp: new Date(), 
          step: '7.3.1' 
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      } else {
        // Atypical - ask for explanation
        setSessionData(prev => ({ ...prev, typical_pending: false, awaiting_atypical_explanation: true }));
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Por favor explica por qué no es típica esta factura.', 
          timestamp: new Date(), 
          step: '7.3.2' 
        }]);
        setCurrentStep('7.3.2');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
    }

    // Step 7.3.2: Capture atypical explanation
    if (currentStep === '7.3.2') {
      const currentMeterNumber = sessionData.awaiting_typical_response_for_meter;
      
      // Store the explanation and ask for confirmation
      setSessionData(prev => ({ 
        ...prev, 
        atypical_reason_pending: userInput,
        awaiting_atypical_explanation: false
      }));
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `¿Quieres decir que el consumo del medidor ${currentMeterNumber} no es típico porque: "${userInput}"?`, 
        timestamp: new Date(), 
        step: '7.3.1' 
      }]);
      setCurrentStep('7.3.1');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 7.3: Bill upload or estimate entry (handles multiple meters)
    if (currentStep === '7.3') {
      const meterCount = parseInt(sessionData.luma_meter_count || '1');
      const dimensioningMethod = sessionData.dimensioning_method;
      const isOffGrid = sessionData.off_grid === 'yes';
      
      // If off-grid or estimado with 1 meter, just collect single estimate
      if (isOffGrid || (dimensioningMethod === 'estimado' && meterCount === 1)) {
        // Check if we're in confirmation mode
        if (sessionData.estimate_kwh_pending !== undefined) {
          const validation = validateYesNo(userInput);
          
          if (validation.isYes) {
            // Confirmed
            setAttemptCount(0);
            const kwh = sessionData.estimate_kwh_pending;
            setSessionData(prev => ({ 
              ...prev, 
              avg_consumo_mensual_kwh: kwh.toString(),
              estimate_kwh_pending: undefined
            }));
            
            // Proceed to Section 8
            const nextStep = logicTree.find(s => s.id === '8');
            const formattedKwh = kwh.toLocaleString();
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `Consumo estimado mensual: ${formattedKwh} kWh.\n\n${nextStep.prompt}`, 
              timestamp: new Date(), 
              step: '8' 
            }]);
            setCurrentStep('8');
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          } else {
            // Not confirmed
            setSessionData(prev => ({ ...prev, estimate_kwh_pending: undefined }));
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: 'Por favor indica el consumo estimado mensual en kWh.', 
              timestamp: new Date(), 
              step: '7.3' 
            }]);
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          }
        }
        
        // Parse kWh from input (supports Spanish number words)
        const kwh = parseSpanishNumber(userInput);
        
        if (!kwh || kwh <= 0) {
          const newAttemptCount = attemptCount + 1;
          setAttemptCount(newAttemptCount);
          if (newAttemptCount >= MAX_ATTEMPTS) {
            showExitMessage();
            return;
          }
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Por favor proporciona un número válido mayor a 0 (por ejemplo: 1000, 2500, "mil quinientos", etc.).', 
            timestamp: new Date(), 
            step: '7.3' 
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
        
        // Valid kWh - ask for confirmation
        setAttemptCount(0);
        setSessionData(prev => ({ ...prev, estimate_kwh_pending: kwh }));
        const formattedKwh = kwh.toLocaleString();
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `¿Quieres decir ${formattedKwh} kWh mensuales?`, 
          timestamp: new Date(), 
          step: '7.3' 
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // Multiple meters case - track progress
      if (dimensioningMethod === 'estimado') {
        const currentMeter = sessionData.current_meter_estimate || 1;
        
        // Check if we're in confirmation mode
        if (sessionData.estimate_kwh_pending !== undefined) {
          const validation = validateYesNo(userInput);
          
          if (validation.isYes) {
            // Confirmed
            setAttemptCount(0);
            const kwh = sessionData.estimate_kwh_pending;
            
            // Store this meter's consumption
            const meterConsumption = sessionData.meter_consumption || {};
            meterConsumption[`meter_${currentMeter}`] = kwh;
            
            if (currentMeter < meterCount) {
              // More meters to go
              setSessionData(prev => ({ 
                ...prev, 
                current_meter_estimate: currentMeter + 1,
                meter_consumption: meterConsumption,
                estimate_kwh_pending: undefined
              }));
              setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: `Por favor, indícanos el consumo estimado mensual (en kWh) del medidor ${currentMeter + 1} de ${meterCount}.`, 
                timestamp: new Date(), 
                step: '7.3' 
              }]);
              setLoading(false);
              setTimeout(() => inputRef.current?.focus(), 200);
              return;
            } else {
              // Last meter - calculate total and proceed to Section 8
              const totalKwh = Object.values(meterConsumption).reduce((sum, val) => sum + val, 0);
              setSessionData(prev => ({ 
                ...prev, 
                meter_consumption: meterConsumption,
                avg_consumo_mensual_kwh: totalKwh.toString(),
                estimate_kwh_pending: undefined
              }));
              
              // Proceed to Section 8 with total displayed
              const nextStep = logicTree.find(s => s.id === '8');
              const formattedTotal = totalKwh.toLocaleString();
              setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: `Consumo estimado mensual total: ${formattedTotal} kWh.\n\n${nextStep.prompt}`, 
                timestamp: new Date(), 
                step: '8' 
              }]);
              setCurrentStep('8');
              setLoading(false);
              setTimeout(() => inputRef.current?.focus(), 200);
              return;
            }
          } else {
            // Not confirmed - ask again
            setSessionData(prev => ({ ...prev, estimate_kwh_pending: undefined }));
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `Por favor indica el consumo estimado mensual (en kWh) del medidor ${currentMeter}.`, 
              timestamp: new Date(), 
              step: '7.3' 
            }]);
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 200);
            return;
          }
        }
        
        // Parse kWh from input (supports Spanish number words)
        const kwh = parseSpanishNumber(userInput);
        
        if (!kwh || kwh <= 0) {
          const newAttemptCount = attemptCount + 1;
          setAttemptCount(newAttemptCount);
          if (newAttemptCount >= MAX_ATTEMPTS) {
            showExitMessage();
            return;
          }
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Por favor proporciona un número válido mayor a 0 (por ejemplo: 1000, 2500, "mil quinientos", etc.).', 
            timestamp: new Date(), 
            step: '7.3' 
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
        
        // Valid kWh - ask for confirmation
        setAttemptCount(0);
        setSessionData(prev => ({ ...prev, estimate_kwh_pending: kwh }));
        const formattedKwh = kwh.toLocaleString();
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `¿Quieres decir ${formattedKwh} kWh mensuales?`, 
          timestamp: new Date(), 
          step: '7.3' 
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      
      // If dimensioning_method is 'factura', file upload is handled separately in handleFileUpload
      // After bill upload, collect detailed bill data before asking typical/atypical
      // This is handled in steps 7.3.a through 7.3.f
    }

    // ============================================================================
    // BILL_REVIEW: OCR card review (replaces old 7.3.a–7.3.g field-by-field flow)
    // ============================================================================

    if (currentStep === 'BILL_REVIEW') {
      const intent = classifyOCRIntent(userInput);
      const ocrData = sessionData._ocr_review_data || sessionData;
      const defs = getFieldDefs(ocrData.tarifa_pending ?? ocrData.tarifa);

      if (intent === 'listo') {
        if (checkedFields.length > 0) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Veo que marcaste algunos campos. ¿Quieres corregirlos antes de continuar? (corregir / listo de todas formas)', timestamp: new Date(), step: 'BILL_REVIEW' }]);
          setLoading(false); return;
        }
        setMessages(prev => prev.map(m => m.type === 'ocr_review' ? { ...m, locked: true } : m));
        setSessionData(prev => commitAllOCR({ ...prev, ...(prev._ocr_review_data || {}) }));
        setCheckedFields([]);
        const step8 = logicTree.find(s => s.id === '8');
        setMessages(prev => [...prev, { role: 'assistant', content: `¡Perfecto! Seguimos.\n\n${step8.prompt}`, timestamp: new Date(), step: '8' }]);
        setCurrentStep('8');
        setLoading(false); return;
      }

      if (intent === 'corregir') {
        const queue = checkedFields.length === 0
          ? defs.map(f => f.fixStep)
          : defs.filter(f => checkedFields.includes(f.id)).map(f => f.fixStep);
        setMessages(prev => prev.map(m => m.type === 'ocr_review' ? { ...m, locked: true } : m));
        setFixQueue(queue.slice(1));
        startNextFix(queue, ocrData, false);
        return;
      }

      if (intent === 'ayuda') {
        const queue = checkedFields.length === 0
          ? defs.map(f => f.fixStep)
          : defs.filter(f => checkedFields.includes(f.id)).map(f => f.fixStep);
        setMessages(prev => prev.map(m => m.type === 'ocr_review' ? { ...m, locked: true } : m));
        setFixQueue(queue.slice(1));
        startNextFix(queue, ocrData, true);
        return;
      }

      const newCount = attemptCount + 1; setAttemptCount(newCount);
      if (newCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
      setMessages(prev => [...prev, { role: 'assistant', content: 'Escribe "listo" para confirmar, "corregir" si hay errores, o "ayuda" si necesitas orientación.', timestamp: new Date(), step: 'BILL_REVIEW' }]);
      setLoading(false); return;
    }

    // ── FIX_* handlers (correction flow for OCR card) ─────────────────────────
    {
      const fixHandlers = {
        FIX_ADDRESS: {
          pendingKey: 'address_fix_pending', targetKey: 'address_pending',
          parse: (t) => t.length >= 5 ? t.trim() : null,
          confirmMsg: (v) => `¿La dirección correcta es "${v}"?`,
          retryMsg: 'Ingresa la dirección completa:',
          errorMsg: 'La dirección parece demasiado corta. Intenta de nuevo:',
          onCommit: (val, d) => {
            const mun = extractMunicipio(val);
            return { ...d, address_pending: val, municipio_pending: mun || d.municipio_pending };
          },
        },
        FIX_MUNICIPIO: {
          pendingKey: 'municipio_fix_pending', targetKey: 'municipio_pending',
          parse: (t) => {
            const MUNS = Object.keys(MUNICIPIO_YIELDS);
            const up = t.trim().toUpperCase();
            const na = up.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
            return MUNS.find(m => { const mu=m.toUpperCase(); const mn=mu.normalize('NFD').replace(/[\u0300-\u036f]/g,''); return up===mu||na===mn||mu.startsWith(up)||mn.startsWith(na); }) ?? null;
          },
          confirmMsg: (v) => `¿El municipio correcto es ${v}?`,
          retryMsg: 'Escribe el nombre del municipio (ej: Ponce, San Juan):',
          errorMsg: 'No reconocí ese municipio. Escribe el nombre completo:',
        },
        FIX_TOTAL: {
          pendingKey: 'luma_total_fix_pending', targetKey: 'luma_total_pending',
          parse: parseSpanishNumber,
          confirmMsg: (v) => `¿El total adeudado correcto es ${fmtUSD(v)}?`,
          retryMsg: 'Ingresa el monto total adeudado:', errorMsg: 'Ingresa un monto válido en dólares:',
        },
        FIX_TARIFA: {
          pendingKey: 'tarifa_fix_pending', targetKey: 'tarifa_pending',
          parse: (t) => mapTariffType(t),
          confirmMsg: (v) => `¿La tarifa correcta es "${v}"?`,
          retryMsg: 'Ingresa el tipo de tarifa (Secundaria, Primaria, Transmisión, Agrícola):',
          errorMsg: 'No reconocí esa tarifa. Intenta de nuevo:',
        },
        FIX_DEMANDA: {
          pendingKey: 'demanda_fix_pending', targetKey: 'demanda_pending',
          parse: parseSpanishNumber,
          confirmMsg: (v) => `¿La carga contratada correcta es ${fmtKVA(v)}?`,
          retryMsg: 'Ingresa la carga contratada en kVA:', errorMsg: 'Ingresa un número válido en kVA:',
        },
        FIX_CARGO_CLIENTE: {
          pendingKey: 'cargo_cliente_fix_pending', targetKey: 'cargo_cliente_pending',
          parse: parseSpanishNumber,
          confirmMsg: (v) => `¿El cargo por cliente correcto es ${fmtUSD(v)}?`,
          retryMsg: 'Ingresa el cargo por cliente:', errorMsg: 'Ingresa un monto válido:',
        },
        FIX_CARGO_DEMANDA: {
          pendingKey: 'cargo_demanda_fix_pending', targetKey: 'cargo_demanda_pending',
          parse: parseSpanishNumber,
          confirmMsg: (v) => `¿El cargo por demanda correcto es ${fmtUSD(v)}?`,
          retryMsg: 'Ingresa el cargo por demanda:', errorMsg: 'Ingresa un monto válido:',
        },
        FIX_EXCESO_KVA: {
          pendingKey: 'exceso_kva_fix_pending', targetKey: 'exceso_kva_pending',
          parse: parseSpanishNumber,
          confirmMsg: (v) => `¿El exceso de demanda correcto es ${fmtKVA(v)}?`,
          retryMsg: 'Ingresa el exceso de demanda en kVA (o 0):', errorMsg: 'Ingresa un número válido en kVA:',
        },
        FIX_EXCESO_USD: {
          pendingKey: 'exceso_usd_fix_pending', targetKey: 'exceso_usd_pending',
          parse: parseSpanishNumber,
          confirmMsg: (v) => `¿El monto por exceso de demanda correcto es ${fmtUSD(v)}?`,
          retryMsg: 'Ingresa el monto por exceso de demanda (o 0):', errorMsg: 'Ingresa un monto válido:',
        },
        FIX_CONSUMO: {
          pendingKey: 'consumo_fix_pending', targetKey: 'consumo_pending',
          parse: (t) => { const n = parseSpanishNumber(t); return (n !== null && n > 0) ? n : null; },
          confirmMsg: (v) => `¿El promedio de consumo mensual correcto es ${fmtKWH(v)}?`,
          retryMsg: 'Ingresa el consumo mensual promedio en kWh:', errorMsg: 'Ingresa un número válido en kWh:',
        },
        FIX_COSTO_KWH: {
          pendingKey: 'costo_kwh_fix_pending', targetKey: 'costo_kwh_pending',
          parse: (t) => { const n = parseSpanishNumber(t); return (n !== null && n > 0 && n < 10) ? n : (n >= 10 ? n/100 : null); },
          confirmMsg: (v) => `¿El costo por kWh correcto es ${fmtUSD(v)}/kWh?`,
          retryMsg: 'Ingresa el costo por kWh (ej: 0.28 o 28):', errorMsg: 'Ingresa un valor válido (ej: 0.28 o 24):',
        },
      };

      const fixHandler = fixHandlers[currentStep];
      if (fixHandler) {
        const { pendingKey, targetKey, parse, confirmMsg, retryMsg, errorMsg, onCommit } = fixHandler;
        const ocrData = sessionData._ocr_review_data || sessionData;
        const r = userInput.toLowerCase();
        const isYes = /\b(s[ií]|yes|correcto|exacto|confirmado|dale|ok|okay|adelante|bien|perfecto)\b/.test(r);
        const isNo  = /\bno\b/.test(r) || ['nope','nel','negativo','incorrecto','mal'].some(w => r.includes(w));

        if (sessionData[pendingKey] !== undefined) {
          if (isYes) {
            const val = sessionData[pendingKey];
            let newOcr = { ...ocrData, [targetKey]: val, [pendingKey]: undefined };
            if (onCommit) newOcr = onCommit(val, newOcr);
            setSessionData(prev => ({ ...prev, ...newOcr, _ocr_review_data: newOcr, [pendingKey]: undefined }));
            setAttemptCount(0);
            startNextFix(fixQueue, newOcr, guidedMode);
            return;
          } else if (isNo) {
            setSessionData(prev => ({ ...prev, [pendingKey]: undefined }));
            setMessages(prev => [...prev, { role: 'assistant', content: retryMsg, timestamp: new Date(), step: currentStep }]);
            setLoading(false); return;
          } else {
            const newCount = attemptCount + 1; setAttemptCount(newCount);
            if (newCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
            setMessages(prev => [...prev, { role: 'assistant', content: '¿Correcto? (sí / no)', timestamp: new Date(), step: currentStep }]);
            setLoading(false); return;
          }
        } else {
          const val = parse(userInput);
          if (val === null || val === undefined) {
            const newCount = attemptCount + 1; setAttemptCount(newCount);
            if (newCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
            setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, timestamp: new Date(), step: currentStep }]);
            setLoading(false); return;
          }
          setSessionData(prev => ({ ...prev, [pendingKey]: val }));
          setMessages(prev => [...prev, { role: 'assistant', content: confirmMsg(val), timestamp: new Date(), step: currentStep }]);
          setLoading(false); return;
        }
      }
    }

    // ============================================================================
    // SECTION 8: ROOF COUNT & MULTI-ROOF DETAILS
    // ============================================================================

    // Step 8: Ask how many roofs (1-10)
    if (currentStep === '8') {

      // ── CONFIRMATION MODE ──────────────────────────────────────────────────
      if (sessionData.roof_count_pending !== undefined) {
        const validation = validateYesNo(userInput);
        const pendingCount = sessionData.roof_count_pending;

        if (validation.isYes) {
          setAttemptCount(0);
          setSessionData(prev => ({
            ...prev,
            roof_count: pendingCount,
            roof_count_pending: undefined,
            current_roof_number: 1
          }));
          const roofLabel = pendingCount === 1 ? 'un techo' : `${pendingCount} techos`;
          if (sessionData._from_prequal && pendingCount === 1 && sessionData.roof_sqft) {
            // Prequal with 1 roof: show size confirmation directly
            const knownSqft = parseFloat(sessionData.roof_sqft);
            setSessionData(prev => ({ ...prev, [`roof_1_size_pending`]: knownSqft }));
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Veo que tienes un techo de ${knownSqft.toLocaleString()} pies². ¿Es correcto? (sí/no)`,
              timestamp: new Date(),
              step: '8.1.size'
            }]);
          } else {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Perfecto, ${roofLabel}. Empecemos${pendingCount === 1 ? '' : ' con el primero'}.\n\n🏠 Techo 1 de ${pendingCount}\n¿Cuál es el tamaño aproximado de este techo? Ingresa un número en pies² si puedes. Si no estás seguro:\n• pequeño — menos de 2,500 pies²\n• mediano — 2,500–5,000 pies²\n• grande — 5,000–10,000 pies²\n• industrial — 10,000–50,000 pies²`,
              timestamp: new Date(),
              step: '8.1.size'
            }]);
          }
          setCurrentStep('8.1.size');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else if (validation.isNo) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, roof_count_pending: undefined }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Entendido. ¿Cuántos techos tienes? (máximo 10)',
            timestamp: new Date(),
            step: '8'
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          const newAttemptCount = attemptCount + 1;
          setAttemptCount(newAttemptCount);
          if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Por favor responde sí o no.',
            timestamp: new Date(),
            step: '8'
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
      }

      // ── ENTRY MODE ─────────────────────────────────────────────────────────
      const parsed = parseSpanishNumber(userInput);
      const roofCount = parsed !== null ? Math.round(parsed) : null;

      if (roofCount === null || roofCount < 1 || roofCount > 10 || !Number.isInteger(roofCount)) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) {
          showExitMessage();
          return;
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor ingresa un número entre 1 y 10. Por ejemplo: "1", "dos", "3 techos".',
          timestamp: new Date(),
          step: '8'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      // Valid — store as pending and confirm
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, roof_count_pending: roofCount }));
      const countLabel = roofCount === 1 ? '1 techo' : `${roofCount} techos`;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `¿Tienes ${countLabel}? (sí/no)`,
        timestamp: new Date(),
        step: '8'
      }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // ---- Roof detail substeps (loop over each roof) ----

    // Helper: returns current roof number and total from sessionData
    const getRoofContext = () => {
      const num = sessionData.current_roof_number || 1;
      const total = parseInt(sessionData.roof_count) || 1;
      return { num, total };
    };

    // Step 8.1.size: Roof size
    if (currentStep === '8.1.size') {
      const { num } = getRoofContext();
      const fieldKey = `roof_${num}_size`;

      // Pre-qual: for roof 1, confirm the known size before asking for input
      if (sessionData._from_prequal && num === 1 && sessionData.roof_sqft && !sessionData[`${fieldKey}_prequal_confirmed`]) {
        const knownSqft = parseFloat(sessionData.roof_sqft);
        // This block only runs once to show the confirmation prompt
        if (sessionData[`${fieldKey}_pending`] === undefined) {
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: knownSqft }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Veo que tienes un techo de ${knownSqft.toLocaleString()} pies². ¿Es correcto? (sí/no)`,
            timestamp: new Date(), step: '8.1.size'
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        }
        // If they say no, fall through to normal entry mode after clearing pending
      }

      // ── CONFIRMATION MODE ──────────────────────────────────────────────────
      if (sessionData[`${fieldKey}_pending`] !== undefined) {
        const validation = validateYesNo(userInput);
        if (validation.isYes) {
          setAttemptCount(0);
          const confirmed = sessionData[`${fieldKey}_pending`];
          setSessionData(prev => ({ ...prev, [fieldKey]: confirmed, [`${fieldKey}_pending`]: undefined, [`${fieldKey}_prequal_confirmed`]: true }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '¿De qué material es el techo? (hormigón, galvalume, otro)',
            timestamp: new Date(),
            step: '8.1.material'
          }]);
          setCurrentStep('8.1.material');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else if (validation.isNo) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: undefined }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Entendido. ¿Cuál es el tamaño del techo? Ingresa un número en pies² o: pequeño, mediano, grande, industrial.',
            timestamp: new Date(),
            step: '8.1.size'
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Unclear — clear pending and fall through to re-parse as a new entry
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: undefined }));
        }
      }

      // ── ENTRY MODE ─────────────────────────────────────────────────────────
      const r = userInput.toLowerCase().trim();

      // Label definitions: value = numeric midpoint stored, display = canonical accented word shown in confirmation
      const LABEL_MAP = {
        pequeño: { value: 1500,  display: 'pequeño' },
        pequeno: { value: 1500,  display: 'pequeño' },
        small:   { value: 1500,  display: 'pequeño' },
        mediano: { value: 3750,  display: 'mediano' },
        medium:  { value: 3750,  display: 'mediano' },
        grande:  { value: 7500,  display: 'grande' },
        large:   { value: 7500,  display: 'grande' },
        industrial: { value: 30000, display: 'industrial' },
      };

      let sizeValue = null;
      let confirmText = null;

      const matchedLabel = Object.keys(LABEL_MAP).find(k => r.includes(k));
      if (matchedLabel) {
        sizeValue = LABEL_MAP[matchedLabel].value;
        confirmText = LABEL_MAP[matchedLabel].display;
      } else {
        const sqftParsed = parseSpanishNumber(userInput);
        if (sqftParsed !== null && sqftParsed > 0 && sqftParsed <= 500000) {
          sizeValue = Math.round(sqftParsed);
          confirmText = `${sizeValue.toLocaleString()} pies²`;
        }
      }

      if (sizeValue === null) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'No entendí el tamaño. Por favor ingresa un número en pies² (ej: 3,500) o una de las opciones:\n• pequeño — menos de 2,500 pies²\n• mediano — 2,500–5,000 pies²\n• grande — 5,000–10,000 pies²\n• industrial — 10,000–50,000 pies²',
          timestamp: new Date(),
          step: '8.1.size'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      // Valid — store numeric value as pending, show label/sqft in confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: sizeValue }));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `¿El tamaño del techo es ${confirmText}? (sí/no)`,
        timestamp: new Date(),
        step: '8.1.size'
      }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 8.1.material: Roof material
    if (currentStep === '8.1.material') {
      const { num } = getRoofContext();
      const fieldKey = `roof_${num}_material`;

      // ── CONFIRMATION MODE ──────────────────────────────────────────────────
      if (sessionData[`${fieldKey}_pending`] !== undefined) {
        const validation = validateYesNo(userInput);
        if (validation.isYes) {
          setAttemptCount(0);
          const confirmed = sessionData[`${fieldKey}_pending`];
          setSessionData(prev => ({ ...prev, [fieldKey]: confirmed, [`${fieldKey}_pending`]: undefined }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '¿En qué condición está el techo? (excelente, buena, regular, mala)',
            timestamp: new Date(),
            step: '8.1.condition'
          }]);
          setCurrentStep('8.1.condition');
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else if (validation.isNo) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: undefined }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Entendido. ¿De qué material es el techo? (hormigón, galvalume, otro)',
            timestamp: new Date(),
            step: '8.1.material'
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Unclear — clear pending and fall through to re-parse as a new entry
          // (user may have re-typed the material instead of saying sí/no)
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: undefined }));
          // Fall through to entry mode below by NOT returning here
        }
      }

      // ── ENTRY MODE ─────────────────────────────────────────────────────────
      const r = userInput.toLowerCase().trim();
      const isHormigon  = r.includes('hormig') || r.includes('concreto') || r.includes('concrete') || r.includes('cemento') || r.includes('losa') || r.includes('placa');
      const isGalvalume = r.includes('galvalume') || r.includes('galvalum') || r.includes('metal') || r.includes('zinc') || r.includes('galvaniz') || r.includes('alumin') || r.includes('acero') || r.includes('steel') || r.includes('tin') || r.includes('lámina') || r.includes('lamina');
      const isOtro      = r.includes('otro') || r.includes('other') || r.includes('shingle') || r.includes('asfalto') || r.includes('madera') || r.includes('wood') || r.includes('teja') || r.includes('fibra') || r.includes('foam') || r.includes('espuma') || r.includes('tpo') || r.includes('pvc') || r.includes('membrane') || r.includes('membrana');

      const cleaned = r.replace(/\s/g, '');
      const hasVowel = /[aeiouáéíóúü]/.test(cleaned);
      const isGarbage = cleaned.length < 3 || (!hasVowel && cleaned.length < 6) || /^[\d\W]+$/.test(cleaned);

      let materialValue = null;
      if (!isGarbage) {
        if (isHormigon)        materialValue = 'hormigón';
        else if (isGalvalume)  materialValue = 'galvalume/metal';
        else if (isOtro)       materialValue = userInput.trim();
        else if (cleaned.length >= 3 && hasVowel) materialValue = userInput.trim();
      }

      if (!materialValue) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'No entendí el material. Por favor indica: hormigón, galvalume, u otro (por ejemplo: asfalto, membrana, TPO).',
          timestamp: new Date(),
          step: '8.1.material'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      // Valid — store as pending and ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: materialValue }));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `¿El material del techo es ${materialValue}? (sí/no)`,
        timestamp: new Date(),
        step: '8.1.material'
      }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // Step 8.1.condition: Roof condition
    if (currentStep === '8.1.condition') {
      const { num, total } = getRoofContext();
      const fieldKey = `roof_${num}_condition`;

      // ── CONFIRMATION MODE ──────────────────────────────────────────────────
      if (sessionData[`${fieldKey}_pending`] !== undefined) {
        const validation = validateYesNo(userInput);
        if (validation.isYes) {
          setAttemptCount(0);
          const confirmed = sessionData[`${fieldKey}_pending`];
          setSessionData(prev => ({ ...prev, [fieldKey]: confirmed, [`${fieldKey}_pending`]: undefined }));

          if (num < total) {
            const nextNum = num + 1;
            setSessionData(prev => ({ ...prev, current_roof_number: nextNum }));
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `🏠 Techo ${nextNum} de ${total}\n¿Cuál es el tamaño aproximado de este techo? Ingresa un número en pies² si puedes. Si no estás seguro:\n• pequeño — menos de 2,500 pies²\n• mediano — 2,500–5,000 pies²\n• grande — 5,000–10,000 pies²\n• industrial — 10,000–50,000 pies²`,
              timestamp: new Date(),
              step: '8.1.size'
            }]);
            setCurrentStep('8.1.size');
          } else {
            setSessionData(prev => ({ ...prev, current_roof_number: null }));
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `¡Listo! Registré los ${total} techo(s). Continuemos.`,
              timestamp: new Date(),
              step: '9.1'
            }, {
              role: 'assistant',
              content: '¿Cómo planeas pagar?\n\n• Contado — pago único, sin intereses\n• Financiamiento — cuotas mensuales, cero pronto\n• No sé — te explico ambas opciones\n\n(escribe: contado, financiamiento, o no sé)',
              timestamp: new Date(),
              step: '9.1'
            }]);
            setCurrentStep('9.1');
          }
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else if (validation.isNo) {
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: undefined }));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Entendido. ¿En qué condición está el techo? (excelente, buena, regular, mala)',
            timestamp: new Date(),
            step: '8.1.condition'
          }]);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 200);
          return;
        } else {
          // Unclear — clear pending and fall through to re-parse as a new entry
          setAttemptCount(0);
          setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: undefined }));
        }
      }

      // ── ENTRY MODE ─────────────────────────────────────────────────────────
      const r = userInput.toLowerCase();
      const isExcellent = r.includes('excelente') || r.includes('excellent') || r.includes('perfecto') || r.includes('perfect') || r.includes('muy buen') || r.includes('nuevo');
      const isGood      = r.includes('buen') || r.includes('good') || r.includes('bien');
      const isFair      = r.includes('regular') || r.includes('fair') || r.includes('más o men');
      const isPoor      = r.includes('mal') || r.includes('poor') || r.includes('deteriorad') || r.includes('dañad') || r.includes('bad');

      let conditionValue = null;
      if (isExcellent)   conditionValue = 'excelente';
      else if (isGood)   conditionValue = 'buena';
      else if (isFair)   conditionValue = 'regular';
      else if (isPoor)   conditionValue = 'mala';

      if (!conditionValue) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor indica la condición: excelente, buena, regular, o mala.',
          timestamp: new Date(),
          step: '8.1.condition'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      // Valid — store as pending and ask for confirmation
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, [`${fieldKey}_pending`]: conditionValue }));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `¿La condición del techo es ${conditionValue}? (sí/no)`,
        timestamp: new Date(),
        step: '8.1.condition'
      }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    // ============================================================================
    // END SECTION 8
    // ============================================================================



    // Standard flow for other sections
    const currentStepData = logicTree.find(s => s.id === currentStep);
    if (!currentStepData) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: paso no encontrado.', timestamp: new Date(), step: 'ERROR' }]);
      setLoading(false);
      return;
    }

    // Save field data
    if (currentStepData.field) {
      setSessionData(prev => ({ ...prev, [currentStepData.field]: userInput }));
    }

    // Handle conditional steps
    if (currentStepData.id === '4.5') {
      const validation = validateYesNo(userInput);
      
      if (validation.isYes) {
        const nextStep = logicTree.find(s => s.id === '4.6');
        setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.6' }]);
        setCurrentStep('4.6');
        setLoading(false);
        return;
      } else if (validation.isNo) {
        setSessionData(prev => ({ ...prev, has_alternate_contact: 'no' }));
        const askTech = logicTree.find(s => s.id === '4.9');
        setMessages(prev => [...prev, { role: 'assistant', content: askTech.prompt, timestamp: new Date(), step: '4.9' }]);
        setCurrentStep('4.9');
        setLoading(false);
        return;
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor responde sí o no.', timestamp: new Date(), step: '4.5' }]);
        setLoading(false);
        return;
      }
    }

    if (currentStepData.id === '4.9') {
      const validation = validateYesNo(userInput);
      
      if (validation.isYes) {
        const nextStep = logicTree.find(s => s.id === '4.10');
        setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: '4.10' }]);
        setCurrentStep('4.10');
        setLoading(false);
        return;
      } else if (validation.isNo) {
        setSessionData(prev => ({ ...prev, has_technical_contact: 'no' }));
        const jumpStep = logicTree.find(s => s.id === '4.13');
        setMessages(prev => [...prev, { role: 'assistant', content: jumpStep.prompt, timestamp: new Date(), step: '4.13' }]);
        setCurrentStep('4.13');
        setLoading(false);
        return;
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Por favor responde sí o no.', timestamp: new Date(), step: '4.9' }]);
        setLoading(false);
        return;
      }
    }

    // High risk detection
    if (currentStepData.id === '4.15') {
      const response = userInput.toLowerCase();
      const highRiskKeywords = ['cannabis', 'marihuana', 'marijuana', 'entretenimiento para adultos', 'adult entertainment', 'criptomoneda', 'crypto', 'bitcoin'];
      const isHighRisk = highRiskKeywords.some(keyword => response.includes(keyword));
      
      if (isHighRisk) {
        setSessionData(prev => ({ 
          ...prev, 
          high_risk: 'yes',
          payment_selection: 'cash',
          financing_eligible: 'no'
        }));
      }
    }

    // ============================================================================
    // SECTION 9 — PAGO
    // ============================================================================

    if (currentStep === '9.1') {
      const r = userInput.toLowerCase().trim();
      const isCash      = r.includes('contado') || r.includes('efectivo') || r.includes('cash');
      const isFinancing = r.includes('financiamiento') || r.includes('financiami') || r.includes('cuota') || r.includes('credito') || r.includes('crédito') || r.includes('financing');
      const isUnsure    = r.includes('no sé') || r.includes('no se') || r.includes('no sab') || r.includes('ambas') || r.includes('explicame') || r.includes('explica') || r.includes('cual') || r.includes('cuál');

      // High-risk override — cash only, skip Section 10
      if (sessionData.high_risk === 'yes') {
        setSessionData(prev => ({ ...prev, payment_selection: 'cash', financing_eligible: 'no' }));
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Debido a la naturaleza de tu negocio, solo podemos proceder con pago en efectivo. Continuamos con la cotización.',
          timestamp: new Date(), step: '9.1'
        }]);
        setLoading(false);
        setTimeout(() => { showQuote({ ...sessionData, payment_selection: 'cash', financing_eligible: 'no' }); }, 600);
        return;
      }

      if (isUnsure) {
        const est = sessionData.estimate || {};
        const roi = est.roiYears ? `~${est.roiYears} años` : '~8 años';
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Claro, te explico brevemente:\n\n💵 CONTADO\nPagas el sistema completo al inicio ($${est.systemCost ? parseFloat(est.systemCost).toLocaleString() : 'ver cotización'}). Sin intereses. Retorno de inversión en ${roi}. Ahorro mensual máximo.\n\n📅 FINANCIAMIENTO\nCuotas mensuales a 9% anual, amortización a 15 años con pago balloon al mes 84. Sin necesidad de banco externo. Cuota estimada: $${est.monthlyPmt ? parseFloat(est.monthlyPmt).toLocaleString() : 'ver cotización'}/mes.\n\n¿Cuál prefieres? (contado / financiamiento)`,
          timestamp: new Date(), step: '9.1'
        }]);
        setCurrentStep('9.1');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      if (!isCash && !isFinancing) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor indica: contado, financiamiento, o escribe "no sé" para una explicación.',
          timestamp: new Date(), step: '9.1'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, payment_selection: isCash ? 'cash' : 'financing' }));

      if (isCash) {
        setLoading(false);
        setTimeout(() => { showQuote({ ...sessionData, payment_selection: 'cash' }); }, 600);
      } else {
        // Go to Section 10 — Financiamiento
        setSessionData(prev => ({ ...prev, _10_1_shown: true }));
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Perfecto. Para el proceso de financiamiento necesito algunos datos.\n\n¿Tu negocio tiene acceso a crédito comercial actualmente? (sí/no)',
          timestamp: new Date(), step: '10.1'
        }]);
        setCurrentStep('10.1');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
      }
      return;
    }

    // ============================================================================
    // SECTION 10 — FINANCIAMIENTO
    // ============================================================================

    if (currentStep === '10.1') {
      // Emit the prompt the first time (logicTree has prompt:null so standard flow doesn't show it)
      if (!sessionData._10_1_shown) {
        setSessionData(prev => ({ ...prev, _10_1_shown: true }));
        setMessages(prev => [...prev, { role: 'assistant', content: '¿Tu negocio tiene acceso a crédito comercial actualmente? (sí/no)', timestamp: new Date(), step: '10.1' }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      const { isYes, isNo, isUnclear } = validateYesNo(userInput);
      if (isUnclear) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor responde sí o no: ¿Tu negocio tiene acceso a crédito comercial actualmente?',
          timestamp: new Date(), step: '10.1'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, tiene_credito_comercial: isYes ? 'sí' : 'no' }));
      if (isNo) {
        // No commercial credit — suggest Windmar Finance directly, skip to 10.5
        const q105 = logicTree.find(s => s.id === '10.5');
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'No hay problema. Windmar facilita el financiamiento a través de varias alianzas. Te podemos ofrecer cuotas a 9% anual, amortización a 15 años.\n\n' + q105.prompt,
          timestamp: new Date(), step: '10.5'
        }]);
        setCurrentStep('10.5');
      } else {
        const q102 = logicTree.find(s => s.id === '10.2');
        setMessages(prev => [...prev, { role: 'assistant', content: q102.prompt, timestamp: new Date(), step: '10.2' }]);
        setCurrentStep('10.2');
      }
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    if (currentStep === '10.2') {
      const trimmed = userInput.trim();
      if (trimmed.length < 2) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor indica el nombre de tu banco o cooperativa.',
          timestamp: new Date(), step: '10.2'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      setSessionData(prev => ({ ...prev, banco_nombre: trimmed }));
      const q103 = logicTree.find(s => s.id === '10.3');
      setMessages(prev => [...prev, { role: 'assistant', content: q103.prompt, timestamp: new Date(), step: '10.3' }]);
      setCurrentStep('10.3');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    if (currentStep === '10.3') {
      const { isYes, isNo, isUnclear } = validateYesNo(userInput);
      if (isUnclear) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor responde sí o no: ¿Tienes relación con un oficial de crédito en ese banco?',
          timestamp: new Date(), step: '10.3'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, tiene_oficial_credito: isYes ? 'sí' : 'no' }));
      if (isYes) {
        const q104 = logicTree.find(s => s.id === '10.4');
        setMessages(prev => [...prev, { role: 'assistant', content: q104.prompt, timestamp: new Date(), step: '10.4' }]);
        setCurrentStep('10.4');
      } else {
        const q105 = logicTree.find(s => s.id === '10.5');
        setMessages(prev => [...prev, { role: 'assistant', content: q105.prompt, timestamp: new Date(), step: '10.5' }]);
        setCurrentStep('10.5');
      }
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    if (currentStep === '10.4') {
      const trimmed = userInput.trim();
      if (trimmed.length < 2) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor indica el nombre del oficial de crédito.',
          timestamp: new Date(), step: '10.4'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      setSessionData(prev => ({ ...prev, oficial_credito_nombre: trimmed }));
      const q105 = logicTree.find(s => s.id === '10.5');
      setMessages(prev => [...prev, { role: 'assistant', content: q105.prompt, timestamp: new Date(), step: '10.5' }]);
      setCurrentStep('10.5');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 200);
      return;
    }

    if (currentStep === '10.5') {
      const { isYes, isNo, isUnclear } = validateYesNo(userInput);
      if (isUnclear) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor responde sí o no: ¿Estarías dispuesto a solicitar financiamiento con Windmar Finance?',
          timestamp: new Date(), step: '10.5'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      setAttemptCount(0);
      setSessionData(prev => ({ ...prev, windmar_finance_interest: isYes ? 'sí' : 'no' }));
      setLoading(false);
      setTimeout(() => { showQuote({ ...sessionData, payment_selection: 'financing', windmar_finance_interest: isYes ? 'sí' : 'no' }); }, 600);
      return;
    }

    // ============================================================================
    // SECTION 11 — COTIZACIÓN  (triggered by showQuote helper, not by user input)
    // Section 12 handles the user's first response after seeing the quote.
    // ============================================================================

    // ============================================================================
    // SECTION 12 — DECISIÓN
    // ============================================================================

    if (currentStep === '12.1') {
      const r = userInput.toLowerCase().trim();
      const isYes     = r.includes('sí') || r.includes('si') || r.includes('yes') || r.includes('proceder') || r.includes('procedo') || r.includes('quiero') || r.includes('adelante') || r.includes('vamos');
      const isNo      = /\bno\b/.test(r) || r.includes('nope') || r.includes('nel') || r.includes('negativo');
      const isThink   = r.includes('pensar') || r.includes('pensarlo') || r.includes('necesito') || r.includes('más tiempo') || r.includes('mas tiempo') || r.includes('después') || r.includes('despues') || r.includes('luego') || r.includes('pensando');

      if (!isYes && !isNo && !isThink) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '¿Cómo deseas proceder?\n• sí — quiero proceder\n• necesito pensarlo — me llamas luego\n• no — por ahora no',
          timestamp: new Date(), step: '12.1'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }

      setAttemptCount(0);

      if (isYes) {
        setSessionData(prev => ({ ...prev, customer_decision: 'ready_to_proceed', estado: 'lead_hot' }));
        const q123 = logicTree.find(s => s.id === '12.3');
        setMessages(prev => [...prev, { role: 'assistant', content: q123.prompt, timestamp: new Date(), step: '12.3' }]);
        setCurrentStep('12.3');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
      } else if (isThink) {
        setSessionData(prev => ({ ...prev, customer_decision: 'thinking', estado: 'lead_warm' }));
        const q122 = logicTree.find(s => s.id === '12.2');
        setMessages(prev => [...prev, { role: 'assistant', content: q122.prompt, timestamp: new Date(), step: '12.2' }]);
        setCurrentStep('12.2');
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
      } else {
        // isNo
        setSessionData(prev => ({ ...prev, customer_decision: 'not_interested', estado: 'lead_cold', saved_at: new Date().toISOString() }));
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Entendido, sin problema. Si en algún momento reconsideras, con gusto te atendemos. Puedes contactarnos por WhatsApp al 787-900-0000 o en windmarenergy.com.\n\n¿Hay algo más en lo que pueda ayudarte?',
          timestamp: new Date(), step: '12.1'
        }]);
        setTimeout(() => {
          showClosing(sessionData);
        }, 800);
      }
      return;
    }

    if (currentStep === '12.2') {
      // Collect callback time — any non-empty answer is valid
      const trimmed = userInput.trim();
      if (trimmed.length < 2) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Por favor indica un día y hora aproximados para llamarte.',
          timestamp: new Date(), step: '12.2'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      setSessionData(prev => ({ ...prev, callback_time: trimmed, saved_at: new Date().toISOString() }));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Perfecto. Un consultor te llamará el ${trimmed}. Mientras tanto, preparamos tu propuesta formal.`,
        timestamp: new Date(), step: '12.2'
      }]);
      setLoading(false);
      setTimeout(() => { showClosing({ ...sessionData, callback_time: trimmed }); }, 800);
      return;
    }

    if (currentStep === '12.3') {
      const { isYes, isNo, isUnclear } = validateYesNo(userInput);
      if (isUnclear) {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        if (newAttemptCount >= MAX_ATTEMPTS) { showExitMessage(); return; }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '¿Confirmas que deseas proceder con el depósito? (sí/no)',
          timestamp: new Date(), step: '12.3'
        }]);
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        return;
      }
      setAttemptCount(0);
      setSessionData(prev => ({
        ...prev,
        deposit_intent: isYes ? 'confirmed' : 'declined',
        estado: isYes ? 'lead_hot' : 'lead_warm',
        saved_at: new Date().toISOString()
      }));
      if (isYes) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '¡Excelente! Un consultor se comunicará contigo en las próximas 24 horas para coordinar el pago del depósito y los próximos pasos.',
          timestamp: new Date(), step: '12.3'
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sin problema. Un consultor te contactará para coordinar cuando estés listo.',
          timestamp: new Date(), step: '12.3'
        }]);
      }
      setLoading(false);
      setTimeout(() => { showClosing(sessionData); }, 800);
      return;
    }

    // ============================================================================
    // SECTION 13 — CIERRE
    // ============================================================================

    if (currentStep === '13.1') {
      setSessionData(prev => ({ ...prev, notes_additional: userInput.trim() }));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '¡Gracias por completar el cuestionario! Tu cotización está lista para descargar. ¿Quieres iniciar otro cuestionario?',
        timestamp: new Date(), step: '13.1'
      }]);
      setAskingToRestart(true);
      setLoading(false);
      return;
    }

    // Default: move to next step
    // If next step is 6.1 and prequal already has address, skip to 6.2
    if (currentStepData.next) {
      let resolvedNextId = currentStepData.next;
      if (resolvedNextId === '6.1' && sessionData._from_prequal && sessionData.address && sessionData.municipio) {
        setSessionData(prev => ({ ...prev, business_address: prev.address }));
        resolvedNextId = '6.2';
      }
      const nextStep = logicTree.find(s => s.id === resolvedNextId);
      if (nextStep) {
        setMessages(prev => [...prev, { role: 'assistant', content: nextStep.prompt, timestamp: new Date(), step: nextStep.id }]);
        setCurrentStep(nextStep.id);
      }
    }

    setLoading(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Validate file type
    if (file.type !== 'application/pdf') {
      setMessages(prev => [...prev, 
        { 
          role: 'assistant', 
          content: '❌ Formato incorrecto. Por favor sube un archivo PDF de tu factura de LUMA.', 
          timestamp: new Date(),
          step: currentStep
        }
      ]);
      e.target.value = ''; // Reset input to allow re-upload
      return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setMessages(prev => [...prev, 
        { 
          role: 'assistant', 
          content: `❌ El archivo es muy grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Por favor sube un archivo menor a 10 MB.`, 
          timestamp: new Date(),
          step: currentStep
        }
      ]);
      e.target.value = ''; // Reset input
      return;
    }
    
    // Validate minimum size (catch empty/corrupted files)
    if (file.size < 1024) {
      setMessages(prev => [...prev, 
        { 
          role: 'assistant', 
          content: '❌ El archivo está vacío o corrupto. Por favor verifica e intenta de nuevo.', 
          timestamp: new Date(),
          step: currentStep
        }
      ]);
      e.target.value = ''; // Reset input
      return;
    }
    
    // Show file uploaded message
    setMessages(prev => [...prev, 
      { role: 'user', content: `📎 Archivo subido: ${file.name}`, timestamp: new Date() }
    ]);
    
    if (currentStep === '7.3') {
      const meterCount = parseInt(sessionData.luma_meter_count || '1');
      const currentMeterUpload = sessionData.current_meter_upload || 1;
      
      // Store uploaded file reference
      const uploadedBills = sessionData.uploaded_bills || {};
      uploadedBills[`meter_${currentMeterUpload}`] = file.name;
      
      setSessionData(prev => ({ 
        ...prev, 
        uploaded_bills: uploadedBills
      }));
      
      // OCR — POST to /api/ocr (server reads ANTHROPIC_API_KEY from .env)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Estoy leyendo tu factura... dame un momento por favor. ⏳',
        timestamp: new Date(),
        step: '7.3'
      }]);

      const formData = new FormData();
      formData.append('bill', file);

      fetch('/api/ocr', { method: 'POST', body: formData })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
          return res.json();
        })
        .then(({ data: ocr }) => {
          const norm = ocr.address ? ocr.address.trim() : (sessionData.address || '');
          const mun  = ocr.municipio || extractMunicipio(norm) || sessionData.municipio || '';
          const ocrReviewData = {
            address_pending:       norm,
            municipio_pending:     mun,
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
          setSessionData(prev => ({
            ...prev,
            [`ocr_data_m${currentMeterUpload}`]: { ...ocrReviewData, ocr_extracted: true },
            _ocr_review_data: ocrReviewData,
            ...ocrReviewData,
          }));
          setCheckedFields([]);
          setGuidedMode(false);
          setMessages(prev => [...prev,
            {
              role: 'assistant',
              content: 'Factura procesada. Revísala y marca cualquier campo que necesite corrección.\n\n• Si todo está correcto: escribe listo\n• Si hay errores: márcalos y escribe corregir\n• Si necesitas ayuda para leer la factura: escribe ayuda',
              timestamp: new Date(), step: 'BILL_REVIEW'
            },
            {
              role: 'assistant', content: '__OCR_REVIEW__',
              timestamp: new Date(), step: 'BILL_REVIEW',
              type: 'ocr_review', ocrData: ocrReviewData
            }
          ]);
          setCurrentStep('BILL_REVIEW');
        })
        .catch((error) => {
          console.error('OCR error:', error.message);
          let errorMessage = 'No pude leer esta factura automáticamente. Vamos a ingresar los datos manualmente.';
          if (error.message.includes('401')) errorMessage = 'Error de autenticación con el servidor OCR. Contacta al administrador.';
          else if (error.message.includes('429')) errorMessage = 'El servidor está ocupado. Espera unos segundos e intenta de nuevo.';
          else if (error.message.includes('422')) errorMessage = 'No pude interpretar la factura. Asegúrate de que sea un PDF claro de LUMA. Ingresaremos los datos manualmente.';
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: errorMessage + ' Por favor dime la cantidad total adeudada:',
            timestamp: new Date(), step: '7.3.a'
          }]);
          setCurrentStep('7.3.a');
          setSessionData(prev => ({
            ...prev,
            [`ocr_data_m${currentMeterUpload}`]: { ocr_extracted: false, manual_entry: true, error_reason: error.message }
          }));
        })
        .finally(() => setLoading(false));

      // Reset file input
      e.target.value = '';
    }
  };

  const downloadQuote = () => {
    const paymentMethod = sessionData.payment_selection;
    const quoteText = `
=====================================
COTIZACIÓN SOLAR - ${sessionData.business_name || 'Cliente'}
=====================================
Fecha: ${new Date().toLocaleDateString('es-PR')}

INFORMACIÓN DEL CLIENTE
-----------------------
Negocio: ${sessionData.business_name || 'N/A'}
Contacto: ${sessionData.cliente_nombre || 'N/A'}
Teléfono: ${sessionData.cliente_telefono || 'N/A'}
Email: ${sessionData.cliente_email || 'N/A'}
Dirección: ${sessionData.business_address || 'N/A'}
CRIM: ${sessionData.crim_number || 'N/A'}

SERVICIOS SOLICITADOS
---------------------
${sessionData.services_selected || 'Paneles solares'}
${sessionData.sellado_superficie ? `Sellado: ${sessionData.sellado_superficie} pies cuadrados` : ''}
${sessionData.cuantas_baterias_anker ? `Baterías Anker: ${sessionData.cuantas_baterias_anker} unidades` : ''}
${sessionData.requiere_respaldo === 'yes' ? `Respaldo: ${sessionData.porcentaje_respaldo}%` : ''}

ESPECIFICACIONES DEL SISTEMA
----------------------------
Tamaño del sistema: ${sessionData.pv_size_kwdc || 'N/A'} kWdc
Capacidad máxima del techo: ${sessionData.pv_max_kwdc_por_techo || 'N/A'} kWdc
Cobertura energética: ${sessionData.energy_coverage_pct || 'N/A'}%
Costo total estimado: $${sessionData.pv_cost_usd ? parseFloat(sessionData.pv_cost_usd).toLocaleString() : 'N/A'} USD

AHORROS PROYECTADOS
-------------------
Ahorro mensual: $${sessionData.gross_monthly_savings_usd || 'N/A'} USD
Ahorro anual: $${sessionData.gross_monthly_savings_usd ? (parseFloat(sessionData.gross_monthly_savings_usd) * 12).toLocaleString() : 'N/A'} USD
Tarifa eléctrica asumida: $${sessionData.implied_rate_usd_per_kwh || '0.25'}/kWh

CONSUMO ACTUAL
--------------
Medidores LUMA: ${sessionData.luma_meter_count || 'N/A'}
Consumo mensual promedio: ${sessionData.avg_consumo_mensual_kwh || 'N/A'} kWh
Método de dimensionamiento: ${sessionData.dimensioning_method || 'N/A'}

INFORMACIÓN DEL TECHO
--------------------
Cantidad de techos: ${sessionData.techo_quantity || 'N/A'}
Área total disponible: ${sessionData.techo_sqft || 'N/A'} pies cuadrados

MÉTODO DE PAGO SELECCIONADO
---------------------------
${paymentMethod === 'financing' ? 'FINANCIAMIENTO' : 'PAGO EN EFECTIVO'}

${paymentMethod === 'financing' ? `
DOCUMENTOS REQUERIDOS PARA FINANCIAMIENTO
----------------------------------------
Esta cotización está sujeta a aprobación de crédito.

Información del Solicitante:
Nombre: ${sessionData.cliente_nombre || '___________________'}
Negocio: ${sessionData.business_name || '___________________'}
Teléfono: ${sessionData.cliente_telefono || '___________________'}
Email: ${sessionData.cliente_email || '___________________'}

MONTO SOLICITADO: $${sessionData.pv_cost_usd ? parseFloat(sessionData.pv_cost_usd).toLocaleString() : 'N/A'} USD

DOCUMENTOS REQUERIDOS:
☐ Copia de identificación con foto
☐ Últimos 2 años de planillas (tax returns)
☐ Estados financieros del negocio
☐ Prueba de ownership del negocio
☐ Últimas 3 facturas de LUMA

FIRMA DEL SOLICITANTE: _____________________  FECHA: __________

` : `
=====================================
AUTORIZACIÓN DE RETIRO - DEPÓSITO (20%)
=====================================

Yo, ${sessionData.cliente_nombre || '___________________'}, autorizo el retiro de:

MONTO DEL DEPÓSITO (20%): $${sessionData.pv_cost_usd ? (parseFloat(sessionData.pv_cost_usd) * 0.20).toLocaleString() : 'N/A'} USD

Este depósito será aplicado al costo total del sistema solar de $${sessionData.pv_cost_usd ? parseFloat(sessionData.pv_cost_usd).toLocaleString() : 'N/A'} USD

MÉTODO DE PAGO:
☐ Cheque #: ___________________
☐ Transferencia bancaria
☐ Efectivo

FIRMA DEL CLIENTE: _____________________  FECHA: __________

RECIBIDO POR: _____________________  FECHA: __________
`}

=====================================
    `;

    const blob = new Blob([quoteText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cotizacion_solar_${sessionData.business_name || 'cliente'}_${paymentMethod === 'financing' ? 'credito' : 'efectivo'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen" style={{background:'#EBF1FF'}}>
      <div className="flex flex-col flex-1">
        <div className="p-3 shadow-lg flex items-center gap-3" style={{background:'#ffffff', borderBottom:'3px solid #1B3F8B'}}>
          <img src="/logo.png" alt="Windmar Commercial" style={{height:'52px', width:'auto'}} />
          <div style={{borderLeft:'2px solid #e5e7eb', paddingLeft:'12px'}}>
            <p className="text-sm font-semibold" style={{color:'#1B3F8B'}}>Cotización Solar Comercial</p>
            <p className="text-xs" style={{color:'#F5A623'}}>Detalle de su propuesta</p>
          </div>
          {sessionData.test_mode === 'on' && (
            <span className="ml-auto text-xs rounded px-2 py-1" style={{background:'#1B3F8B', color:'white'}}>
              🧪 MODO PRUEBA · Step: {currentStep}
            </span>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.type === 'ocr_review' ? (
                  <div className="w-full max-w-lg">
                    {sessionData.test_mode === 'on' && (
                      <div className="text-xs font-mono text-orange-400 mb-1">step: {msg.step}</div>
                    )}
                    <OCRReviewCard
                      data={msg.ocrData ?? sessionData}
                      checkedFields={msg.locked ? [] : checkedFields}
                      onToggle={msg.locked ? () => {} : toggleField}
                      disabled={!!msg.locked}
                    />
                    <div className="text-xs text-gray-400 mt-1 ml-1">
                      {msg.timestamp.toLocaleTimeString('es-PR', {hour:'2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                ) : (
                <div className="max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap shadow-sm" style={msg.role === 'user' ? {background:'#1B3F8B', color:'white'} : {background:'#ffffff', color:'#1f2937', border:'1px solid #e5e7eb'}}>
                  {msg.role === 'assistant' && msg.step && sessionData.test_mode === 'on' && (
                    <div className="text-xs font-mono text-blue-600 mb-2 pb-1 border-b border-blue-200">
                      Step: {msg.step}
                    </div>
                  )}
                  <div>{msg.content}</div>
                  <div className="text-xs mt-1" style={msg.role === 'user' ? {color:'#93c5fd'} : {color:'#9ca3af'}}>
                    {msg.timestamp.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white shadow-md rounded-2xl p-4">
                  <Loader2 className="animate-spin" size={24} style={{color:'#F5A623'}} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {sessionData.test_mode === 'on' && (
            <div className="w-80 border-l border-gray-300 bg-gray-50 overflow-y-auto p-4">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">🔍 Debug Panel</h3>
              <div className="space-y-2 text-xs">
                <div className="bg-white p-2 rounded border border-gray-200">
                  <div className="font-semibold text-gray-600 mb-1">Current Step:</div>
                  <div className="font-mono text-orange-600">{currentStep}</div>
                </div>
                <div className="bg-white p-2 rounded border border-gray-200">
                  <div className="font-semibold text-gray-600 mb-1">Session Data:</div>
                  <div className="font-mono text-gray-700 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                    {JSON.stringify(sessionData, null, 2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-gray-200">
          {questionnaireComplete && (
            <button onClick={downloadQuote} className="w-full mb-3 bg-green-500 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-colors font-semibold">
              <Download size={20} />
              Descargar Cotización
            </button>
          )}
          
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" title="Subir archivo">
              <Upload size={20} className="text-gray-600" />
            </button>
            
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && !(sessionEnded && sessionData.test_mode !== 'on') && handleSend()}
              placeholder={
                sessionEnded && sessionData.test_mode !== 'on' 
                  ? "Sesión terminada - Refresca el navegador" 
                  : askingToRestart 
                  ? "¿Iniciar otro? (sí/no)" 
                  : "Escribe tu respuesta..."
              }
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || (sessionEnded && sessionData.test_mode !== 'on')}
            />
            
            <button onClick={handleSend} disabled={loading || !input.trim() || (sessionEnded && sessionData.test_mode !== 'on')} className="p-3 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{background:'#1B3F8B'}}>
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}