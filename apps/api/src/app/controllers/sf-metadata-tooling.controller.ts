import { ENV } from '@jetstream/api-config';
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
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

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
const describeMetadata = createRoute(routeDefinition.describeMetadata.validators, async ({ jetstreamConn }, req, res, next) => {
  try {
    const results = await jetstreamConn.metadata.describe();

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const listMetadata = createRoute(routeDefinition.listMetadata.validators, async ({ body, jetstreamConn }, req, res, next) => {
  try {
    const results = await jetstreamConn.metadata.list(body.types);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const readMetadata = createRoute(routeDefinition.readMetadata.validators, async ({ body, params, jetstreamConn }, req, res, next) => {
  try {
    const fullNames = body.fullNames;
    const metadataType = params.type;

    const results = await jetstreamConn.metadata.read(metadataType, fullNames);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const deployMetadata = createRoute(routeDefinition.deployMetadata.validators, async ({ body, jetstreamConn }, req, res, next) => {
  try {
    const files = body.files;
    const options = body.options;

    const results = await jetstreamConn.metadata.deployMetadata(files, options);

    sendJson(res, results);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const deployMetadataZip = createRoute(
  routeDefinition.deployMetadataZip.validators,
  async ({ body, query, jetstreamConn }, req, res, next) => {
    try {
      const metadataPackage = body; // buffer
      // this is validated as valid JSON previously
      const options = DeployOptionsSchema.parse(JSON.parse(query.options));

      const results = await jetstreamConn.metadata.deploy(metadataPackage, options);

      sendJson(res, results);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  }
);

const checkMetadataResults = createRoute(
  routeDefinition.checkMetadataResults.validators,
  async ({ params, query, jetstreamConn }, req, res, next) => {
    try {
      const id = params.id;
      const includeDetails = query.includeDetails;

      const results = await jetstreamConn.metadata.checkDeployStatus(id, includeDetails);

      sendJson(res, results);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  }
);

const retrievePackageFromLisMetadataResults = createRoute(
  routeDefinition.retrievePackageFromLisMetadataResults.validators,
  async ({ body, jetstreamConn }, req, res, next) => {
    try {
      const types = body;

      const results = await jetstreamConn.metadata.retrieve(
        getRetrieveRequestFromListMetadata(types, jetstreamConn.sessionInfo.apiVersion)
      );

      sendJson(res, results);
    } catch (ex) {
      next(ex);
    }
  }
);

const retrievePackageFromExistingServerPackages = createRoute(
  routeDefinition.retrievePackageFromExistingServerPackages.validators,
  async ({ body, jetstreamConn }, req, res, next) => {
    try {
      const packageNames = body.packageNames;

      const retrieveRequest: RetrieveRequest = {
        apiVersion: jetstreamConn.sessionInfo.apiVersion,
        packageNames,
        singlePackage: false,
      };

      const results = await jetstreamConn.metadata.retrieve(retrieveRequest);

      sendJson(res, results);
    } catch (ex) {
      next(ex);
    }
  }
);

const retrievePackageFromManifest = createRoute(
  routeDefinition.retrievePackageFromManifest.validators,
  async ({ body, jetstreamConn }, req, res, next) => {
    try {
      const packageManifest = body.packageManifest;
      const results = await jetstreamConn.metadata.retrieve(getRetrieveRequestFromManifest(packageManifest));

      sendJson(res, results);
    } catch (ex) {
      next(ex);
    }
  }
);

const checkRetrieveStatus = createRoute(
  routeDefinition.checkRetrieveStatus.validators,
  async ({ query, jetstreamConn }, req, res, next) => {
    try {
      const id: string = query.id;

      const results = await jetstreamConn.metadata.checkRetrieveStatus(id);

      sendJson(res, results);
    } catch (ex) {
      next(ex);
    }
  }
);

const checkRetrieveStatusAndRedeploy = createRoute(
  routeDefinition.checkRetrieveStatusAndRedeploy.validators,
  async ({ body, query, jetstreamConn, targetJetstreamConn }, req, res, next) => {
    try {
      const id = query.id;
      const deployOptions = body.deployOptions;
      const replacementPackageXml = body.replacementPackageXml;
      const changesetName = body.changesetName;

      // const results = correctInvalidXmlResponseTypes(await conn.metadata.checkRetrieveStatus(id));
      const results = await jetstreamConn.metadata.checkRetrieveStatus(id);

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
                jetstreamConn.sessionInfo.apiVersion || ENV.SFDC_API_VERSION
              }</version>\n</Package>`
            );

          oldPackage.forEach((relativePath, file) => {
            if (file.name === 'package.xml') {
              newPackage.folder(changesetName)?.file(relativePath, replacementPackageXml);
            } else if (!file.dir) {
              newPackage.folder(changesetName)?.file(relativePath, file.async('uint8array'), { binary: true });
            }
          });
          const deployResults = await targetJetstreamConn.metadata.deploy(
            await newPackage.generateAsync({ type: 'base64', compression: 'STORE', mimeType: 'application/zip', platform: 'UNIX' }),
            deployOptions
          );
          sendJson(res, { type: 'deploy', results: deployResults, zipFile: results.zipFile });
        } else {
          // Deploy package as-is
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const deployResults = await targetJetstreamConn.metadata.deploy(results.zipFile!, deployOptions);
          sendJson(res, { type: 'deploy', results: deployResults, zipFile: results.zipFile });
        }
      } else {
        sendJson(res, { type: 'retrieve', results });
      }
    } catch (ex) {
      next(ex);
    }
  }
);

const getPackageXml = createRoute(routeDefinition.getPackageXml.validators, async ({ body, jetstreamConn }, req, res, next) => {
  try {
    const types = body.metadata;
    const otherFields = body.otherFields;

    sendJson(res, buildPackageXml(types, jetstreamConn.sessionInfo.apiVersion, otherFields));
  } catch (ex) {
    next(ex);
  }
});

/**
 * This uses the SOAP api to allow returning logs
 */
const anonymousApex = createRoute(routeDefinition.anonymousApex.validators, async ({ body, jetstreamConn }, req, res, next) => {
  try {
    const { apex, logLevel } = body;

    const results = await jetstreamConn.apex.anonymousApex({ apex, logLevel });

    sendJson(res, results);
  } catch (ex) {
    next(ex);
  }
});

const apexCompletions = createRoute(routeDefinition.apexCompletions.validators, async ({ params, jetstreamConn }, req, res, next) => {
  try {
    const type = params.type;

    const results = await jetstreamConn.apex.apexCompletions(type);

    sendJson(res, results);
  } catch (ex) {
    next(ex);
  }
});
