import { ApiRequestError } from '@jetstream/shared/data';
import { describe, expect, it, vi } from 'vitest';
import { checkStatusWithRetry } from '../shared-ui-utils';

describe('checkStatusWithRetry', () => {
  it('repeats a status check that failed transiently', async () => {
    const checkStatus = vi.fn().mockRejectedValueOnce(new ApiRequestError('Bad Gateway', 502)).mockResolvedValueOnce({ done: true });

    await expect(checkStatusWithRetry(checkStatus, 0)).resolves.toEqual({ done: true });
    expect(checkStatus).toHaveBeenCalledTimes(2);
  });

  it('gives up after three consecutive transient failures', async () => {
    const outage = new ApiRequestError('Bad Gateway', 502);
    const checkStatus = vi.fn().mockRejectedValue(outage);

    await expect(checkStatusWithRetry(checkStatus, 0)).rejects.toBe(outage);
    expect(checkStatus).toHaveBeenCalledTimes(3);
  });

  it('does not repeat a check the server rejected', async () => {
    const rejection = new ApiRequestError('Job not found', 400);
    const checkStatus = vi.fn().mockRejectedValue(rejection);

    await expect(checkStatusWithRetry(checkStatus, 0)).rejects.toBe(rejection);
    expect(checkStatus).toHaveBeenCalledTimes(1);
  });
});
