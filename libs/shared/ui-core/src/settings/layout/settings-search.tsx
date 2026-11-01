import { REGEX } from '@jetstream/shared/utils';
import escapeRegExp from 'lodash/escapeRegExp';
import { createContext, Fragment, ReactNode, useCallback, useContext, useId, useLayoutEffect, useMemo, useState } from 'react';

/**
 * Settings search: every section, group and row checks itself against the search, so pages only describe their
 * settings and never list what is searchable. A setting is shown when every searched word appears in its own text
 * or in the headings of the group and section it sits in - so "query indent" finds "Indent size" under "Query".
 */

/** Children report whether they are shown, so a section or group whose own text does not match can still stay visible */
type ReportVisibility = (key: string, isVisible: boolean) => void;

interface SettingsSearchScope {
  /** Lowercase searchable text of the sections and groups this one sits in */
  text: string;
  reportVisibility: ReportVisibility;
}

const SettingsSearchTermsContext = createContext<string[]>([]);

const SettingsSearchScopeContext = createContext<SettingsSearchScope>({ text: '', reportVisibility: () => undefined });

/**
 * Splits a search into the words that must all match, the same way as the other filter lists:
 * a search wrapped in quotes is matched as one phrase.
 */
export function getSettingsSearchTerms(search: string): string[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (normalizedSearch.length > 1 && normalizedSearch.startsWith('"') && normalizedSearch.endsWith('"')) {
    const phrase = normalizedSearch.replace(REGEX.START_OR_END_QUOTE, '').trim();
    return phrase ? [phrase] : [];
  }
  return normalizedSearch.split(/\s+/).filter(Boolean);
}

/** Wraps each match of a search term in a `<mark>` - anything other than a string is returned as-is */
export function highlightSearchTerms(text: ReactNode, terms: string[]): ReactNode {
  if (typeof text !== 'string' || terms.length === 0) {
    return text;
  }
  // Longest first, so a term is not cut short by a shorter term it starts with
  const pattern = [...terms]
    .sort((termA, termB) => termB.length - termA.length)
    .map(escapeRegExp)
    .join('|');
  // With a single capture group, split places the matches at the odd indexes
  const parts = text.split(new RegExp(`(${pattern})`, 'gi'));
  if (parts.length === 1) {
    return text;
  }
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="text-color-highlight">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** Tracks which children reported themselves visible */
export function useVisibleChildKeys() {
  const [visibleKeys, setVisibleKeys] = useState<ReadonlySet<string>>(() => new Set());

  const reportVisibility = useCallback<ReportVisibility>((key, isVisible) => {
    setVisibleKeys((priorKeys) => {
      if (priorKeys.has(key) === isVisible) {
        return priorKeys;
      }
      const nextKeys = new Set(priorKeys);
      if (isVisible) {
        nextKeys.add(key);
      } else {
        nextKeys.delete(key);
      }
      return nextKeys;
    });
  }, []);

  return { visibleKeys, reportVisibility };
}

export interface SettingsSearchProviderProps {
  terms: string[];
  /** Called with each top level section's key (its `id`) whenever that section is shown or hidden */
  reportVisibility: ReportVisibility;
  children: ReactNode;
}

export const SettingsSearchProvider = ({ terms, reportVisibility, children }: SettingsSearchProviderProps) => {
  const scope = useMemo<SettingsSearchScope>(() => ({ text: '', reportVisibility }), [reportVisibility]);
  return (
    <SettingsSearchTermsContext.Provider value={terms}>
      <SettingsSearchScopeContext.Provider value={scope}>{children}</SettingsSearchScopeContext.Provider>
    </SettingsSearchTermsContext.Provider>
  );
};

export const SettingsSearchScopeProvider = ({ scope, children }: { scope: SettingsSearchScope; children: ReactNode }) => (
  <SettingsSearchScopeContext.Provider value={scope}>{children}</SettingsSearchScopeContext.Provider>
);

export interface UseSettingsSearchOptions {
  /** Reported to the parent instead of a generated key - sections use their `id` so the navigation can follow them */
  reportKey?: string;
  /** Text shown for this item, only strings are searched */
  text: ReactNode[];
  /** Additional words that find this item without being shown, e.g. "dark" for the theme */
  keywords?: string[];
}

/**
 * Whether a section, group or row matches the current search. Containers also pass `scope` to their children
 * through `SettingsSearchScopeProvider`, and stay visible while any child matches.
 */
export function useSettingsSearch({ reportKey, text, keywords = [] }: UseSettingsSearchOptions) {
  const terms = useContext(SettingsSearchTermsContext);
  const parentScope = useContext(SettingsSearchScopeContext);
  const generatedKey = useId();
  const key = reportKey ?? generatedKey;
  const { visibleKeys, reportVisibility } = useVisibleChildKeys();

  // Separate lines so a quoted phrase cannot match across the end of one piece of text and the start of the next
  const ownText = [...text, ...keywords]
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
    .toLocaleLowerCase();
  const scopeText = parentScope.text ? `${parentScope.text}\n${ownText}` : ownText;
  const isVisible = terms.every((term) => scopeText.includes(term)) || visibleKeys.size > 0;

  // Layout effects so a parent hides or shows in the same frame as its children
  const { reportVisibility: reportToParent } = parentScope;
  useLayoutEffect(() => {
    reportToParent(key, isVisible);
  }, [reportToParent, key, isVisible]);

  useLayoutEffect(() => {
    return () => reportToParent(key, false);
  }, [reportToParent, key]);

  const scope = useMemo<SettingsSearchScope>(() => ({ text: scopeText, reportVisibility }), [scopeText, reportVisibility]);

  return {
    isVisible,
    scope,
    highlight: (value: ReactNode) => highlightSearchTerms(value, terms),
  };
}
