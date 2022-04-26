// Page object that contains helpers for querying the page
export const getOrgDropdownContainer = (additional = '') => cy.get('[data-testid=orgs-combobox-container] ' + additional);

export const getObjectList = (additional = '') => cy.get('[data-testid=sobject-list] ul ' + additional);
export const getFieldsList = (additional = '') => cy.get('[data-testid=sobject-fields] ' + additional);
export const getFiltersAndSoql = (additional = '') => cy.get('[data-testid=filters-and-soql] ' + additional);

export const getExecuteQueryButton = (additional = '') => cy.get('[data-testid=execute-query-button] ' + additional);
