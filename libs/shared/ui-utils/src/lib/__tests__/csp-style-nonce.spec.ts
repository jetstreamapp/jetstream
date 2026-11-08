import { afterEach, describe, expect, it } from 'vitest';
import { addNonceToCreatedStyleElements } from '../csp-style-nonce';

const originalCreateElement = Document.prototype.createElement;

describe('addNonceToCreatedStyleElements', () => {
  afterEach(() => {
    Document.prototype.createElement = originalCreateElement;
  });

  it('adds the nonce to style elements created from script', () => {
    addNonceToCreatedStyleElements('page-nonce');

    const style = document.createElement('style');

    expect(style.getAttribute('nonce')).toBe('page-nonce');
  });

  it('leaves every other element alone', () => {
    addNonceToCreatedStyleElements('page-nonce');

    expect(document.createElement('div').hasAttribute('nonce')).toBe(false);
    expect(document.createElement('script').hasAttribute('nonce')).toBe(false);
    expect(document.createElement('link').hasAttribute('nonce')).toBe(false);
  });

  it('does not add a nonce to style markup parsed from an HTML string', () => {
    addNonceToCreatedStyleElements('page-nonce');

    const container = document.createElement('div');
    container.innerHTML = '<style>body { color: red; }</style>';

    expect(container.querySelector('style')?.hasAttribute('nonce')).toBe(false);
  });
});
