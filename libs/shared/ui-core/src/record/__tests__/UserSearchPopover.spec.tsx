import { query } from '@jetstream/shared/data';
import { AppAction, appActionObservable$ } from '@jetstream/shared/ui-utils';
import { axeScan } from '@jetstream/test-utils';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { atom } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@jetstream/shared/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/data')>()),
  query: vi.fn(),
}));

// `@jetstream/ui/app-state` fetches app info and the user profile at module load. `doMock` rather
// than `mock` so the stub atoms can be built from a normal top-level import; everything that reaches
// the `@jetstream/ui` barrel is therefore imported dynamically below, after the stubs are in place.
vi.doMock('@jetstream/ui/app-state', () => ({
  applicationCookieState: atom({ serverUrl: 'https://test.getjetstream.app', defaultApiVersion: 'v62.0' }),
  selectedOrgState: atom({ uniqueId: 'a-b' }),
  selectSkipFrontdoorAuth: atom(false),
}));

const trackEvent = vi.fn();
vi.doMock('../../analytics', () => ({ useAmplitude: () => ({ trackEvent }) }));

const { UserSearchPopover } = await import('../UserSearchPopover');
const { ViewRecordModalStandIn } = await import('./ViewRecordModalStandIn');

const USERS = [
  {
    Id: '005000000000001AAA',
    Name: 'Ada Lovelace',
    Alias: 'alove',
    CreatedDate: '2024-01-01T00:00:00.000Z',
    Email: 'ada@example.com',
    IsActive: true,
    Profile: { Id: '00e000000000001AAA', Name: 'System Administrator' },
    Username: 'ada@example.com',
    UserType: 'Standard',
  },
  {
    Id: '005000000000002AAA',
    Name: 'Grace Hopper',
    Alias: 'ghopp',
    CreatedDate: '2024-01-01T00:00:00.000Z',
    Email: 'grace@example.com',
    IsActive: false,
    Profile: { Id: '00e000000000002AAA', Name: 'Standard User' },
    Username: 'grace@example.com',
    UserType: 'Standard',
  },
];

async function renderOpen({ withRecordModal = false } = {}) {
  const result = render(
    <>
      <UserSearchPopover />
      {withRecordModal && <ViewRecordModalStandIn />}
    </>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'View User Details' }));
  });
  const listbox = await screen.findByRole('listbox', { name: 'Users' });
  return { ...result, listbox, filter: screen.getByRole('searchbox', { name: 'Id, Name, Email, or Username' }) };
}

function collectAppActions() {
  const events: AppAction[] = [];
  const subscription = appActionObservable$.subscribe((event) => events.push(event));
  return { events, unsubscribe: () => subscription.unsubscribe() };
}

describe('UserSearchPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(query).mockResolvedValue({
      queryResults: { records: USERS, done: true, totalSize: USERS.length },
    } as unknown as Awaited<ReturnType<typeof query>>);
  });

  it('lists the matching users as options', async () => {
    const { listbox } = await renderOpen();
    expect(within(listbox).getAllByRole('option')).toHaveLength(2);
  });

  // SearchInput acts on ArrowDown at keyup (keydown is consumed so a hosting list does not move first)
  it('moves focus from the filter into the users list on ArrowDown', async () => {
    const { listbox, filter } = await renderOpen();
    filter.focus();

    fireEvent.keyDown(filter, { key: 'ArrowDown' });
    fireEvent.keyUp(filter, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(within(listbox).getAllByRole('option')[0]);
  });

  it('closes on selection, hands focus to the record modal, and returns it to the trigger when the modal closes', async () => {
    const { events, unsubscribe } = collectAppActions();
    const { listbox } = await renderOpen({ withRecordModal: true });

    fireEvent.keyDown(within(listbox).getAllByRole('option')[0], { key: 'Enter' });

    expect(events).toEqual([{ action: 'VIEW_RECORD', payload: { recordId: USERS[0].Id } }]);
    const recordModal = await screen.findByRole('dialog', { name: `Record ${USERS[0].Id}` });
    await waitFor(() => expect(recordModal.contains(document.activeElement)).toBe(true));
    expect(screen.queryByRole('dialog', { name: /Search Users/, hidden: true })).toBeNull();

    fireEvent.click(within(recordModal).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'View User Details' })));
    unsubscribe();
  });

  // The user rows carry copy buttons, a profile popover trigger and a "View in Salesforce" link inside
  // role="option" (reached with ArrowRight, see List), which axe reports as nested-interactive — the
  // open finding X4 in docs/accessibility/audit-2026/findings.md. It predates this spec and is scoped
  // out here so the scan still guards everything else.
  it('has no axe violations while open, other than the known nested-interactive rows', async () => {
    const { baseElement } = await renderOpen();
    const results = await axeScan(baseElement);
    expect(results.violations.map(({ id }) => id)).toEqual(['nested-interactive']);
  });
});
