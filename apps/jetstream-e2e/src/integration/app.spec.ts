import { getGreeting } from '../support/app.po';

describe('jetstream', () => {
  beforeEach(() => {
    cy.loginByAuth0Api(Cypress.env('auth_username'), Cypress.env('auth_password'));
    // TODO: what I actually need to do is get a session token from the server somehow, not just from auth0
  });

  it('should display welcome message', () => {
    // // Custom command example, see `../support/commands.ts` file
    // cy.login('my-email@something.com', 'myPassword');
    // // Function helper example, see `../support/app.po.ts` file
    // getGreeting().contains('Welcome to jetstream!');
  });
});
