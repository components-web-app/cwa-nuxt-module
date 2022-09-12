describe('Home page load', () => {
  it('Visits index page', () => {
    cy.visit('/')
    cy.get('.component-group p').should('contain', 'Bonjour mon ami')
  })
})
