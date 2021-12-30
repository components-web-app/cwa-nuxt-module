describe('Component Manager Functions', () => {
  it('Toggle edit mode', () => {
    cy.login()
    cy.get('label[for="edit-mode"]').click()
    cy.get('.cwa-add-button.is-pulsing').should('have.length', 3)
  })
  it('Discarding adding a component', () => {
    cy.get('.cwa-add-button.is-pulsing').eq(1).click()
    cy.get('.cwa-component-manager-holder').should('be.visible')
    cy.get('select#component').select('HtmlContent')
    cy.get('.html-component').eq(1).as('newComponent').should('contain.text', 'No content').within(($component) => {
      cy.get('.cwa-manager-highlight.is-draft').should('exist')
    })
    cy.get('.cwa-manager-highlight').should('have.length', 1)
    cy.get('body').click()
    cy.get('.cwa-modal.is-active.cwa-confirm-dialog').should('exist').within(($dialog) => {
      cy.get('h2').should('contain.text', 'Confirm Discard')
      cy.get('button').contains('Cancel').click()
    })
    cy.get('@newComponent').should('exist').within(($component) => {
      cy.get('.cwa-manager-highlight.is-draft').should('exist')
    })
    cy.get('.cwa-manager-highlight').should('have.length', 1)
    cy.get('body').click()
    cy.get('button').contains('Discard').click()
    cy.get('@newComponent').should('not.exist')
    cy.get('.cwa-manager-highlight').should('not.exist')
  })
})
