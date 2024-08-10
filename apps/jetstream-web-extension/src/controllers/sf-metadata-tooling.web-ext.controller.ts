import {
  AnonymousApexSchema,
  BooleanQueryParamSchema,
  CheckRetrieveStatusAndRedeployRequestSchema,
  DeployMetadataRequestSchema,
  DeployOptionsSchema,
  GetPackageXmlSchema,
  ListMetadataRequestSchema,
  ReadMetadataRequestSchema,
  RetrievePackageFromExistingServerPackagesRequestSchema,
  RetrievePackageFromLisMetadataResultsRequestSchema,
} from '@jetstream/api-types';
import { buildPackageXml, getRetrieveRequestFromListMetadata, getRetrieveRequestFromManifest } from '@jetstream/salesforce-api';
import { RetrieveRequest } from '@jetstream/types';
import JSZip from 'jszip';
import { isString } from 'lodash';
import { z } from 'zod';
import { createRoute, handleErrorResponse, handleJsonResponse } from './route.utils';

export const routeDefinition = {
  describeMetadata: {
    controllerFn: () => describeMetadata,
    validators: {},
  },
  listMetadata: {
    controllerFn: () => listMetadata,
    validators: {
      body: ListMetadataRequestSchema,
    },
  },
  readMetadata: {
    controllerFn: () => readMetadata,
    validators: {
      params: z.object({ type: z.string() }),
      body: ReadMetadataRequestSchema,
    },
  },
  deployMetadata: {
    controllerFn: () => deployMetadata,
    validators: {
      body: DeployMetadataRequestSchema,
    },
  },
  deployMetadataZip: {
    controllerFn: () => deployMetadataZip,
    validators: {
      body: z.any(),
      query: z.object({ options: z.string() }),
    },
  },
  checkMetadataResults: {
    controllerFn: () => checkMetadataResults,
    validators: {
      params: z.object({ id: z.string().min(15).max(18) }),
      query: z.object({ includeDetails: BooleanQueryParamSchema }),
    },
  },
  retrievePackageFromLisMetadataResults: {
    controllerFn: () => retrievePackageFromLisMetadataResults,
    validators: {
      body: RetrievePackageFromLisMetadataResultsRequestSchema,
    },
  },
  retrievePackageFromExistingServerPackages: {
    controllerFn: () => retrievePackageFromExistingServerPackages,
    validators: {
      body: RetrievePackageFromExistingServerPackagesRequestSchema,
    },
  },
  retrievePackageFromManifest: {
    controllerFn: () => retrievePackageFromManifest,
    validators: {
      body: z.object({ packageManifest: z.string() }),
    },
  },
  checkRetrieveStatus: {
    controllerFn: () => checkRetrieveStatus,
    validators: {
      query: z.object({ id: z.string().min(15).max(18) }),
    },
  },
  checkRetrieveStatusAndRedeploy: {
    controllerFn: () => checkRetrieveStatusAndRedeploy,
    validators: {
      hasTargetOrg: true,
      query: z.object({ id: z.string().min(15).max(18) }),
      body: CheckRetrieveStatusAndRedeployRequestSchema,
    },
  },
  getPackageXml: {
    controllerFn: () => getPackageXml,
    validators: {
      body: GetPackageXmlSchema,
    },
  },
  anonymousApex: {
    controllerFn: () => anonymousApex,
    validators: {
      body: AnonymousApexSchema,
    },
  },
  apexCompletions: {
    controllerFn: () => apexCompletions,
    validators: {
      params: z.object({
        type: z.enum(['apex', 'visualforce']),
      }),
    },
  },
};

