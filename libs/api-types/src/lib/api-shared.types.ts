import { isQueryLocatorUrl, isSObjectBlobFieldUrl } from '@jetstream/shared/utils';
import { z } from 'zod';

export interface LoggerLike {
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export const BooleanQueryParamSchema = z
  .enum(['true', 'false'])
  .nullish()
  .transform((value) => value === 'true');

/**
 * A `nextRecordsUrl` handed back from a prior query. The proxy requests this path with the org's
 * credentials, so it must be a query locator and nothing else.
 */
export const QueryLocatorUrlSchema = z
  .string()
  .refine(isQueryLocatorUrl, { error: 'nextRecordsUrl must be the query locator path returned by Salesforce' });

/**
 * A record blob field path for the file download proxy (`/services/data/vXX.X/sobjects/<SObject>/<id>/<Field>`).
 */
export const SObjectBlobFieldUrlSchema = z.string().refine(isSObjectBlobFieldUrl, {
  error: 'url must be a record blob field path, e.g. /services/data/v62.0/sobjects/ContentVersion/<id>/VersionData',
});

export const DeployOptionsSchema = z
  .object({
    allowMissingFiles: z.boolean().nullish(),
    autoUpdatePackage: z.boolean().nullish(),
    checkOnly: z.boolean().nullish(),
    ignoreWarnings: z.boolean().nullish(),
    performRetrieve: z.boolean().nullish(),
    purgeOnDelete: z.boolean().nullish(),
    rollbackOnError: z.boolean().nullish(),
    runAllTests: z.boolean().nullish(),
    runTests: z.string().array().nullish(),
    testLevel: z.enum(['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg']).nullish(),
    singlePackage: z.boolean().nullish(),
  })
  .refine(
    (record) => {
      if (record.testLevel === 'RunSpecifiedTests' && !Array.isArray(record.runTests)) {
        return false;
      }
      return record;
    },
    {
      error: 'RunSpecifiedTests requires specified tests to be provided',
    },
  )
  .transform((record) => {
    if (record.testLevel !== 'RunSpecifiedTests' && record.runTests) {
      record.runTests = undefined;
    }
    return record;
  });

export type DeployOptions = z.infer<typeof DeployOptionsSchema>;
