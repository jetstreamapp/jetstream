/* eslint-disable @typescript-eslint/no-namespace */
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
// eslint-disable-next-line @typescript-eslint/no-namespace
import jwt from 'express-jwt';
declare global {
  namespace Cypress {
    interface Chainable {
      login(): void;
      initOrg(): void;
    }
  }
}

/**
 * Logs in using username+password
 * Does NOT use auth0
 */
Cypress.Commands.add('login', () => {
  const email = Cypress.env('username');
  const password = Cypress.env('password');
  cy.request('POST', '/__test__/login', { email, password }).its('body').as('currentUser');
});

/**
 * Authenticates with Salesforce and adds org to DB
 * TODO: we should only do this ONCE - maybe here? https://docs.cypress.io/api/commands/session
 */
Cypress.Commands.add('initOrg', () => {
  cy.request({
    url: 'https://login.salesforce.com/services/oauth2/token',
    method: 'POST',
    form: true,
    body: {
      grant_type: 'password',
      client_id: '3MVG94YrNIs0WS4d2PK0lDfKIz60UH6tNKX1qc7poTDrY.X4XsDJYnVdd1c.OsdTBLK.5z20hMJcKQh999rJF',
      client_secret: '282991E5BE06438CC6B27A5A0FD0F8722E7C1837FB53CD122FE6C8BA0E8E1170',
      username: 'test-e2e@getjetstream.app',
      password: 'Password123',
    },
  }).then(({ body }) => cy.request('POST', '/__test__/orgs/init', body).its('body.data').as('org'));
});
