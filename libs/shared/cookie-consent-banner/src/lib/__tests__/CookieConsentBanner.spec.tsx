import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CookieConsentBanner } from '../CookieConsentBanner';

const acceptAll = vi.fn();
const rejectAll = vi.fn();

vi.mock('../useCookieConsent', () => ({
  useCookieConsent: () => ({ showBanner: true, acceptAll, rejectAll }),
}));

describe('CookieConsentBanner', () => {
  it('is a named region whose buttons say what they accept or reject', async () => {
    const { baseElement } = render(<CookieConsentBanner />);

    expect(screen.getByRole('region', { name: 'We use cookies to improve your experience' })).toBeTruthy();
    const acceptButton = screen.getByRole('button', { name: 'Accept cookies' });
    const rejectButton = screen.getByRole('button', { name: 'Reject cookies' });
    // Both buttons carry the explanation as their description
    for (const button of [acceptButton, rejectButton]) {
      const describedById = button.getAttribute('aria-describedby') as string;
      expect(document.getElementById(describedById)?.textContent).toMatch(/analytics cookies/i);
    }

    fireEvent.click(acceptButton);
    expect(acceptAll).toHaveBeenCalledTimes(1);
    fireEvent.click(rejectButton);
    expect(rejectAll).toHaveBeenCalledTimes(1);

    await axeScan(baseElement);
  });
});
