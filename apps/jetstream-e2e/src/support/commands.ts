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
