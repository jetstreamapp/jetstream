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
      '/platform-event': ['get', 'post'],
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

  it('documents the SAML ACS as a form post with a SAMLResponse body', () => {
    const operation = getOpenApiSpec().paths?.['/api/auth/sso/saml/{teamId}/acs']?.post;

    expect(Object.keys(operation?.requestBody && 'content' in operation.requestBody ? operation.requestBody.content : {})).toEqual([
      'application/x-www-form-urlencoded',
    ]);
  });
});
