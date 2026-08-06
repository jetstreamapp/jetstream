// Kept separate from index.d.ts because this augmentation imports from a workspace project.
// index.d.ts is force-included (via tsconfig `files`) by projects that have no dependency on
// @jetstream/desktop/types, and pulling that project into their program breaks TS project
// references (TS6307). Only projects that reference `window.electronAPI` include this file.
interface Window {
  electronAPI?: import('@jetstream/desktop/types').ElectronAPI;
}
