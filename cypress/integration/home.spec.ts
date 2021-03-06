describe('Sample tests', () => {
  it('Visits index page', () => {
    cy.visit('/')
    cy.get('.notice.is-danger').should('contain', 'The component PrimaryPageTemplate specified by resource /_/pages/86a6c9f7-951e-4d20-aea8-5f3479a7a646 does not exist')
  })
})
