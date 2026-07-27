import { Blob as NodeBlob } from 'node:buffer';

// jsdom's Blob does not interoperate with Node's CompressionStream/Response (cross-realm web
// streams); Node's Blob shares a realm with the stream globals the code under test uses, so gzip
// round-trips behave exactly like they do in real browsers.
globalThis.Blob = NodeBlob as unknown as typeof Blob;

// The database is created per authenticated user at login, so there is no module-level instance for
// specs to reach for. Bind one directly rather than going through `initDexieDb`, which additionally
// drives the adopt-once legacy migration and record sync — neither of which these specs exercise.
// Registering the real hooks keeps derived index fields (`pinnedIdx`) behaving as they do in the app.
//
// Imported dynamically on purpose: Dexie captures `indexedDB` into `Dexie.dependencies` the first
// time its module evaluates, so it must not be pulled in until the `fake-indexeddb/auto` setup file
// (see vite.config.ts) has run — a static import here would capture `undefined` and leave every
// spec failing with `MissingAPIError`.
const { createDexieInstance, registerDbHooks, setDexieDbInstance } = await import('@jetstream/ui/db');
setDexieDbInstance(createDexieInstance('jetstream-data-history-spec', registerDbHooks));
