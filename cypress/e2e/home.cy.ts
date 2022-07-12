describe('Home page load', () => {
  it('Visits index page', () => {
    cy.visit('/')
    cy.get('.component-collection p').should('contain', 'Bonjour mon ami')
  })
})
