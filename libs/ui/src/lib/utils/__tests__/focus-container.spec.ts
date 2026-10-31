import { afterEach, describe, expect, test } from 'vitest';
import { focusContainer } from '../focus-container';

function renderContainer() {
  document.body.innerHTML = `
    <main id="main">
      <p id="text">Some text</p>
      <button id="inside" type="button">Inside</button>
    </main>
    <button id="outside" type="button">Outside</button>
  `;
  return {
    main: document.getElementById('main') as HTMLElement,
    text: document.getElementById('text') as HTMLElement,
    inside: document.getElementById('inside') as HTMLElement,
    outside: document.getElementById('outside') as HTMLElement,
  };
}

describe('focusContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('focuses an element that has no tabindex of its own', () => {
    const { main } = renderContainer();
    focusContainer(main);
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  test('removes the tabindex once focus moves on, so clicks on the content cannot focus the container again', () => {
    const { main, inside, outside } = renderContainer();

    focusContainer(main);
    inside.focus();
    expect(main.hasAttribute('tabindex')).toBe(false);

    focusContainer(main);
    outside.focus();
    expect(main.hasAttribute('tabindex')).toBe(false);
  });

  test('releases the container on a pointer press inside it, before the click can keep focus there', () => {
    const { main, text } = renderContainer();
    focusContainer(main);

    text.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(main.hasAttribute('tabindex')).toBe(false);
  });

  test('leaves a tabindex the element already had alone', () => {
    const { main, outside } = renderContainer();
    main.setAttribute('tabindex', '0');

    focusContainer(main);
    outside.focus();

    expect(main.getAttribute('tabindex')).toBe('0');
  });

  test('does not leave a tabindex behind when the element cannot take focus', () => {
    const detached = document.createElement('section');
    focusContainer(detached);
    expect(detached.hasAttribute('tabindex')).toBe(false);
  });
});
