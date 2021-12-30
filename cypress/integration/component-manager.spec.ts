import exp = require('constants');

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

  it('Add a draft component and then publish it', () => {
    cy.get('.cwa-add-button.is-pulsing').eq(1).click()
    cy.get('select#component').select('HtmlContent')
    cy.get('.html-component').eq(1).as('newComponent').should('exist')
    cy.get('button').contains('Add Draft').click()
    cy.get('button').contains('Reuse').should('exist')
    cy.get('@newComponent').get('.cwa-manager-highlight:not(.is-draft)').should('exist')
    cy.get('body').click()
    cy.wait(1000)
    cy.get('.cwa-component-manager-holder').should('not.be.visible')
    cy.get('.cwa-manager-highlight').should('not.exist')
  })

  it('Handle errors when adding a component', () => {
    cy.get('.cwa-add-button.is-pulsing').eq(0).click()
    cy.get('select#component').select('HtmlContent')
    cy.get('button').contains('Add Draft').get('.alt-toggle-arrow').click()
    cy.get('.alt-options-list a').contains('Add as published').as('addAsPublsihedButton').should('exist')
    cy.get('@addAsPublsihedButton').click()

    cy.get('.status-container').within(($statusContainer) => {
      cy.get('.status-icon').should('have.class', 'is-error')
      cy.get('.cwa-error-notifications .cwa-warning-triangle').should('exist')
      cy.get('.cwa-error-notifications .total').should('be.visible').should('contain.text', 1)
      cy.get('.errors-list li:first-child').within(($firstError) => {
        cy.get('.error-title').should('contain.text', 'html')
        cy.get('.error-description').should('contain.text', 'This value should not be blank')
      })
    })

    cy.get('.html-component').eq(0).as('newComponent').should('exist')
    cy.get('@newComponent').should('have.class', 'has-error')

    cy.get('.cwa-manager-tab').eq(1).should('have.class', 'has-error').should('contain.text', 'HTML Content')
  })

  it('Add a published component', () => {})

  it('Add a dynamic placeholder', () => {

  })
})
