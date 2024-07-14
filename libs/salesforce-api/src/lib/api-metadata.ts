import { DeployOptions, ListMetadataRequest, ReadMetadataRequest } from '@jetstream/api-types';
import { arrayBufferToBase64, ensureArray, splitArrayToMaxSize, uint8ArrayToBase64 } from '@jetstream/shared/utils';
import {
  AsyncResult,
  DeployResult,
  DescribeMetadataResult,
  FileProperties,
  MetadataInfo,
  RetrieveRequest,
  RetrieveResult,
} from '@jetstream/types';
import JSZip from 'jszip';
import isString from 'lodash/isString';
import { ApiConnection } from './connection';
import { SoapResponse } from './types';
import {
  SalesforceApi,
  correctDeployMetadataResultTypes,
  correctInvalidArrayXmlResponseTypes,
  correctInvalidXmlResponseTypes,
} from './utils';

export class ApiMetadata extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  async describe(): Promise<DescribeMetadataResult> {
    // for some types, if folder is null then no data will be returned
    return this.apiRequest<{
      'ns1:Envelope': {
        Body: {
          describeMetadataResponse: {
            result: DescribeMetadataResult;
          };
        };
        Header?: any;
      };
    }>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          describeMetadata: { asOfVersion: this.apiVersion },
        },
      })
    )
      .then((response) => correctInvalidXmlResponseTypes(response['ns1:Envelope'].Body.describeMetadataResponse.result))
      .then((response) => {
        response.organizationNamespace = isString(response.organizationNamespace) ? response.organizationNamespace : null;
        response.partialSaveAllowed = correctInvalidXmlResponseTypes(response.partialSaveAllowed);
        response.testRequired = correctInvalidXmlResponseTypes(response.testRequired);
        response.metadataObjects = correctInvalidArrayXmlResponseTypes(response.metadataObjects).map((item) => {
          item.childXmlNames = ensureArray(item.childXmlNames || []);
          item = correctInvalidXmlResponseTypes(item);
          return item;
        });
        response.partialSaveAllowed = correctInvalidXmlResponseTypes(response.partialSaveAllowed);
        response.testRequired = correctInvalidXmlResponseTypes(response.testRequired);
        return response;
      });
  }

  async list(types: ListMetadataRequest['types']): Promise<FileProperties[]> {
    return this.apiRequest<SoapResponse<'listMetadataResponse', FileProperties[]>>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          listMetadata: {
            // for some types, if folder is null then no data will be returned
            queries: types.map(({ type, folder }) => (folder ? { type, folder } : { type })),
            asOfVersion: this.apiVersion,
          },
        },
      })
    ).then((response) => correctInvalidArrayXmlResponseTypes(response['ns1:Envelope'].Body.listMetadataResponse?.result || []));
  }

  async read(type: string, fullNames: ReadMetadataRequest['fullNames']): Promise<MetadataInfo[]> {
    return (
      await Promise.all(
        splitArrayToMaxSize(fullNames, 10).map((fullNames) =>
          this.apiRequest<SoapResponse<'readMetadataResponse', { records: MetadataInfo[] }>>(
            this.prepareSoapRequestOptions({
              type: 'METADATA',
              body: {
                readMetadata: {
                  type,
                  fullNames,
                },
              },
            })
          ).then((response) => {
            return correctInvalidArrayXmlResponseTypes(response['ns1:Envelope'].Body.readMetadataResponse?.result.records || []);
          })
        )
      )
    ).flat();
  }

  /**
   * When provided with all the data, build a file and convert to base64 for deployment
   */
  async deployMetadata(metadata: { fullFilename: string; content: string }[], options: DeployOptions): Promise<AsyncResult> {
    const zip = new JSZip();
    metadata.forEach((item) => zip.file(item.fullFilename, item.content));
    return this.deploy(await zip.generateAsync({ type: 'base64' }), options);
  }

  /**
   * Deploy metadata
   * Zip should be an array buffer or base64 encoded string
   */
  async deploy(body: ArrayBuffer | Uint8Array | string, options: DeployOptions): Promise<AsyncResult> {
    let ZipFile: string;
    if (body instanceof Uint8Array) {
      ZipFile = uint8ArrayToBase64(body);
    } else if (body instanceof ArrayBuffer) {
      ZipFile = arrayBufferToBase64(body);
    } else if (isString(body)) {
      ZipFile = body;
    } else {
      throw new Error(`Invalid body type ${typeof body}`);
    }
    return this.apiRequest<SoapResponse<'deployResponse', AsyncResult>>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          deploy: {
            ZipFile,
            DeployOptions: options,
          },
        },
      })
    )
      .then((result) => result['ns1:Envelope'].Body.deployResponse.result)
      .then(correctInvalidXmlResponseTypes);
  }

  async checkDeployStatus(jobId: string, includeDetails = false): Promise<DeployResult> {
    return this.apiRequest<SoapResponse<'checkDeployStatusResponse', DeployResult>>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          checkDeployStatus: {
            asyncProcessId: jobId,
            includeDetails,
          },
        },
      })
    )
      .then((result) => result['ns1:Envelope'].Body.checkDeployStatusResponse.result)
      .then(correctDeployMetadataResultTypes);
  }

  async retrieve(request: RetrieveRequest) {
    return this.apiRequest<SoapResponse<'retrieveResponse', AsyncResult>>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          retrieve: { request },
        },
      })
    )
      .then((results) => {
        return results;
      })
      .then((result) => correctInvalidXmlResponseTypes(result['ns1:Envelope'].Body.retrieveResponse.result));
  }

  async checkRetrieveStatus(asyncProcessId: string) {
    return this.apiRequest<SoapResponse<'checkRetrieveStatusResponse', RetrieveResult>>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          checkRetrieveStatus: { asyncProcessId },
        },
      })
    )
      .then((result) => result['ns1:Envelope'].Body.checkRetrieveStatusResponse.result)
      .then((results) => {
        results.fileProperties = ensureArray(results.fileProperties);
        results.messages = ensureArray(results.messages);
        return correctInvalidXmlResponseTypes(results);
      });
  }
}
