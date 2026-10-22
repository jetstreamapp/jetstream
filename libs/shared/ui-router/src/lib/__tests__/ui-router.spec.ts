import { ACCESS_PROFILE_TOOL_KEYS } from '@jetstream/types';
import { APP_ROUTES, getAccessProfileToolForPath, isPathAllowedByAccessProfile } from '../ui-router';

describe('getAccessProfileToolForPath', () => {
  it('returns the tool for a route and its child routes', () => {
    expect(getAccessProfileToolForPath('/query')).toBe('query');
    expect(getAccessProfileToolForPath('/query/results')).toBe('query');
    expect(getAccessProfileToolForPath('/automation-control/editor')).toBe('automation-control');
  });

  it('matches whole path segments so similar routes are not confused', () => {
    expect(getAccessProfileToolForPath('/load')).toBe('load');
    expect(getAccessProfileToolForPath('/load-multiple-objects')).toBe('load');
    expect(getAccessProfileToolForPath('/loader')).toBeUndefined();
    expect(getAccessProfileToolForPath('/apex')).toBe('anonymous-apex');
    expect(getAccessProfileToolForPath('/apex-tests')).toBe('apex-tests');
  });

  it('ignores case because the router matches paths case-insensitively', () => {
    expect(getAccessProfileToolForPath('/LOAD')).toBe('load');
    expect(getAccessProfileToolForPath('/Load-Multiple-Objects')).toBe('load');
    expect(getAccessProfileToolForPath('/Query/Results')).toBe('query');
    expect(getAccessProfileToolForPath('/APEX-TESTS')).toBe('apex-tests');
    expect(getAccessProfileToolForPath('/LOADER')).toBeUndefined();
    expect(getAccessProfileToolForPath('/HOME')).toBeUndefined();
  });

  it('returns nothing for routes that are always available', () => {
    expect(getAccessProfileToolForPath('/home')).toBeUndefined();
    expect(getAccessProfileToolForPath('/settings')).toBeUndefined();
    expect(getAccessProfileToolForPath('/teams')).toBeUndefined();
    expect(getAccessProfileToolForPath('/org-groups')).toBeUndefined();
  });

  it('maps every tool in the access profile catalog to at least one route', () => {
    const routedTools = new Set(Object.values(APP_ROUTES).map(({ TOOL }) => TOOL));
    expect(ACCESS_PROFILE_TOOL_KEYS.filter((tool) => !routedTools.has(tool))).toEqual([]);
  });
});

describe('isPathAllowedByAccessProfile', () => {
  it('always allows a route that no tool grants', () => {
    expect(isPathAllowedByAccessProfile('/settings', () => false)).toBe(true);
  });

  it('asks about the tool that grants the route', () => {
    const canAccessTool = vi.fn((tool: string) => tool === 'query');

    expect(isPathAllowedByAccessProfile('/query/results', canAccessTool)).toBe(true);
    expect(isPathAllowedByAccessProfile('/load', canAccessTool)).toBe(false);
    expect(canAccessTool).toHaveBeenCalledWith('load');
  });
});
