// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

Cypress.Commands.add('navigate', (...args) => {
  return cy.window().then((w) => {
    w.$nuxt._router.push(...args)
  })
})

Cypress.Commands.add('navigateByUrl', (url) => {
  return cy.navigate(url)
})

Cypress.Commands.add('login', () => {
  cy.visit('/login')
  return cy.window().then((w) => {
    w.nuxtApp.$auth.loginWith('cookie', {
      data: {
        username: 'admin',
        password: 'admin'
      }
    })
    cy.get('.cwa-admin-bar').should('exist')
    return cy.navigate('/')
  })
})
