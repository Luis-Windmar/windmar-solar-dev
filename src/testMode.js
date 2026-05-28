// Client-side TEST_MODE flag.
//
// Sourced from window.__TEST_MODE__, which server.js injects into prequal.html
// at request time by replacing the literal placeholder `__TEST_MODE__` with
// either 'true' or 'false' depending on the TEST_MODE env var.
//
//   TEST_MODE === true   → development: TEST- prefixes, "usar datos de prueba"
//                          button, "Generar lead SI/NO" toggle, etc. all visible.
//   TEST_MODE === false  → production: every test artifact hidden / disabled.
//
// Default to true when the value is missing or invalid (e.g. local dev with
// no replacement run, or a static-file fallthrough). False only when the
// placeholder was explicitly replaced with the literal string 'false'.

export const TEST_MODE =
  typeof window !== 'undefined' && window.__TEST_MODE__ !== 'false';
