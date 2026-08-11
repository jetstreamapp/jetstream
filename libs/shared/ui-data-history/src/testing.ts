/**
 * Test-only entry point for `@jetstream/ui/data-history`.
 *
 * Kept out of the production barrel so an in-memory fake never appears in the public API of a
 * library every app imports. Pair it with `setHistoryFileStoreForTests` from the main entry point,
 * which is a seam on the real factory rather than a parallel implementation.
 */
export * from './lib/file-store/fake-file-store';
