import { createDexieInstance, registerDbHooks, setDexieDbInstance } from '@jetstream/ui/db';
import { Blob as NodeBlob } from 'node:buffer';

// `fake-indexeddb/auto` is loaded ahead of this file via `setupFiles` — see vite.config.ts for why
// it cannot be a static import here.

// jsdom's Blob does not interoperate with Node's CompressionStream/Response (cross-realm web
// streams); Node's Blob shares a realm with the stream globals the code under test uses, so gzip
// round-trips behave exactly like they do in real browsers.
globalThis.Blob = NodeBlob as unknown as typeof Blob;

// The database is created per authenticated user at login, so there is no module-level instance for
// specs to reach for. Bind one directly rather than going through `initDexieDb`, which additionally
// drives the adopt-once legacy migration and record sync — neither of which these specs exercise.
// Registering the real hooks keeps derived index fields (`pinnedIdx`) behaving as they do in the app.
setDexieDbInstance(createDexieInstance('jetstream-data-history-spec', registerDbHooks));
