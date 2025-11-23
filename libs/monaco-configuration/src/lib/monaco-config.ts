import type * as monaco from 'monaco-editor';
import { configureApexLog } from './language-apex-log';
import { configureSfdcFormulaLanguage } from './language-sfdc-formula';
import { configureSoqlLanguage } from './language-soql';
import { configureApexCompletions } from './monaco-apex-completions';
import { configureSfdcFormulaCompletions } from './monaco-sfdx-formula-completions';
import { getApexLogFoldableRegions } from './monaco-utils';

type Monaco = typeof monaco;

export function configure(monaco: Monaco) {
  configureSoqlLanguage(monaco);
  configureApexLog(monaco);
  configureSfdcFormulaLanguage(monaco);
  configureApexCompletions(monaco).catch((ex) => {
    console.warn('Failed to load Apex completions');
  });
  configureSfdcFormulaCompletions(monaco).catch((ex) => {
    console.warn('Failed to load sfdc-formula completions');
  });

  monaco.languages.registerFoldingRangeProvider('apex-log', {
    provideFoldingRanges: (model, context, token) => getApexLogFoldableRegions(model.getValue()),
  });
}
