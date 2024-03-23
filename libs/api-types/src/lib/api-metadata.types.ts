import { z } from 'zod';
import { DeployOptionsSchema } from './api-shared.types';

export const ListMetadataRequestSchema = z.object({
  types: z
    .object({
      type: z.string(),
      folder: z.string().nullish(),
    })
    .array()
    .min(1),
});
export type ListMetadataRequest = z.infer<typeof ListMetadataRequestSchema>;

export const ReadMetadataRequestSchema = z.object({
  fullNames: z.string().array().min(1),
});
export type ReadMetadataRequest = z.infer<typeof ReadMetadataRequestSchema>;

export const DeployMetadataRequestSchema = z.object({
  files: z
    .object({
      fullFilename: z.string(),
      content: z.string(),
    })
    .array()
    .min(1),
  options: DeployOptionsSchema,
});
export type DeployMetadataRequest = z.infer<typeof DeployMetadataRequestSchema>;

export const RetrievePackageFromLisMetadataResultsRequestSchema = z.record(
  z
    .object({
      fullName: z.string(),
      namespacePrefix: z.string().nullish(),
    })
    .array()
);
export type RetrievePackageFromLisMetadataResultsRequest = z.infer<typeof RetrievePackageFromLisMetadataResultsRequestSchema>;

export const RetrievePackageFromExistingServerPackagesRequestSchema = z.object({
  packageNames: z.string().array().min(1),
});
export type RetrievePackageFromExistingServerPackagesRequest = z.infer<typeof RetrievePackageFromExistingServerPackagesRequestSchema>;

export const RetrievePackageFromManifestRequestSchema = z.object({
  packageManifest: z.string(),
});
export type RetrievePackageFromManifestRequest = z.infer<typeof RetrievePackageFromManifestRequestSchema>;

export const CheckRetrieveStatusAndRedeployRequestSchema = z
  .object({
    changesetName: z.string().nullish(),
    replacementPackageXml: z.string().nullish(),
    deployOptions: DeployOptionsSchema,
  })
  .refine(
    ({ changesetName, replacementPackageXml }) => (replacementPackageXml ? !!changesetName : true),
    'ChangesetName is required when replacementPackageXml is provided'
  );
export type CheckRetrieveStatusAndRedeployRequest = z.infer<typeof CheckRetrieveStatusAndRedeployRequestSchema>;

export const GetPackageXmlSchema = z.object({
  metadata: z.record(
    z
      .object({
        fullName: z.string(),
        namespacePrefix: z.string().nullish(),
      })
      .array()
  ), // TODO: define metadata type
  otherFields: z.record(z.string()).nullish(),
});
export type GetPackageXml = z.infer<typeof GetPackageXmlSchema>;

export const AnonymousApexSchema = z.object({
  apex: z.string().min(1),
  logLevel: z.enum(['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST']).nullish(),
});
export type AnonymousApex = z.infer<typeof AnonymousApexSchema>;
