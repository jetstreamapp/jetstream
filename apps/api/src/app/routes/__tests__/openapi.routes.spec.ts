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
});
