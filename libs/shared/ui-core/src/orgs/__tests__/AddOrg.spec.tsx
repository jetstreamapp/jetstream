import { SalesforceOrgUi } from '@jetstream/types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { atom } from 'jotai';
import { describe, expect, it, vi } from 'vitest';

// `@jetstream/ui/app-state` fetches app info and the user profile at module load, and `..` is the
// full ui-core barrel - neither is needed to exercise the login url derivation this component owns.
// `doMock` rather than `mock` so the stub atoms can be built from a normal top-level import.
vi.doMock('@jetstream/ui/app-state', () => ({
  fromAppState: {
    applicationCookieState: atom({ serverUrl: 'https://test.getjetstream.app' }),
    jetstreamActiveGroupSelector: atom(undefined),
  },
}));

vi.doMock('../..', () => ({
  useAmplitude: () => ({ trackEvent: vi.fn() }),
}));

const { AddOrg } = await import('../AddOrg');

function buildOrg(instanceUrl: string): SalesforceOrgUi {
  return {
    uniqueId: '00D000000000001-005000000000001',
    label: 'john.smith@acme.com',
    username: 'john.smith@acme.com',
    instanceUrl,
  } as SalesforceOrgUi;
}

function renderOpen(existingOrg?: SalesforceOrgUi) {
  const onAddOrg = vi.fn();
  const onAddOrgHandlerFn = vi.fn();
  const result = render(<AddOrg existingOrg={existingOrg} onAddOrg={onAddOrg} onAddOrgHandlerFn={onAddOrgHandlerFn} />);
  fireEvent.click(screen.getByRole('button', { name: /add org/i }));
  return { ...result, onAddOrgHandlerFn };
}

function getCustomUrlInput() {
  return document.querySelector('input#org-custom-url') as HTMLInputElement;
}

function clickContinue() {
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('AddOrg', () => {
  describe('reconnecting an existing org', () => {
    // The prefill is re-parsed to build the login url, so anything it drops sends the user to a host
    // their org does not serve
    it.each([
      ['https://acme.develop.my.salesforce.com'],
      ['https://acme.sandbox.my.salesforce.com'],
      ['https://acme--uat.sandbox.my.salesforce.com'],
      ['https://acme.my.salesforce.com'],
    ])('reconnects %s to the same host', (instanceUrl) => {
      const { onAddOrgHandlerFn } = renderOpen(buildOrg(instanceUrl));

      expect((screen.getByLabelText('Custom Login URL') as HTMLInputElement).checked).toBe(true);
      clickContinue();

      expect(onAddOrgHandlerFn).toHaveBeenCalledWith(expect.objectContaining({ loginUrl: instanceUrl }), expect.any(Function));
    });

    it('passes the existing username as the login hint', () => {
      const { onAddOrgHandlerFn } = renderOpen(buildOrg('https://acme.my.salesforce.com'));
      clickContinue();
      expect(onAddOrgHandlerFn).toHaveBeenCalledWith(expect.objectContaining({ loginHint: 'john.smith@acme.com' }), expect.any(Function));
    });

    it.each([['https://login.salesforce.com'], ['https://na139.salesforce.com']])(
      'falls back to production for %s, which is not a My Domain',
      (instanceUrl) => {
        const { onAddOrgHandlerFn } = renderOpen(buildOrg(instanceUrl));

        expect((screen.getByLabelText('Production / Developer') as HTMLInputElement).checked).toBe(true);
        clickContinue();

        expect(onAddOrgHandlerFn).toHaveBeenCalledWith(
          expect.objectContaining({ loginUrl: 'https://login.salesforce.com' }),
          expect.any(Function),
        );
      },
    );
  });

  describe('org type selection', () => {
    it.each([
      ['Production / Developer', 'https://login.salesforce.com'],
      ['Sandbox (test.salesforce.com)', 'https://test.salesforce.com'],
      ['Pre-release', 'https://prerellogin.pre.salesforce.com'],
    ])('sends %s to %s', (radioLabel, expected) => {
      const { onAddOrgHandlerFn } = renderOpen();

      fireEvent.click(screen.getByLabelText(radioLabel));
      clickContinue();

      expect(onAddOrgHandlerFn).toHaveBeenCalledWith(expect.objectContaining({ loginUrl: expected }), expect.any(Function));
    });
  });

  describe('custom login url', () => {
    function selectCustom() {
      fireEvent.click(screen.getByLabelText('Custom Login URL'));
    }

    it('disables Continue until a valid domain is entered', () => {
      renderOpen();
      selectCustom();

      const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
      expect(continueButton.disabled).toBe(true);

      fireEvent.change(getCustomUrlInput(), { target: { value: 'not a domain' } });
      expect(continueButton.disabled).toBe(true);

      fireEvent.change(getCustomUrlInput(), { target: { value: 'acme' } });
      expect(continueButton.disabled).toBe(false);
    });

    it('describes the error to screen readers while the input is invalid', () => {
      renderOpen();
      selectCustom();
      fireEvent.change(getCustomUrlInput(), { target: { value: 'https://evil.com' } });

      // The label-help association is always present; the error id joins it only while invalid
      expect(getCustomUrlInput().getAttribute('aria-describedby')).toContain('org-custom-url-error');
      expect(getCustomUrlInput().getAttribute('aria-invalid')).toBe('true');

      fireEvent.change(getCustomUrlInput(), { target: { value: 'acme' } });
      expect(getCustomUrlInput().getAttribute('aria-describedby')).not.toContain('org-custom-url-error');
      expect(getCustomUrlInput().getAttribute('aria-describedby')).toContain('label-help-text');
    });

    it('builds the login url from shorthand', () => {
      const { onAddOrgHandlerFn } = renderOpen();
      selectCustom();
      fireEvent.change(getCustomUrlInput(), { target: { value: 'acme--uat' } });
      clickContinue();

      expect(onAddOrgHandlerFn).toHaveBeenCalledWith(
        expect.objectContaining({ loginUrl: 'https://acme--uat.sandbox.my.salesforce.com' }),
        expect.any(Function),
      );
    });
  });

  describe('advanced options', () => {
    // The toggle is a disclosure: a screen reader user hears expanded/collapsed on it and can jump
    // to the region it controls, which stays in the DOM (empty) while collapsed so the id resolves
    it('reports its expanded state and controls the region it reveals', () => {
      renderOpen();
      const toggle = screen.getByRole('checkbox', { name: /advanced options/i });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      const region = document.getElementById(toggle.getAttribute('aria-controls') as string) as HTMLElement;
      expect(region.textContent).toBe('');

      fireEvent.click(toggle);

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(within(region).getByLabelText(/login=true/)).toBeTruthy();
    });
  });
});
