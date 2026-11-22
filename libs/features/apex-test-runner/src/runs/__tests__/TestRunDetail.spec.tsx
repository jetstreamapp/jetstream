import type { SalesforceOrgUi } from '@jetstream/types';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestRunDetailViewModel } from '../../apex-test-runner-types';

vi.mock('../TestRunResultsTable', () => ({ default: () => null }));
vi.mock('../TestResultDetailModal', () => ({ default: () => null }));

const { TestRunDetail } = await import('../TestRunDetail');

const selectedOrg = { uniqueId: 'org-1' } as SalesforceOrgUi;

function buildDetail(status: string): TestRunDetailViewModel {
  return {
    run: { Id: 'run-1', Status: status, MethodsEnqueued: 2, MethodsCompleted: 2, MethodsFailed: 0 } as never,
    queueItems: [],
    testResults: [],
  };
}

function renderDetail(status: string) {
  const props = {
    selectedOrg,
    loading: false,
    aborting: false,
    errorMessage: null,
    pollingTimedOut: false,
    onAbort: vi.fn(),
    onResumePolling: vi.fn(),
  };
  const view = render(<TestRunDetail {...props} detail={buildDetail(status)} />);
  return { rerenderWith: (nextStatus: string) => view.rerender(<TestRunDetail {...props} detail={buildDetail(nextStatus)} />) };
}

describe('TestRunDetail focus hand-off', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves focus to the status without scrolling when a run finishes and nothing has focus', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const { rerenderWith } = renderDetail('Processing');
    expect(focus).not.toHaveBeenCalled();

    rerenderWith('Completed');

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('leaves focus alone when the user is focused on something else', () => {
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const { rerenderWith } = renderDetail('Processing');

    rerenderWith('Completed');

    expect(focus).not.toHaveBeenCalled();
    other.remove();
  });
});
