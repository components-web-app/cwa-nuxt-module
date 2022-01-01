module.exports = {
  preset: '@nuxt/test-utils',
  testEnvironment: 'node',
  transform: {
    // '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^~/.nuxt/cwa/(.*)$': '<rootDir>/__mock__/.nuxt/cwa/$1'
  }
}
