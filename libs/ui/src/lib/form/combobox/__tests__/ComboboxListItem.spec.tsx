import { render, screen } from '@testing-library/react';
import { ComboboxListItem } from '../ComboboxListItem';

const NOOP = () => undefined;

/**
 * The two layouts are mutually exclusive: a `secondaryLabel` with `secondaryLabelOnNewLine` renders
 * the stacked "entity" layout, anything else renders the single-line layout. Truncation behavior has
 * to be verified in both, which is what `allowWrap` exists to control.
 */
describe('ComboboxListItem', () => {
  describe('single line layout', () => {
    test('truncates by default', () => {
      render(<ComboboxListItem id="a" label="john.smith@acme.com" selected={false} onSelection={NOOP} />);
      expect(screen.getByText('john.smith@acme.com').parentElement?.className).toContain('slds-truncate');
    });

    test('drops slds-truncate when allowWrap is set', () => {
      render(<ComboboxListItem id="a" label="john.smith@acme.com" allowWrap selected={false} onSelection={NOOP} />);
      expect(screen.getByText('john.smith@acme.com').parentElement?.className).not.toContain('slds-truncate');
    });
  });

  describe('entity layout', () => {
    const entityProps = {
      id: 'a',
      label: 'UAT Sandbox',
      secondaryLabel: 'john.smith@acme.com.uat',
      secondaryLabelOnNewLine: true,
      selected: false,
      onSelection: NOOP,
    };

    test('truncates the secondary label by default', () => {
      render(<ComboboxListItem {...entityProps} />);
      expect(screen.getByText('john.smith@acme.com.uat').className).toContain('slds-truncate');
    });

    test('drops slds-truncate from the secondary label when allowWrap is set', () => {
      render(<ComboboxListItem {...entityProps} allowWrap />);
      expect(screen.getByText('john.smith@acme.com.uat').className).not.toContain('slds-truncate');
    });
  });

  describe('labelSuffix', () => {
    test('is not rendered when omitted', () => {
      render(<ComboboxListItem id="a" label="Production" selected={false} onSelection={NOOP} />);
      expect(screen.queryByText('Sandbox')).toBeNull();
    });

    test('renders below the label in the single line layout', () => {
      render(<ComboboxListItem id="a" label="Production" labelSuffix={<span>Sandbox</span>} selected={false} onSelection={NOOP} />);
      expect(screen.getByText('Production')).toBeTruthy();
      expect(screen.getByText('Sandbox')).toBeTruthy();
    });

    test('renders below the label in the entity layout', () => {
      render(
        <ComboboxListItem
          id="a"
          label="UAT Sandbox"
          secondaryLabel="john.smith@acme.com.uat"
          secondaryLabelOnNewLine
          labelSuffix={<span>Sandbox</span>}
          selected={false}
          onSelection={NOOP}
        />,
      );
      expect(screen.getByText('UAT Sandbox')).toBeTruthy();
      expect(screen.getByText('john.smith@acme.com.uat')).toBeTruthy();
      expect(screen.getByText('Sandbox')).toBeTruthy();
    });

    /**
     * The suffix used to sit beside the label inside a shared flex row, in a column that could not
     * shrink, so a row carrying more than one badge squeezed the label down to a few characters wide.
     *
     * The assertion is that the suffix row is a direct child of the item body, which is what puts it
     * on its own line. Asserting merely that the label's element excludes the suffix would pass on the
     * old markup too - the suffix was a sibling of the label's span, not inside it.
     */
    test('puts the suffix on its own row rather than in a shared row with the label', () => {
      const { container } = render(
        <ComboboxListItem
          id="a"
          label="john.smith@acme.com"
          allowWrap
          labelSuffix={
            <>
              <span>Developer</span>
              <span>Connection error</span>
            </>
          }
          selected={false}
          onSelection={NOOP}
        />,
      );
      const suffixRow = screen.getByText('Connection error').parentElement;
      expect(suffixRow?.parentElement).toBe(container.querySelector('.slds-media__body'));
      expect(suffixRow?.contains(screen.getByText('Developer'))).toBe(true);
      expect(suffixRow?.contains(screen.getByText('john.smith@acme.com'))).toBe(false);
    });
  });
});
