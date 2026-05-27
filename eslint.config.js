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
