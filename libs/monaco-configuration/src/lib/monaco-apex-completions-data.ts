export type APEX_COMPLETIONS_ROOTS =
  | 'String'
  | 'Set'
  | 'Schema'
  | 'Schedulable'
  | 'SObject'
  | 'Long'
  | 'Map'
  | 'Limits'
  | 'List'
  | 'JSON'
  | 'Integer'
  | 'HttpRequest'
  | 'HttpResponse'
  | 'Id'
  | 'Http'
  | 'EventBus'
  | 'Double'
  | 'Database'
  | 'Date'
  | 'Datetime'
  | 'Decimal'
  | 'ApexPages'
  | 'Url'
  | 'UserInfo'
  | 'System';

export type APEX_COMPLETIONS_TYPES = { [key in APEX_COMPLETIONS_ROOTS]: CompletionItem };

export interface CompletionItem {
  constructors: CompletionItemConstructor[];
  methods: CompletionItemMethod[];
  properties: CompletionItemProperty[];
}

export interface CompletionItemConstructor {
  methodDoc: string | null;
  name: string;
  parameters: CompletionItemParameter[];
  references: any[];
}
export interface CompletionItemMethod {
  argTypes: string[];
  isStatic: boolean;
  methodDoc: string | null;
  name: string;
  parameters: CompletionItemParameter[];
  references: any[];
  returnType?: string;
}
export interface CompletionItemProperty {
  name: string;
  type: string;
}

export interface CompletionItemParameter {
  name: string;
  type: string;
}

export const ROOT_COMPLETION_TYPES: APEX_COMPLETIONS_ROOTS[] = [
  'String',
  'Set',
  'Schema',
  'Schedulable',
  'SObject',
  'Long',
  'Map',
  'Limits',
  'List',
  'JSON',
  'Integer',
  'HttpRequest',
  'HttpResponse',
  'Id',
  'Http',
  'EventBus',
  'Double',
  'Database',
  'Date',
  'Datetime',
  'Decimal',
  'ApexPages',
  'Url',
  'UserInfo',
  'System',
];

const caseInsensitiveKeyMap = ROOT_COMPLETION_TYPES.reduce((output: { [key: string]: APEX_COMPLETIONS_ROOTS }, item) => {
  output[item.toLowerCase()] = item;
  return output;
}, {});

export function getProperCasedCompletionKey(key: string) {
  return caseInsensitiveKeyMap[key.toLowerCase()];
}

