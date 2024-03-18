import { AnonymousApexResponse } from '@jetstream/types';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('API - Apex', () => {
  test('anonymousApex', async ({ apiRequestUtils }) => {
    const [validWithLogLevel, validWithoutLogLevel, validApexWithXmlChars, invalidApex, runtimeError, missingApex, invalidLogLevel] =
      await Promise.all([
        apiRequestUtils.makeRequest<AnonymousApexResponse>('POST', `/api/apex/anonymous`, {
          apex: `System.debug('Hello World');`,
          logLevel: 'DEBUG',
        }),
        apiRequestUtils.makeRequest<AnonymousApexResponse>('POST', `/api/apex/anonymous`, {
          apex: `System.debug('Hello World');`,
        }),
        apiRequestUtils.makeRequest<AnonymousApexResponse>('POST', `/api/apex/anonymous`, {
          apex: `List<Account> accounts = [SELECT Id from Account LIMIT 0];`,
        }),
        apiRequestUtils.makeRequest<AnonymousApexResponse>('POST', `/api/apex/anonymous`, {
          apex: `System.debug('Hello World')`,
        }),
        apiRequestUtils.makeRequest<AnonymousApexResponse>('POST', `/api/apex/anonymous`, {
          apex: `String name = [SELECT Id from Account LIMIT 0][1].Name;`,
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
    expect(validWithLogLevel.result.success).toEqual(true);
    expect(validWithLogLevel.debugLog).toContain(`System.debug('Hello World');`);

    expect(validWithoutLogLevel).toBeTruthy();
    expect(typeof validWithoutLogLevel.debugLog === 'string').toBeTruthy();
    expect(validWithoutLogLevel.result.success).toEqual(true);
    expect(validWithLogLevel.debugLog).toContain(`System.debug('Hello World');`);

    expect(validApexWithXmlChars).toBeTruthy();
    expect(typeof validApexWithXmlChars.debugLog === 'string').toBeTruthy();
    expect(validApexWithXmlChars.debugLog).toContain('List<Account> accounts = [SELECT Id from Account LIMIT 0];');

    expect(typeof invalidApex.debugLog === 'string').toBeTruthy();
    expect(invalidApex.result.compiled).toEqual(false);
    expect(invalidApex.result.success).toEqual(false);
    expect(invalidApex.result.compileProblem).toEqual(`Unexpected token '('.`);

    expect(typeof runtimeError.debugLog === 'string').toBeTruthy();
    expect(runtimeError.result.compiled).toEqual(true);
    expect(runtimeError.result.success).toEqual(false);
    expect(runtimeError.result.exceptionMessage).toEqual(`System.ListException: List index out of bounds: 1`);
    expect(runtimeError.result.exceptionStackTrace).toEqual(`AnonymousBlock: line 1, column 1`);

    expect(missingApex.ok()).toBeFalsy();
    const missingApexBody = await missingApex.json();
    expect(missingApexBody.message).toEqual(`Invalid request: 'apex' is Required`);

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
