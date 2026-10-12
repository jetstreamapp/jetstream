import {
  EntitlementFlags,
  ProvisionTeamRequest,
  ProvisionTeamRequestSchema,
  StripeQuoteSummary,
  TeamBillingMode,
} from '@jetstream/admin/types';

export interface TeamFormState {
  name: string;
  billingMode: TeamBillingMode;
  /** Kept as the raw input string so an empty field stays empty instead of becoming 0 */
  licenseCountLimit: string;
  entitlements: EntitlementFlags;
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
  billingMode: 'STRIPE',
  licenseCountLimit: '',
  entitlements: DEFAULT_ENTITLEMENTS,
};

export type ProvisionFormErrors = Partial<Record<'name' | 'licenseCountLimit' | 'entitlements' | 'form', string>>;

export function buildProvisionRequest({ customerId, quoteId, form }: { customerId: string; quoteId: string | null; form: TeamFormState }): {
  request: ProvisionTeamRequest | null;
  errors: ProvisionFormErrors;
} {
  const trimmedLimit = form.licenseCountLimit.trim();
  const parsedRequest = ProvisionTeamRequestSchema.safeParse({
    customerId,
    quoteId,
    name: form.name,
    billingMode: form.billingMode,
    licenseCountLimit: trimmedLimit ? Number(trimmedLimit) : null,
    entitlements: form.billingMode === 'MANUAL' ? form.entitlements : null,
  });

  if (parsedRequest.success) {
    return { request: parsedRequest.data, errors: {} };
  }

  const errors: ProvisionFormErrors = {};
  parsedRequest.error.issues.forEach(({ path, message }) => {
    const [field] = path;
    if (field === 'name' || field === 'licenseCountLimit' || field === 'entitlements') {
      errors[field] = errors[field] ?? message;
    } else {
      errors.form = errors.form ?? message;
    }
  });
  return { request: null, errors };
}

export function getQuoteLabel({ number, id }: StripeQuoteSummary): string {
  return number ? `${number} (${id})` : id;
}
