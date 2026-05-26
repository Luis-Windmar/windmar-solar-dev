// Canonical LUMA tariff normalizer.
//
// Accepts free-text bill labels OR LUMA's GSD contract codes and returns
// one of four canonical lowercase ASCII enum values:
//   'residencial' | 'secundaria' | 'primaria' | 'transmision' | null
//
// Order of checks is significant — 'gsd-tr' (transmisión) contains
// 'gsd-t' as a substring, so the transmisión branch must run BEFORE the
// secundaria branch, otherwise 'gsd-tr' would be misclassified as
// secundaria. This is a deliberate deviation from the prompt's listed
// order; documented in wrap-ups/sizing-rules-audit-rewrite.md §X.

function normalizeLumaTariff(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes('residen'))                              return 'residencial';
  if (s.includes('transmi') || s.includes('gsd-tr'))      return 'transmision';
  if (s.includes('primar')  || s.includes('gsd-p'))       return 'primaria';
  if (s.includes('secund')  || s.includes('gsd-t') || s.includes('lrs')) return 'secundaria';
  return null;
}

// Default contracted demand (kVA) for bills where the OCR doesn't capture
// it — typically because the bill itself doesn't print a contracted-demand
// value (Residencial and Secundaria bills are capped at fixed kVA by LUMA
// regulation and don't carry explicit demand line items). The default
// matches the regulatory cap for that tariff so it propagates cleanly
// into the OCR review card, EstimateScreen demand floor, and the Zoho
// Carga_Contratada_KVA field. Primaria / Transmisión / unknown fall back
// to 50 as a conservative safety net for OCR misses; the rep is expected
// to correct it on the review card when OCR fails on a real demand bill.
function defaultDemandKva(tariff) {
  const t = normalizeLumaTariff(tariff);
  if (t === 'residencial') return 25;
  return 50;
}

module.exports = { normalizeLumaTariff, defaultDemandKva };
