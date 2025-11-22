/* eslint-disable no-useless-escape */
import type * as monaco from 'monaco-editor';
type Monaco = typeof monaco;

export function configureSfdcFormulaLanguage(monaco: Monaco) {
  monaco.languages.register({ id: 'sfdc-formula' });
  monaco.languages.setLanguageConfiguration('sfdc-formula', languageConfiguration);
  monaco.languages.setMonarchTokensProvider('sfdc-formula', language);

  // TODO: format formula (maybe call to server an use prettier?)
  // monaco.languages.registerDocumentFormattingEditProvider('sfdc-formula', {
  //   provideDocumentFormattingEdits: async (model, options, token) => {
  //     return [
  //       {
  //         range: model.getFullModelRange(),
  //         text: (await soqlParserJs).formatQuery(model.getValue()),
  //       },
  //     ];
  //   },
  // });
}

export const languageConfiguration: monaco.languages.LanguageConfiguration = {
  wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['(', ')'],
  ],
  onEnterRules: [
    {
      // e.g. /** | */
      beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
      afterText: /^\s*\*\/$/,
      action: {
        indentAction: 2,
        appendText: ' * ',
      },
    },
    {
      // e.g. /** ...|
      beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
      action: {
        indentAction: 0,
        appendText: ' * ',
      },
    },
    {
      // e.g.  * ...|
      beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
      action: {
        indentAction: 0,
        appendText: '* ',
      },
    },
    {
      // e.g.  */|
      beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
      action: {
        indentAction: 0,
        removeText: 1,
      },
    },
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '`', close: '`', notIn: ['string', 'comment'] },
    { open: '/**', close: ' */', notIn: ['string'] },
  ],
  colorizedBracketPairs: [
    ['{', '}'],
    ['(', ')'],
  ],
};

