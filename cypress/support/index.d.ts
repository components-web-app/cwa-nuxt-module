// in cypress/support/index.d.ts
// load type definitions that come with Cypress module
/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Custom command to navigate through next router
     * @example cy.navigate('greeting')
    */
    navigate(...args: any): Chainable<Element>
  }
}
