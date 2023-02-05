declare module 'formulon' {
  export type DataType = 'number' | 'text' | 'picklist' | 'multipicklist' | DataTypeNoOption;
  export type DataTypeNoOption = 'checkbox' | 'date' | 'time' | 'datetime' | 'geolocation' | 'null';
  export type DataType = 'number' | 'text' | 'checkbox' | 'date' | 'time' | 'datetime' | 'geolocation' | 'null';
  export type FormulaData = Record<string, FormulaDataValue>;
  export type FormulaDataValue = AstLiteral | AstLiteralText | AstLiteralNumber | AstLiteralPicklist;
  export type FormulaResult = AstError | AstNotImplementedError | FormulaDataValue;
  export type AstResult = AstCallExpression;
  export type FunctionType =
    | 'abs'
    | 'add'
    | 'addmonths'
    | 'and'
    | 'begins'
    | 'blankvalue'
    | 'br'
    | 'case'
    | 'casesafeid'
    | 'ceiling'
    | 'contains'
    | 'currencyrate'
    | 'date'
    | 'datetimevalue'
    | 'datevalue'
    | 'day'
    | 'distance'
    | 'divide'
    | 'equal'
    | 'exp'
    | 'exponentiate'
    | 'find'
    | 'floor'
    | 'geolocation'
    | 'getsessionid'
    | 'greaterthan'
    | 'greaterthanorequal'
    | 'hour'
    | 'hyperlink'
    | 'if'
    | 'image'
    | 'includes'
    | 'isblank'
    | 'isnull'
    | 'isnumber'
    | 'ispickval'
    | 'left'
    | 'len'
    | 'lessthan'
    | 'lessthanorequal'
    | 'ln'
    | 'log'
    | 'lower'
    | 'lpad'
    | 'max'
    | 'mceiling'
    | 'mfloor'
    | 'mid'
    | 'millisecond'
    | 'min'
    | 'minute'
    | 'mod'
    | 'month'
    | 'multiply'
    | 'not'
    | 'now'
    | 'nullvalue'
    | 'or'
    | 'regex'
    | 'right'
    | 'round'
    | 'rpad'
    | 'second'
    | 'sqrt'
    | 'substitute'
    | 'subtract'
    | 'text'
    | 'timenow'
    | 'timevalue'
    | 'today'
    | 'trim'
    | 'unequal'
    | 'upper'
    | 'value'
    | 'weekday'
    | 'year';

  export interface AstError {
    type: 'error';
    errorType: 'ArgumentError';
    message: string;
    name?: string;
    FunctionType: string;
    expected: number;
    received: number;
  }

  export interface AstNotImplementedError {
    type: 'error';
    errorType: 'NotImplementedError';
    message: string;
    name: string;
  }

  export interface AstLiteral {
    type: 'literal';
    value: string | number | boolean | null | Date;
    dataType: DataTypeNoOption;
    options?: Record<string, any> | null;
  }

  export interface AstLiteralText {
    type: 'literal';
    value: string;
    dataType: 'text';
    options: {
      length: number;
    };
  }

  export interface AstLiteralNumber {
    type: 'literal';
    value: number;
    dataType: 'number';
    options: {
      length: number;
      scale: number;
    };
  }

  export interface AstLiteralPicklist {
    type: 'literal';
    value: number;
    dataType: 'picklist' | 'multipicklist';
    options: { values: string[] };
  }

  export interface AstCallExpression {
    type: 'callExpression';
    id: string;
    arguments: (FormulaResult | AstCallExpression)[];
  }

  export const parse: (formula: string, substitutions: FormulaData) => FormulaResult;
  export const extract: (formula: string) => string[];
  export const ast: (formula: string) => AstCallExpression;
}
