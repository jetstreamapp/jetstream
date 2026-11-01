import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getSearchableText, getSettingsSearchTerms, highlightSearchTerms } from '../layout/settings-search';

describe('getSettingsSearchTerms', () => {
  it('splits a search into lowercase words', () => {
    expect(getSettingsSearchTerms('  Query   INDENT ')).toEqual(['query', 'indent']);
  });

  it('returns no terms for a blank search', () => {
    expect(getSettingsSearchTerms('   ')).toEqual([]);
    expect(getSettingsSearchTerms('""')).toEqual([]);
  });

  it('treats a quoted search as one phrase', () => {
    expect(getSettingsSearchTerms('"Indent Size"')).toEqual(['indent size']);
  });

  it('treats a lone quote as an ordinary character', () => {
    expect(getSettingsSearchTerms('"')).toEqual(['"']);
  });
});

describe('highlightSearchTerms', () => {
  function renderHighlighted(text: string, terms: string[]) {
    const { container } = render(<p>{highlightSearchTerms(text, terms)}</p>);
    return {
      text: container.textContent,
      marks: Array.from(container.querySelectorAll('mark')).map(({ textContent }) => textContent),
    };
  }

  it('marks every match of every term, keeping the original casing', () => {
    expect(renderHighlighted('Sync across devices, reset sync', ['sync', 'devices'])).toEqual({
      text: 'Sync across devices, reset sync',
      marks: ['Sync', 'devices', 'sync'],
    });
  });

  it('prefers the longest term when terms overlap', () => {
    expect(renderHighlighted('Data history', ['dat', 'data']).marks).toEqual(['Data']);
  });

  it('matches regular expression characters literally', () => {
    expect(renderHighlighted('Data & Storage (beta)', ['(beta)']).marks).toEqual(['(beta)']);
  });

  it('marks matches inside fragments and HTML elements', () => {
    const { container } = render(
      <p>
        {highlightSearchTerms(
          <>
            Files are saved <strong>without asking</strong>:
          </>,
          ['asking', 'saved'],
        )}
      </p>,
    );
    expect(container.textContent).toBe('Files are saved without asking:');
    expect(Array.from(container.querySelectorAll('mark')).map(({ textContent }) => textContent)).toEqual(['saved', 'asking']);
    expect(container.querySelector('strong mark')?.textContent).toBe('asking');
  });

  it('leaves text without matches and other components unchanged', () => {
    expect(highlightSearchTerms('Theme', ['query'])).toBe('Theme');
    const Component = () => <span>Theme</span>;
    const element = <Component />;
    expect(highlightSearchTerms(element, ['theme'])).toBe(element);
    expect(highlightSearchTerms('Theme', [])).toBe('Theme');
  });
});

describe('getSearchableText', () => {
  it('reads strings and numbers inside fragments and HTML elements, as they render', () => {
    expect(
      getSearchableText(
        <>
          Up to <strong>{365}</strong> days, <em>without asking</em>
        </>,
      ),
    ).toBe('Up to 365 days, without asking');
  });

  it('skips other components and empty nodes', () => {
    const Component = () => <span>hidden</span>;
    expect(
      getSearchableText(
        <span>
          Shown {null}
          <Component />
        </span>,
      ),
    ).toBe('Shown ');
    expect(getSearchableText(undefined)).toBe('');
  });
});
