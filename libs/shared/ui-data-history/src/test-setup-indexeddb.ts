/**
 * Installs the in-memory IndexedDB before ANY other setup file or spec is evaluated.
 *
 * Kept as its own setup file because ordering is the whole point: dexie captures `indexedDB` into
 * `Dexie.dependencies` the first time its module evaluates, so anything importing `@jetstream/ui/db`
 * ahead of this would capture `undefined` and fail every spec with `MissingAPIError`. `setupFiles`
 * order guarantees that; import order inside a single module does not, since sorting can move it.
 */
import 'fake-indexeddb/auto';
