/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
import { SalesforceOrgUi } from '@jetstream/types';
import { render, screen } from '@testing-library/react';
import { Provider } from 'jotai';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const uiState = vi.hoisted(() => ({
  hasProAccess: true,
  deployAllowed: true,
}));

vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/shared/ui-utils')>();
  return {
    ...actual,
    saveFile: vi.fn(),
    useTitle: vi.fn(),
    useBrowserNotifications: () => ({ notifyUser: vi.fn() }),
    useDisposables: () => ({ addDisposable: vi.fn() }),
  };
});

vi.mock('@jetstream/ui/app-state', async () => {
  const { atom } = await import('jotai');
  const orgA = { uniqueId: 'org-a', label: 'UAT', username: 'uat@example.com' } as SalesforceOrgUi;
  const orgB = { uniqueId: 'org-b', label: 'Prod', username: 'prod@example.com' } as SalesforceOrgUi;
  return {
    applicationCookieState: atom({ serverUrl: 'https://getjetstream.app', google_apiKey: '', google_appId: '', google_clientId: '' }),
    googleDriveAccessState: atom({ hasGoogleDriveAccess: false, googleShowUpgradeToPro: false }),
    orgAlignmentAccessState: atom(() => ({ hasOrgAlignmentAccess: uiState.hasProAccess })),
    salesforceOrgsState: atom([orgA, orgB]),
    salesforceOrgsById: atom({ 'org-a': orgA, 'org-b': orgB }),
    selectedOrgStateWithoutPlaceholder: atom(orgA),
    selectSkipFrontdoorAuth: atom(false),
    useOperationAccess: () => ({
      allowed: uiState.deployAllowed,
      deniedReason: uiState.deployAllowed ? undefined : 'Deploy not allowed',
    }),
  };
});

vi.mock('@jetstream/ui/db', () => ({
  hasDexieDb: () => false,
  orgAlignmentDb: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@jetstream/ui-core', () => ({
  ConfirmPageChange: () => null,
  fromJetstreamEvents: { emit: vi.fn() },
  GroupScopedOrgsCombobox: ({ label, selectedOrg }: { label: string; selectedOrg?: SalesforceOrgUi | null }) => (
    <div data-testid={`org-picker-${label}`}>{selectedOrg ? selectedOrg.label : 'None'}</div>
  ),
  OrgLabelBadge: ({ org }: { org: SalesforceOrgUi }) => <span>{org.label}</span>,
  ProFeaturePaywall: ({ featureLabel }: { featureLabel: string }) => <div>{featureLabel} is a paid feature</div>,
  RequireMetadataApiBanner: () => null,
}));

import { OrgAlignment } from '../OrgAlignment';

describe('OrgAlignment', () => {
  beforeEach(() => {
    uiState.hasProAccess = true;
    uiState.deployAllowed = true;
  });

  it('renders the Org Alignment page with org selectors and empty state', () => {
    render(
      <Provider>
        <MemoryRouter>
          <OrgAlignment />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByText('Org Alignment')).toBeTruthy();
    expect(screen.getByText('Choose two orgs to compare')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Compare Orgs/i })).toHaveProperty('disabled', true);
  });

  it('shows the paywall instead of the tool when the user does not have Pro access', () => {
    uiState.hasProAccess = false;
    render(
      <Provider>
        <MemoryRouter>
          <OrgAlignment />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByText('Org Alignment is a paid feature')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Compare Orgs/i })).toBeNull();
  });
});
