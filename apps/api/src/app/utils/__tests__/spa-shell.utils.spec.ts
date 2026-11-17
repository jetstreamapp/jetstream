import { describe, expect, it } from 'vitest';
import { applyEnvironmentFavicons } from '../spa-shell.utils';

const HTML = [
  '<link rel="apple-touch-icon" sizes="57x57" href="/assets/images/apple-icon-57x57.png" />',
  '<link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png" />',
  '<link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png" />',
].join('\n');

describe('applyEnvironmentFavicons', () => {
  it('leaves production untouched', () => {
    expect(applyEnvironmentFavicons(HTML, 'production')).toBe(HTML);
  });

  it.each(['development', 'staging'] as const)('swaps every sized favicon in %s and nothing else', (environment) => {
    const result = applyEnvironmentFavicons(HTML, environment);
    expect(result).toContain(`/assets/images/favicon-${environment}-32x32.png`);
    expect(result).toContain(`/assets/images/favicon-${environment}-16x16.png`);
    expect(result).toContain('/assets/images/apple-icon-57x57.png');
    expect(result).not.toContain('/assets/images/favicon-32x32.png');
  });
});
