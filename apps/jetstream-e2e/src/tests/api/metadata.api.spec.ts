import {
  AnonymousApexResponse,
  AsyncResult,
  DeployResult,
  DescribeMetadataResult,
  FileProperties,
  MetadataInfo,
  RetrieveResult,
} from '@jetstream/types';
import { readFileSync } from 'fs-extra';
import { join } from 'path';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('API - Metadata', () => {
  test('describe metadata', async ({ apiRequestUtils }) => {
    const results = await apiRequestUtils.makeRequest<DescribeMetadataResult>('GET', `/api/metadata/describe`);

    expect(results).toBeTruthy();
    expect(Array.isArray(results.metadataObjects)).toBeTruthy();
    expect(results.organizationNamespace).toBeFalsy();
    expect(results.partialSaveAllowed).toBeTruthy();
    expect(results.testRequired).toBeFalsy();
  });

  test('list metadata', async ({ apiRequestUtils }) => {
    const results = await apiRequestUtils.makeRequest<FileProperties[]>('POST', `/api/metadata/list`, { types: [{ type: 'ApexClass' }] });

    expect(results).toBeTruthy();
    expect(Array.isArray(results)).toBeTruthy();

    results.forEach((result) => {
      expect(result).toBeTruthy();
      expect(result.type).toBeTruthy();
      expect(result.createdById).toBeTruthy();
      expect(result.createdByName).toBeTruthy();
      expect(result.createdDate).toBeTruthy();
      expect(result.fileName).toBeTruthy();
      expect(result.fullName).toBeTruthy();
      expect(result.id).toBeTruthy();
      expect(result.lastModifiedById).toBeTruthy();
    });
  });

  test('read metadata', async ({ apiRequestUtils }) => {
    const results = await apiRequestUtils.makeRequest<MetadataInfo[]>('POST', `/api/metadata/read/CustomObject`, {
      fullNames: ['Account'],
    });

    expect(results).toBeTruthy();
    expect(Array.isArray(results)).toBeTruthy();
    expect(results.length).toEqual(1);

    results.forEach((result) => {
      expect(result).toBeTruthy();
      expect(result.fullName).toBeTruthy();
    });
  });

  test('read metadata - Item does not exist', async ({ apiRequestUtils }) => {
    const results = await apiRequestUtils.makeRequest<MetadataInfo[]>('POST', `/api/metadata/read/PermissionSet`, {
      fullNames: ['ApexUtils'],
    });

    expect(results).toBeTruthy();
    expect(Array.isArray(results)).toBeTruthy();
    expect(results.length).toEqual(0);
  });

  test('deploy metadata', async ({ apiRequestUtils }) => {
    const results = await apiRequestUtils.makeRequest<AsyncResult>('POST', `/api/metadata/deploy`, {
      files: [
        {
          fullFilename: 'classes/AddPrimaryContact.cls',
          content: `
public class AddPrimaryContact implements Queueable {

  String stateAbbr;
  Contact contact;

  public AddPrimaryContact(Contact contact, String stateAbbr) {
    this.contact = contact;
    this.stateAbbr = stateAbbr;
  }

  public void execute(QueueableContext context) {
        List<Account> accounts = [Select ID FROM Account WHERE BillingState = :stateAbbr LIMIT 200];
        List<Contact> contacts = new List<Contact>();
        for(Account a : accounts) {
          Contact c = contact.clone();
          c.accountId = a.Id;
          contacts.add(c);
        }
        insert contacts;
  }
}`,
        },
      ],
      options: {
        allowMissingFiles: false,
        autoUpdatePackage: false,
        checkOnly: false,
        ignoreWarnings: false,
        purgeOnDelete: false,
        rollbackOnError: true,
        singlePackage: true,
        runTests: [],
      },
    });

    expect(results).toBeTruthy();
    expect(results.id).toBeTruthy();
    expect(results.state).toBeTruthy();
    expect(typeof results.done === 'boolean').toBeTruthy();
  });

  test('deploy zip And Check Results', async ({ apiRequestUtils }) => {
    const file = readFileSync(join(__dirname, 'test.metadata-package.zip'));
    const results = await apiRequestUtils.makeRequest<AsyncResult>(
      'POST',
      `/api/metadata/deploy-zip?${new URLSearchParams({
        options: JSON.stringify({
          allowMissingFiles: false,
          autoUpdatePackage: false,
          checkOnly: false,
          ignoreWarnings: false,
          purgeOnDelete: false,
          rollbackOnError: true,
          singlePackage: true,
          runTests: [],
        }),
      })}`,
      file,
      {
        'Content-Type': 'application/zip',
      }
    );

    expect(results).toBeTruthy();
    expect(results.id).toBeTruthy();
    expect(results.state).toBeTruthy();
    expect(typeof results.done === 'boolean').toBeTruthy();

    const retrieveResults = await apiRequestUtils.makeRequest<DeployResult>('GET', `/api/metadata/deploy/${results.id}`);

    expect(retrieveResults).toBeTruthy();
    expect(retrieveResults.id).toBeTruthy();
    expect(retrieveResults.status).toBeTruthy();
    expect(typeof retrieveResults.done === 'boolean').toBeTruthy();
    expect(typeof retrieveResults.success === 'boolean').toBeTruthy();
  });

  test('retrieve package from list metadata', async ({ apiRequestUtils }) => {
    const results = await apiRequestUtils.makeRequest<AsyncResult>('POST', `/api/metadata/retrieve/list-metadata`, {
      ApexClass: [
        {
          createdById: '0056g000004tCpaAAE',
          createdByName: 'Barbara Walters',
          createdDate: '2021-02-01T03:16:19.000Z',
          fileName: 'classes/ApexUtils.cls',
          fullName: 'ApexUtils',
          id: '01p6g00000RikTCAAZ',
          lastModifiedById: '0056g000004tCpaAAE',
          lastModifiedByName: 'Barbara Walters',
          lastModifiedDate: '2022-03-02T02:52:38.000Z',
          manageableState: 'unmanaged',
          type: 'ApexClass',
        },
      ],
    });

    expect(results).toBeTruthy();
    expect(results.id).toBeTruthy();
    expect(results.state).toBeTruthy();
    expect(typeof results.done === 'boolean').toBeTruthy();

    const retrieveResults = await apiRequestUtils.makeRequest<RetrieveResult>(
      'GET',
      `/api/metadata/retrieve/check-results?id=${results.id}`
    );

    expect(retrieveResults).toBeTruthy();
    expect(retrieveResults.id).toBeTruthy();
    expect(retrieveResults.status).toBeTruthy();
    expect(typeof retrieveResults.done === 'boolean').toBeTruthy();
    expect(typeof retrieveResults.success === 'boolean').toBeTruthy();
  });

  test('retrieve package from package', async ({ apiRequestUtils }) => {
    const results = await apiRequestUtils.makeRequest<AsyncResult>('POST', `/api/metadata/retrieve/package-names`, {
      packageNames: 'MyPackage',
    });

    expect(results).toBeTruthy();
    expect(results.id).toBeTruthy();
    expect(results.state).toBeTruthy();
    expect(typeof results.done === 'boolean').toBeTruthy();
  });

  test('retrieve package from manifest', async ({ apiRequestUtils }) => {
    const results = await apiRequestUtils.makeRequest<AsyncResult>('POST', `/api/metadata/retrieve/manifest`, {
      packageManifest: `<?xml version="1.0" encoding="UTF-8"?>
      <Package xmlns="http://soap.sforce.com/2006/04/metadata">
        <types>
          <members>ApexUtils</members>
          <name>ApexClass</name>
        </types>
        <version>60.0</version>
      </Package>`,
    });

    expect(results).toBeTruthy();
    expect(results.id).toBeTruthy();
    expect(results.state).toBeTruthy();
    expect(typeof results.done === 'boolean').toBeTruthy();
  });

  // TODO: checkRetrieveStatusAndRedeploy (this one will be hard - maybe skip)

  test('getPackageXml', async ({ apiRequestUtils }) => {
    const results = await apiRequestUtils.makeRequest<string>('POST', `/api/metadata/package-xml`, {
      metadata: {
        ApexClass: [
          {
            fullName: 'ApexUtils',
          },
        ],
      },
      otherFields: {},
    });

    expect(results).toBeTruthy();
    expect(typeof results === 'string').toBeTruthy();
  });

  test('anonymousApex', async ({ apiRequestUtils }) => {
    const [validWithLogLevel, validWithoutLogLevel, missingApex, invalidLogLevel] = await Promise.all([
      apiRequestUtils.makeRequest<AnonymousApexResponse>('POST', `/api/apex/anonymous`, {
        apex: `System.debug('Hello World');`,
        logLevel: 'DEBUG',
      }),
      apiRequestUtils.makeRequest<AnonymousApexResponse>('POST', `/api/apex/anonymous`, {
        apex: `System.debug('Hello World');`,
      }),
      apiRequestUtils.makeRequestRaw('POST', `/api/apex/anonymous`, {
        apex1: `System.debug('Hello World');`,
        logLevel: 'DEBUG',
      }),
      apiRequestUtils.makeRequestRaw('POST', `/api/apex/anonymous`, {
        apex: `System.debug('Hello World');`,
        logLevel: 'SUPERFINE',
      }),
    ]);

    expect(validWithLogLevel).toBeTruthy();
    expect(typeof validWithLogLevel.debugLog === 'string').toBeTruthy();
    expect(validWithLogLevel.result.success).toBeTruthy();

    expect(validWithoutLogLevel).toBeTruthy();
    expect(typeof validWithoutLogLevel.debugLog === 'string').toBeTruthy();
    expect(validWithoutLogLevel.result.success).toBeTruthy();

    expect(missingApex.ok()).toBeFalsy();
    expect((await missingApex.text()).includes(`apex`)).toBeTruthy();

    expect(invalidLogLevel.ok()).toBeFalsy();
    expect((await invalidLogLevel.text()).includes(`logLevel`)).toBeTruthy();
  });

  // TODO: this one takes a really long time to run
  // test('apexCompletions', async ({ apiRequestUtils }) => {
  //   const [apexCompletions, vfCompletions, invalid] = await Promise.all([
  //     apiRequestUtils.makeRequest<ApexCompletionResponse>('GET', `/api/apex/completions/apex`),
  //     apiRequestUtils.makeRequest<ApexCompletionResponse>('GET', `/api/apex/completions/visualforce`),
  //     apiRequestUtils.makeRequestRaw('GET', `/api/apex/completions/invalid`),
  //   ]);

  //   expect(apexCompletions).toBeTruthy();
  //   expect(apexCompletions.publicDeclarations).toBeTruthy();

  //   expect(vfCompletions).toBeTruthy();
  //   expect(vfCompletions.publicDeclarations).toBeTruthy();

  //   expect(invalid.ok()).toBeFalsy();
  //   expect((await invalid.text()).includes(`type`)).toBeTruthy();
  // });
});
