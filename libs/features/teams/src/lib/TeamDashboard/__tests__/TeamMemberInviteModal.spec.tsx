import { TeamAccessProfile } from '@jetstream/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// This lib has no vitest setup file, and the `@jetstream/ui` barrel pulls in the drag-and-drop powered
// expression builder, whose dependency reads `ResizeObserver` at module-evaluation time
vi.hoisted(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverShim {
      constructor(_callback?: ResizeObserverCallback) {}
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = ResizeObserverShim as unknown as typeof ResizeObserver;
  }
});

vi.mock('@jetstream/shared/data', () => ({ createInvitation: vi.fn() }));

const { TeamMemberInviteModal } = await import('../TeamMemberInviteModal');

function setup() {
  render(
    <TeamMemberInviteModal
      teamId="team-1"
      accessProfiles={[] as TeamAccessProfile[]}
      canAssignAccessProfile={false}
      userRole="ADMIN"
      seatGate={{ seats: null, hasManualBilling: false, canManageSeats: false, isPastDue: false, onBuySeats: vi.fn() }}
      ssoConfig={{ ssoEnabled: true, ssoProvider: 'SAML', ssoBypassEnabled: false, ssoBypassEnabledRoles: [] } as never}
      verifiedDomains={['acme.com']}
      onClose={vi.fn()}
    />,
  );
  return screen.getByRole('textbox', { name: /Email Address/ });
}

const SSO_WARNING = /not one of your verified domains/;

describe('TeamMemberInviteModal SSO warning', () => {
  it('waits for blur rather than flashing while the address is typed', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: 'person@other.com' } });
    expect(screen.queryByText(SSO_WARNING)).toBeNull();

    fireEvent.blur(input);
    expect(screen.getByText(SSO_WARNING)).toBeTruthy();
  });

  it('clears a stale warning when the address is edited', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: 'person@other.com' } });
    fireEvent.blur(input);
    expect(screen.getByText(SSO_WARNING)).toBeTruthy();

    fireEvent.change(input, { target: { value: 'person@acme.com' } });
    expect(screen.queryByText(SSO_WARNING)).toBeNull();
  });

  it('shows the warning when Enter submits while the field is still focused', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: 'person@other.com' } });

    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(screen.getByText(SSO_WARNING)).toBeTruthy();
  });
});
