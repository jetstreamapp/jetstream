import { getNavLinks, getMainLinks, getFooterLinks } from '../support/app.po';

describe('landing', () => {
  beforeEach(() => cy.visit('/'));

  it('Should have nav links on all pages', () => {
    function validateNavLinks() {
      getNavLinks().contains('Features').should('have.attr', 'href', '/#features');
      getNavLinks().contains('Documentation').should('have.attr', 'href', 'https://docs.getjetstream.app/');
      getNavLinks().contains('Contact Us').should('have.attr', 'href', 'mailto:support@getjetstream.app');
      getNavLinks().contains('Log in').should('have.attr', 'href', '/oauth/login');
      getNavLinks().contains('Sign-Up').should('have.attr', 'href', '/oauth/signup');
    }

    validateNavLinks();

    cy.visit('/privacy/');
    validateNavLinks();

    cy.visit('/terms-of-service/');
    validateNavLinks();
  });

  it('Should have CTA sign up', () => {
    getMainLinks().contains('Sign-up for a free account').should('have.attr', 'href', '/oauth/signup');
  });

  it('Should have footer links', () => {
    getFooterLinks().contains('Documentation').should('have.attr', 'href', 'https://docs.getjetstream.app/');
    getFooterLinks().contains('Contact Us').should('have.attr', 'href', 'mailto:support@getjetstream.app');
    getFooterLinks().contains('Privacy').should('have.attr', 'href', '/privacy/');
    getFooterLinks().contains('Terms').should('have.attr', 'href', '/terms-of-service/');
  });

  it('Should navigate to privacy page', () => {
    getFooterLinks().contains('Privacy').click();
    cy.url().should('include', '/privacy/');
  });

  it('Should navigate to terms page', () => {
    getFooterLinks().contains('Terms').click();
    cy.url().should('include', '/terms-of-service/');
  });
});
