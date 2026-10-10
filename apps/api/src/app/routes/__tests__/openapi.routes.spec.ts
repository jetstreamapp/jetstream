import { describe, expect, it } from 'vitest';
import { getOpenApiSpec } from '../openapi.routes';

describe('getOpenApiSpec', () => {
  // zod-openapi throws while building the document if any route has a schema it cannot represent
  // (e.g. a z.record query), which breaks /openapi/spec.json for every route
  it('generates the spec for every documented route', () => {
    const spec = getOpenApiSpec();

    expect(spec.openapi).toBe('3.1.1');
    expect(Object.keys(spec.paths ?? {}).length).toBeGreaterThan(0);
  });

  it('documents the named Salesforce oauth callback query params', () => {
    const parameters = getOpenApiSpec().paths?.['/oauth/sfdc/callback']?.get?.parameters ?? [];
    const queryParamNames = parameters
      .filter((param) => 'in' in param && param.in === 'query')
      .map((param) => 'name' in param && param.name);

    expect(queryParamNames).toEqual(['code', 'state', 'error', 'error_description']);
  });

  // The spec is hand-maintained, so a newly added SSO route is easy to forget
  it('documents every SSO login, configuration and domain verification route', () => {
    const { paths = {} } = getOpenApiSpec();
    const expectedOperations: Record<string, string[]> = {
      '/api/auth/sso/discover': ['post'],
      '/api/auth/sso/start': ['post'],
      '/api/auth/sso/saml/{teamId}/acs': ['post'],
      '/api/auth/sso/saml/{teamId}/metadata': ['get'],
      '/api/auth/sso/oidc/{teamId}/initiate': ['get'],
      '/api/auth/sso/oidc/{teamId}/callback': ['get'],
      '/api/teams/{teamId}/sso/config': ['get'],
      '/api/teams/{teamId}/sso/saml/parse-metadata': ['post'],
      '/api/teams/{teamId}/sso/saml/config': ['post', 'delete'],
      '/api/teams/{teamId}/sso/oidc/config': ['post', 'delete'],
      '/api/teams/{teamId}/sso/settings': ['put'],
      '/api/teams/{teamId}/domain-verification': ['get', 'post'],
      '/api/teams/{teamId}/domain-verification/{domainId}/verify': ['post'],
      '/api/teams/{teamId}/domain-verification/{domainId}': ['delete'],
    };

    for (const [path, methods] of Object.entries(expectedOperations)) {
      expect(Object.keys(paths[path] ?? {}), path).toEqual(expect.arrayContaining(methods));
    }
  });

  it('documents the audit log, canvas, feedback, platform event, webhook and socket.io routes', () => {
    const { paths = {} } = getOpenApiSpec();
    const expectedOperations: Record<string, string[]> = {
      '/api/teams/{teamId}/audit-logs': ['get'],
      '/api/canvas-orgs': ['get', 'post'],
      '/api/canvas-orgs/{id}': ['patch', 'delete'],
      '/api/teams/{teamId}/canvas-orgs': ['get', 'post'],
      '/api/teams/{teamId}/canvas-orgs/{id}': ['patch', 'delete'],
      '/api/feedback': ['post'],
      '/desktop-app/feedback': ['post'],
      '/web-extension/feedback': ['post'],
      '/canvas/app': ['get', 'post'],
      '/canvas/callback': ['get', 'post'],
      '/webhook/stripe': ['post'],
      '/webhook/mailgun': ['post'],
      '/socket.io/': ['get', 'post'],
    };

    for (const [path, methods] of Object.entries(expectedOperations)) {
      expect(Object.keys(paths[path] ?? {}), path).toEqual(expect.arrayContaining(methods));
    }
  });

  it('documents the webhooks without session or Salesforce org headers', () => {
    const { paths = {} } = getOpenApiSpec();
    const stripeHeaders = (paths['/webhook/stripe']?.post?.parameters ?? []).map((param) => 'name' in param && param.name);

    expect(stripeHeaders).toEqual(['Stripe-Signature']);
    expect(paths['/webhook/mailgun']?.post?.parameters ?? []).toEqual([]);
  });

  it('documents the SAML ACS as a form post that requires a SAMLResponse', () => {
    const operation = getOpenApiSpec().paths?.['/api/auth/sso/saml/{teamId}/acs']?.post;
    const content = operation?.requestBody && 'content' in operation.requestBody ? operation.requestBody.content : {};
    const mediaType = content['application/x-www-form-urlencoded'];
    const schema = (mediaType && 'schema' in mediaType ? mediaType.schema : undefined) as
      | { properties?: object; required?: string[] }
      | undefined;

    expect(Object.keys(content)).toEqual(['application/x-www-form-urlencoded']);
    expect(Object.keys(schema?.properties ?? {})).toContain('SAMLResponse');
    expect(schema?.required).toContain('SAMLResponse');
  });

  it('documents every method and a path suffix for the platform event proxy', () => {
    const { paths = {} } = getOpenApiSpec();

    for (const path of ['/platform-event', '/platform-event/{path}']) {
      expect(Object.keys(paths[path] ?? {}), path).toEqual(expect.arrayContaining(['get', 'post', 'put', 'patch', 'delete']));
    }
  });

  it('documents the source org on the platform event proxy as a header or query param, without a CSRF header', () => {
    const operation = getOpenApiSpec().paths?.['/platform-event']?.post;
    const parameters = (operation?.parameters ?? []).filter((param) => 'in' in param);
    const names = (location: string) => parameters.filter((param) => param.in === location).map((param) => 'name' in param && param.name);

    expect(names('header')).toEqual(['X-SFDC-ID', 'X-SFDC-API-VERSION']);
    expect(names('query')).toEqual(['X-SFDC-ID', 'X-SFDC-API-VERSION']);
  });

  it('does not document a CSRF header on routes that never check one', () => {
    const { paths = {} } = getOpenApiSpec();
    const operations = [
      paths['/api/auth/sso/saml/{teamId}/acs']?.post,
      paths['/canvas/app']?.get,
      paths['/canvas/app']?.post,
      paths['/canvas/callback']?.get,
      paths['/canvas/callback']?.post,
      paths['/platform-event']?.post,
      paths['/webhook/stripe']?.post,
    ];

    for (const operation of operations) {
      const headerNames = (operation?.parameters ?? []).map((param) => 'name' in param && param.name);
      expect(headerNames.some((name) => typeof name === 'string' && /csrf/i.test(name))).toBe(false);
    }
  });

  it('requires a sid and the polling transport for Engine.IO writes', () => {
    const parameters = getOpenApiSpec().paths?.['/socket.io/']?.post?.parameters ?? [];
    const sid = parameters.find((param) => 'name' in param && param.name === 'sid');
    const transport = parameters.find((param) => 'name' in param && param.name === 'transport');

    expect(sid && 'required' in sid && sid.required).toBe(true);
    expect(transport && 'schema' in transport && transport.schema).toMatchObject({ const: 'polling' });
  });
});
