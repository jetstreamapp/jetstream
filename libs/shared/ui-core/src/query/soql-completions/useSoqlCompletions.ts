import { SalesforceOrgUi } from '@jetstream/types';
import type { OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { useCallback, useEffect, useRef } from 'react';
import { registerSoqlCompletions } from './soql-completions';

export interface UseSoqlCompletionsOptions {
  selectedOrg: SalesforceOrgUi | null;
  isTooling: boolean;
}

/**
 * Registers org-aware SOQL completions for a single editor.
 *
 * Returns a callback to invoke from the editor's `onMount`. The registration is scoped to the
 * mounted editor's model and disposed on unmount — monaco keeps completion providers on the
 * language, so an undisposed provider would keep firing in every other SOQL editor in the app.
 */
export function useSoqlCompletions({ selectedOrg, isTooling }: UseSoqlCompletionsOptions) {
  const disposableRef = useRef<monaco.IDisposable | null>(null);

  // Read through a ref so switching orgs or toggling tooling does not require re-registering
  const optionsRef = useRef({ selectedOrg, isTooling });
  // eslint-disable-next-line react-hooks/refs
  optionsRef.current = { selectedOrg, isTooling };

  useEffect(() => {
    return () => {
      disposableRef.current?.dispose();
      disposableRef.current = null;
    };
  }, []);

  return useCallback<OnMount>((editor, monaco) => {
    disposableRef.current?.dispose();
    disposableRef.current = registerSoqlCompletions(monaco, {
      getSelectedOrg: () => optionsRef.current.selectedOrg,
      getIsTooling: () => optionsRef.current.isTooling,
      isRelevantModel: (model) => model.uri.toString() === editor.getModel()?.uri.toString(),
    });
  }, []);
}
