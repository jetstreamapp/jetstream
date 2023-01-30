import type * as monaco from 'monaco-editor';

// lazy load to ensure not in main bundle
const completionsImport = import('./monaco-apex-completions-data');
type Monaco = typeof monaco;
const triggerChars = 'adefhijlmnsu';

export async function configureApexCompletions(monaco: Monaco) {
  const completionsData = await completionsImport;

  monaco.languages.registerCompletionItemProvider('apex', {
    triggerCharacters: ['.', ...triggerChars.split(''), ...triggerChars.toUpperCase().split('')],
    provideCompletionItems: (model, position, context, token) => {
      return {
        suggestions: getSuggestions(completionsData, monaco, model, position),
      };
    },
  });
}

function getSuggestions(
  completionsData: typeof import('./monaco-apex-completions-data'),
  monaco: Monaco,
  model: monaco.editor.ITextModel,
  position: monaco.Position
): monaco.languages.CompletionItem[] {
  const textUntilPositionRaw = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 0,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  });

  const textUntilPosition = textUntilPositionRaw.trim();

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

  const snippetRange = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: textUntilPosition.length - getWordUntilPosition.startColumn - 1,
    endColumn: getWordUntilPosition.endColumn,
  };

  let completions: monaco.languages.CompletionItem[] = getSnippets(monaco, snippetRange);

  if (mostRecentCharacter === '.') {
    const priorWord = textUntilPosition.substring(0, textUntilPosition.length - 1);
    const key = completionsData.getProperCasedCompletionKey(priorWord);
    if (key && completionsData.APEX_COMPLETIONS[key]) {
      completions = completions.concat(
        completionsData.APEX_COMPLETIONS[key].methods.map(
          (method): monaco.languages.CompletionItem => ({
            label: `${key}.${method.name}(${method.parameters.map((param) => `${param.type} ${param.name}`).join(', ')})`,
            kind: monaco.languages.CompletionItemKind.Class,
            filterText: method.name,
            insertText: `${method.name}(${method.parameters.map((param, i) => `\${${i + 1}:${param.name}}`).join(', ')});`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          })
        )
      );
    }
  } else if (textUntilPositionRaw.toLowerCase() === 'new' || textUntilPositionRaw.toLowerCase() === 'new ') {
    completions = completions.concat([
      {
        label: 'new List()',
        filterText: 'new List',
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: 'new List<${1:String}>(${2});',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: range,
      },
      {
        label: 'new Set()',
        filterText: 'new Set',
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: 'new Set<${1:String}>(#{2});',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: range,
      },
      {
        label: 'new Map()',
        filterText: 'new Map',
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: 'new Map<${1:String}, ${2:Account}>(${3});',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: range,
      },
    ]);
  } else if (textUntilPosition.includes('.')) {
    const [root, word, other] = textUntilPosition.split('.');
    const key = completionsData.getProperCasedCompletionKey(root);
    if (!other && key && completionsData.APEX_COMPLETIONS[key]) {
      completions = completions.concat(
        completionsData.APEX_COMPLETIONS[key].methods.map(
          (method): monaco.languages.CompletionItem => ({
            label: `${key}.${method.name}(${method.parameters.map((param) => `${param.type} ${param.name}`).join(', ')})`,
            kind: monaco.languages.CompletionItemKind.Class,
            filterText: method.name,
            insertText: `${method.name}(${method.parameters.map((param, i) => `\${${i + 1}:${param.name}}`).join(', ')});`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          })
        )
      );
    } else {
      completions = completions.concat(
        completionsData.ROOT_COMPLETION_TYPES.map((completion) => ({
          label: completion,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: completion,
          range: range,
        }))
      );
    }
  } else {
    completions = completions.concat(
      completionsData.ROOT_COMPLETION_TYPES.map((completion) => ({
        label: completion,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: completion,
        range: range,
      }))
    );
  }

  return completions;
}

/**
 * Built-in snippets that are always returned with completions
 * @param monaco
 * @param range
 * @returns
 */
function getSnippets(monaco: Monaco, range: monaco.IRange): monaco.languages.CompletionItem[] {
  const SNIPPETS: monaco.languages.CompletionItem[] = [
    {
      label: 'List<SObject> records = new List<SObject>();',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'List<${1:SObject}> ${2:records} = new List<${1:SObject}>(${3});',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
    {
      label: 'Set<SObject> records = new Set<SObject>();',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'Set<${1:SObject}> ${2:records} = new Set<${1:SObject}>(${3});',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
    {
      label: 'Map<Id, SObject> recordMap = new Map<Id, SObject>();',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'Map<${1:Id}, ${2:SObject}> ${3:recordMap} = new Map<${1:Id}, ${2:SObject}>(${4});',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
    {
      label: 'List<SObject> = new [SELECT Id FROM SObject]',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'List<${1:SObject}> ${2:records} = [SELECT ${3:Id} FROM ${1:SObject}${4: WHERE Id IN :records}];',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
    {
      label: 'Map<Id, SObject> = new Map<Id, SObject>([SELECT Id FROM SObject])',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        'Map<Id, ${1:SObject}> ${2:recordMap} = new Map<Id, ${1:SObject}>([SELECT ${3:Id} FROM ${1:SObject}${4: WHERE Id IN :records}]);',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
    {
      label: 'for(SObject record : records)',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'for(${1:SObject} ${2:record} : ${3:records}) {\n\t${4}\n}',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
    {
      label: 'for(SObject record : [SELECT Id FROM SObject])',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'for(${1:SObject} ${2:record} : [SELECT ${3:Id} FROM ${1:SObject}${4: WHERE Id IN :records}]) {\n\t${5}\n}',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
    },
  ];
  return SNIPPETS;
}
