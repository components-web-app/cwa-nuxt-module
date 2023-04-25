describe('Component Manager Functions', () => {
  it('Toggle edit mode', () => {
    cy.login()
    cy.get('#cwa-cm-edit-button').click()
    cy.get('.cwa-add-button.is-pulsing').should('have.length', 2)
  })

  it('Discarding adding a component', () => {
    cy.get('.cwa-add-button.is-pulsing').eq(1).click()
    cy.get('button').contains('Switch to layout').click()
    cy.get('.cwa-component-manager-holder').should('be.visible')
    cy.get('select#component').select('HtmlContent')
    cy.get('.html-component:eq(1)')
      .as('newComponent')
      .should('contain.text', 'No content')
    cy.get('.cwa-manager-highlight').should(($highlight) => {
      expect($highlight).to.have.length(1)
      expect($highlight).have.class('is-draft')
    })
    cy.get('body').click()
    cy.get('button').contains('Switch to page').click()
    cy.get('.cwa-modal.is-active.cwa-confirm-dialog')
      .should('exist')
      .within(() => {
        cy.get('h2').should('contain.text', 'Confirm Discard')
        cy.get('button').contains('Cancel').click()
      })
    cy.get('@newComponent')
      .should('exist')
      .within(() => {
        cy.get('.cwa-manager-highlight.is-draft').should('exist')
      })
    cy.get('.cwa-manager-highlight').should('have.length', 1)
    cy.get('body').click()
    cy.get('button').contains('Switch to page').click()
    cy.get('button').contains('Discard').click()
    cy.get('@newComponent').should('not.exist')
    cy.get('.cwa-manager-highlight').should('not.exist')
  })

  it('Add a draft component and then publish it', () => {
    // only in c1 version 10.7.0
    cy.on('uncaught:exception', (err) => {
      expect(err.message).to.include(
        "Cannot read properties of undefined (reading 'message')"
      )
      // return false to prevent the error from
      // failing this test
      return false
    })

    cy.get('.cwa-add-button.is-pulsing').eq(1).click()
    cy.get('button').contains('Switch to layout').click()
    cy.get('select#component').select('HtmlContent')
    cy.get('.html-component:eq(1)').as('newComponent')
    cy.get('@newComponent').should('exist')

    cy.get('button').contains('Add Draft').click()

    cy.get('button').contains('Publish').should('exist')
    cy.get('@newComponent')
      .get('.cwa-manager-highlight.is-draft')
      .should('exist')
    cy.get('.cwa-manager-tab:eq(3)').contains('Publish').click()
    cy.get('button').contains('Publish').click()

    // will be an error do not hide the manager

    cy.get('.cwa-component-manager-holder').should('be.visible')
    cy.get('.cwa-error-notifications').click()
    cy.get('.errors-list').should('not.be.visible')
    cy.get('.cwa-manager-tab').contains('HTML Content').click()
    cy.get('.html-content-tab label').click()
    cy.get('.ql-editor[contenteditable]').type('My HTML Content')
    cy.get('.cwa-manager-tab').contains('Publish').click()
    cy.get('button').contains('Publish').click()
    cy.get('.errors-list').should('not.exist')
    cy.get('.cwa-error-notifications .cwa-warning-triangle').should('not.exist')
    cy.get('.status-icon').should('not.exist')
    cy.get('.cwa-component-manager-holder').should('not.be.visible')
    cy.get('.cwa-manager-highlight').should('not.exist')

    cy.get('@newComponent').click()
    cy.get('.cwa-manager-highlight:not(.is-draft)').should('exist')
  })

  it('Handle errors when adding a component', () => {
    cy.get('.cwa-add-button.is-pulsing').eq(0).click()
    cy.get('select#component').select('HtmlContent')
    cy.get('button')
      .contains('Add Draft')
      .get('.cm-button-button.is-more')
      .click()
    cy.get('.alt-options-list button')
      .contains('Add & Publish')
      .as('addAsPublsihedButton')
      .should('exist')
    cy.get('@addAsPublsihedButton').click()

    cy.get('.status-container').within(() => {
      cy.get('.status-icon').should('not.exist')
      cy.get('.cwa-error-notifications .cwa-warning-triangle').should('exist')
      cy.get('.cwa-error-notifications .total')
        .should('be.visible')
        .should('contain.text', 1)
      cy.get('.errors-list li:first-child')
      cy.get('.errors-list li:first-child')
        .should('be.visible')
        .within(() => {
          cy.get('.error-title').should('contain.text', 'html')
          cy.get('.error-description').should(
            'contain.text',
            'This value should not be blank'
          )
        })
    })

    cy.get('.html-component').first().as('newComponent').should('exist')
    cy.get('@newComponent').should('have.class', 'has-error')

    cy.get('.cwa-manager-tab')
      .eq(0)
      .should('have.class', 'has-error')
      .should('contain.text', 'HTML Content')
  })

  it('Show plus sign in collection if all components deleted', () => {
    cy.login()
    cy.get('#cwa-cm-edit-button').click()
  })

  it('Add a published component', () => {})

  it('Add a dynamic placeholder', () => {})
})