// export async function describeMetadata(req: Request, res: Response, next: NextFunction) {
const describeMetadata = createRoute(routeDefinition.describeMetadata.validators, async ({ jetstreamConn }, req) => {
  try {
    const results = await jetstreamConn!.metadata.describe();

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const listMetadata = createRoute(routeDefinition.listMetadata.validators, async ({ body, jetstreamConn }, req) => {
  try {
    const results = await jetstreamConn!.metadata.list(body.types);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const readMetadata = createRoute(routeDefinition.readMetadata.validators, async ({ body, params, jetstreamConn }, req) => {
  try {
    const fullNames = body.fullNames;
    const metadataType = params.type;

    const results = await jetstreamConn!.metadata.read(metadataType, fullNames);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const deployMetadata = createRoute(routeDefinition.deployMetadata.validators, async ({ body, jetstreamConn }, req) => {
  try {
    const files = body.files;
    const options = body.options;

    const results = await jetstreamConn!.metadata.deployMetadata(files, options);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const deployMetadataZip = createRoute(routeDefinition.deployMetadataZip.validators, async ({ body, query, jetstreamConn }, req) => {
  try {
    const metadataPackage = body; // buffer
    // this is validated as valid JSON previously
    const options = DeployOptionsSchema.parse(JSON.parse(query.options));

    const results = await jetstreamConn!.metadata.deploy(metadataPackage, options);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const checkMetadataResults = createRoute(routeDefinition.checkMetadataResults.validators, async ({ params, query, jetstreamConn }, req) => {
  try {
    const id = params.id;
    const includeDetails = query.includeDetails;

    const results = await jetstreamConn!.metadata.checkDeployStatus(id, includeDetails);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const retrievePackageFromLisMetadataResults = createRoute(
  routeDefinition.retrievePackageFromLisMetadataResults.validators,
  async ({ body, jetstreamConn }, req) => {
    try {
      const types = body;

      const results = await jetstreamConn!.metadata.retrieve(
        getRetrieveRequestFromListMetadata(types, jetstreamConn!.sessionInfo.apiVersion)
      );

      return handleJsonResponse(results);
    } catch (ex) {
      return handleErrorResponse(ex);
    }
  }
);

const retrievePackageFromExistingServerPackages = createRoute(
  routeDefinition.retrievePackageFromExistingServerPackages.validators,
  async ({ body, jetstreamConn }, req) => {
    try {
      const packageNames = body.packageNames;

      const retrieveRequest: RetrieveRequest = {
        apiVersion: jetstreamConn!.sessionInfo.apiVersion,
        packageNames,
        singlePackage: false,
      };

      const results = await jetstreamConn!.metadata.retrieve(retrieveRequest);

      return handleJsonResponse(results);
    } catch (ex) {
      return handleErrorResponse(ex);
    }
  }
);

const retrievePackageFromManifest = createRoute(
  routeDefinition.retrievePackageFromManifest.validators,
  async ({ body, jetstreamConn }, req) => {
    try {
      const packageManifest = body.packageManifest;

      const results = await jetstreamConn!.metadata.retrieve(getRetrieveRequestFromManifest(packageManifest));

      return handleJsonResponse(results);
    } catch (ex) {
      return handleErrorResponse(ex);
    }
  }
);

const checkRetrieveStatus = createRoute(routeDefinition.checkRetrieveStatus.validators, async ({ query, jetstreamConn }, req) => {
  try {
    const id: string = query.id;

    const results = await jetstreamConn!.metadata.checkRetrieveStatus(id);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const checkRetrieveStatusAndRedeploy = createRoute(
  routeDefinition.checkRetrieveStatusAndRedeploy.validators,
  async ({ body, query, jetstreamConn, targetJetstreamConn }, req) => {
    try {
      const id = query.id;
      const deployOptions = body.deployOptions;
      const replacementPackageXml = body.replacementPackageXml;
      const changesetName = body.changesetName;

      // const results = correctInvalidXmlResponseTypes(await conn.metadata.checkRetrieveStatus(id));
      const results = await jetstreamConn!.metadata.checkRetrieveStatus(id);

      if (isString(results.zipFile)) {
        // create a new zip in the correct structure to add to changeset
        if (replacementPackageXml && changesetName) {
          const oldPackage = await JSZip.loadAsync(results.zipFile, { base64: true });
          const newPackage = JSZip();
          newPackage
            .folder('unpackaged')
            ?.file(
              'package.xml',
              `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n\t<version>${
                jetstreamConn!.sessionInfo.apiVersion
              }</version>\n</Package>`
            );

          oldPackage.forEach((relativePath, file) => {
            if (file.name === 'package.xml') {
              newPackage.folder(changesetName)?.file(relativePath, replacementPackageXml);
            } else if (!file.dir) {
              newPackage.folder(changesetName)?.file(relativePath, file.async('uint8array'), { binary: true });
            }
          });
          const deployResults = await targetJetstreamConn!.metadata.deploy(
            await newPackage.generateAsync({ type: 'base64', compression: 'STORE', mimeType: 'application/zip', platform: 'UNIX' }),
            deployOptions
          );
          return handleJsonResponse({ type: 'deploy', results: deployResults, zipFile: results.zipFile });
        } else {
          // Deploy package as-is
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const deployResults = await targetJetstreamConn!.metadata.deploy(results.zipFile!, deployOptions);
          return handleJsonResponse({ type: 'deploy', results: deployResults, zipFile: results.zipFile });
        }
      } else {
        return handleJsonResponse({ type: 'retrieve', results });
      }
    } catch (ex) {
      return handleErrorResponse(ex);
    }
  }
);

const getPackageXml = createRoute(routeDefinition.getPackageXml.validators, async ({ body, jetstreamConn }, req) => {
  try {
    const types = body.metadata;
    const otherFields = body.otherFields;

    const results = buildPackageXml(types, jetstreamConn!.sessionInfo.apiVersion, otherFields);
    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

/**
 * This uses the SOAP api to allow returning logs
 */
const anonymousApex = createRoute(routeDefinition.anonymousApex.validators, async ({ body, jetstreamConn }, req) => {
  try {
    const { apex, logLevel } = body;

    const results = await jetstreamConn!.apex.anonymousApex({ apex, logLevel });

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const apexCompletions = createRoute(routeDefinition.apexCompletions.validators, async ({ params, jetstreamConn }, req) => {
  try {
    const type = params.type;

    const results = await jetstreamConn!.apex.apexCompletions(type);

    return handleJsonResponse(results);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
