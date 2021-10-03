import { configureSoqlLanguage } from './language-soql';
import type * as monaco from 'monaco-editor';
import { getApexLogFoldableRegions } from './monaco-utils';

type Monaco = typeof monaco;

export function configure(monaco: Monaco) {
  configureSoqlLanguage(monaco);

  monaco.languages.registerFoldingRangeProvider('powershell', {
    provideFoldingRanges: (model, context, token) => getApexLogFoldableRegions(model.getValue()),
  });
}
