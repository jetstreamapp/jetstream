import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal, describeSObject, manualRequest, queryAllWithCache } from '@jetstream/shared/data';
import { DescribeSObjectResult, Field, SalesforceOrgUi } from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import type * as monaco from 'monaco-editor';
import { CharacterInfo, CustomPermission, ExternalString, SpecialWordType } from './formula-evaluator.types';

type Monaco = typeof monaco;
let priorCompletion: monaco.IDisposable | undefined;
const SPECIAL_WORDS = new Map<string, SpecialWordType>([
  ['$organization', { type: 'sobject', value: 'Organization' }],
  ['$user', { type: 'sobject', value: 'User' }],
  ['$profile', { type: 'sobject', value: 'profile' }],
  ['$userrole', { type: 'sobject', value: 'UserRole' }],
  ['$custommetadata', { type: 'customMetadata', value: 'CustomMetadata' }],
  ['$setup', { type: 'customSettings', value: 'CustomSettings' }],
  ['$label', { type: 'customLabel', value: 'ExternalString' }],
  ['$api', { type: 'api', value: 'Api' }],
  ['$system', { type: 'hardCoded', value: ['OriginDateTime'] }],
  ['$permission', { type: 'customPermission', value: 'CustomPermission' }],
]);

const triggerChars = 'adefhijlmnsu';

/**
 * Register completions only for fields
 * Formula completions are registered in monaco-sfdx-formula-completions since these are known ahead of time
 */
export async function registerCompletions(
  monaco: Monaco,
  selectedOrg: SalesforceOrgUi,
  sobject?: string,
  additionalFields?: Partial<Field>[]
) {
  if (priorCompletion) {
    priorCompletion.dispose();
  }

  try {
    priorCompletion = monaco.languages.registerCompletionItemProvider('sfdc-formula', {
      triggerCharacters: ['.', ...triggerChars.split(''), ...triggerChars.toUpperCase().split('')],
      provideCompletionItems: async (model, position, context, token) => {
        const characterInfo = getCharacterInfo(model, position);
        return {
          suggestions: await fetchCompletions(monaco, characterInfo, selectedOrg, sobject, additionalFields),
        };
      },
    });
  } catch (ex) {
    logger.warn('Could not populate completions', ex.message);
  }
}

function getCharacterInfo(model: monaco.editor.ITextModel, position: monaco.Position): CharacterInfo {
  const textUntilPositionRaw = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 0,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  });

  let textUntilPosition = textUntilPositionRaw.trim();

  if (textUntilPosition.includes('(')) {
    textUntilPosition = textUntilPosition.substring(textUntilPosition.lastIndexOf('(') + 1);
  }

  const mostRecentCharacter = model
    .getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: Math.max(position.column - 1, 0),
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    })
    .trim();

  const getWordUntilPosition = model.getWordUntilPosition(position);

  const range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: getWordUntilPosition.startColumn,
    endColumn: getWordUntilPosition.endColumn,
  };

  return {
    textUntilPosition,
    mostRecentCharacter,
    range,
  };
}