export const APEX_COMPLETIONS: APEX_COMPLETIONS_TYPES = {
  String: {
    constructors: [],
    methods: [
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'abbreviate',
        parameters: [
          {
            name: 'maxWidth',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'abbreviate',
        parameters: [
          {
            name: 'maxWidth',
            type: 'Integer',
          },
          {
            name: 'offset',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Exception'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Exception', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'capitalize',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'center',
        parameters: [
          {
            name: 'size',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'center',
        parameters: [
          {
            name: 'size',
            type: 'Integer',
          },
          {
            name: 'padStr',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'charAt',
        parameters: [
          {
            name: 'index',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'codePointAt',
        parameters: [
          {
            name: 'index',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'codePointBefore',
        parameters: [
          {
            name: 'index',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'codePointCount',
        parameters: [
          {
            name: 'beginIndex',
            type: 'Integer',
          },
          {
            name: 'endIndex',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'compareTo',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'contains',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'containsAny',
        parameters: [
          {
            name: 'validChars',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'containsIgnoreCase',
        parameters: [
          {
            name: 'searchStr',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'containsNone',
        parameters: [
          {
            name: 'invalidChars',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'containsOnly',
        parameters: [
          {
            name: 'validChars',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'containsWhitespace',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'countMatches',
        parameters: [
          {
            name: 'searchStr',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'deleteWhitespace',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'difference',
        parameters: [
          {
            name: 'other',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'endsWith',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'endsWithIgnoreCase',
        parameters: [
          {
            name: 'suffix',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Object'],
        isStatic: false,
        methodDoc: null,
        name: 'equals',
        parameters: [
          {
            name: 'other',
            type: 'Object',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'equalsIgnoreCase',
        parameters: [
          {
            name: 'other',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'escapeCsv',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'escapeEcmaScript',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'escapeHtml3',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'escapeHtml4',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'escapeJava',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'escapeSingleQuotes',
        parameters: [
          {
            name: 's',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'escapeUnicode',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'escapeXml',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String', 'List<APEX_OBJECT>'],
        isStatic: true,
        methodDoc: null,
        name: 'format',
        parameters: [
          {
            name: 'format',
            type: 'String',
          },
          {
            name: 'arguments',
            type: 'List<APEX_OBJECT>',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['List<Integer>'],
        isStatic: true,
        methodDoc: null,
        name: 'fromCharArray',
        parameters: [
          {
            name: 'charArr',
            type: 'List<Integer>',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getChars',
        parameters: [],
        references: [],
        returnType: 'List<Integer>',
      },
      {
        argTypes: ['List<String>'],
        isStatic: true,
        methodDoc: null,
        name: 'getCommonPrefix',
        parameters: [
          {
            name: 'strings',
            type: 'List<String>',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'getLevenshteinDistance',
        parameters: [
          {
            name: 'other',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'getLevenshteinDistance',
        parameters: [
          {
            name: 'other',
            type: 'String',
          },
          {
            name: 'threshold',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'hashCode',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'indexOf',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'indexOf',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
          {
            name: 'startPos',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'indexOfAny',
        parameters: [
          {
            name: 'searchChars',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'indexOfAnyBut',
        parameters: [
          {
            name: 'searchChars',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'indexOfChar',
        parameters: [
          {
            name: 'ch',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'indexOfChar',
        parameters: [
          {
            name: 'ch',
            type: 'Integer',
          },
          {
            name: 'fromIndex',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'indexOfDifference',
        parameters: [
          {
            name: 'other',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'indexOfIgnoreCase',
        parameters: [
          {
            name: 'searchStr',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'indexOfIgnoreCase',
        parameters: [
          {
            name: 'searchStr',
            type: 'String',
          },
          {
            name: 'startPos',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isAllLowerCase',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isAllUpperCase',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isAlpha',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isAlphaSpace',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isAlphanumeric',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isAlphanumericSpace',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isAsciiPrintable',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'isBlank',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'isEmpty',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'isNotBlank',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'isNotEmpty',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isNumeric',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isNumericSpace',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isWhitespace',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['APEX_OBJECT', 'String'],
        isStatic: true,
        methodDoc: null,
        name: 'join',
        parameters: [
          {
            name: 'iterableObj',
            type: 'APEX_OBJECT',
          },
          {
            name: 'separator',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'lastIndexOf',
        parameters: [
          {
            name: 'searchStr',
            type: 'String',
          },
          {
            name: 'startPos',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'lastIndexOf',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'lastIndexOfChar',
        parameters: [
          {
            name: 'ch',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'lastIndexOfChar',
        parameters: [
          {
            name: 'ch',
            type: 'Integer',
          },
          {
            name: 'fromIndex',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'lastIndexOfIgnoreCase',
        parameters: [
          {
            name: 'searchStr',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'lastIndexOfIgnoreCase',
        parameters: [
          {
            name: 'searchStr',
            type: 'String',
          },
          {
            name: 'startPos',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'left',
        parameters: [
          {
            name: 'len',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'leftPad',
        parameters: [
          {
            name: 'len',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'leftPad',
        parameters: [
          {
            name: 'len',
            type: 'Integer',
          },
          {
            name: 'padStr',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'length',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'mid',
        parameters: [
          {
            name: 'pos',
            type: 'Integer',
          },
          {
            name: 'len',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'normalizeSpace',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'offsetByCodePoints',
        parameters: [
          {
            name: 'index',
            type: 'Integer',
          },
          {
            name: 'codePointOffset',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String', 'Integer', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'overlay',
        parameters: [
          {
            name: 'overlay',
            type: 'String',
          },
          {
            name: 'start',
            type: 'Integer',
          },
          {
            name: 'end',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'remove',
        parameters: [
          {
            name: 'toRemove',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'removeEnd',
        parameters: [
          {
            name: 'toRemove',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'removeEndIgnoreCase',
        parameters: [
          {
            name: 'toRemove',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'removeStart',
        parameters: [
          {
            name: 'toRemove',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'removeStartIgnoreCase',
        parameters: [
          {
            name: 'toRemove',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'repeat',
        parameters: [
          {
            name: 'numTimes',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'repeat',
        parameters: [
          {
            name: 'separator',
            type: 'String',
          },
          {
            name: 'numTimes',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'replace',
        parameters: [
          {
            name: 'target',
            type: 'String',
          },
          {
            name: 'replacement',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'replaceAll',
        parameters: [
          {
            name: 'regex',
            type: 'String',
          },
          {
            name: 'replacement',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'replaceFirst',
        parameters: [
          {
            name: 'regex',
            type: 'String',
          },
          {
            name: 'replacement',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'reverse',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'right',
        parameters: [
          {
            name: 'len',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'rightPad',
        parameters: [
          {
            name: 'len',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'rightPad',
        parameters: [
          {
            name: 'len',
            type: 'Integer',
          },
          {
            name: 'padStr',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'split',
        parameters: [
          {
            name: 'regex',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'List<String>',
      },
      {
        argTypes: ['String', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'split',
        parameters: [
          {
            name: 'regex',
            type: 'String',
          },
          {
            name: 'limit',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'List<String>',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'splitByCharacterType',
        parameters: [],
        references: [],
        returnType: 'List<String>',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'splitByCharacterTypeCamelCase',
        parameters: [],
        references: [],
        returnType: 'List<String>',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'startsWith',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'startsWithIgnoreCase',
        parameters: [
          {
            name: 'prefix',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'stripHtmlTags',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'substring',
        parameters: [
          {
            name: 'start',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'substring',
        parameters: [
          {
            name: 'start',
            type: 'Integer',
          },
          {
            name: 'end',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'substringAfter',
        parameters: [
          {
            name: 'separator',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'substringAfterLast',
        parameters: [
          {
            name: 'separator',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'substringBefore',
        parameters: [
          {
            name: 'separator',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'substringBeforeLast',
        parameters: [
          {
            name: 'separator',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'substringBetween',
        parameters: [
          {
            name: 'open',
            type: 'String',
          },
          {
            name: 'close',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'substringBetween',
        parameters: [
          {
            name: 'tag',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'swapCase',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toLowerCase',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'toLowerCase',
        parameters: [
          {
            name: 'locale',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toUpperCase',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'toUpperCase',
        parameters: [
          {
            name: 'locale',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'trim',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'uncapitalize',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'unescapeCsv',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'unescapeEcmaScript',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'unescapeHtml3',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'unescapeHtml4',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'unescapeJava',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'unescapeUnicode',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'unescapeXml',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Date'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'd',
            type: 'Date',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Datetime'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'dt',
            type: 'Datetime',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Decimal'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'd',
            type: 'Decimal',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Double'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'd',
            type: 'Double',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'i',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Long'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'l',
            type: 'Long',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Object'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'o',
            type: 'Object',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Datetime'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOfGmt',
        parameters: [
          {
            name: 'dt',
            type: 'Datetime',
          },
        ],
        references: [],
        returnType: 'String',
      },
    ],
    properties: [],
  },
  Set: {
    constructors: [
      {
        methodDoc: null,
        name: 'Set',
        parameters: [],
        references: [],
      },
      {
        methodDoc: null,
        name: 'Set',
        parameters: [
          {
            name: 'param1',
            type: 'Object',
          },
        ],
        references: [],
      },
    ],
    methods: [
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'add',
        parameters: [
          {
            name: 'element',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['List'],
        isStatic: false,
        methodDoc: null,
        name: 'addAll',
        parameters: [
          {
            name: 'elements',
            type: 'List',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Set'],
        isStatic: false,
        methodDoc: null,
        name: 'addAll',
        parameters: [
          {
            name: 'elements',
            type: 'Set',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clear',
        parameters: [],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [],
        references: [],
        returnType: 'Set<String>',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'contains',
        parameters: [
          {
            name: 'element',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['List'],
        isStatic: false,
        methodDoc: null,
        name: 'containsAll',
        parameters: [
          {
            name: 'elements',
            type: 'List',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Set'],
        isStatic: false,
        methodDoc: null,
        name: 'containsAll',
        parameters: [
          {
            name: 'elements',
            type: 'Set',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'equals',
        parameters: [
          {
            name: 'obj',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'hashCode',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isEmpty',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'iterator',
        parameters: [],
        references: [],
        returnType: 'system.ListIterator',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'remove',
        parameters: [
          {
            name: 'element',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['List'],
        isStatic: false,
        methodDoc: null,
        name: 'removeAll',
        parameters: [
          {
            name: 'elements',
            type: 'List',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Set'],
        isStatic: false,
        methodDoc: null,
        name: 'removeAll',
        parameters: [
          {
            name: 'elements',
            type: 'Set',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['List'],
        isStatic: false,
        methodDoc: null,
        name: 'retainAll',
        parameters: [
          {
            name: 'elements',
            type: 'List',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Set'],
        isStatic: false,
        methodDoc: null,
        name: 'retainAll',
        parameters: [
          {
            name: 'elements',
            type: 'Set',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'size',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toString',
        parameters: [],
        references: [],
        returnType: 'String',
      },
    ],
    properties: [],
  },
  Schema: {
    constructors: [],
    methods: [
      {
        argTypes: ['List<Schema.DataCategoryGroupSobjectTypePair>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'describeDataCategoryGroupStructures',
        parameters: [
          {
            name: 'pairs',
            type: 'List<Schema.DataCategoryGroupSobjectTypePair>',
          },
          {
            name: 'topCategoriesOnly',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Schema.DescribeDataCategoryGroupStructureResult>',
      },
      {
        argTypes: ['List<String>'],
        isStatic: true,
        methodDoc: null,
        name: 'describeDataCategoryGroups',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<String>',
          },
        ],
        references: [],
        returnType: 'List<Schema.DescribeDataCategoryGroupResult>',
      },
      {
        argTypes: ['List<String>'],
        isStatic: true,
        methodDoc: null,
        name: 'describeSObjects',
        parameters: [
          {
            name: 'types',
            type: 'List<String>',
          },
        ],
        references: [],
        returnType: 'List<Schema.DescribeSObjectResult>',
      },
      {
        argTypes: ['List<String>', 'ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'describeSObjects',
        parameters: [
          {
            name: 'types',
            type: 'List<String>',
          },
          {
            name: 'options',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'List<Schema.DescribeSObjectResult>',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'describeTabs',
        parameters: [],
        references: [],
        returnType: 'List<Schema.DescribeTabSetResult>',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'getAppDescribe',
        parameters: [
          {
            name: 'appName',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Map<String,Schema.SObjectType>',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getGlobalDescribe',
        parameters: [],
        references: [],
        returnType: 'Map<String,Schema.SObjectType>',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getModuleDescribe',
        parameters: [],
        references: [],
        returnType: 'Map<String,Schema.SObjectType>',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'getModuleDescribe',
        parameters: [
          {
            name: 'moduleName',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Map<String,Schema.SObjectType>',
      },
    ],
    properties: [],
  },
  Schedulable: {
    constructors: [],
    methods: [
      {
        argTypes: ['System.SchedulableContext'],
        isStatic: false,
        methodDoc: null,
        name: 'execute',
        parameters: [
          {
            name: 'param1',
            type: 'System.SchedulableContext',
          },
        ],
        references: [],
        returnType: 'void',
      },
    ],
    properties: [],
  },
  SObject: {
    constructors: [],
    methods: [
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['APEX_OBJECT', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'APEX_OBJECT',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Schema.SObjectField', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'fieldToken',
            type: 'Schema.SObjectField',
          },
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Schema.SObjectField', 'String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'fieldToken',
            type: 'Schema.SObjectField',
          },
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'fieldName',
            type: 'String',
          },
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'fieldName',
            type: 'String',
          },
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clear',
        parameters: [],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: ['Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [
          {
            name: 'preserveId',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: ['Boolean', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [
          {
            name: 'preserveId',
            type: 'Boolean',
          },
          {
            name: 'deep',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: ['Boolean', 'Boolean', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [
          {
            name: 'preserveId',
            type: 'Boolean',
          },
          {
            name: 'deep',
            type: 'Boolean',
          },
          {
            name: 'preserveReadOnlyTimestamps',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: ['Boolean', 'Boolean', 'Boolean', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [
          {
            name: 'preserveId',
            type: 'Boolean',
          },
          {
            name: 'deep',
            type: 'Boolean',
          },
          {
            name: 'preserveReadOnlyTimestamps',
            type: 'Boolean',
          },
          {
            name: 'preserveAutoNumbers',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: ['Schema.SObjectField'],
        isStatic: false,
        methodDoc: null,
        name: 'get',
        parameters: [
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
        ],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'get',
        parameters: [
          {
            name: 'field',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getAll',
        parameters: [],
        references: [],
        returnType: 'Map<String,SObject>',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getCloneSourceId',
        parameters: [],
        references: [],
        returnType: 'Id',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getErrors',
        parameters: [],
        references: [],
        returnType: 'List<Database.Error>',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getInstance',
        parameters: [],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'getInstance',
        parameters: [
          {
            name: 'id',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getOptions',
        parameters: [],
        references: [],
        returnType: 'Database.DMLOptions',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getOrgDefaults',
        parameters: [],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getPopulatedFieldsAsMap',
        parameters: [],
        references: [],
        returnType: 'Map<String,ANY>',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getQuickActionName',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Schema.SObjectField'],
        isStatic: false,
        methodDoc: null,
        name: 'getSObject',
        parameters: [
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
        ],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'getSObject',
        parameters: [
          {
            name: 'field',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getSObjectType',
        parameters: [],
        references: [],
        returnType: 'Schema.SObjectType',
      },
      {
        argTypes: ['Schema.SObjectField'],
        isStatic: false,
        methodDoc: null,
        name: 'getSObjects',
        parameters: [
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
        ],
        references: [],
        returnType: 'List<SObject>',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'getSObjects',
        parameters: [
          {
            name: 'field',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'List<SObject>',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'getValues',
        parameters: [
          {
            name: 'id',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'hasErrors',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isClone',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Schema.SObjectField'],
        isStatic: false,
        methodDoc: null,
        name: 'isSet',
        parameters: [
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'isSet',
        parameters: [
          {
            name: 'fieldName',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Schema.SObjectField', 'Object'],
        isStatic: false,
        methodDoc: null,
        name: 'put',
        parameters: [
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
          {
            name: 'value',
            type: 'Object',
          },
        ],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: ['String', 'Object'],
        isStatic: false,
        methodDoc: null,
        name: 'put',
        parameters: [
          {
            name: 'field',
            type: 'String',
          },
          {
            name: 'value',
            type: 'Object',
          },
        ],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: ['Schema.SObjectField', 'SObject'],
        isStatic: false,
        methodDoc: null,
        name: 'putSObject',
        parameters: [
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
          {
            name: 'value',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: ['String', 'SObject'],
        isStatic: false,
        methodDoc: null,
        name: 'putSObject',
        parameters: [
          {
            name: 'field',
            type: 'String',
          },
          {
            name: 'value',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'SObject',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'recalculateFormulas',
        parameters: [],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: false,
        methodDoc: null,
        name: 'setOptions',
        parameters: [
          {
            name: 'options',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'void',
      },
    ],
    properties: [],
  },
  Long: {
    constructors: [],
    methods: [
      {
        argTypes: ['Exception'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Exception', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'format',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'intValue',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Long',
      },
    ],
    properties: [],
  },
  Map: {
    constructors: [
      {
        methodDoc: null,
        name: 'Map',
        parameters: [
          {
            name: 'param1',
            type: 'List<Object>',
          },
        ],
        references: [],
      },
      {
        methodDoc: null,
        name: 'Map',
        parameters: [
          {
            name: 'param1',
            type: 'Map<Object,Object>',
          },
        ],
        references: [],
      },
    ],
    methods: [
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clear',
        parameters: [],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [],
        references: [],
        returnType: 'Map<String,String>',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'containsKey',
        parameters: [
          {
            name: 'key',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'deepClone',
        parameters: [],
        references: [],
        returnType: 'Map<String,String>',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'equals',
        parameters: [
          {
            name: 'obj',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'get',
        parameters: [
          {
            name: 'key',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getSObjectType',
        parameters: [],
        references: [],
        returnType: 'Schema.SObjectType',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'hashCode',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isEmpty',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'keySet',
        parameters: [],
        references: [],
        returnType: 'Set<String>',
      },
      {
        argTypes: ['ANY', 'ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'put',
        parameters: [
          {
            name: 'key',
            type: 'ANY',
          },
          {
            name: 'value',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: false,
        methodDoc: null,
        name: 'putAll',
        parameters: [
          {
            name: 'entries',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Map'],
        isStatic: false,
        methodDoc: null,
        name: 'putAll',
        parameters: [
          {
            name: 'entries',
            type: 'Map',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'remove',
        parameters: [
          {
            name: 'key',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'size',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toString',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'values',
        parameters: [],
        references: [],
        returnType: 'List<String>',
      },
    ],
    properties: [],
  },
  Limits: {
    constructors: [],
    methods: [
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getAggregateQueries',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getCallouts',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getChildRelationshipsDescribes',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getCpuTime',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getDatabaseTime',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getDmlRows',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getDmlStatements',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getEmailInvocations',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getFieldSetsDescribes',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getFieldsDescribes',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getFindSimilarCalls',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getFutureCalls',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getHeapSize',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitAggregateQueries',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitCallouts',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitChildRelationshipsDescribes',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitCpuTime',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitDatabaseTime',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitDmlRows',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitDmlStatements',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitEmailInvocations',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitFieldSetsDescribes',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitFieldsDescribes',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitFindSimilarCalls',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitFutureCalls',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitHeapSize',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitMobilePushApexCalls',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitPicklistDescribes',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitPublishImmediateDML',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitQueries',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitQueryLocatorRows',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitQueryRows',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitQueueableJobs',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitRecordTypesDescribes',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitRunAs',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitSavepointRollbacks',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitSavepoints',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitScriptStatements',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLimitSoslQueries',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getMobilePushApexCalls',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getPicklistDescribes',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getPublishImmediateDML',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getQueries',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getQueryLocatorRows',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getQueryRows',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getQueueableJobs',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getRecordTypesDescribes',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getRunAs',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getSavepointRollbacks',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getSavepoints',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getScriptStatements',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getSoslQueries',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
    ],
    properties: [],
  },
  List: {
    constructors: [
      {
        methodDoc: null,
        name: 'List',
        parameters: [],
        references: [],
      },
      {
        methodDoc: null,
        name: 'List',
        parameters: [
          {
            name: 'param1',
            type: 'Integer',
          },
        ],
        references: [],
      },
    ],
    methods: [
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'add',
        parameters: [
          {
            name: 'element',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: ['Integer', 'ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'add',
        parameters: [
          {
            name: 'index',
            type: 'Integer',
          },
          {
            name: 'element',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['List'],
        isStatic: false,
        methodDoc: null,
        name: 'addAll',
        parameters: [
          {
            name: 'elements',
            type: 'List',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Set'],
        isStatic: false,
        methodDoc: null,
        name: 'addAll',
        parameters: [
          {
            name: 'elements',
            type: 'Set',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clear',
        parameters: [],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [],
        references: [],
        returnType: 'List<String>',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'contains',
        parameters: [
          {
            name: 'element',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'deepClone',
        parameters: [],
        references: [],
        returnType: 'List<String>',
      },
      {
        argTypes: ['Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'deepClone',
        parameters: [
          {
            name: 'preserveId',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<String>',
      },
      {
        argTypes: ['Boolean', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'deepClone',
        parameters: [
          {
            name: 'preserveId',
            type: 'Boolean',
          },
          {
            name: 'preserveReadOnlyTimestamps',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<String>',
      },
      {
        argTypes: ['Boolean', 'Boolean', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'deepClone',
        parameters: [
          {
            name: 'preserveId',
            type: 'Boolean',
          },
          {
            name: 'preserveReadOnlyTimestamps',
            type: 'Boolean',
          },
          {
            name: 'preserveAutoNumbers',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<String>',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'equals',
        parameters: [
          {
            name: 'obj',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'get',
        parameters: [
          {
            name: 'index',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getSObjectType',
        parameters: [],
        references: [],
        returnType: 'Schema.SObjectType',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'hashCode',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'indexOf',
        parameters: [
          {
            name: 'element',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'isEmpty',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'iterator',
        parameters: [],
        references: [],
        returnType: 'system.ListIterator',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'remove',
        parameters: [
          {
            name: 'index',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer', 'ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'set',
        parameters: [
          {
            name: 'index',
            type: 'Integer',
          },
          {
            name: 'value',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'size',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'sort',
        parameters: [],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toString',
        parameters: [],
        references: [],
        returnType: 'String',
      },
    ],
    properties: [],
  },
  JSON: {
    constructors: [
      {
        methodDoc: null,
        name: 'JSON',
        parameters: [],
        references: [],
      },
    ],
    methods: [
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: ['Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'createGenerator',
        parameters: [
          {
            name: 'pretty',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'System.JSONGenerator',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'createParser',
        parameters: [
          {
            name: 'jsonString',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'System.JSONParser',
      },
      {
        argTypes: ['String', 'System.Type'],
        isStatic: true,
        methodDoc: null,
        name: 'deserialize',
        parameters: [
          {
            name: 'jsonString',
            type: 'String',
          },
          {
            name: 'apexType',
            type: 'System.Type',
          },
        ],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: ['String', 'System.Type'],
        isStatic: true,
        methodDoc: null,
        name: 'deserializeStrict',
        parameters: [
          {
            name: 'jsonString',
            type: 'String',
          },
          {
            name: 'apexType',
            type: 'System.Type',
          },
        ],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'deserializeUntyped',
        parameters: [
          {
            name: 'jsonString',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: ['Object'],
        isStatic: true,
        methodDoc: null,
        name: 'serialize',
        parameters: [
          {
            name: 'o',
            type: 'Object',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Object', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'serialize',
        parameters: [
          {
            name: 'o',
            type: 'Object',
          },
          {
            name: 'suppressApexObjectNulls',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Object'],
        isStatic: true,
        methodDoc: null,
        name: 'serializePretty',
        parameters: [
          {
            name: 'o',
            type: 'Object',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Object', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'serializePretty',
        parameters: [
          {
            name: 'o',
            type: 'Object',
          },
          {
            name: 'suppressApexObjectNulls',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'String',
      },
    ],
    properties: [],
  },
  Integer: {
    constructors: [],
    methods: [
      {
        argTypes: ['Exception'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Exception', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'format',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Object'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'o',
            type: 'Object',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'i',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
    ],
    properties: [],
  },
  HttpRequest: {
    constructors: [
      {
        methodDoc: null,
        name: 'HttpRequest',
        parameters: [],
        references: [],
      },
    ],
    methods: [
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getBody',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getBodyAsBlob',
        parameters: [],
        references: [],
        returnType: 'Blob',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getBodyDocument',
        parameters: [],
        references: [],
        returnType: 'dom.Document',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getCompressed',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getEndpoint',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'getHeader',
        parameters: [
          {
            name: 'key',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getMethod',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'setBody',
        parameters: [
          {
            name: 'body',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Blob'],
        isStatic: false,
        methodDoc: null,
        name: 'setBodyAsBlob',
        parameters: [
          {
            name: 'body',
            type: 'Blob',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'setBodyDocument',
        parameters: [
          {
            name: 'body',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'setClientCertificate',
        parameters: [
          {
            name: 'clientCert',
            type: 'String',
          },
          {
            name: 'password',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'setClientCertificateName',
        parameters: [
          {
            name: 'certDevName',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'setCompressed',
        parameters: [
          {
            name: 'compressed',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'setEndpoint',
        parameters: [
          {
            name: 'endpoint',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'setHeader',
        parameters: [
          {
            name: 'key',
            type: 'String',
          },
          {
            name: 'value',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'setMethod',
        parameters: [
          {
            name: 'method',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'setTimeout',
        parameters: [
          {
            name: 'timeout',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toString',
        parameters: [],
        references: [],
        returnType: 'String',
      },
    ],
    properties: [],
  },
  HttpResponse: {
    constructors: [
      {
        methodDoc: null,
        name: 'HttpResponse',
        parameters: [],
        references: [],
      },
    ],
    methods: [
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getBody',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getBodyAsBlob',
        parameters: [],
        references: [],
        returnType: 'Blob',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getBodyDocument',
        parameters: [],
        references: [],
        returnType: 'dom.Document',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'getHeader',
        parameters: [
          {
            name: 'key',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getHeaderKeys',
        parameters: [],
        references: [],
        returnType: 'List<String>',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getStatus',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getStatusCode',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getXmlStreamReader',
        parameters: [],
        references: [],
        returnType: 'System.XmlStreamReader',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'setBody',
        parameters: [
          {
            name: 'body',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Blob'],
        isStatic: false,
        methodDoc: null,
        name: 'setBodyAsBlob',
        parameters: [
          {
            name: 'body',
            type: 'Blob',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'setHeader',
        parameters: [
          {
            name: 'key',
            type: 'String',
          },
          {
            name: 'value',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'setStatus',
        parameters: [
          {
            name: 'status',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'setStatusCode',
        parameters: [
          {
            name: 'statusCode',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toString',
        parameters: [],
        references: [],
        returnType: 'String',
      },
    ],
    properties: [],
  },
  Id: {
    constructors: [],
    methods: [
      {
        argTypes: ['Exception'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Exception', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'equals',
        parameters: [
          {
            name: 'o',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getSobjectType',
        parameters: [],
        references: [],
        returnType: 'Schema.SObjectType',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'to15',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Id',
      },
      {
        argTypes: ['String', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
          {
            name: 'restoreCasing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Id',
      },
    ],
    properties: [],
  },
  Http: {
    constructors: [
      {
        methodDoc: null,
        name: 'Http',
        parameters: [],
        references: [],
      },
    ],
    methods: [
      {
        argTypes: ['ANY'],
        isStatic: false,
        methodDoc: null,
        name: 'send',
        parameters: [
          {
            name: 'request',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'System.HttpResponse',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toString',
        parameters: [],
        references: [],
        returnType: 'String',
      },
    ],
    properties: [],
  },
  EventBus: {
    constructors: [],
    methods: [
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'getOperationId',
        parameters: [
          {
            name: 'result',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'publish',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'publish',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'callback',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'publish',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'publish',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'callback',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
    ],
    properties: [],
  },
  Double: {
    constructors: [],
    methods: [
      {
        argTypes: ['Exception'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Exception', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'format',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'intValue',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'longValue',
        parameters: [],
        references: [],
        returnType: 'Long',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'round',
        parameters: [],
        references: [],
        returnType: 'Long',
      },
      {
        argTypes: ['Object'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'o',
            type: 'Object',
          },
        ],
        references: [],
        returnType: 'Double',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Double',
      },
    ],
    properties: [],
  },
  Database: {
    constructors: [],
    methods: [
      {
        argTypes: ['Database.LeadConvert'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLead',
        parameters: [
          {
            name: 'leadConvert',
            type: 'Database.LeadConvert',
          },
        ],
        references: [],
        returnType: 'Database.LeadConvertResult',
      },
      {
        argTypes: ['Database.LeadConvert', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLead',
        parameters: [
          {
            name: 'leadConvert',
            type: 'Database.LeadConvert',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.LeadConvertResult',
      },
      {
        argTypes: ['Database.LeadConvert', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLead',
        parameters: [
          {
            name: 'leadConvert',
            type: 'Database.LeadConvert',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.LeadConvertResult',
      },
      {
        argTypes: ['List<Database.LeadConvert>'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLead',
        parameters: [
          {
            name: 'leadConverts',
            type: 'List<Database.LeadConvert>',
          },
        ],
        references: [],
        returnType: 'List<Database.LeadConvertResult>',
      },
      {
        argTypes: ['List<Database.LeadConvert>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLead',
        parameters: [
          {
            name: 'leadConverts',
            type: 'List<Database.LeadConvert>',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.LeadConvertResult>',
      },
      {
        argTypes: ['List<Database.LeadConvert>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLead',
        parameters: [
          {
            name: 'leadConverts',
            type: 'List<Database.LeadConvert>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.LeadConvertResult>',
      },
      {
        argTypes: ['Database.LeadConvert', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLeadWithAccess',
        parameters: [
          {
            name: 'leadConvert',
            type: 'Database.LeadConvert',
          },
          {
            name: 'AccessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.LeadConvertResult',
      },
      {
        argTypes: ['Database.LeadConvert', 'APEX_OBJECT', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLeadWithAccess',
        parameters: [
          {
            name: 'leadConvert',
            type: 'Database.LeadConvert',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.LeadConvertResult',
      },
      {
        argTypes: ['Database.LeadConvert', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLeadWithAccess',
        parameters: [
          {
            name: 'leadConvert',
            type: 'Database.LeadConvert',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.LeadConvertResult',
      },
      {
        argTypes: ['List<Database.LeadConvert>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLeadWithAccess',
        parameters: [
          {
            name: 'leadConverts',
            type: 'List<Database.LeadConvert>',
          },
          {
            name: 'AccessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.LeadConvertResult>',
      },
      {
        argTypes: ['List<Database.LeadConvert>', 'APEX_OBJECT', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLeadWithAccess',
        parameters: [
          {
            name: 'leadConverts',
            type: 'List<Database.LeadConvert>',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.LeadConvertResult>',
      },
      {
        argTypes: ['List<Database.LeadConvert>', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'convertLeadWithAccess',
        parameters: [
          {
            name: 'leadConverts',
            type: 'List<Database.LeadConvert>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.LeadConvertResult>',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'countQuery',
        parameters: [
          {
            name: 'query',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['String', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'countQueryWithAccess',
        parameters: [
          {
            name: 'query',
            type: 'String',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Id'],
        isStatic: true,
        methodDoc: null,
        name: 'delete',
        parameters: [
          {
            name: 'id',
            type: 'Id',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['Id', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'delete',
        parameters: [
          {
            name: 'id',
            type: 'Id',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['List<Id>'],
        isStatic: true,
        methodDoc: null,
        name: 'delete',
        parameters: [
          {
            name: 'ids',
            type: 'List<Id>',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['List<Id>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'delete',
        parameters: [
          {
            name: 'ids',
            type: 'List<Id>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'delete',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['List<SObject>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'delete',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'delete',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['SObject', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'delete',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteAsync',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteAsync',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'callback',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteAsync',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteAsync',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'callback',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteImmediate',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteImmediate',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['Id', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteWithAccess',
        parameters: [
          {
            name: 'id',
            type: 'Id',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['Id', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteWithAccess',
        parameters: [
          {
            name: 'id',
            type: 'Id',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['List<Id>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteWithAccess',
        parameters: [
          {
            name: 'ids',
            type: 'List<Id>',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['List<Id>', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteWithAccess',
        parameters: [
          {
            name: 'ids',
            type: 'List<Id>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['List<SObject>', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.DeleteResult>',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['SObject', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'deleteWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['List<Id>'],
        isStatic: true,
        methodDoc: null,
        name: 'emptyRecycleBin',
        parameters: [
          {
            name: 'ids',
            type: 'List<Id>',
          },
        ],
        references: [],
        returnType: 'List<Database.EmptyRecycleBinResult>',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'emptyRecycleBin',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.EmptyRecycleBinResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'emptyRecycleBin',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.EmptyRecycleBinResult',
      },
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'executeBatch',
        parameters: [
          {
            name: 'batchable',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['APEX_OBJECT', 'Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'executeBatch',
        parameters: [
          {
            name: 'batchable',
            type: 'APEX_OBJECT',
          },
          {
            name: 'batchSize',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'getAsyncDeleteResult',
        parameters: [
          {
            name: 'deleteResult',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'getAsyncDeleteResult',
        parameters: [
          {
            name: 'asyncLocator',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Database.DeleteResult',
      },
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'getAsyncLocator',
        parameters: [
          {
            name: 'result',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'getAsyncSaveResult',
        parameters: [
          {
            name: 'saveResult',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'getAsyncSaveResult',
        parameters: [
          {
            name: 'asyncLocator',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['String', 'Datetime', 'Datetime'],
        isStatic: true,
        methodDoc: null,
        name: 'getDeleted',
        parameters: [
          {
            name: 'sobjectType',
            type: 'String',
          },
          {
            name: 'startDate',
            type: 'Datetime',
          },
          {
            name: 'endDate',
            type: 'Datetime',
          },
        ],
        references: [],
        returnType: 'Database.GetDeletedResult',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'getQueryLocator',
        parameters: [
          {
            name: 'query',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'Database.QueryLocator',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'getQueryLocator',
        parameters: [
          {
            name: 'query',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Database.QueryLocator',
      },
      {
        argTypes: ['String', 'Datetime', 'Datetime'],
        isStatic: true,
        methodDoc: null,
        name: 'getUpdated',
        parameters: [
          {
            name: 'sobjectType',
            type: 'String',
          },
          {
            name: 'startDate',
            type: 'Datetime',
          },
          {
            name: 'endDate',
            type: 'Datetime',
          },
        ],
        references: [],
        returnType: 'Database.GetUpdatedResult',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'insert',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'insert',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'insert',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'insert',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'insert',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'insert',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'insertAsync',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'insertAsync',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'callback',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'insertAsync',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'insertAsync',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'callback',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'insertImmediate',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'insertImmediate',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'insertWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'AccessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'insertWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'insertWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'insertWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'AccessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'insertWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'insertWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'Id'],
        isStatic: true,
        methodDoc: null,
        name: 'merge',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicate',
            type: 'Id',
          },
        ],
        references: [],
        returnType: 'Database.MergeResult',
      },
      {
        argTypes: ['SObject', 'Id', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'merge',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicate',
            type: 'Id',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.MergeResult',
      },
      {
        argTypes: ['SObject', 'List<Id>'],
        isStatic: true,
        methodDoc: null,
        name: 'merge',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicates',
            type: 'List<Id>',
          },
        ],
        references: [],
        returnType: 'List<Database.MergeResult>',
      },
      {
        argTypes: ['SObject', 'List<Id>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'merge',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicates',
            type: 'List<Id>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.MergeResult>',
      },
      {
        argTypes: ['SObject', 'List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'merge',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicates',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.MergeResult>',
      },
      {
        argTypes: ['SObject', 'List<SObject>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'merge',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicates',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.MergeResult>',
      },
      {
        argTypes: ['SObject', 'SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'merge',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicate',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.MergeResult',
      },
      {
        argTypes: ['SObject', 'SObject', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'merge',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicate',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.MergeResult',
      },
      {
        argTypes: ['SObject', 'Id', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'mergeWithAccess',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicate',
            type: 'Id',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.MergeResult',
      },
      {
        argTypes: ['SObject', 'Id', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'mergeWithAccess',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicate',
            type: 'Id',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.MergeResult',
      },
      {
        argTypes: ['SObject', 'List<Id>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'mergeWithAccess',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicates',
            type: 'List<Id>',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.MergeResult>',
      },
      {
        argTypes: ['SObject', 'List<Id>', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'mergeWithAccess',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicates',
            type: 'List<Id>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.MergeResult>',
      },
      {
        argTypes: ['SObject', 'List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'mergeWithAccess',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicates',
            type: 'List<SObject>',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.MergeResult>',
      },
      {
        argTypes: ['SObject', 'List<SObject>', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'mergeWithAccess',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicates',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.MergeResult>',
      },
      {
        argTypes: ['SObject', 'SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'mergeWithAccess',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicate',
            type: 'SObject',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.MergeResult',
      },
      {
        argTypes: ['SObject', 'SObject', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'mergeWithAccess',
        parameters: [
          {
            name: 'master',
            type: 'SObject',
          },
          {
            name: 'duplicate',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.MergeResult',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'query',
        parameters: [
          {
            name: 'query',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'List<SObject>',
      },
      {
        argTypes: ['String', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'queryWithAccess',
        parameters: [
          {
            name: 'query',
            type: 'String',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<SObject>',
      },
      {
        argTypes: ['System.Savepoint'],
        isStatic: true,
        methodDoc: null,
        name: 'rollback',
        parameters: [
          {
            name: 'savepoint',
            type: 'System.Savepoint',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'setSavepoint',
        parameters: [],
        references: [],
        returnType: 'System.Savepoint',
      },
      {
        argTypes: ['Id'],
        isStatic: true,
        methodDoc: null,
        name: 'undelete',
        parameters: [
          {
            name: 'id',
            type: 'Id',
          },
        ],
        references: [],
        returnType: 'Database.UndeleteResult',
      },
      {
        argTypes: ['Id', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'undelete',
        parameters: [
          {
            name: 'id',
            type: 'Id',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.UndeleteResult',
      },
      {
        argTypes: ['List<Id>'],
        isStatic: true,
        methodDoc: null,
        name: 'undelete',
        parameters: [
          {
            name: 'ids',
            type: 'List<Id>',
          },
        ],
        references: [],
        returnType: 'List<Database.UndeleteResult>',
      },
      {
        argTypes: ['List<Id>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'undelete',
        parameters: [
          {
            name: 'ids',
            type: 'List<Id>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.UndeleteResult>',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'undelete',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.UndeleteResult>',
      },
      {
        argTypes: ['List<SObject>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'undelete',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.UndeleteResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'undelete',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.UndeleteResult',
      },
      {
        argTypes: ['SObject', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'undelete',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.UndeleteResult',
      },
      {
        argTypes: ['Id', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'undeleteWithAccess',
        parameters: [
          {
            name: 'id',
            type: 'Id',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.UndeleteResult',
      },
      {
        argTypes: ['Id', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'undeleteWithAccess',
        parameters: [
          {
            name: 'id',
            type: 'Id',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.UndeleteResult',
      },
      {
        argTypes: ['List<Id>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'undeleteWithAccess',
        parameters: [
          {
            name: 'ids',
            type: 'List<Id>',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.UndeleteResult>',
      },
      {
        argTypes: ['List<Id>', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'undeleteWithAccess',
        parameters: [
          {
            name: 'ids',
            type: 'List<Id>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.UndeleteResult>',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'undeleteWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.UndeleteResult>',
      },
      {
        argTypes: ['List<SObject>', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'undeleteWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.UndeleteResult>',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'undeleteWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.UndeleteResult',
      },
      {
        argTypes: ['SObject', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'undeleteWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.UndeleteResult',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'update',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'update',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'update',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'update',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'update',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'update',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'updateAsync',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'updateAsync',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'callback',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'updateAsync',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'updateAsync',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'callback',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'updateImmediate',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'updateImmediate',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'updateWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'updateWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['List<SObject>', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'updateWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.SaveResult>',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'updateWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'DmlOptions',
            type: 'APEX_OBJECT',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'updateWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['SObject', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'updateWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.SaveResult',
      },
      {
        argTypes: ['List<SObject>'],
        isStatic: true,
        methodDoc: null,
        name: 'upsert',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
        ],
        references: [],
        returnType: 'List<Database.UpsertResult>',
      },
      {
        argTypes: ['List<SObject>', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'upsert',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.UpsertResult>',
      },
      {
        argTypes: ['List<SObject>', 'Schema.SObjectField'],
        isStatic: true,
        methodDoc: null,
        name: 'upsert',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
        ],
        references: [],
        returnType: 'List<Database.UpsertResult>',
      },
      {
        argTypes: ['List<SObject>', 'Schema.SObjectField', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'upsert',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'List<Database.UpsertResult>',
      },
      {
        argTypes: ['SObject'],
        isStatic: true,
        methodDoc: null,
        name: 'upsert',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
        ],
        references: [],
        returnType: 'Database.UpsertResult',
      },
      {
        argTypes: ['SObject', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'upsert',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.UpsertResult',
      },
      {
        argTypes: ['SObject', 'Schema.SObjectField'],
        isStatic: true,
        methodDoc: null,
        name: 'upsert',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
        ],
        references: [],
        returnType: 'Database.UpsertResult',
      },
      {
        argTypes: ['SObject', 'Schema.SObjectField', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'upsert',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'Database.UpsertResult',
      },
      {
        argTypes: ['List<SObject>', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'upsertWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.UpsertResult>',
      },
      {
        argTypes: ['List<SObject>', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'upsertWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.UpsertResult>',
      },
      {
        argTypes: ['List<SObject>', 'Schema.SObjectField', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'upsertWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'field ',
            type: 'Schema.SObjectField',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.UpsertResult>',
      },
      {
        argTypes: ['List<SObject>', 'Schema.SObjectField', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'upsertWithAccess',
        parameters: [
          {
            name: 'sobjects',
            type: 'List<SObject>',
          },
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'List<Database.UpsertResult>',
      },
      {
        argTypes: ['SObject', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'upsertWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.UpsertResult',
      },
      {
        argTypes: ['SObject', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'upsertWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.UpsertResult',
      },
      {
        argTypes: ['SObject', 'Schema.SObjectField', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'upsertWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.UpsertResult',
      },
      {
        argTypes: ['SObject', 'Schema.SObjectField', 'Boolean', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'upsertWithAccess',
        parameters: [
          {
            name: 'sobject',
            type: 'SObject',
          },
          {
            name: 'field',
            type: 'Schema.SObjectField',
          },
          {
            name: 'allOrNothing',
            type: 'Boolean',
          },
          {
            name: 'accessLevel',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Database.UpsertResult',
      },
    ],
    properties: [],
  },
  Date: {
    constructors: [],
    methods: [
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'addDays',
        parameters: [
          {
            name: 'days',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: ['Exception'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Exception', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'addMonths',
        parameters: [
          {
            name: 'months',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'addYears',
        parameters: [
          {
            name: 'years',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'day',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'dayOfYear',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Date'],
        isStatic: false,
        methodDoc: null,
        name: 'daysBetween',
        parameters: [
          {
            name: 'other',
            type: 'Date',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer', 'Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'daysInMonth',
        parameters: [
          {
            name: 'year',
            type: 'Integer',
          },
          {
            name: 'month',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'format',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'isLeapYear',
        parameters: [
          {
            name: 'year',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Date'],
        isStatic: false,
        methodDoc: null,
        name: 'isSameDay',
        parameters: [
          {
            name: 'other',
            type: 'Date',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'month',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Date'],
        isStatic: false,
        methodDoc: null,
        name: 'monthsBetween',
        parameters: [
          {
            name: 'other',
            type: 'Date',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer', 'Integer', 'Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'newInstance',
        parameters: [
          {
            name: 'year',
            type: 'Integer',
          },
          {
            name: 'month',
            type: 'Integer',
          },
          {
            name: 'day',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'parse',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toStartOfMonth',
        parameters: [],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toStartOfWeek',
        parameters: [],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'today',
        parameters: [],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: ['Object'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'o',
            type: 'Object',
          },
        ],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'year',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
    ],
    properties: [],
  },
  Datetime: {
    constructors: [],
    methods: [
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'addDays',
        parameters: [
          {
            name: 'days',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Exception'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Exception', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'addHours',
        parameters: [
          {
            name: 'hours',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'addMinutes',
        parameters: [
          {
            name: 'minutes',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'addMonths',
        parameters: [
          {
            name: 'months',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'addSeconds',
        parameters: [
          {
            name: 'seconds',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'addYears',
        parameters: [
          {
            name: 'years',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'date',
        parameters: [],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'dateGmt',
        parameters: [],
        references: [],
        returnType: 'Date',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'day',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'dayGmt',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'dayOfYear',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'dayOfYearGmt',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'format',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'format',
        parameters: [
          {
            name: 'dateformat',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: false,
        methodDoc: null,
        name: 'format',
        parameters: [
          {
            name: 'dateformat',
            type: 'String',
          },
          {
            name: 'timezone',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'formatGmt',
        parameters: [
          {
            name: 'dateformat',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'formatLong',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getTime',
        parameters: [],
        references: [],
        returnType: 'Long',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'hour',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'hourGmt',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Datetime'],
        isStatic: false,
        methodDoc: null,
        name: 'isSameDay',
        parameters: [
          {
            name: 'other',
            type: 'Datetime',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'millisecond',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'millisecondGmt',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'minute',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'minuteGmt',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'month',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'monthGmt',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Date', 'Time'],
        isStatic: true,
        methodDoc: null,
        name: 'newInstance',
        parameters: [
          {
            name: 'date',
            type: 'Date',
          },
          {
            name: 'time',
            type: 'Time',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Integer', 'Integer', 'Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'newInstance',
        parameters: [
          {
            name: 'year',
            type: 'Integer',
          },
          {
            name: 'month',
            type: 'Integer',
          },
          {
            name: 'day',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Integer', 'Integer', 'Integer', 'Integer', 'Integer', 'Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'newInstance',
        parameters: [
          {
            name: 'year',
            type: 'Integer',
          },
          {
            name: 'month',
            type: 'Integer',
          },
          {
            name: 'day',
            type: 'Integer',
          },
          {
            name: 'hour',
            type: 'Integer',
          },
          {
            name: 'minute',
            type: 'Integer',
          },
          {
            name: 'second',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Long'],
        isStatic: true,
        methodDoc: null,
        name: 'newInstance',
        parameters: [
          {
            name: 'time',
            type: 'Long',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Date', 'Time'],
        isStatic: true,
        methodDoc: null,
        name: 'newInstanceGmt',
        parameters: [
          {
            name: 'date',
            type: 'Date',
          },
          {
            name: 'time',
            type: 'Time',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Integer', 'Integer', 'Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'newInstanceGmt',
        parameters: [
          {
            name: 'year',
            type: 'Integer',
          },
          {
            name: 'month',
            type: 'Integer',
          },
          {
            name: 'day',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['Integer', 'Integer', 'Integer', 'Integer', 'Integer', 'Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'newInstanceGmt',
        parameters: [
          {
            name: 'year',
            type: 'Integer',
          },
          {
            name: 'month',
            type: 'Integer',
          },
          {
            name: 'day',
            type: 'Integer',
          },
          {
            name: 'hour',
            type: 'Integer',
          },
          {
            name: 'minute',
            type: 'Integer',
          },
          {
            name: 'second',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'now',
        parameters: [],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'parse',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'second',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'secondGmt',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'time',
        parameters: [],
        references: [],
        returnType: 'Time',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'timeGmt',
        parameters: [],
        references: [],
        returnType: 'Time',
      },
      {
        argTypes: ['Object'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'o',
            type: 'Object',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOfGmt',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'year',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'yearGmt',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
    ],
    properties: [],
  },
  Decimal: {
    constructors: [],
    methods: [
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'abs',
        parameters: [],
        references: [],
        returnType: 'Decimal',
      },
      {
        argTypes: ['Exception'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Exception', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'Exception',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'Boolean'],
        isStatic: false,
        methodDoc: null,
        name: 'addError',
        parameters: [
          {
            name: 'msg',
            type: 'String',
          },
          {
            name: 'escape',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Decimal', 'Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'divide',
        parameters: [
          {
            name: 'divisor',
            type: 'Decimal',
          },
          {
            name: 'scale',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Decimal',
      },
      {
        argTypes: ['Decimal', 'Integer', 'APEX_OBJECT'],
        isStatic: false,
        methodDoc: null,
        name: 'divide',
        parameters: [
          {
            name: 'divisor',
            type: 'Decimal',
          },
          {
            name: 'scale',
            type: 'Integer',
          },
          {
            name: 'roundingMode',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Decimal',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'doubleValue',
        parameters: [],
        references: [],
        returnType: 'Double',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'format',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'intValue',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'longValue',
        parameters: [],
        references: [],
        returnType: 'Long',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'pow',
        parameters: [
          {
            name: 'exponent',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Decimal',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'precision',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'round',
        parameters: [],
        references: [],
        returnType: 'Long',
      },
      {
        argTypes: ['System.RoundingMode'],
        isStatic: false,
        methodDoc: null,
        name: 'round',
        parameters: [
          {
            name: 'roundingMode',
            type: 'System.RoundingMode',
          },
        ],
        references: [],
        returnType: 'Long',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'scale',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: ['Integer'],
        isStatic: false,
        methodDoc: null,
        name: 'setScale',
        parameters: [
          {
            name: 'scale',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'Decimal',
      },
      {
        argTypes: ['Integer', 'System.RoundingMode'],
        isStatic: false,
        methodDoc: null,
        name: 'setScale',
        parameters: [
          {
            name: 'scale',
            type: 'Integer',
          },
          {
            name: 'roundingMode',
            type: 'System.RoundingMode',
          },
        ],
        references: [],
        returnType: 'Decimal',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'stripTrailingZeros',
        parameters: [],
        references: [],
        returnType: 'Decimal',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toPlainString',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Double'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'dbl',
            type: 'Double',
          },
        ],
        references: [],
        returnType: 'Decimal',
      },
      {
        argTypes: ['Long'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'lng',
            type: 'Long',
          },
        ],
        references: [],
        returnType: 'Decimal',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'valueOf',
        parameters: [
          {
            name: 'str',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Decimal',
      },
    ],
    properties: [],
  },
  ApexPages: {
    constructors: [],
    methods: [
      {
        argTypes: ['ApexPages.Message'],
        isStatic: true,
        methodDoc: null,
        name: 'addMessage',
        parameters: [
          {
            name: 'message',
            type: 'ApexPages.Message',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'addMessages',
        parameters: [
          {
            name: 'ex',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'currentPage',
        parameters: [],
        references: [],
        returnType: 'System.PageReference',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getMessages',
        parameters: [],
        references: [],
        returnType: 'List<ApexPages.Message>',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'hasMessages',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['ApexPages.Severity'],
        isStatic: true,
        methodDoc: null,
        name: 'hasMessages',
        parameters: [
          {
            name: 'severity',
            type: 'ApexPages.Severity',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
    ],
    properties: [],
  },
  Url: {
    constructors: [
      {
        methodDoc: null,
        name: 'Url',
        parameters: [
          {
            name: 'protocol',
            type: 'String',
          },
          {
            name: 'host',
            type: 'String',
          },
          {
            name: 'port',
            type: 'Integer',
          },
          {
            name: 'file',
            type: 'String',
          },
        ],
        references: [],
      },
      {
        methodDoc: null,
        name: 'Url',
        parameters: [
          {
            name: 'protocol',
            type: 'String',
          },
          {
            name: 'host',
            type: 'String',
          },
          {
            name: 'file',
            type: 'String',
          },
        ],
        references: [],
      },
      {
        methodDoc: null,
        name: 'Url',
        parameters: [
          {
            name: 'spec',
            type: 'String',
          },
        ],
        references: [],
      },
      {
        methodDoc: null,
        name: 'Url',
        parameters: [
          {
            name: 'context',
            type: 'System.Url',
          },
          {
            name: 'spec',
            type: 'String',
          },
        ],
        references: [],
      },
    ],
    methods: [
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getAuthority',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getCurrentRequestUrl',
        parameters: [],
        references: [],
        returnType: 'System.Url',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getDefaultPort',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getFile',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: true,
        methodDoc: null,
        name: 'getFileFieldURL',
        parameters: [
          {
            name: 'objectId',
            type: 'String',
          },
          {
            name: 'fieldName',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getHost',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getOrgDomainUrl',
        parameters: [],
        references: [],
        returnType: 'System.Url',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getPath',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getPort',
        parameters: [],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getProtocol',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getQuery',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getRef',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getSalesforceBaseUrl',
        parameters: [],
        references: [],
        returnType: 'System.Url',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'getUserInfo',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['System.Url'],
        isStatic: false,
        methodDoc: null,
        name: 'sameFile',
        parameters: [
          {
            name: 'other',
            type: 'System.Url',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toExternalForm',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'toString',
        parameters: [],
        references: [],
        returnType: 'String',
      },
    ],
    properties: [],
  },
  UserInfo: {
    constructors: [
      {
        methodDoc: null,
        name: 'UserInfo',
        parameters: [],
        references: [],
      },
    ],
    methods: [
      {
        argTypes: [],
        isStatic: false,
        methodDoc: null,
        name: 'clone',
        parameters: [],
        references: [],
        returnType: 'Object',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getDefaultCurrency',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getFirstName',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLanguage',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLastName',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getLocale',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getName',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getOrganizationId',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getOrganizationName',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getProfileId',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getSessionId',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getTimeZone',
        parameters: [],
        references: [],
        returnType: 'System.TimeZone',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getUiTheme',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getUiThemeDisplayed',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getUserEmail',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getUserId',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getUserName',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getUserRoleId',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getUserType',
        parameters: [],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Id'],
        isStatic: true,
        methodDoc: null,
        name: 'hasPackageLicense',
        parameters: [
          {
            name: 'packageId',
            type: 'Id',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'isCurrentUserLicensed',
        parameters: [
          {
            name: 'namespacePrefix',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Id'],
        isStatic: true,
        methodDoc: null,
        name: 'isCurrentUserLicensedForPackage',
        parameters: [
          {
            name: 'packageId',
            type: 'Id',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'isMultiCurrencyOrganization',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
    ],
    properties: [],
  },
  System: {
    constructors: [],
    methods: [
      {
        argTypes: ['String'],
        isStatic: true,
        methodDoc: null,
        name: 'abortJob',
        parameters: [
          {
            name: 'jobId',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'assert',
        parameters: [
          {
            name: 'condition',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['Boolean', 'ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'assert',
        parameters: [
          {
            name: 'condition',
            type: 'Boolean',
          },
          {
            name: 'msg',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['ANY', 'ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'assertEquals',
        parameters: [
          {
            name: 'expected',
            type: 'ANY',
          },
          {
            name: 'actual',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['ANY', 'ANY', 'ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'assertEquals',
        parameters: [
          {
            name: 'expected',
            type: 'ANY',
          },
          {
            name: 'actual',
            type: 'ANY',
          },
          {
            name: 'msg',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['ANY', 'ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'assertNotEquals',
        parameters: [
          {
            name: 'expected',
            type: 'ANY',
          },
          {
            name: 'actual',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['ANY', 'ANY', 'ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'assertNotEquals',
        parameters: [
          {
            name: 'expected',
            type: 'ANY',
          },
          {
            name: 'actual',
            type: 'ANY',
          },
          {
            name: 'msg',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'attachFinalizer',
        parameters: [
          {
            name: 'finalizer',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'String'],
        isStatic: true,
        methodDoc: null,
        name: 'changeOwnPassword',
        parameters: [
          {
            name: 'oldPassword',
            type: 'String',
          },
          {
            name: 'newPassword',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'currentPageReference',
        parameters: [],
        references: [],
        returnType: 'System.PageReference',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'currentTimeMillis',
        parameters: [],
        references: [],
        returnType: 'Long',
      },
      {
        argTypes: ['ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'debug',
        parameters: [
          {
            name: 'o',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['APEX_OBJECT', 'ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'debug',
        parameters: [
          {
            name: 'logLevel',
            type: 'APEX_OBJECT',
          },
          {
            name: 'o',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'enqueueJob',
        parameters: [
          {
            name: 'queueable',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'Id',
      },
      {
        argTypes: ['ANY', 'ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'equals',
        parameters: [
          {
            name: 'left',
            type: 'ANY',
          },
          {
            name: 'right',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'getApplicationReadWriteMode',
        parameters: [],
        references: [],
        returnType: 'System.ApplicationReadWriteMode',
      },
      {
        argTypes: ['APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'getQuiddityShortCode',
        parameters: [
          {
            name: 'Quiddity',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'hashCode',
        parameters: [
          {
            name: 'obj',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'isBatch',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'isFunctionCallback',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'isFuture',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'isQueueable',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'isRunningElasticCompute',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'isScheduled',
        parameters: [],
        references: [],
        returnType: 'Boolean',
      },
      {
        argTypes: ['Id', 'Id'],
        isStatic: true,
        methodDoc: null,
        name: 'movePassword',
        parameters: [
          {
            name: 'targetUserId',
            type: 'Id',
          },
          {
            name: 'sourceUserId',
            type: 'Id',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'now',
        parameters: [],
        references: [],
        returnType: 'Datetime',
      },
      {
        argTypes: ['List', 'String', 'String', 'String'],
        isStatic: true,
        methodDoc: null,
        name: 'process',
        parameters: [
          {
            name: 'workitemIds',
            type: 'List',
          },
          {
            name: 'action',
            type: 'String',
          },
          {
            name: 'commments',
            type: 'String',
          },
          {
            name: 'nextApprover',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'List<Id>',
      },
      {
        argTypes: ['Date'],
        isStatic: true,
        methodDoc: null,
        name: 'purgeOldAsyncJobs',
        parameters: [
          {
            name: 'date',
            type: 'Date',
          },
        ],
        references: [],
        returnType: 'Integer',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'requestVersion',
        parameters: [],
        references: [],
        returnType: 'System.Version',
      },
      {
        argTypes: ['Id', 'Boolean'],
        isStatic: true,
        methodDoc: null,
        name: 'resetPassword',
        parameters: [
          {
            name: 'userId',
            type: 'Id',
          },
          {
            name: 'sendUserEmail',
            type: 'Boolean',
          },
        ],
        references: [],
        returnType: 'System.ResetPasswordResult',
      },
      {
        argTypes: ['Id', 'Boolean', 'String'],
        isStatic: true,
        methodDoc: null,
        name: 'resetPasswordWithEmailTemplate',
        parameters: [
          {
            name: 'userId',
            type: 'Id',
          },
          {
            name: 'sendUserEmail',
            type: 'Boolean',
          },
          {
            name: 'emailTemplateName',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'System.ResetPasswordResult',
      },
      {
        argTypes: ['Package.Version'],
        isStatic: true,
        methodDoc: null,
        name: 'runAs',
        parameters: [
          {
            name: 'version',
            type: 'Package.Version',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['SObject', 'ANY'],
        isStatic: true,
        methodDoc: null,
        name: 'runAs',
        parameters: [
          {
            name: 'user',
            type: 'SObject',
          },
          {
            name: 'block',
            type: 'ANY',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['String', 'String', 'APEX_OBJECT'],
        isStatic: true,
        methodDoc: null,
        name: 'schedule',
        parameters: [
          {
            name: 'jobName',
            type: 'String',
          },
          {
            name: 'cronExp',
            type: 'String',
          },
          {
            name: 'schedulable',
            type: 'APEX_OBJECT',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['APEX_OBJECT', 'String', 'Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'scheduleBatch',
        parameters: [
          {
            name: 'batchable',
            type: 'APEX_OBJECT',
          },
          {
            name: 'jobName',
            type: 'String',
          },
          {
            name: 'minutesFromNow',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['APEX_OBJECT', 'String', 'Integer', 'Integer'],
        isStatic: true,
        methodDoc: null,
        name: 'scheduleBatch',
        parameters: [
          {
            name: 'batchable',
            type: 'APEX_OBJECT',
          },
          {
            name: 'jobName',
            type: 'String',
          },
          {
            name: 'minutesFromNow',
            type: 'Integer',
          },
          {
            name: 'scopeSize',
            type: 'Integer',
          },
        ],
        references: [],
        returnType: 'String',
      },
      {
        argTypes: ['Id', 'String'],
        isStatic: true,
        methodDoc: null,
        name: 'setPassword',
        parameters: [
          {
            name: 'userId',
            type: 'Id',
          },
          {
            name: 'password',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'void',
      },
      {
        argTypes: ['List', 'String', 'String'],
        isStatic: true,
        methodDoc: null,
        name: 'submit',
        parameters: [
          {
            name: 'ids',
            type: 'List',
          },
          {
            name: 'commments',
            type: 'String',
          },
          {
            name: 'nextApprover',
            type: 'String',
          },
        ],
        references: [],
        returnType: 'List<Id>',
      },
      {
        argTypes: [],
        isStatic: true,
        methodDoc: null,
        name: 'today',
        parameters: [],
        references: [],
        returnType: 'Date',
      },
    ],
    properties: [],
  },
};
