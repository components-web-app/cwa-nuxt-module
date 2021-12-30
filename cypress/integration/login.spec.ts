describe('Login', () => {
  it('Visits the login page', () => {
    cy.visit('/login')
    cy.get('h1').should('contain.text', 'Admin Access')
    cy.get('button[type=submit]').click()
    cy.get('.notice.is-danger').should(
      'contain.text',
      'Incorrect username and/or password'
    )
    cy.get('input[type=text]').type('admin')
    cy.get('input[type=password]').type('admin')
    cy.get('button[type=submit]').click()
    cy.get('.notice.is-danger').should('not.exist')
    cy.location('pathname').should('eq', '/')
    cy.get('.cwa-admin-bar').should('exist')

    cy.get('.component-collection p').should('contain', 'Bonjour mon ami')

    cy.get('.cwa-admin-bar-menu > .menu').should('not.exist')
    cy.get('.cwa-hamburger').click()
    cy.get('.cwa-admin-bar-menu > .menu').should('be.visible')
    cy.get('.menu-links-right li:last-child ul li:last-child a').should(
      'contain.text',
      'API dev..75ce (unstable)'
    )
    cy.get('.menu-links-right li:first-child ul li:last-child a').click()
    cy.get('.cwa-admin-bar').should('not.exist')
  })
})
