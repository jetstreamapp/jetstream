import { z } from 'zod';

export const BooleanQueryParamSchema = z
  .enum(['true', 'false'])
  .nullish()
  .transform((value) => value === 'true');

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
    { message: 'RunSpecifiedTests requires specified tests to be provided' }
  )
  .transform((record) => {
    if (record.testLevel !== 'RunSpecifiedTests' && record.runTests) {
      record.runTests = undefined;
    }
    return record;
  });

export type DeployOptions = z.infer<typeof DeployOptionsSchema>;
