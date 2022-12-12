// Feature coming soon for vitest see: https://github.com/stryker-mutator/stryker-js/issues/3465
// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  _comment:
    "This config was generated using 'stryker init'. Please see the guide for more information: https://stryker-mutator.io/docs/stryker-js/guides/vuejs",
  testRunner: "vitest",
  mutator: {
    plugins: [],
  },
  jest: {},
  reporters: ["progress", "clear-text", "html"],
  coverageAnalysis: "off",
  ignorePatterns: ['src/templates/**', 'dist', 'coverage']
};
export default config;
