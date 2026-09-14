import { notifyOrgActivity } from '@jetstream/shared/data';
import { ORG_INACTIVITY_EXPIRATION_DAYS } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { fromAppState } from '@jetstream/ui/app-state';
import { act, render } from '@testing-library/react';
import { addDays } from 'date-fns';
import { createStore, Provider } from 'jotai';
import { OrgActivitySync } from '../OrgActivitySync';
import { calculateOrgExpiration } from '../useOrgExpiration';

function buildOrg(uniqueId: string, overrides: Partial<SalesforceOrgUi> = {}): SalesforceOrgUi {
  return {
    uniqueId,
    label: uniqueId,
    username: `${uniqueId}@acme.com`,
    organizationId: '00D000000000001',
    instanceUrl: 'https://acme.my.salesforce.com',
    filterText: '',
    accessToken: '',
    loginUrl: '',
    userId: '005000000000001',
    email: `${uniqueId}@acme.com`,
    displayName: uniqueId,
    ...overrides,
  } as SalesforceOrgUi;
}

function lastUsedDaysAgo(daysAgo: number) {
  return addDays(new Date(), -daysAgo).toISOString();
}

function renderWithOrgs(orgs: SalesforceOrgUi[]) {
  const store = createStore();
  store.set(fromAppState.salesforceOrgsState, orgs);
  render(
    <Provider store={store}>
      <OrgActivitySync />
    </Provider>,
  );
  return {
    store,
    orgs: () => store.get(fromAppState.salesforceOrgsState),
    orgById: (uniqueId: string) => store.get(fromAppState.salesforceOrgsState).find((org) => org.uniqueId === uniqueId),
  };
}

describe('OrgActivitySync', () => {
  /**
   * The bug: the server clears a scheduled expiration whenever the org is used, but says nothing about
   * it in the response, so the warning stayed on screen until the org list was re-fetched.
   */
  it('clears the warning on an org that was just successfully used', () => {
    const expiring = buildOrg('expiring', {
      lastActivityAt: lastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS - 2),
      expirationScheduledFor: addDays(new Date(), 2).toISOString(),
    });
    const { orgById } = renderWithOrgs([expiring]);
    expect(calculateOrgExpiration(orgById('expiring')).status).toBe('expiring');

    act(() => notifyOrgActivity(expiring));

    expect(calculateOrgExpiration(orgById('expiring')).status).toBe('connected');
    expect(orgById('expiring')?.expirationScheduledFor).toBeNull();
  });

  it('leaves every other org alone', () => {
    const used = buildOrg('used', { lastActivityAt: lastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS - 1) });
    const untouched = buildOrg('untouched', { lastActivityAt: lastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS - 1) });
    const { orgById } = renderWithOrgs([used, untouched]);

    act(() => notifyOrgActivity(used));

    expect(calculateOrgExpiration(orgById('untouched')).status).toBe('expiring');
  });

  /**
   * Activity is confirmed on every single request, so replacing the org array when nothing visible
   * changes would re-render every consumer of it constantly.
   */
  it('does not touch org state for an org that was already healthy', () => {
    const healthy = buildOrg('healthy', { lastActivityAt: lastUsedDaysAgo(1) });
    const { orgs } = renderWithOrgs([healthy]);
    const before = orgs();

    act(() => notifyOrgActivity(healthy));

    expect(orgs()).toBe(before);
  });

  /** Recording activity does not resolve a connection error, so it must not loop on one either */
  it('does not touch org state for an org held back by a connection error', () => {
    const errored = buildOrg('errored', { lastActivityAt: lastUsedDaysAgo(1), connectionError: 'Something went wrong' });
    const { orgs } = renderWithOrgs([errored]);
    const before = orgs();

    act(() => notifyOrgActivity(errored));

    expect(orgs()).toBe(before);
  });

  it('stops listening once unmounted', () => {
    const expiring = buildOrg('expiring', { lastActivityAt: lastUsedDaysAgo(ORG_INACTIVITY_EXPIRATION_DAYS - 2) });
    const store = createStore();
    store.set(fromAppState.salesforceOrgsState, [expiring]);
    const { unmount } = render(
      <Provider store={store}>
        <OrgActivitySync />
      </Provider>,
    );
    unmount();

    act(() => notifyOrgActivity(expiring));

    expect(calculateOrgExpiration(store.get(fromAppState.salesforceOrgsState)[0]).status).toBe('expiring');
  });
});
