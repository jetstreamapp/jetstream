/**
 * Stamp the page's CSP nonce on every `<style>` element created from script.
 *
 * Monaco, Google's Picker and other libraries create `<style>` elements without a way to pass a nonce, which is
 * what keeps 'unsafe-inline' in the /app style-src-elem. Only `createElement` is covered: markup parsed from an HTML
 * string (innerHTML, an injected tag) gets no nonce, and that is the injection a style nonce exists to stop. Script
 * that can call `createElement` can already do anything a style could, since /app scripts are nonce + strict-dynamic.
 */
export function addNonceToCreatedStyleElements(nonce: string) {
  const createElement = Document.prototype.createElement;
  Document.prototype.createElement = function createElementWithStyleNonce(this: Document, ...args: Parameters<Document['createElement']>) {
    const element = createElement.apply(this, args);
    if (element instanceof HTMLStyleElement) {
      element.setAttribute('nonce', nonce);
    }
    return element;
  } as Document['createElement'];
}
