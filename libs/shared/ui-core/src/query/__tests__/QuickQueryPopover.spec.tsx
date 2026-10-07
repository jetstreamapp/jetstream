import { axeScan } from '@jetstream/test-utils';
import { QueryHistoryItem } from '@jetstream/types';
import { EditorProps } from '@monaco-editor/react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { atom } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ACCOUNT_SOQL = 'SELECT Id FROM Account';
const APEX_CLASS_SOQL = 'SELECT Id FROM ApexClass';

function buildRecentQuery(
  overrides: Pick<QueryHistoryItem, 'key' | 'sObject' | 'label' | 'soql'> & Partial<QueryHistoryItem>,
): QueryHistoryItem {
  return {
    hashedKey: overrides.key,
    org: 'a-b',
    lastRun: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    runCount: 1,
    isTooling: false,
    isFavorite: false,
    ...overrides,
  };
}

const recentQueries: QueryHistoryItem[] = [
  buildRecentQuery({ key: 'qh_a-b:Account:selectidfromaccount', sObject: 'Account', label: 'Account', soql: ACCOUNT_SOQL }),
  buildRecentQuery({
    key: 'qh_a-b:ApexClass:selectidfromapexclass',
    sObject: 'ApexClass',
    label: 'Apex Class',
    soql: APEX_CLASS_SOQL,
    isTooling: true,
  }),
];

const navigateMock = vi.fn();
const restoreMock = vi.fn();
const editorOptionsSpy = vi.fn();

// `@jetstream/ui/app-state` fetches app info and the user profile at module load; only the two atoms
// this component reads are needed. `doMock` rather than `mock` so the stub atoms can be built from a
// normal top-level import.
vi.doMock('@jetstream/ui/app-state', () => ({
  selectedOrgState: atom({ uniqueId: 'a-b', connectionError: undefined }),
  soqlQueryFormatOptionsState: atom({}),
}));

// The live query itself is stubbed, so the Dexie chain only has to resolve
vi.doMock('@jetstream/ui/db', () => ({
  getDexieDb: () => ({
    query_history: {
      orderBy: () => ({ reverse: () => ({ limit: () => ({ toArray: () => Promise.resolve(recentQueries) }) }) }),
    },
  }),
}));
vi.doMock('dexie-react-hooks', () => ({ useLiveQuery: () => recentQueries }));

vi.doMock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigateMock,
}));

vi.doMock('../../analytics', () => ({ useAmplitude: () => ({ trackEvent: vi.fn() }) }));
vi.doMock('../../jetstream-events', () => ({ fromJetstreamEvents: { emit: vi.fn() } }));
vi.doMock('../../settings/SoqlQueryFormatConfigPopover', () => ({ SoqlQueryFormatConfigPopover: () => null }));
vi.doMock('../QueryHistory/QueryHistoryModal', () => ({ QueryHistoryModal: () => null }));
vi.doMock('../RestoreQuery/useQueryRestore', () => ({ useQueryRestore: () => [restoreMock] }));

// Monaco cannot render in jsdom; a plain textarea exposes the value/options the component hands it
vi.doMock('../../app/MonacoEditor', () => ({
  MonacoEditor: ({ value, options, onChange }: EditorProps) => {
    editorOptionsSpy(options);
    return (
      <textarea
        data-testid="editor"
        aria-label="SOQL editor"
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value, undefined as never)}
      />
    );
  },
}));

const { QuickQueryPopover } = await import('../QuickQueryPopover');

function renderOpen() {
  const result = render(<QuickQueryPopover />);
  fireEvent.click(screen.getByRole('button', { name: 'Query Search' }));
  return result;
}

function getEditorValue() {
  return (screen.getByTestId('editor') as HTMLTextAreaElement).value;
}

function getRecentQueryOptions() {
  return within(screen.getByRole('listbox', { name: 'Recent queries' })).getAllByRole('option');
}

describe('QuickQueryPopover', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    restoreMock.mockClear();
    editorOptionsSpy.mockClear();
  });

  it('renders recent queries as a listbox with one option per query', () => {
    renderOpen();

    const options = getRecentQueryOptions();
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain(ACCOUNT_SOQL);
    expect(options[1].textContent).toContain('Apex Class (Metadata Query)');
  });

  it('moves focus from View All History into the list on ArrowDown', () => {
    renderOpen();
    const viewAllButton = screen.getByRole('button', { name: 'View All History' });
    viewAllButton.focus();

    fireEvent.keyDown(viewAllButton, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(getRecentQueryOptions()[0]);
  });

  it('loads the focused query and its query type into the editor on Enter', () => {
    renderOpen();
    const [, apexClassOption] = getRecentQueryOptions();
    apexClassOption.focus();

    fireEvent.keyDown(apexClassOption, { key: 'Enter' });

    expect(getEditorValue()).toBe(APEX_CLASS_SOQL);
    expect((document.getElementById('is-tooling-query-search') as HTMLInputElement).checked).toBe(true);
    expect(apexClassOption.getAttribute('aria-selected')).toBe('true');
    expect(navigateMock).not.toHaveBeenCalled();
    expect(restoreMock).not.toHaveBeenCalled();
  });

  it('loads a query on plain click', () => {
    renderOpen();

    fireEvent.click(getRecentQueryOptions()[0]);

    expect(getEditorValue()).toBe(ACCOUNT_SOQL);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  // Ctrl is the Windows modifier; `List` treats Ctrl+Enter as a plain Enter, so it proves the
  // modifier variant is intercepted before the list's own handling
  it.each([['metaKey'], ['ctrlKey']])('executes the focused query on %s+Enter', (modifier) => {
    renderOpen();
    const [accountOption] = getRecentQueryOptions();
    accountOption.focus();

    fireEvent.keyDown(accountOption, { key: 'Enter', [modifier]: true });

    expect(navigateMock).toHaveBeenCalledWith('/query/results', { state: { isTooling: false, soql: ACCOUNT_SOQL } });
  });

  it('executes the query on modifier+click', () => {
    renderOpen();

    fireEvent.click(getRecentQueryOptions()[0], { metaKey: true });

    expect(navigateMock).toHaveBeenCalledWith('/query/results', { state: { isTooling: false, soql: ACCOUNT_SOQL } });
  });

  it('restores the focused query on Shift+Enter', () => {
    renderOpen();
    const [, apexClassOption] = getRecentQueryOptions();
    apexClassOption.focus();

    fireEvent.keyDown(apexClassOption, { key: 'Enter', shiftKey: true });

    expect(restoreMock).toHaveBeenCalledWith(APEX_CLASS_SOQL, true);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('lets Tab leave the editor', () => {
    renderOpen();
    expect(editorOptionsSpy).toHaveBeenCalledWith(expect.objectContaining({ tabFocusMode: true }));
  });

  it('has no axe violations while open', async () => {
    const { baseElement } = renderOpen();
    expect((await axeScan(baseElement)).violations).toEqual([]);
  });
});
