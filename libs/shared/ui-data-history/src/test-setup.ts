import { ensureLocalStorageReady } from '@jetstream/ui/db';
import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';

// jsdom's Blob does not interoperate with Node's CompressionStream/Response (cross-realm web
// streams); Node's Blob shares a realm with the stream globals the code under test uses, so gzip
// round-trips behave exactly like they do in real browsers.
globalThis.Blob = NodeBlob as unknown as typeof Blob;

// Dexie is user-scoped and created lazily at login, so tests have to bind a scope before any
// db access — including the "history is not initialized yet" cases.
await ensureLocalStorageReady({ userId: 'data-history-test-user', dbName: 'Jetstream' });
