import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getSettingsSearchTerms, highlightSearchTerms } from '../layout/settings-search';

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

  it('leaves text without matches and non-string content unchanged', () => {
    expect(highlightSearchTerms('Theme', ['query'])).toBe('Theme');
    const element = <span>Theme</span>;
    expect(highlightSearchTerms(element, ['theme'])).toBe(element);
    expect(highlightSearchTerms('Theme', [])).toBe('Theme');
  });
});
