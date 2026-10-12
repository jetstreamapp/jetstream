import { XMarkIcon } from '@heroicons/react/20/solid';
import { TeamSeatMode, UserListItem } from '@jetstream/admin/types';
import { TeamMemberRole } from '@jetstream/types';
import { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ENTITLEMENT_KEYS, ENTITLEMENT_LABELS } from '../../components/EntitlementList';
import { Alert } from '../../components/ErrorAlert';
import { TeamRoleSelect } from '../../components/TeamRoleSelect';
import { UserPicker } from '../../components/UserPicker';
import { classNames } from '../../utils/class-names';
import { countSeatsTaken, getDefaultRoleForNewMember, ProvisionFormErrors, SEAT_MODE_LABELS, TeamFormState } from './provision-team.utils';

const INPUT_CLASS_NAME =
  'block w-full rounded-md border-0 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-blue-600 focus:ring-inset';

/** Both modes invoice through Stripe and take entitlements from the subscription; they differ in who controls seats */
const SEAT_MODE_OPTIONS: Array<{ value: TeamSeatMode; description: string }> = [
  {
    value: 'SUBSCRIPTION',
    description:
      'The seat limit tracks the Stripe subscription quantity, and team admins can add or remove seats themselves. ' +
      'Billing status follows the subscription.',
  },
  {
    value: 'FIXED',
    description:
      'For an agreed number of licenses. You set the seat limit, team admins cannot change it, and Stripe sync leaves it alone. ' +
      'Billing status stays Manual, so the team is never marked past due.',
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
  const isFixedSeats = form.seatMode === 'FIXED';
  const selectedUserIds = new Set(form.members.map(({ user }) => user.id));

  function handleAddMember({ id, email, name }: UserListItem) {
    onChange({ ...form, members: [...form.members, { user: { id, email, name }, role: getDefaultRoleForNewMember(form.members) }] });
  }

  function handleMemberRoleChange(userId: string, role: TeamMemberRole) {
    onChange({ ...form, members: form.members.map((member) => (member.user.id === userId ? { ...member, role } : member)) });
  }

  function handleRemoveMember(userId: string) {
    onChange({ ...form, members: form.members.filter(({ user }) => user.id !== userId) });
  }

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
            <legend className="text-sm font-medium text-slate-900">Seats</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {SEAT_MODE_OPTIONS.map(({ value, description }) => (
                <label
                  key={value}
                  aria-label={SEAT_MODE_LABELS[value]}
                  className={classNames(
                    'flex cursor-pointer gap-2 rounded-md p-3 ring-1',
                    form.seatMode === value ? 'bg-blue-50 ring-blue-600' : 'ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  <input
                    type="radio"
                    name="seatMode"
                    value={value}
                    checked={form.seatMode === value}
                    onChange={() => onChange({ ...form, seatMode: value })}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{SEAT_MODE_LABELS[value]}</span>
                    <span className="block text-xs text-slate-500">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            label={isFixedSeats ? 'Seat limit' : 'Seat limit (optional)'}
            error={errors.licenseCountLimit}
            hint={
              isFixedSeats
                ? `Required for fixed seats. This is the enforced cap on active admins and members.${
                    quoteSeatQuantity ? ` The quote has ${quoteSeatQuantity} seats.` : ''
                  }`
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

          {isFixedSeats ? (
            <fieldset>
              <legend className="text-sm font-medium text-slate-900">Starting entitlements</legend>
              <p className="mt-0.5 text-xs text-slate-500">
                Gives the team access before the subscription exists. Once it starts, Stripe&apos;s entitlements replace these.
              </p>
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
      <Card
        title="Members (optional)"
        description="People who already have a Jetstream account, added straight to the team with no invitation or email. Anyone else can be invited from the team page afterwards."
      >
        <div className="max-w-2xl space-y-3">
          {form.members.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-md ring-1 ring-slate-200">
              {form.members.map(({ user, role }) => (
                <li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-slate-900">{user.email}</span>
                    {user.name && <span className="text-slate-500"> · {user.name}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <TeamRoleSelect value={role} onChange={(nextRole) => handleMemberRoleChange(user.id, nextRole)} />
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveMember(user.id)} aria-label={`Remove ${user.email}`}>
                      <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {form.members.length > 0 && (
            <p className="text-xs text-slate-500">
              {countSeatsTaken(form.members)} of {form.members.length} take a seat. Billing members do not.
            </p>
          )}
          <UserPicker selectedUserIds={selectedUserIds} onSelect={handleAddMember} />
          {errors.members && <Alert tone="error">{errors.members}</Alert>}
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
