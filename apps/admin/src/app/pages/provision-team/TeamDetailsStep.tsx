import { TeamBillingMode } from '@jetstream/admin/types';
import { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ENTITLEMENT_KEYS, ENTITLEMENT_LABELS } from '../../components/EntitlementList';
import { Alert } from '../../components/ErrorAlert';
import { classNames } from '../../utils/class-names';
import { ProvisionFormErrors, TeamFormState } from './provision-team.utils';

const INPUT_CLASS_NAME =
  'block w-full rounded-md border-0 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-blue-600 focus:ring-inset';

const BILLING_MODE_OPTIONS: Array<{ value: TeamBillingMode; title: string; description: string }> = [
  {
    value: 'STRIPE',
    title: 'Stripe subscription',
    description: 'Seats, billing status and entitlements sync from the subscription once the quote is accepted.',
  },
  {
    value: 'MANUAL',
    title: 'Manual billing',
    description: 'Billed outside Stripe subscriptions. You set the seat limit and entitlements here, and Stripe sync never changes them.',
  },
];

function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900">
        {label}
        <div className="mt-1">{children}</div>
      </label>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export interface TeamDetailsStepProps {
  form: TeamFormState;
  errors: ProvisionFormErrors;
  quoteSeatQuantity: number | null;
  onChange: (form: TeamFormState) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function TeamDetailsStep({ form, errors, quoteSeatQuantity, onChange, onBack, onContinue }: TeamDetailsStepProps) {
  const isManualBilling = form.billingMode === 'MANUAL';

  return (
    <div className="space-y-4">
      <Card title="Team details">
        <div className="max-w-xl space-y-5">
          <Field label="Team name" error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              className={INPUT_CLASS_NAME}
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium text-slate-900">Billing mode</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {BILLING_MODE_OPTIONS.map(({ value, title, description }) => (
                <label
                  key={value}
                  aria-label={title}
                  className={classNames(
                    'flex cursor-pointer gap-2 rounded-md p-3 ring-1',
                    form.billingMode === value ? 'bg-blue-50 ring-blue-600' : 'ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  <input
                    type="radio"
                    name="billingMode"
                    value={value}
                    checked={form.billingMode === value}
                    onChange={() => onChange({ ...form, billingMode: value })}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{title}</span>
                    <span className="block text-xs text-slate-500">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            label={isManualBilling ? 'Seat limit' : 'Seat limit (optional)'}
            error={errors.licenseCountLimit}
            hint={
              isManualBilling
                ? 'Required for manual billing. This is the enforced cap on active admins and members.'
                : `Caps seats until the subscription syncs, then Stripe's quantity replaces it.${
                    quoteSeatQuantity ? ` The quote has ${quoteSeatQuantity} seats.` : ''
                  } Leave empty for no cap.`
            }
          >
            <input
              type="number"
              min={1}
              step={1}
              value={form.licenseCountLimit}
              onChange={(event) => onChange({ ...form, licenseCountLimit: event.target.value })}
              className={classNames(INPUT_CLASS_NAME, 'max-w-40')}
            />
          </Field>

          {isManualBilling ? (
            <fieldset>
              <legend className="text-sm font-medium text-slate-900">Entitlements</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ENTITLEMENT_KEYS.map((entitlementKey) => (
                  <label key={entitlementKey} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.entitlements[entitlementKey]}
                      onChange={(event) =>
                        onChange({ ...form, entitlements: { ...form.entitlements, [entitlementKey]: event.target.checked } })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    {ENTITLEMENT_LABELS[entitlementKey]}
                  </label>
                ))}
              </div>
              {errors.entitlements && <p className="mt-1 text-xs text-red-700">{errors.entitlements}</p>}
            </fieldset>
          ) : (
            <Alert tone="info">Entitlements come from the Stripe subscription, so there is nothing to set here.</Alert>
          )}

          {errors.form && <Alert tone="error">{errors.form}</Alert>}
        </div>
      </Card>
      <div className="flex justify-between">
        <Button onClick={onBack}>Back</Button>
        <Button variant="primary" onClick={onContinue}>
          Review
        </Button>
      </div>
    </div>
  );
}
