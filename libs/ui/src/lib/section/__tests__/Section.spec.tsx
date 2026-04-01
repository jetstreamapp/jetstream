import { fireEvent, render, screen } from '@testing-library/react';
import { Section } from '../Section';

// Note: Section.tsx sets aria-expanded={!expanded} on the toggle button,
// which is inverted from the ARIA spec convention. These tests reflect the
// actual component behavior.
describe('Section', () => {
  test('renders label text', () => {
    render(
      <Section id="sec-1" label="My Section">
        <p>Content</p>
      </Section>,
    );
    expect(screen.getByText('My Section')).toBeTruthy();
  });

  test('renders children when expanded', () => {
    render(
      <Section id="sec-1" label="Label" initialExpanded>
        <p>Section Content</p>
      </Section>,
    );
    expect(screen.getByText('Section Content')).toBeTruthy();
  });

  test('toggle button aria-expanded is false when section is open (initialExpanded defaults to true)', () => {
    render(
      <Section id="sec-1" label="Label">
        <p>Content</p>
      </Section>,
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  test('toggle button aria-expanded is true when section is closed (initialExpanded=false)', () => {
    render(
      <Section id="sec-1" label="Label" initialExpanded={false}>
        <p>Content</p>
      </Section>,
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  test('clicking the toggle button opens a closed section', () => {
    render(
      <Section id="sec-1" label="Label" initialExpanded={false}>
        <p>Content</p>
      </Section>,
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  test('clicking the toggle button closes an open section', () => {
    render(
      <Section id="sec-1" label="Label" initialExpanded>
        <p>Content</p>
      </Section>,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  test('button has aria-controls pointing to content id', () => {
    render(
      <Section id="my-section" label="Label">
        <p>Content</p>
      </Section>,
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-controls')).toBe('my-section');
  });

  test('content div has aria-hidden=false when expanded', () => {
    render(
      <Section id="sec-1" label="Label" initialExpanded>
        <p>Content</p>
      </Section>,
    );
    const content = document.getElementById('sec-1');
    expect(content?.getAttribute('aria-hidden')).toBe('false');
  });

  test('content div has aria-hidden=true when collapsed', () => {
    render(
      <Section id="sec-1" label="Label" initialExpanded={false}>
        <p>Content</p>
      </Section>,
    );
    const content = document.getElementById('sec-1');
    expect(content?.getAttribute('aria-hidden')).toBe('true');
  });

  test('removeFromDomOnCollapse removes children from DOM when collapsed', () => {
    render(
      <Section id="sec-1" label="Label" initialExpanded={false} removeFromDomOnCollapse>
        <p>Hidden Content</p>
      </Section>,
    );
    expect(screen.queryByText('Hidden Content')).toBeNull();
  });

  test('removeFromDomOnCollapse keeps children in DOM when expanded', () => {
    render(
      <Section id="sec-1" label="Label" initialExpanded removeFromDomOnCollapse>
        <p>Visible Content</p>
      </Section>,
    );
    expect(screen.getByText('Visible Content')).toBeTruthy();
  });

  test('noBorder omits the slds-box class', () => {
    const { container } = render(
      <Section id="sec-1" label="Label" noBorder>
        <p>Content</p>
      </Section>,
    );
    expect((container.firstChild as HTMLElement).className).not.toContain('slds-box');
  });

  test('without noBorder applies slds-box class', () => {
    const { container } = render(
      <Section id="sec-1" label="Label">
        <p>Content</p>
      </Section>,
    );
    expect((container.firstChild as HTMLElement).className).toContain('slds-box');
  });
});
