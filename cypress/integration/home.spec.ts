describe('Sample tests', () => {
  it('Visits index page', () => {
    cy.visit('/')
    cy.get('.component-collection h4').should('contain', 'My custom HtmlContent component. See the HTML below. That was easy!')
    cy.get('.component-collection p').should('contain', 'Bonjour mon ami')
  })
})
