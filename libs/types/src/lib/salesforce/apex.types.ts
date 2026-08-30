import { SoapNil } from './misc.types';

export interface AnonymousApexSoapResponse {
  Envelope: {
    Header: {
      DebuggingInfo: {
        debugLog: string;
      };
    };
    Body: {
      executeAnonymousResponse: {
        result: {
          column: string | SoapNil;
          compileProblem: string | SoapNil;
          compiled: string | SoapNil;
          exceptionMessage: string | SoapNil;
          exceptionStackTrace: string | SoapNil;
          line: string | SoapNil;
          success: string | SoapNil;
        };
      };
    };
  };
}

export interface AnonymousApexResponse {
  debugLog: string;
  result: {
    column?: number | null;
    compileProblem?: string | null;
    compiled: boolean;
    exceptionMessage?: string | null;
    exceptionStackTrace?: string | null;
    line?: number | null;
    success: boolean;
  };
}

/**
 * Examples:
 *
 * publicDeclarations['System'] // Get list of all base types, usually just use this
 * publicDeclarations['System']['System'].methods // get everything in the system class
 * publicDeclarations['System']['Integer'].methods // get methods from the Integer class
 *
 */
export interface ApexCompletionResponse {
  publicDeclarations: Record<string, Record<string, ApexCompletion>>;
}

export interface ApexCompletion {
  constructors: ApexCompletionMethod[];
  methods: ApexCompletionMethod[];
  properties: ApexCompletionProperty[];
}

export interface ApexCompletionMethod {
  argTypes?: string[]; // not populated on constructors
  isStatic?: boolean; // not populated on constructors
  methodDoc: null;
  name: string;
  parameters: ApexCompletionMethodParameter[];
  references: unknown[];
  returnType: string; // not populated on constructors
}

export interface ApexCompletionMethodParameter {
  name: string;
  type: string;
}

export interface ApexCompletionProperty {
  name: string;
  references: unknown[];
}

export type ApexTestRunStatus = 'Queued' | 'Preparing' | 'Processing' | 'Holding' | 'Completed' | 'Failed' | 'Aborted';

export interface ApexTestRunResultRecord {
  Id: string;
  AsyncApexJobId: string;
  Status: ApexTestRunStatus;
  ClassesEnqueued: number;
  ClassesCompleted: number | null;
  MethodsEnqueued: number | null;
  MethodsCompleted: number | null;
  MethodsFailed: number | null;
  StartTime: string | null;
  EndTime: string | null;
  /** Total test execution time in milliseconds */
  TestTime: number | null;
  UserId: string;
  User: { Name: string } | null;
  CreatedDate: string;
}

export type ApexTestQueueItemStatus = 'Queued' | 'Preparing' | 'Processing' | 'Holding' | 'Completed' | 'Failed' | 'Aborted';

export interface ApexTestQueueItemRecord {
  Id: string;
  Status: ApexTestQueueItemStatus;
  /** Progress indicator while processing, e.g. "(4/6)" */
  ExtendedStatus: string | null;
  ApexClassId: string;
  ApexClass: { Name: string } | null;
  TestRunResultId: string;
  ParentJobId: string;
}

export type ApexTestOutcome = 'Pass' | 'Fail' | 'CompileFail' | 'Skip';

export interface ApexTestResultRecord {
  Id: string;
  Outcome: ApexTestOutcome;
  MethodName: string;
  Message: string | null;
  StackTrace: string | null;
  /** Execution time in milliseconds */
  RunTime: number | null;
  ApexClassId: string;
  ApexClass: { Name: string } | null;
  ApexLogId: string | null;
  ApexTestRunResultId: string;
}

export interface ApexCodeCoverageAggregateRecord {
  Id: string;
  ApexClassOrTriggerId: string;
  ApexClassOrTrigger: { Name: string } | null;
  NumLinesCovered: number;
  NumLinesUncovered: number;
  /** Only present when explicitly included in the query */
  Coverage?: {
    coveredLines: number[];
    uncoveredLines: number[];
  };
}

export interface ApexOrgWideCoverageRecord {
  Id: string;
  PercentCovered: number;
}

export interface ApexTestSuiteRecord {
  Id: string;
  TestSuiteName: string;
}

export interface TestSuiteMembershipRecord {
  Id: string;
  ApexClassId: string;
  ApexTestSuiteId: string;
}

export interface ApexClassRecord {
  Id: string;
  Name: string;
  NamespacePrefix: string | null;
  Status: string;
  LastModifiedDate: string;
  Body?: string;
  /** Null for classes that need to be recompiled and for managed classes */
  SymbolTable?: ApexSymbolTable | null;
}

export interface ApexTriggerRecord {
  Id: string;
  Name: string;
  Body: string;
}

export interface ApexSymbolTable {
  tableDeclaration: {
    name: string;
    modifiers: string[];
    annotations: { name: string }[];
  };
  methods: ApexSymbolTableMethod[];
}

export interface ApexSymbolTableMethod {
  name: string;
  modifiers: string[];
  annotations: { name: string }[];
  location: { line: number; column: number };
}

export interface RunTestsAsyncOptions {
  /** Stop executing new tests after this many failures (0 to 1,000,000). Omit for no limit. */
  maxFailedTests?: number;
  /** Skip collecting code coverage for a faster run */
  skipCodeCoverage?: boolean;
}

/**
 * Request body for POST /tooling/runTestsAsynchronous.
 * classids/suiteids are comma-delimited id lists; tests allows method-level selection.
 */
export type RunTestsAsyncPayload = (
  | { classids: string }
  | { suiteids: string }
  | { tests: { classId: string; testMethods?: string[] }[] }
) &
  RunTestsAsyncOptions;
