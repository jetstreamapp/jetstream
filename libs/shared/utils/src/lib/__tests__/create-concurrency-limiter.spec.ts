import { createConcurrencyLimiter } from '../utils';

/** Task that resolves only when told to, so tests can hold slots open deterministically. */
function createControllableTask() {
  let resolveTask!: (value: string) => void;
  let rejectTask!: (reason: Error) => void;
  const promise = new Promise<string>((resolve, reject) => {
    resolveTask = resolve;
    rejectTask = reject;
  });
  return { run: () => promise, resolve: resolveTask, reject: rejectTask };
}

/** Lets any already-resolved promises settle so queued tasks can start. */
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createConcurrencyLimiter', () => {
  it('should run tasks immediately while under the limit', async () => {
    const limit = createConcurrencyLimiter(3);
    let running = 0;
    let maxRunning = 0;

    await Promise.all(
      Array.from({ length: 3 }, () =>
        limit(async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await flushMicrotasks();
          running--;
        }),
      ),
    );

    expect(maxRunning).toBe(3);
  });

  it('should never exceed the limit and should still run every task', async () => {
    const limit = createConcurrencyLimiter(5);
    let running = 0;
    let maxRunning = 0;
    let completed = 0;

    await Promise.all(
      Array.from({ length: 26 }, () =>
        limit(async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await flushMicrotasks();
          running--;
          completed++;
        }),
      ),
    );

    expect(maxRunning).toBe(5);
    expect(completed).toBe(26);
  });

  it('should hold queued tasks until a slot frees up', async () => {
    const limit = createConcurrencyLimiter(2);
    const first = createControllableTask();
    const second = createControllableTask();
    let thirdStarted = false;

    limit(first.run);
    limit(second.run);
    const thirdResult = limit(async () => {
      thirdStarted = true;
      return 'third';
    });

    await flushMicrotasks();
    expect(thirdStarted).toBe(false);

    first.resolve('first');
    await flushMicrotasks();
    expect(thirdStarted).toBe(true);
    await expect(thirdResult).resolves.toBe('third');

    second.resolve('second');
  });

  it('should release the slot when a task rejects so later tasks are not stranded', async () => {
    const limit = createConcurrencyLimiter(1);
    const failing = limit(() => Promise.reject(new Error('boom')));

    await expect(failing).rejects.toThrow('boom');
    await expect(limit(() => Promise.resolve('ran anyway'))).resolves.toBe('ran anyway');
  });

  it('should return each task result to its own caller', async () => {
    const limit = createConcurrencyLimiter(2);
    const results = await Promise.all([1, 2, 3, 4, 5].map((value) => limit(() => Promise.resolve(value * 10))));
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it('should treat a limit below one as a limit of one rather than deadlocking', async () => {
    const limit = createConcurrencyLimiter(0);
    let running = 0;
    let maxRunning = 0;

    await Promise.all(
      Array.from({ length: 3 }, () =>
        limit(async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await flushMicrotasks();
          running--;
        }),
      ),
    );

    expect(maxRunning).toBe(1);
  });
});
