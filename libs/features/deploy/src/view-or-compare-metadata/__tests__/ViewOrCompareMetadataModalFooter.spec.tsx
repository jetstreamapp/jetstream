/* eslint-disable import/first -- vi.mock calls must be evaluated before the modules they intercept are imported */
const operationAccess = vi.hoisted(() => ({ current: { allowed: true } as { allowed: boolean; deniedReason?: string } }));

vi.mock('@jetstream/ui/app-state', () => ({ useOperationAccess: () => operationAccess.current }));

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewOrCompareMetadataModalFooter } from '../ViewOrCompareMetadataModalFooter';

/** The text a screen reader reads as the element's description (its aria-describedby targets, in order) */
function getDescription(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

function renderFooter({ hasTargetMetadata }: { hasTargetMetadata: boolean }) {
  render(
    <ViewOrCompareMetadataModalFooter
      hasSourceMetadata
      hasTargetMetadata={hasTargetMetadata}
      hasTargetMetadataContent={hasTargetMetadata}
      sourceLoading={false}
      sourceLastChecked={null}
      targetLoading={false}
      targetLastChecked={null}
      isSingleOrgMode={false}
      onDownloadPackage={vi.fn()}
      onExportSummary={vi.fn()}
      onDeployToTarget={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return screen.getByRole('button', { name: 'Deploy Changes' });
}

describe('ViewOrCompareMetadataModalFooter', () => {
  afterEach(() => {
    operationAccess.current = { allowed: true };
  });

  it('keeps Deploy Changes focusable and says a target org is needed', () => {
    const deployButton = renderFooter({ hasTargetMetadata: false });

    expect(deployButton.getAttribute('aria-disabled')).toBe('true');
    expect(deployButton.hasAttribute('disabled')).toBe(false);
    expect(getDescription(deployButton)).toBe('Select a target org to deploy changes');
  });

  it('says why Deploy Changes is unavailable when the access profile does not allow deploying', () => {
    operationAccess.current = { allowed: false, deniedReason: 'Your access does not include deploying metadata' };
    const deployButton = renderFooter({ hasTargetMetadata: true });

    expect(deployButton.getAttribute('aria-disabled')).toBe('true');
    expect(getDescription(deployButton)).toBe('Your access does not include deploying metadata');
  });

  it('is available with no reason once a target org is loaded', () => {
    const deployButton = renderFooter({ hasTargetMetadata: true });

    expect(deployButton.hasAttribute('aria-disabled')).toBe(false);
    expect(getDescription(deployButton)).toBe('');
  });
});
