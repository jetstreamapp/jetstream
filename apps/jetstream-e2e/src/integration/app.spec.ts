import { getExecuteQueryButton, getFieldsList, getObjectList, getOrgDropdownContainer } from '../support/app.po';

/**
 * Basic integration tests to ensure application is working
 */

describe('jetstream', () => {
  beforeEach(() => {
    cy.login();
    cy.initOrg();
  });

  it('Should be able to select a default org', () => {
    sessionStorage.clear();
    cy.visit('/app');
    cy.contains('This action requires an org to be selected.').should('exist');

    getOrgDropdownContainer('input').click();
    getOrgDropdownContainer('ul li').last().click();

    cy.contains('This action requires an org to be selected.').should('not.exist');
    cy.location('pathname').should('eq', '/app/query');
  });

  it('Should be able to run query', () => {
    cy.visit('/app');
    // select account
    getExecuteQueryButton().should('be.disabled');
    getObjectList('li').contains('Account').click();

    getFieldsList('li input[type=checkbox]').each(($el, index) => {
      if (index > 4) {
        return;
      }
      cy.wrap($el).check({ force: true });
    });

    getExecuteQueryButton().should('not.be.disabled');
    getExecuteQueryButton().click();
    cy.location('pathname').should('eq', '/app/query/results');
  });
});