async function fetchCompletions(
  monaco: Monaco,
  characterInfo: CharacterInfo,
  selectedOrg: SalesforceOrgUi,
  sobject?: string,
  additionalFields?: Partial<Field>[]
): Promise<monaco.languages.CompletionItem[]> {
  const { textUntilPosition: textUntilPositionAll, mostRecentCharacter, range } = characterInfo;
  // if spaces, ignore prior words - e.x. "Log__r.ApiVersion__c != LoggedBy__r" we only care about LoggedBy__r
  const textUntilPosition = textUntilPositionAll.split(' ').reverse()[0];

  let priorWords: string[] = [];
  if (mostRecentCharacter === '.' || textUntilPosition.includes('.')) {
    if (mostRecentCharacter === '.') {
      priorWords = textUntilPosition.substring(0, textUntilPosition.length - 1).split('.');
    } else {
      priorWords = textUntilPosition.substring(0, textUntilPosition.length - 1).split('.');
      priorWords = priorWords.slice(0, priorWords.length - 1);
    }
  }

  let currentSObjectMeta: Omit<DescribeSObjectResult, 'fields'> & { fields: Partial<Field>[] };

  /**
   * Handle all special words (starts with `$`)
   */
  if (SPECIAL_WORDS.has(priorWords[0]?.toLowerCase())) {
    const specialWord = SPECIAL_WORDS.get(priorWords[0].toLowerCase());
    if (specialWord?.type === 'hardCoded') {
      return specialWord.value.map((value) => ({
        label: value,
        filterText: value,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: value,
        range,
      }));
    } else if (specialWord?.type === 'sobject') {
      sobject = specialWord.value;
    } else if (specialWord?.type === 'api') {
      const results = await manualRequest(selectedOrg, { method: 'GET', url: '/services/data' });
      if (results.error || !results.body) {
        return [];
      }
      return (JSON.parse(results.body) as { version: string }[]).map(({ version: value }) => {
        const apiValue = `Enterprise_Server_URL_${value.replace('.', '')}`;
        return {
          label: apiValue,
          filterText: apiValue,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: apiValue,
          range,
        };
      });
    } else if (specialWord?.type === 'customMetadata') {
      /**
       * if word length === 1 [$CustomMetadata.], return list of objects
       * if word length === 2 [$CustomMetadata.Support_Tier__mdt], return records on selected object
       * if word length === 3, return fields on selected record
       */
      const customMetadata = (await describeGlobal(selectedOrg)).data.sobjects.filter(({ name }) => name.endsWith('__mdt'));
      if (priorWords.length === 1) {
        return customMetadata.map(({ name, label }) => ({
          label: `${name} (${label})`,
          filterText: name,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: `${name}.`,
          range,
        }));
      } else if (priorWords.length === 2) {
        const foundCustomMetadata = customMetadata.find(({ name }) => name.toLowerCase() === priorWords[1].toLowerCase());
        if (!foundCustomMetadata) {
          return [];
        }
        const { data } = await queryAllWithCache(selectedOrg, `SELECT Id, QualifiedApiName FROM ${foundCustomMetadata.name}`);
        return data.queryResults.records.map(({ QualifiedApiName }) => ({
          label: QualifiedApiName,
          filterText: QualifiedApiName,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: `${QualifiedApiName}.`,
          range,
        }));
      } else {
        const foundCustomMetadata = customMetadata.find(({ name }) => name.toLowerCase() === priorWords[1].toLowerCase());
        if (!foundCustomMetadata) {
          return [];
        }
        sobject = foundCustomMetadata.name;
        priorWords = []; // treat this as the base object
      }
    } else if (specialWord?.type === 'customSettings') {
      /**
       * if word length === 1 [$Setup.], return list of objects
       * if word length === 2 [$Setup.customSetting__c.], return fields on selected object
       */
      const customSettings = (await describeGlobal(selectedOrg)).data.sobjects.filter(({ customSetting }) => customSetting);
      if (priorWords.length === 1) {
        return customSettings.map(({ name, label }) => ({
          label: `${name} (${label})`,
          filterText: name,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: `${name}.`,
          range,
        }));
      } else {
        const customSetting = customSettings.find(({ name }) => name.toLowerCase() === priorWords[1].toLowerCase());
        if (!customSetting) {
          return [];
        }
        sobject = customSetting.name;
        priorWords = []; // treat this as the base object
      }
    } else if (specialWord?.type === 'customLabel' || specialWord?.type === 'customPermission') {
      if (priorWords.length > 2) {
        return [];
      }
      return (await fetchAndNormalizeLabelOrPermission(selectedOrg, specialWord)).map(({ detail, label, name }) => ({
        label: `${name} (${label})`,
        detail,
        filterText: name,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: name,
        range,
      }));
    }
  }

  if (!sobject) {
    return [];
  }

  /**
   * Query field metadata from based object
   * There are some special cases where the base object could have been changed
   */
  const { data } = await describeSObject(selectedOrg, sobject);
  // Current object metadata - will be changed when fetching related object metadata
  currentSObjectMeta = {
    ...data,
    fields: [...data.fields, ...(additionalFields || [])],
  };
  // If true, then special keywords will be included in results
  let isRootObject = true;
  // Completions are added to the list
  const completions: monaco.languages.CompletionItem[] = [];

  if (priorWords.length >= 1 || mostRecentCharacter === '.') {
    isRootObject = false;
    for (const priorWord of priorWords) {
      const foundRelationship = currentSObjectMeta.fields.find(
        (field) =>
          !!field.relationshipName && !!field.referenceTo?.length && field.relationshipName.toLowerCase() === priorWord.toLowerCase()
      );
      if (foundRelationship && foundRelationship.referenceTo && foundRelationship.referenceTo?.length > 0) {
        const { data: relatedSObjectMeta } = await describeSObject(selectedOrg, foundRelationship.referenceTo[0]);
        currentSObjectMeta = relatedSObjectMeta;
      } else {
        logger.warn('Invalid relationship name', priorWord);
        return [];
      }
    }
  }

  if (isRootObject) {
    ['$Api', '$CustomMetadata', '$Label', '$Organization', '$Permission', '$Profile', '$Setup', '$System', '$User', '$UserRole'].forEach(
      (specialWord) => {
        completions.push({
          label: specialWord,
          detail: specialWord,
          filterText: specialWord,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: specialWord,
          range,
        });
      }
    );
  }

  return currentSObjectMeta.fields.reduce((completions: monaco.languages.CompletionItem[], field) => {
    completions.push({
      label: `${field.name} (${field.label})`,
      detail: field.type,
      filterText: field.name,
      kind: monaco.languages.CompletionItemKind.Class,
      insertText: field.name!,
      range,
    });
    if (!!field.relationshipName && !!field.referenceTo?.length) {
      completions.push({
        label: `${field.relationshipName} (Relationship to ${field.referenceTo[0]})`,
        detail: `${field.referenceTo[0]} - Relationship`,
        filterText: field.name,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: `${field.relationshipName}.`,
        range,
      });
    }
    return completions;
  }, completions);
}

