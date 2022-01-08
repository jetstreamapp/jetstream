import type * as monaco from 'monaco-editor';
import { configureApexLog } from './language-apex-log';
import { configureSoqlLanguage } from './language-soql';
import { getApexLogFoldableRegions } from './monaco-utils';

type Monaco = typeof monaco;

export function configure(monaco: Monaco) {
  configureSoqlLanguage(monaco);
  configureApexLog(monaco);

  monaco.languages.registerFoldingRangeProvider('apex-log', {
    provideFoldingRanges: (model, context, token) => getApexLogFoldableRegions(model.getValue()),
  });
}
