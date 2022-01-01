module.exports = {
  preset: '@nuxt/test-utils',
  testEnvironment: 'node',
  transform: {
    // '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/demo/$1'
  }
}
