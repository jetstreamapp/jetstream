import { CheckIcon } from '@heroicons/react/20/solid';
import { ProvisioningLookupResult, ProvisionTeamRequest, ProvisionTeamResponse, StripeCustomerSummary } from '@jetstream/admin/types';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiPost, useApiQuery } from '../../api/admin-api-client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EntitlementList } from '../../components/EntitlementList';
import { Alert, ErrorAlert } from '../../components/ErrorAlert';
import { StripeIdLink } from '../../components/ExternalLink';
import { KeyValueList } from '../../components/KeyValueList';
import { PageHeader } from '../../components/PageHeader';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { classNames } from '../../utils/class-names';
import { EMPTY_VALUE, formatNumber, getStripeDashboardUrl } from '../../utils/format';
import type { TeamDetailLocationState } from '../team-detail/TeamDetailPage';
import { CustomerReviewStep } from './CustomerReviewStep';
import { CustomerSearchStep } from './CustomerSearchStep';
import { buildProvisionRequest, getQuoteLabel, INITIAL_TEAM_FORM, ProvisionFormErrors, TeamFormState } from './provision-team.utils';
import { TeamDetailsStep } from './TeamDetailsStep';

type WizardStep = 'customer' | 'review-customer' | 'team-details' | 'confirm';

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: 'customer', label: 'Find customer' },
  { id: 'review-customer', label: 'Customer and quote' },
  { id: 'team-details', label: 'Team details' },
  { id: 'confirm', label: 'Review and create' },
];

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = STEPS.findIndex(({ id }) => id === currentStep);
  return (
    <ol className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {STEPS.map(({ id, label }, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={id} className="flex items-center gap-2">
            <span
              className={classNames(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                isComplete && 'bg-blue-600 text-white',
                isCurrent && 'bg-white text-blue-700 ring-2 ring-blue-600',
                !isComplete && !isCurrent && 'bg-white text-slate-500 ring-1 ring-slate-300',
              )}
            >
              {isComplete ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </span>
            <span className={isCurrent ? 'font-medium text-slate-900' : 'text-slate-500'}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ProvisionTeamPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('customer');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [form, setForm] = useState<TeamFormState>(INITIAL_TEAM_FORM);
  const [formErrors, setFormErrors] = useState<ProvisionFormErrors>({});
  const [validatedRequest, setValidatedRequest] = useState<ProvisionTeamRequest | null>(null);

  const lookupPath = customerId
    ? `/api/provisioning/${encodeURIComponent(customerId)}${selectedQuoteId ? `?${new URLSearchParams({ quoteId: selectedQuoteId }).toString()}` : ''}`
    : null;
  const {
    data: lookup,
    error: lookupError,
    loading: lookupLoading,
    reload: reloadLookup,
  } = useApiQuery<ProvisioningLookupResult>(lookupPath);
  // The lookup hook keeps the previous customer's data while loading, so only trust it when it matches the selection
  const currentLookup = lookup && lookup.customer.id === customerId ? lookup : null;
  const selectedQuote = currentLookup?.quotes.find(({ id }) => id === selectedQuoteId) ?? null;

  const {
    run: provisionTeam,
    loading: provisioning,
    error: provisionError,
  } = useAsyncAction((request: ProvisionTeamRequest) => apiPost<ProvisionTeamResponse>('/api/teams', request));

  function handleSelectCustomer(customer: StripeCustomerSummary, quoteId: string | null) {
    setCustomerId(customer.id);
    setSelectedQuoteId(quoteId);
    setForm(INITIAL_TEAM_FORM);
    setFormErrors({});
    setStep('review-customer');
  }

  function handleContinueToTeamDetails() {
    if (!currentLookup) {
      return;
    }
    setForm((previousForm) => ({
      ...previousForm,
      name: previousForm.name || currentLookup.suggestedTeamName,
      licenseCountLimit: previousForm.licenseCountLimit || (selectedQuote?.teamSeatQuantity ? String(selectedQuote.teamSeatQuantity) : ''),
    }));
    setStep('team-details');
  }

  function handleContinueToConfirm() {
    if (!customerId) {
      return;
    }
    const { request, errors } = buildProvisionRequest({ customerId, quoteId: selectedQuoteId, form });
    setFormErrors(errors);
    if (request) {
      setValidatedRequest(request);
      setStep('confirm');
    }
  }

  async function handleCreateTeam() {
    if (!validatedRequest) {
      return;
    }
    const response = await provisionTeam(validatedRequest);
    if (response) {
      const locationState: TeamDetailLocationState = { provisionResult: response };
      navigate(`/teams/${response.teamId}`, { state: locationState });
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/teams" className="hover:underline">
            Teams
          </Link>
        }
        title="Provision team"
        subtitle="Create a team in Jetstream and link it to an existing Stripe customer. No email is sent."
      />
      <StepIndicator currentStep={step} />

      {step === 'customer' && <CustomerSearchStep onSelect={handleSelectCustomer} />}

      {step === 'review-customer' && (
        <CustomerReviewStep
          lookup={currentLookup}
          loading={lookupLoading}
          error={lookupError}
          selectedQuoteId={selectedQuoteId}
          onSelectQuote={setSelectedQuoteId}
          onRetry={reloadLookup}
          onBack={() => setStep('customer')}
          onContinue={handleContinueToTeamDetails}
        />
      )}

      {step === 'team-details' && (
        <TeamDetailsStep
          form={form}
          errors={formErrors}
          quoteSeatQuantity={selectedQuote?.teamSeatQuantity ?? null}
          onChange={setForm}
          onBack={() => setStep('review-customer')}
          onContinue={handleContinueToConfirm}
        />
      )}

      {step === 'confirm' && validatedRequest && (
        <div className="space-y-4">
          <Card title="Review">
            <KeyValueList
              items={[
                { label: 'Team name', value: validatedRequest.name },
                {
                  label: 'Stripe customer',
                  value: (
                    <span>
                      {currentLookup?.customer.name || currentLookup?.customer.email || EMPTY_VALUE}{' '}
                      <StripeIdLink id={validatedRequest.customerId} href={getStripeDashboardUrl(validatedRequest.customerId)} />
                    </span>
                  ),
                },
                {
                  label: 'Quote',
                  value: selectedQuote ? (
                    <StripeIdLink id={getQuoteLabel(selectedQuote)} href={getStripeDashboardUrl(selectedQuote.id)} />
                  ) : (
                    'None'
                  ),
                },
                { label: 'Billing mode', value: validatedRequest.billingMode === 'MANUAL' ? 'Manual billing' : 'Stripe subscription' },
                {
                  label: 'Seat limit',
                  value: validatedRequest.licenseCountLimit
                    ? formatNumber(validatedRequest.licenseCountLimit)
                    : 'No cap until the subscription syncs',
                },
                {
                  label: 'Entitlements',
                  value:
                    validatedRequest.billingMode === 'MANUAL' && validatedRequest.entitlements ? (
                      <EntitlementList entitlements={validatedRequest.entitlements} />
                    ) : (
                      'From the Stripe subscription'
                    ),
                },
              ]}
            />
          </Card>
          <Alert tone="info" title="What happens next">
            <ul className="list-disc space-y-1 pl-4">
              <li>The team, its billing account and default login settings are created in one transaction.</li>
              <li>
                The Stripe customer is tagged with the new team id, so the subscription syncs to this team when the quote is accepted.
              </li>
              <li>No email is sent. Invite the first admin from the team page when you are ready.</li>
            </ul>
          </Alert>
          {provisionError && <ErrorAlert error={provisionError} title="Team not created" />}
          <div className="flex justify-between">
            <Button onClick={() => setStep('team-details')} disabled={provisioning}>
              Back
            </Button>
            <Button variant="primary" onClick={handleCreateTeam} loading={provisioning}>
              Create team
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
