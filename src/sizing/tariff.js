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

module.exports = { normalizeLumaTariff };
