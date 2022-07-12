import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/index.ts'
  },
  projectId: 'f7oug8',
  video: false
  // modifyObstructiveCode: false
})
