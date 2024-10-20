// Feature coming soon for vitest see: https://github.com/stryker-mutator/stryker-js/issues/3465
// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  reporters: ['progress', 'clear-text', 'html'],
  coverageAnalysis: 'off',
  ignorePatterns: ['src/templates/**', 'dist', 'coverage'],
  plugins: [
    '@stryker-mutator/vitest-runner',
  ],
}
export default config
