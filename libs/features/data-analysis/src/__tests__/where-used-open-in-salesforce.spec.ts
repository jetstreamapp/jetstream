import { describe, expect, it } from 'vitest';
import { getWhereUsedOpenInSalesforcePath } from '../where-used-open-in-salesforce';

describe('getWhereUsedOpenInSalesforcePath', () => {
  it('uses stored path from job when present', () => {
    expect(
      getWhereUsedOpenInSalesforcePath({
        type: 'Flow',
        name: 'X',
        kind: 'automation',
        openInSalesforcePath: '/builder_platform_interaction/flowBuilder.app?flowId=abc',
      }),
    ).toBe('/builder_platform_interaction/flowBuilder.app?flowId=abc');
  });

  it('builds Flow builder URL from component id when path omitted', () => {
    expect(
      getWhereUsedOpenInSalesforcePath({
        type: 'Flow',
        name: 'My_Flow',
        kind: 'automation',
        componentId: '301xx000000abcd',
      }),
    ).toBe('/builder_platform_interaction/flowBuilder.app?flowId=301xx000000abcd');
  });

  it('returns Process Builder home without component id', () => {
    expect(
      getWhereUsedOpenInSalesforcePath({
        type: 'ProcessDefinition',
        name: 'P',
        kind: 'automation',
      }),
    ).toBe('/lightning/setup/ProcessAutomation/home');
  });
});
