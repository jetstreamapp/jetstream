import { z } from 'zod';

export const DeployOptionsSchema = z.object({
  allowMissingFiles: z.boolean().nullish(),
  autoUpdatePackage: z.boolean().nullish(),
  checkOnly: z.boolean().nullish(),
  ignoreWarnings: z.boolean().nullish(),
  performRetrieve: z.boolean().nullish(),
  purgeOnDelete: z.boolean().nullish(),
  rollbackOnError: z.boolean().nullish(),
  runAllTests: z.boolean().nullish(),
  runTests: z.string().array().nullish(),
  singlePackage: z.boolean().nullish(),
});
export type DeployOptions = z.infer<typeof DeployOptionsSchema>;
