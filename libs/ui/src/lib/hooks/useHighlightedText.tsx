import isString from 'lodash/isString';
import escapeRegExp from 'lodash/escapeRegExp';
import React, { ReactNode, useEffect, useState } from 'react';
import { REGEX } from '@jetstream/shared/utils';

// inspired by: https://stackoverflow.com/questions/29652862/highlight-text-using-reactjs
/**
 * Add spans and highlight classes around text based on search term
 *
 * @param {string} text If JSX.Element, no action will be taken
 * @param searchTerm text to match against
 * @param [ignoreHighlight] if true, no highlighting will be performed
 * @returns highlighted react node
 */
export function useHighlightedText(
  text: string | JSX.Element | ReactNode,
  searchTerm?: string,
  options?: { className?: string; ignoreHighlight?: boolean }
) {
  options = options || {};
  const { className, ignoreHighlight } = options;
  const [highlightedText, setHighlightedText] = useState<ReactNode>(text);

  useEffect(() => {
    if (ignoreHighlight || !text || !searchTerm || !isString(text) || !isString(searchTerm)) {
      if (highlightedText !== text) {
        setHighlightedText(text);
      }
    } else {
      let terms: string[];
      // If value is surrounded in quotes, treat as literal value
      if (searchTerm.startsWith('"') && searchTerm.endsWith('"')) {
        terms = [escapeRegExp(searchTerm.toLocaleLowerCase().trim().replace(REGEX.START_OR_END_QUOTE, ''))];
      } else {
        terms = escapeRegExp(searchTerm.toLocaleLowerCase().trim()).split(' ');
      }
      const highlightedText = (
        <span className={className}>
          {text
            .split(new RegExp(terms.map((term) => `(${term})`).join('|'), 'gi'))
            .filter((item) => !!item)
            .map((part, i) => (
              <span key={i} className={terms.includes(part.trim().toLowerCase()) ? 'text-color-highlight' : ''}>
                {part}
              </span>
            ))}
        </span>
      );

      setHighlightedText(highlightedText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ignoreHighlight, searchTerm, text, className]);

  return highlightedText;
}
