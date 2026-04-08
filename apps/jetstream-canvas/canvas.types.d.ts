import { Canvas } from '@jetstream/types';
import 'vite/client';

declare global {
  // eslint-disable-next-line no-var
  var sr: Canvas.SfdcCanvasSignedRequest;
  interface Window {
    // Canvas SDK global
    Sfdc: {
      canvas: SfdcCanvas;
      JSON: typeof JSON;
    };
  }

  /** Global created by the SDK: `window.Sfdc.canvas` */
  interface SfdcCanvas extends Canvas.SfdcCanvasCore, Canvas.SfdcCanvasModules {}
}
