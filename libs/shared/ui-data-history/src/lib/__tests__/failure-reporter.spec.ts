import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataHistoryFailureInfo, reportDataHistoryFailure, setDataHistoryFailureReporter } from '../failure-reporter';
import { DataHistoryDirectoryPermissionError } from '../file-store/fsa-types';

function captureReports() {
  const reports: DataHistoryFailureInfo[] = [];
  setDataHistoryFailureReporter((info) => reports.push(info));
  return reports;
}

describe('data history failure reporter', () => {
  afterEach(() => {
    setDataHistoryFailureReporter(null);
  });

  it('reports unexpected failures with the operation and context', () => {
    const reports = captureReports();
    const error = new TypeError('records.map is not a function');

    reportDataHistoryFailure({ operation: 'capture-step', error, entryKey: 'entry-1', backend: 'opfs' });

    expect(reports).toEqual([{ operation: 'capture-step', error, entryKey: 'entry-1', backend: 'opfs' }]);
  });

  it.each([
    ['a revoked folder permission', new DataHistoryDirectoryPermissionError()],
    ['a denied permission prompt', Object.assign(new Error('User denied'), { name: 'NotAllowedError' })],
    ['a stream aborted on backend switch', Object.assign(new Error('Aborted'), { name: 'AbortError' })],
    ['a picker outside a user gesture', Object.assign(new Error('gesture'), { name: 'SecurityError' })],
    ['a file that is already gone', Object.assign(new Error('missing'), { name: 'NotFoundError' })],
  ])('does not report %s', (_label, error) => {
    const reports = captureReports();

    reportDataHistoryFailure({ operation: 'capture-step', error });

    expect(reports).toHaveLength(0);
  });

  it('still reports a quota failure, which means capture silently stopped working', () => {
    const reports = captureReports();
    const error = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });

    reportDataHistoryFailure({ operation: 'capture-step', error });

    expect(reports).toHaveLength(1);
  });

  it('never throws when the reporter itself fails', () => {
    setDataHistoryFailureReporter(() => {
      throw new Error('tracker exploded');
    });

    expect(() => reportDataHistoryFailure({ operation: 'init', error: new Error('boom') })).not.toThrow();
  });

  it('stops reporting once the reporter is unset', () => {
    const reporter = vi.fn();
    setDataHistoryFailureReporter(reporter);
    setDataHistoryFailureReporter(null);

    expect(() => reportDataHistoryFailure({ operation: 'init', error: new Error('boom') })).not.toThrow();
    expect(reporter).not.toHaveBeenCalled();
  });
});