/**
 * Query Label or CustomPermission and return a normalized list of results
 * This allows the logic to be handled the same for either type
 */
async function fetchAndNormalizeLabelOrPermission(
  selectedOrg: SalesforceOrgUi,
  { type }: SpecialWordType
): Promise<
  {
    name: string;
    label: string;
    detail: string;
  }[]
> {
  if (type === 'customLabel') {
    const { data } = await queryAllWithCache<ExternalString>(
      selectedOrg,
      composeQuery({
        fields: [getField('Name'), getField('MasterLabel'), getField('NamespacePrefix'), getField('Value')],
        sObject: 'ExternalString',
        where: {
          left: {
            field: 'IsProtected',
            operator: '=',
            value: 'false',
            literalType: 'BOOLEAN',
          },
        },
      }),
      true
    );

    return data.queryResults.records.map(({ Name, NamespacePrefix, MasterLabel, Value }) => ({
      name: NamespacePrefix ? `${NamespacePrefix}__${Name}` : Name,
      label: MasterLabel,
      detail: Value,
    }));
  } else if (type === 'customPermission') {
    const { data } = await queryAllWithCache<CustomPermission>(
      selectedOrg,
      composeQuery({
        fields: [getField('DeveloperName'), getField('MasterLabel'), getField('NamespacePrefix'), getField('Description')],
        sObject: 'CustomPermission',
        where: {
          left: {
            field: 'IsProtected',
            operator: '=',
            value: 'false',
            literalType: 'BOOLEAN',
          },
        },
      })
    );

    return data.queryResults.records.map(({ DeveloperName, NamespacePrefix, MasterLabel, Description }) => ({
      name: NamespacePrefix ? `${NamespacePrefix}__${DeveloperName}` : DeveloperName,
      label: MasterLabel,
      detail: Description,
    }));
  }
  throw new Error('Not supported');
}
