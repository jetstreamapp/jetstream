import { arrayBufferToBase64, ensureArray, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { DeployOptions, DeployResult, RetrieveResult } from '@jetstream/types';
import type { AsyncResult, DescribeMetadataResult, FileProperties, MetadataInfo, RetrieveRequest } from 'jsforce';
import JSZip from 'jszip';
import { ApiConnection } from './connection';
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
    return this.apiRequest<DescribeMetadataResult>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          describeMetadata: { asOfVersion: this.apiVersion },
        },
      })
    ).then((response) => {
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

  async list(types: { type: string; folder?: string }[]): Promise<FileProperties[]> {
    return this.apiRequest<FileProperties[]>(
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
    ).then((response) => correctInvalidArrayXmlResponseTypes(response));
  }

  async read(type: string, fullNames: string[]): Promise<MetadataInfo[]> {
    return (
      await Promise.all(
        splitArrayToMaxSize(fullNames, 10).map((fullNames) =>
          this.apiRequest<MetadataInfo[]>(
            this.prepareSoapRequestOptions({
              type: 'METADATA',
              body: {
                readMetadata: {
                  type,
                  fullNames,
                },
              },
            })
          ).then((response) => correctInvalidArrayXmlResponseTypes(response))
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
  async deploy(body: ArrayBuffer | string, options: DeployOptions): Promise<AsyncResult> {
    const ZipFile = body instanceof ArrayBuffer ? arrayBufferToBase64(body) : body;
    return this.apiRequest<AsyncResult>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          deploy: {
            ZipFile,
            DeployOptions: options,
          },
        },
      })
    ).then(correctInvalidXmlResponseTypes);
  }

  async checkDeployStatus(jobId: string, includeDetails = false): Promise<DeployResult> {
    return this.apiRequest<DeployResult>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          checkDeployStatus: {
            asyncProcessId: jobId,
            includeDetails,
          },
        },
      })
    ).then(correctDeployMetadataResultTypes);
  }

  async retrieve(request: RetrieveRequest) {
    return this.apiRequest<AsyncResult>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          retrieve: { request },
        },
      })
    ).then(correctInvalidXmlResponseTypes);
  }

  async checkRetrieveStatus(asyncProcessId: string) {
    return this.apiRequest<RetrieveResult>(
      this.prepareSoapRequestOptions({
        type: 'METADATA',
        body: {
          checkRetrieveStatus: { asyncProcessId },
        },
      })
    ).then((results) => {
      results.fileProperties = ensureArray(results.fileProperties);
      results.messages = ensureArray(results.messages);
      return correctInvalidXmlResponseTypes(results);
    });
  }

  // TODO: this needs a second org to work
  async checkRetrieveStatusAndRedeploy() {}
}
