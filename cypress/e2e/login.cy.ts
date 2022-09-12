describe('Login', () => {
  it('Visits the login page', () => {
    cy.visit('/login')
    cy.get('h1').should('contain.text', 'Admin Access')
  })
  it('Fails to login login', () => {
    cy.get('button[type=submit]').click()
    cy.get('.notification.is-danger').should(
      'contain.text',
      'Incorrect username and/or password'
    )
  })
  it('Successfully logs in', () => {
    cy.get('input[type=text]').type('admin')
    cy.get('input[type=password]').type('admin')
    cy.get('button[type=submit]').click()
    cy.get('.notification.is-danger').should('not.exist')
  })
  it('Redirected and the home page is displayed', () => {
    cy.location('pathname').should('eq', '/')
    cy.get('.cwa-admin-bar').should('exist')

    cy.get('.component-group p').should('contain', 'Bonjour mon ami')
  })
  it('Can use the hamburger menu', () => {
    cy.get('.cwa-admin-bar-menu > .menu').should('not.exist')
    cy.get('.cwa-hamburger').click()
    cy.get('.cwa-admin-bar-menu > .menu').should('be.visible')
    cy.get('.menu-links-right li:last-child ul li:last-child a').should(
      'contain.text',
      'API dev..75ce (unstable)'
    )
  })
  it('Can log out', () => {
    cy.get('.menu-links-right li:first-child ul li:last-child a').click()
    cy.get('.cwa-admin-bar').should('not.exist')
  })
})