export const language = <monaco.languages.IMonarchLanguage>{
  defaultToken: '',
  tokenPostfix: '.formula',
  ignoreCase: true,
  keywords: [
    'ABS',
    'ACOS',
    'ADDMONTHS',
    'AND',
    'ASCII',
    'ASIN',
    'ATAN',
    'ATAN2',
    'BEGINS',
    'BLANKVALUE',
    'BR',
    'CASE',
    'CASESAFEID',
    'CEILING',
    'CHR',
    'CONTAINS',
    'COS',
    'CURRENCYRATE',
    'DATE',
    'DATETIMEVALUE',
    'DATEVALUE',
    'DAY',
    'DAYOFYEAR',
    'DISTANCE',
    'EXP',
    'FIND',
    'FLOOR',
    'FORMATDURATION',
    'FROMUNIXTIME',
    'GEOLOCATION',
    'GETRECORDIDS',
    'GETSESSIONID',
    'HOUR',
    'HTMLENCODE',
    'HYPERLINK',
    'IF',
    'IMAGE',
    'IMAGEPROXYURL',
    'INCLUDE',
    'INCLUDES',
    'INITCAP',
    'ISBLANK',
    'ISCHANGED',
    'ISCLONE',
    'ISNEW',
    'ISNULL',
    'ISNUMBER',
    'ISOWEEK',
    'ISOYEAR',
    'ISPICKVAL',
    'JSENCODE',
    'JSINHTMLENCOD',
    'JUNCTIONIDLIST',
    'LEFT',
    'LEN',
    'LINKTO',
    'LN',
    'LOG',
    'LOWER',
    'LPAD',
    'MAX',
    'MCEILING',
    'MFLOOR',
    'MID',
    'MILLISECOND',
    'MIN',
    'MINUTE',
    'MOD',
    'MONTH',
    'NOT',
    'NOW',
    'NULLVALUE',
    'OR',
    'PARENTGROUPVAL',
    'PI',
    'PICKLISTCOUNT',
    'PREDICT',
    'PREVGROUPVAL',
    'PRIORVALUE',
    'REGEX',
    'REQUIRESCRIPT',
    'REVERSE',
    'RIGHT',
    'ROUND',
    'RPAD',
    'SECOND',
    'SIN',
    'SQRT',
    'SUBSTITUTE',
    'TAN',
    'TEXT',
    'TIMENOW',
    'TIMEVALUE',
    'TODAY',
    'TRIM',
    'TRUNC',
    'UNIXTIMESTAMP',
    'UPPER',
    'URLENCODE',
    'URLFOR',
    'VALUE',
    'VLOOKUP',
    'WEEKDAY',
    'YEAR',
    '$Api',
    '$CustomMetadata',
    '$Label',
    '$Organization',
    '$Permission',
    '$Profile',
    '$Setup',
    '$System',
    '$User',
    '$UserRole',
  ],
  operators: ['+', '-', '*', '/', '^', '=', '==', '<>', '!=', '<', '>', '<=', '>=', '&&', '||', '&'],
  typeKeywords: [],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  digits: /\d+(_+\d+)*/,
  octaldigits: /[0-7]+(_+[0-7]+)*/,
  binarydigits: /[0-1]+(_+[0-1]+)*/,
  hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,
  regexpctl: /[(){}\[\]\$\^|\-*+?\.]/,
  regexpesc: /\\(?:[bBdDfnrstvwWn0\\\/]|@regexpctl|c[A-Z]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/,
  tokenizer: {
    root: [[/[{}]/, 'delimiter.bracket'], { include: 'common' }],
    common: [
      // identifiers and keywords
      [
        /#?[a-z_$][\w$]*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        },
      ],
      [/[A-Z][\w\$]*/, 'type.identifier'],
      // to show class names nicely
      // [/[A-Z][\w\$]*/, 'identifier'],
      // whitespace
      { include: '@whitespace' },
      // regular expression: ensure it is terminated before beginning (otherwise it is an opeator)
      [/\/(?=([^\\\/]|\\.)+\/([dgimsuy]*)(\s*)(\.|;|,|\)|\]|\}|$))/, { token: 'regexp', bracket: '@open', next: '@regexp' }],
      // delimiters and operators
      [/[()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [/!(?=([^=]|$))/, 'delimiter'],
      [
        /@symbols/,
        {
          cases: {
            '@operators': 'delimiter',
            '@default': '',
          },
        },
      ],
      // numbers
      [/(@digits)[eE]([\-+]?(@digits))?/, 'number.float'],
      [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, 'number.float'],
      [/0[xX](@hexdigits)n?/, 'number.hex'],
      [/0[oO]?(@octaldigits)n?/, 'number.octal'],
      [/0[bB](@binarydigits)n?/, 'number.binary'],
      [/(@digits)n?/, 'number'],
      // delimiter: after number because of .\d floats
      [/[;,.]/, 'delimiter'],
      // strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      // non-teminated string
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      // non-teminated string
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
      [/`/, 'string', '@string_backtick'],
    ],
    whitespace: [
      [/[ \t\r\n]+/, ''],
      [/\/\*\*(?!\/)/, 'comment.doc', '@jsdoc'],
      [/\/\*/, 'comment', '@comment'],
      [/\/\/.*$/, 'comment'],
    ],
    comment: [
      [/[^\/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[\/*]/, 'comment'],
    ],
    jsdoc: [
      [/[^\/*]+/, 'comment.doc'],
      [/\*\//, 'comment.doc', '@pop'],
      [/[\/*]/, 'comment.doc'],
    ],
    // We match regular expression quite precisely
    regexp: [
      [/(\{)(\d+(?:,\d*)?)(\})/, ['regexp.escape.control', 'regexp.escape.control', 'regexp.escape.control']],
      [/(\[)(\^?)(?=(?:[^\]\\\/]|\\.)+)/, ['regexp.escape.control', { token: 'regexp.escape.control', next: '@regexrange' }]],
      [/(\()(\?:|\?=|\?!)/, ['regexp.escape.control', 'regexp.escape.control']],
      [/[()]/, 'regexp.escape.control'],
      [/@regexpctl/, 'regexp.escape.control'],
      [/[^\\\/]/, 'regexp'],
      [/@regexpesc/, 'regexp.escape'],
      [/\\\./, 'regexp.invalid'],
      [/(\/)([dgimsuy]*)/, [{ token: 'regexp', bracket: '@close', next: '@pop' }, 'keyword.other']],
    ],
    regexrange: [
      [/-/, 'regexp.escape.control'],
      [/\^/, 'regexp.invalid'],
      [/@regexpesc/, 'regexp.escape'],
      [/[^\]]/, 'regexp'],
      [
        /\]/,
        {
          token: 'regexp.escape.control',
          next: '@pop',
          bracket: '@close',
        },
      ],
    ],
    string_double: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],
    string_single: [
      [/[^\\']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string', '@pop'],
    ],
    string_backtick: [
      [/\$\{/, { token: 'delimiter.bracket', next: '@bracketCounting' }],
      [/[^\\`$]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/`/, 'string', '@pop'],
    ],
    bracketCounting: [[/\{/, 'delimiter.bracket', '@bracketCounting'], [/\}/, 'delimiter.bracket', '@pop'], { include: 'common' }],
  },
};
