/**
 * Installs the in-memory IndexedDB before ANY other setup file or spec module is evaluated.
 *
 * This is its own setup file because ordering is the whole point: dexie captures `indexedDB` into
 * `Dexie.dependencies` the first time its module evaluates, so anything importing `@jetstream/ui/db`
 * ahead of this would capture `undefined` and fail with `MissingAPIError`. Only the `setupFiles`
 * array guarantees that ordering — import order inside a single module does NOT, because
 * organize-imports (which this repo runs as a matter of course) will happily sort a side-effect
 * import below the others.
 *
 * List this BEFORE `test-setup-data-history-db.ts` in any project's `setupFiles`.
 */
import 'fake-indexeddb/auto';
