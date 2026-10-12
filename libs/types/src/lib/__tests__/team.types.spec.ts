/**
 * Clients from before access profiles still send a legacy `features` array. The request schemas must keep
 * accepting (and dropping) it so those requests are not rejected while a deploy rolls out.
 */
import { describe, expect, it } from 'vitest';
import { TeamInvitationRequestSchema, TeamInvitationUpdateRequestSchema, TeamMemberUpdateRequestSchema } from '../team.types';

const LEGACY_FEATURES = ['ALL'];

describe('team request schemas', () => {
  it('accepts an invitation request with legacy features and drops them', () => {
    const parsed = TeamInvitationRequestSchema.parse({ email: 'Invitee@Example.com', role: 'MEMBER', features: LEGACY_FEATURES });

    expect(parsed).toEqual({ email: 'invitee@example.com', role: 'MEMBER' });
  });

  it('accepts an invitation update request with legacy features and drops them', () => {
    const parsed = TeamInvitationUpdateRequestSchema.parse({ role: 'ADMIN', features: LEGACY_FEATURES });

    expect(parsed).toEqual({ role: 'ADMIN' });
  });

  it('accepts a member update request with legacy features and drops them', () => {
    const parsed = TeamMemberUpdateRequestSchema.parse({ role: 'BILLING', features: LEGACY_FEATURES });

    expect(parsed).toEqual({ role: 'BILLING' });
  });
});
