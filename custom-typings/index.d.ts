import type { ApplicationCookie, ElectronPreferences, SalesforceOrgUi } from '../libs/types/src';

// https://webpack.js.org/loaders/worker-loader/#integrating-with-typescript
declare module 'worker-loader!*' {
  class WebpackWorker extends Worker {
    constructor();
  }

  export default WebpackWorker;
}

declare global {
  interface Window {
    electron?: {
      appCookie: ApplicationCookie;
      initialPreferences: ElectronPreferences;
      loadPreferences: () => Promise<ElectronPreferences>;
      savePreferences: (preferences: ElectronPreferences) => Promise<ElectronPreferences>;
      getAppVersion: () => Promise<string>;
      logout: () => void;
      onPreferencesChanged: (callback: (event: any, preferences: ElectronPreferences) => void) => void;
      platform: string;
      isElectron: boolean;
      isElectronDev: boolean;
      isFocused: () => boolean;
      // getServerSocket: () => Promise<string>;
      // ipcConnect: (is: string, func: (client: any) => void) => void;
      onOrgAdded: (callback: (event: any, org: SalesforceOrgUi, switchActiveOrg: boolean) => void) => void;
    };
    electronPreferences?: {
      initialPreferences: ElectronPreferences;
      loadPreferences: () => Promise<ElectronPreferences>;
      savePreferences: (preferences: ElectronPreferences) => Promise<ElectronPreferences>;
      pickDirectory: () => Promise<string | null>;
      platform: string;
      isElectron: boolean;
    };
  }
}

declare module 'formulon' {
  export type FormulaData = Record<string, FormulaResult>;

  export type FormulaResult = AstError | AstLiteral | AstLiteralText | AstLiteralNumber;
  export type AstResult = AstCallExpression;

  export interface AstError {
    type: 'error';
    errorType: 'ArgumentError';
    message: string;
    function: string;
    expected: number;
    received: number;
  }

  export interface AstLiteral {
    type: 'literal';
    value: string;
    dataType: 'checkbox' | 'date' | 'time' | 'datetime' | 'geolocation' | 'null';
    options: undefined;
  }

  export interface AstLiteralText {
    type: 'literal';
    value: string;
    dataType: 'text';
    options: {
      length: number;
      scale: number;
    };
  }

  export interface AstLiteralNumber {
    type: 'literal';
    value: string;
    dataType: 'number';
    options: {
      length: number;
    };
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
