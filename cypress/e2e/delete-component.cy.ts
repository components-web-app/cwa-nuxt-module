/// <reference path="../../node_modules/cypress/types/cypress-global-vars.d.ts"/>
describe('Delete a component', () => {
  it('Show plus sign in collection if all components deleted', () => {
    cy.login()
    cy.get('#cwa-cm-edit-button').click()
    cy.get('.html-component').first().as('newComponent').should('exist')
    cy.get('@newComponent').click()
    cy.get('.tab-content-container').should('be.visible')
    cy.get('.cwa-manager-tab').contains('Info').click()
    cy.get('.trash-link').click()
    cy.get('.modal-card-inner button').contains('Delete').click()
    cy.get('.cwa-add-button.is-pulsing').should('have.length', 3)
  })
})
