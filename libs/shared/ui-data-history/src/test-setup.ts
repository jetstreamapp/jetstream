import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';

// jsdom's Blob does not interoperate with Node's CompressionStream/Response (cross-realm web
// streams); Node's Blob shares a realm with the stream globals the code under test uses, so gzip
// round-trips behave exactly like they do in real browsers.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
