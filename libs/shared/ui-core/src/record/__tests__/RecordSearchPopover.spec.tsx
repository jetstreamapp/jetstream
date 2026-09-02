import { describeGlobal } from '@jetstream/shared/data';
import { AppAction, appActionObservable$ } from '@jetstream/shared/ui-utils';
import { axeScan } from '@jetstream/test-utils';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { atom } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@jetstream/shared/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/data')>()),
  describeGlobal: vi.fn(),
}));

// `@jetstream/ui/app-state` fetches app info and the user profile at module load. `doMock` rather
// than `mock` so the stub atom can be built from a normal top-level import; everything that reaches
// the `@jetstream/ui` barrel is therefore imported dynamically below, after the stubs are in place.
vi.doMock('@jetstream/ui/app-state', () => ({
  selectedOrgState: atom({ uniqueId: 'a-b' }),
}));

const getRecentRecordsFromStorage = vi.fn();
const addRecentRecordToStorage = vi.fn();
vi.doMock('../record-utils', () => ({ getRecentRecordsFromStorage, addRecentRecordToStorage }));

const { RecordSearchPopover } = await import('../RecordSearchPopover');
const { ViewRecordModalStandIn } = await import('./ViewRecordModalStandIn');

const ACCOUNT_ID = '001000000000001AAA';
const CONTACT_ID = '003000000000001AAA';

const describeGlobalMock = vi.mocked(describeGlobal);

async function renderOpen({ withRecordModal = false } = {}) {
  const result = render(
    <>
      <RecordSearchPopover />
      {withRecordModal && <ViewRecordModalStandIn />}
    </>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'View Record Details' }));
  });
  const listbox = await screen.findByRole('listbox', { name: 'Recent records' });
  return { ...result, listbox, input: screen.getByLabelText('Record Id') as HTMLInputElement };
}

/** Collects VIEW_RECORD (and any other) app actions the popover emits, which is what opens the record modal. */
function collectAppActions() {
  const events: AppAction[] = [];
  const subscription = appActionObservable$.subscribe((event) => events.push(event));
  return { events, unsubscribe: () => subscription.unsubscribe() };
}

describe('RecordSearchPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecentRecordsFromStorage.mockResolvedValue({
      'a-b': [
        { recordId: ACCOUNT_ID, name: 'Acme', sobject: 'Account' },
        { recordId: CONTACT_ID, sobject: 'Contact' },
      ],
    });
    addRecentRecordToStorage.mockResolvedValue([]);
    describeGlobalMock.mockResolvedValue({
      data: {
        sobjects: [
          { keyPrefix: '001', name: 'Account' },
          { keyPrefix: '003', name: 'Contact' },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof describeGlobal>>);
  });

  it('renders the recent records as a listbox of options', async () => {
    const { listbox } = await renderOpen();

    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(within(listbox).getByRole('option', { name: new RegExp(`${ACCOUNT_ID} - Acme`) })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: /Contact/ })).toBeTruthy();
  });

  it('moves focus from the Record Id input into the list on ArrowDown', async () => {
    const { listbox, input } = await renderOpen();
    input.focus();

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(within(listbox).getAllByRole('option')[0]);
  });

  it('opens a recent record on Enter and closes the popover', async () => {
    const { events, unsubscribe } = collectAppActions();
    const { listbox } = await renderOpen();

    fireEvent.keyDown(within(listbox).getAllByRole('option')[0], { key: 'Enter' });

    await waitFor(() => expect(events).toEqual([{ action: 'VIEW_RECORD', payload: { recordId: ACCOUNT_ID } }]));
    expect(describeGlobalMock).toHaveBeenCalledWith(expect.objectContaining({ uniqueId: 'a-b' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /View Record Details/, hidden: true })).toBeNull());
    unsubscribe();
  });

  // A natively disabled Submit was skipped by Tab, which then left the popover and closed it
  it('keeps Tab inside the popover: input, then the aria-disabled Submit, then the list', async () => {
    const { listbox, input } = await renderOpen();
    input.focus();

    userEvent.tab();
    const submitButton = screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement;
    expect(document.activeElement).toBe(submitButton);
    expect(submitButton.disabled).toBe(false);
    expect(submitButton.getAttribute('aria-disabled')).toBe('true');

    userEvent.tab();
    expect(document.activeElement).toBe(listbox);
  });

  it('does not submit while the id is invalid, from the button or from the form', async () => {
    const { events, unsubscribe } = collectAppActions();
    const { input } = await renderOpen();
    fireEvent.change(input, { target: { value: '001' } });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(describeGlobalMock).not.toHaveBeenCalled();
    expect(events).toEqual([]);
    unsubscribe();
  });

  // The submit button's click also raises the form's submit; the click must cancel that path
  it('submits a typed id from the Submit button exactly once', async () => {
    const { events, unsubscribe } = collectAppActions();
    const { input } = await renderOpen();
    fireEvent.change(input, { target: { value: CONTACT_ID } });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(events).toEqual([{ action: 'VIEW_RECORD', payload: { recordId: CONTACT_ID } }]));
    expect(describeGlobalMock).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('hands focus to the record modal, and back to the trigger when the modal closes', async () => {
    const { input } = await renderOpen({ withRecordModal: true });
    fireEvent.change(input, { target: { value: CONTACT_ID } });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    const recordModal = await screen.findByRole('dialog', { name: `Record ${CONTACT_ID}` });
    await waitFor(() => expect(recordModal.contains(document.activeElement)).toBe(true));
    expect(screen.queryByRole('dialog', { name: /View Record Details/, hidden: true })).toBeNull();

    fireEvent.click(within(recordModal).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'View Record Details' })));
  });

  it('has no axe violations while open', async () => {
    const { baseElement } = await renderOpen();
    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });
});
