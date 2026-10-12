import {
  EntitlementFlags,
  ProvisionTeamRequest,
  ProvisionTeamRequestSchema,
  StripeQuoteSummary,
  TeamSeatMode,
  UserListItem,
} from '@jetstream/admin/types';
import { BILLABLE_ROLES, TeamMemberRole } from '@jetstream/types';

export interface SelectedTeamMember {
  user: Pick<UserListItem, 'id' | 'email' | 'name'>;
  role: TeamMemberRole;
}

export interface TeamFormState {
  name: string;
  seatMode: TeamSeatMode;
  /** Kept as the raw input string so an empty field stays empty instead of becoming 0 */
  licenseCountLimit: string;
  entitlements: EntitlementFlags;
  members: SelectedTeamMember[];
}

export const DEFAULT_ENTITLEMENTS: EntitlementFlags = {
  chromeExtension: false,
  googleDrive: false,
  recordSync: false,
  desktop: false,
  analysisTools: false,
  salesforceCanvas: false,
};

export const INITIAL_TEAM_FORM: TeamFormState = {
  name: '',
  seatMode: 'SUBSCRIPTION',
  licenseCountLimit: '',
  entitlements: DEFAULT_ENTITLEMENTS,
  members: [],
};

export const SEAT_MODE_LABELS: Record<TeamSeatMode, string> = {
  SUBSCRIPTION: 'Follow the subscription',
  FIXED: 'Fixed by agreement',
};

type ProvisionFormField = 'name' | 'licenseCountLimit' | 'entitlements' | 'members';
export type ProvisionFormErrors = Partial<Record<ProvisionFormField | 'form', string>>;

const FORM_FIELDS = new Set<string>(['name', 'licenseCountLimit', 'entitlements', 'members']);

/** The first person added usually runs the team, so they start as an admin */
export function getDefaultRoleForNewMember(members: SelectedTeamMember[]): TeamMemberRole {
  return members.length === 0 ? 'ADMIN' : 'MEMBER';
}

export function countSeatsTaken(members: SelectedTeamMember[]): number {
  return members.filter(({ role }) => BILLABLE_ROLES.has(role)).length;
}

export function buildProvisionRequest({ customerId, quoteId, form }: { customerId: string; quoteId: string | null; form: TeamFormState }): {
  request: ProvisionTeamRequest | null;
  errors: ProvisionFormErrors;
} {
  const trimmedLimit = form.licenseCountLimit.trim();
  const parsedRequest = ProvisionTeamRequestSchema.safeParse({
    customerId,
    quoteId,
    name: form.name,
    seatMode: form.seatMode,
    licenseCountLimit: trimmedLimit ? Number(trimmedLimit) : null,
    entitlements: form.seatMode === 'FIXED' ? form.entitlements : null,
    members: form.members.map(({ user, role }) => ({ userId: user.id, role })),
  });

  const errors: ProvisionFormErrors = {};
  if (!parsedRequest.success) {
    parsedRequest.error.issues.forEach(({ path, message }) => {
      const [field] = path;
      const errorKey = typeof field === 'string' && FORM_FIELDS.has(field) ? (field as ProvisionFormField) : 'form';
      errors[errorKey] = errors[errorKey] ?? message;
    });
    return { request: null, errors };
  }

  // The API enforces this too; catching it here keeps the admin on the step where it can be fixed
  const { licenseCountLimit } = parsedRequest.data;
  const seatsTaken = countSeatsTaken(form.members);
  if (licenseCountLimit && seatsTaken > licenseCountLimit) {
    errors.members = `${seatsTaken} members take a seat but the seat limit is ${licenseCountLimit}. Raise the limit or make someone Billing.`;
    return { request: null, errors };
  }

  return { request: parsedRequest.data, errors };
}

export function getQuoteLabel({ number, id }: StripeQuoteSummary): string {
  return number ? `${number} (${id})` : id;
}
