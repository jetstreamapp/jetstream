import { zodResolver } from '@hookform/resolvers/zod';
import { BLOCKED_PUBLIC_EMAIL_DOMAINS } from '@jetstream/shared/constants';
import { deleteDomainVerification, saveDomainVerification, verifyDomain } from '@jetstream/shared/data';
import { saveFile } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { DomainVerification } from '@jetstream/types';
import { Badge, Card, ConfirmationModalPromise, FeedbackLink, fireToast, Grid, GridCol, Icon, Input, Modal, Spinner } from '@jetstream/ui';
import { abilityState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';

interface TeamDomainConfigurationProps {
  teamId: string;
  domains: DomainVerification[];
  hasSsoEnabled: boolean;
  onChange: (action: 'ADD' | 'VERIFY' | 'DELETE', domain: DomainVerification) => void;
}

export function TeamDomainConfiguration({ teamId, domains, hasSsoEnabled, onChange }: TeamDomainConfigurationProps) {
  const [addDomainModalOpen, setAddDomainModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState<DomainVerification | null>(null);
  const ability = useAtomValue(abilityState);

  const pendingDomains = domains.filter(({ status }) => status === 'PENDING');
  const verifiedDomains = domains.filter(({ status }) => status === 'VERIFIED');
  const verifiedDomainCount = verifiedDomains.length;

  const canUpdate = ability.can('update', 'DomainConfiguration');
  const canDelete = ability.can('delete', 'DomainConfiguration');

  async function handleAddDomain(domain: string) {
    try {
      const pendingVerification = await saveDomainVerification(teamId, domain);
      setAddDomainModalOpen(false);
      setVerifyModalOpen(pendingVerification);
      onChange('ADD', pendingVerification);
      fireToast({ type: 'success', message: 'Domain verification request created' });
    } catch (ex) {
      fireToast({ type: 'error', message: getErrorMessage(ex) });
    }
  }

  async function handleDelete(domain: DomainVerification) {
    if (
      await ConfirmationModalPromise({
        content: 'Are you sure you want to delete this domain?',
      })
    ) {
      try {
        await deleteDomainVerification(teamId, domain.id);
        // loadVerifications();
        fireToast({ type: 'success', message: 'Domain deleted successfully' });
        onChange('DELETE', domain);
      } catch (ex) {
        fireToast({ type: 'error', message: getErrorMessage(ex) });
      }
    }
  }

  async function handleVerify(domain: DomainVerification) {
    setVerifyModalOpen(null);
    onChange('VERIFY', domain);
  }

  return (
    <Card
      title="Domain Management"
      className="slds-m-bottom_medium slds-card_boundary"
      icon={{ type: 'standard', icon: 'people' }}
      actions={
        canUpdate ? (
          <button className="slds-button slds-button_neutral" type="button" onClick={() => setAddDomainModalOpen(true)}>
            Add Domain
          </button>
        ) : undefined
      }
    >
      <div className="">
        {verifiedDomains.length === 0 ? (
          <p className="slds-text-color_weak">
            You don't have any verified domains. Setting up a verified domain is required to enable Single-Sign On.
          </p>
        ) : (
          <ul className="slds-list">
            {verifiedDomains.map((domain) => (
              <li key={domain.id}>
                <Grid verticalAlign="center">
                  <Grid verticalAlign="center">
                    <Badge type="success" className="slds-m-right_small">
                      Verified
                    </Badge>
                    <strong>{domain.domain}</strong>
                  </Grid>
                  {canDelete && (!hasSsoEnabled || verifiedDomainCount > 1) && (
                    <GridCol bump="left">
                      <button
                        className="slds-button slds-button_icon slds-button_icon-border-filled"
                        type="button"
                        onClick={() => handleDelete(domain)}
                      >
                        <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
                      </button>
                    </GridCol>
                  )}
                </Grid>
              </li>
            ))}
          </ul>
        )}

        {pendingDomains.length > 0 && (
          <ul className="slds-list">
            {pendingDomains.map((domain) => (
              <li key={domain.id}>
                <Grid verticalAlign="center">
                  <GridCol className="slds-col">
                    <Grid verticalAlign="center">
                      <Badge type="default" className="slds-m-right_small">
                        Pending Verification
                      </Badge>
                      <strong>{domain.domain}</strong>
                    </Grid>
                  </GridCol>
                  {canUpdate && (
                    <GridCol bump="left">
                      <button
                        className="slds-button slds-button_neutral slds-m-right_x-small"
                        type="button"
                        onClick={() => setVerifyModalOpen(domain)}
                      >
                        Verify
                      </button>
                      <button
                        className="slds-button slds-button_icon slds-button_icon-border-filled"
                        type="button"
                        onClick={() => handleDelete(domain)}
                      >
                        <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
                      </button>
                    </GridCol>
                  )}
                </Grid>
              </li>
            ))}
          </ul>
        )}
      </div>

      {addDomainModalOpen && <AddDomainModal onClose={() => setAddDomainModalOpen(false)} onSave={handleAddDomain} />}

      {verifyModalOpen && (
        <VerifyDomainModal
          teamId={teamId}
          verification={verifyModalOpen}
          onClose={(verified) => (verified ? handleVerify(verifyModalOpen) : setVerifyModalOpen(null))}
        />
      )}
    </Card>
  );
}

const FormSchema = z.object({
  domain: z
    .string()
    .toLowerCase()
    .min(1)
    .max(255)
    .regex(z.regexes.domain, { error: 'Invalid domain format' })
    .refine((domain) => !BLOCKED_PUBLIC_EMAIL_DOMAINS.has(domain), {
      message: 'Public email provider domains cannot be claimed for SSO verification',
    }),
});

function AddDomainModal({ onClose, onSave }: { onClose: () => void; onSave: (domain: string) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: { domain: '' },
  });

  return (
    <Modal
      header="Add Domain"
      onClose={onClose}
      footer={
        <>
          <button className="slds-button slds-button_neutral" type="button" onClick={onClose}>
            Cancel
          </button>
          <button form="domain-form" className="slds-button slds-button_brand" type="submit">
            Continue
          </button>
        </>
      }
    >
      <form id="domain-form" onSubmit={handleSubmit(({ domain }) => onSave(domain))}>
        <Input label="Domain" errorMessage={errors.domain?.message} hasError={!!errors.domain} errorMessageId="domain-error" isRequired>
          <input className="slds-input" type="text" {...register('domain')} placeholder="example.com" />
        </Input>
        <div className="slds-m-top_small">
          <p>To verify ownership of your domain, you will need to add a DNS TXT record or have a publicly accessible file on the domain.</p>
          <p>Specific instructions will be provided in the next step.</p>
        </div>
      </form>
    </Modal>
  );
}

function VerifyDomainModal({
  teamId,
  verification,
  onClose,
}: {
  teamId: string;
  verification: DomainVerification;
  onClose: (verified?: boolean) => void;
}) {
  const [loading, setIsLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string>();

  async function handleVerify() {
    try {
      setIsLoading(true);
      const result = await verifyDomain(teamId, verification.id);
      if (result.success && result.verification) {
        fireToast({ type: 'success', message: 'Domain verified successfully' });
        onClose(true);
      } else {
        setVerificationMessage(result.message || 'Verification failed');
      }
    } catch (ex) {
      setVerificationMessage(getErrorMessage(ex));
    } finally {
      setIsLoading(false);
    }
  }

  function downloadTxtFile() {
    saveFile(`${verification.verificationCode}`, 'jetstream-verification', 'text/plain;charset=utf-8');
  }

  return (
    <Modal
      header={`Verify ${verification.domain}`}
      onClose={onClose}
      footer={
        <Grid align="spread" verticalAlign="center">
          <FeedbackLink
            label="Need Help?"
            type="EMAIL"
            omitInNewWindowIcon
            emailLinkParams={{ subject: `Help with domain verification: ${verification.domain}` }}
          />
          <div>
            <button key="cancel" className="slds-button slds-button_neutral" type="button" onClick={() => onClose()}>
              Cancel
            </button>
            <button key="verify" className="slds-button slds-button_brand slds-is-relative" type="button" onClick={handleVerify}>
              {loading && <Spinner size="x-small" />}
              Check Verification
            </button>
          </div>
        </Grid>
      }
    >
      <p>
        To verify ownership of <strong>{verification.domain}</strong>, add a DNS{' '}
        <strong>
          <code>TXT</code>
        </strong>{' '}
        record to your domain with the following value:
      </p>
      <code className="slds-box slds-theme_shade slds-m-vertical_small slds-show">{verification.verificationCode}</code>
      <p>
        Add this{' '}
        <strong>
          <code>TXT</code>
        </strong>{' '}
        record either on the root domain{' '}
        <strong>
          <code>{verification.domain}</code>
        </strong>{' '}
        or on the subdomain{' '}
        <strong>
          <code>_jetstream.{verification.domain}</code>
        </strong>
        .
      </p>
      <p className="slds-m-top_x-small">
        DNS records may take some time to propagate, you may need to wait before verification is successful.
      </p>
      <hr />
      <p>Alternatively, you can host a file at either of the following URLs which contains the code:</p>
      <code className="slds-box slds-theme_shade slds-m-vertical_small slds-show">
        https://{verification.domain}/.well-known/jetstream-verification.txt
      </code>
      <code className="slds-box slds-theme_shade slds-m-vertical_small slds-show">
        https://_jetstream.{verification.domain}/.well-known/jetstream-verification.txt
      </code>
      <button className="slds-button" type="button" onClick={downloadTxtFile}>
        Download Verification File
      </button>
      {verificationMessage && <p className="slds-text-color_error slds-m-top_small">{verificationMessage}</p>}
    </Modal>
  );
}
