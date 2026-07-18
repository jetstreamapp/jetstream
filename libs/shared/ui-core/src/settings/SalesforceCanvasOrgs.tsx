import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCanvasOrg,
  createTeamCanvasOrg,
  deleteCanvasOrg,
  deleteTeamCanvasOrg,
  getCanvasOrgs,
  getTeamCanvasOrgs,
} from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  CreateSalesforceCanvasOrgRequest,
  CreateSalesforceCanvasOrgRequestSchema,
  ListItem,
  SALESFORCE_CANVAS_ORG_LIMIT,
  SalesforceCanvasOrg,
} from '@jetstream/types';
import {
  Card,
  ConfirmationModalPromise,
  fireToast,
  Grid,
  GridCol,
  Icon,
  Input,
  Modal,
  Picklist,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

/**
 * Best-effort parse of the "My Domain" base from a connected org's instance URL, so we can prefill the
 * form. Mirrors the server's parseMyDomainBase; the field stays editable if the URL is unusual.
 *   https://acme.my.salesforce.com               -> "acme"
 *   https://acme--uat.sandbox.my.salesforce.com  -> "acme"
 */
function parseMyDomainBaseFromInstanceUrl(instanceUrl: string): string {
  try {
    const { hostname } = new URL(instanceUrl);
    const [subdomain] = hostname.split('.');
    return subdomain?.split('--')[0] ?? '';
  } catch {
    return '';
  }
}

/** Whether this card manages the current user's personal orgs or a team's shared orgs. */
export type CanvasOrgScope = { type: 'user' } | { type: 'team'; teamId: string };

interface SalesforceCanvasOrgsProps {
  scope: CanvasOrgScope;
  /** When false, the card is view-only (no authorize/remove actions) — e.g. a non-admin team member. */
  canManage?: boolean;
}

/**
 * Self-contained card for managing the Salesforce orgs authorized to load the Jetstream Canvas app.
 * Rendered on the personal Settings page (user scope) and the Team Dashboard (team scope); the backing
 * data functions are selected from `scope`.
 */
export function SalesforceCanvasOrgs({ scope, canManage = true }: SalesforceCanvasOrgsProps) {
  const teamId = scope.type === 'team' ? scope.teamId : null;
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<SalesforceCanvasOrg[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const loadOrgs = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingError(null);
      const results = teamId ? await getTeamCanvasOrgs(teamId) : await getCanvasOrgs();
      setOrgs(results);
    } catch (ex) {
      setLoadingError(getErrorMessage(ex));
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const atLimit = orgs.length >= SALESFORCE_CANVAS_ORG_LIMIT;

  // Errors intentionally propagate to the modal so they render inline — a toast would be hidden behind
  // the modal overlay.
  async function handleAdd(payload: CreateSalesforceCanvasOrgRequest) {
    const created = teamId ? await createTeamCanvasOrg(teamId, payload) : await createCanvasOrg(payload);
    setOrgs((prior) => [...prior, created]);
    setAddModalOpen(false);
    fireToast({ type: 'success', message: 'Org authorized for the Managed Package' });
  }

  async function handleDelete(org: SalesforceCanvasOrg) {
    if (
      await ConfirmationModalPromise({
        header: 'Remove authorized org',
        content: `Remove ${org.orgName || org.organizationId}? This org (and its sandboxes) will no longer be able to use the Managed Package.`,
      })
    ) {
      try {
        if (teamId) {
          await deleteTeamCanvasOrg(teamId, org.id);
        } else {
          await deleteCanvasOrg(org.id);
        }
        setOrgs((prior) => prior.filter((item) => item.id !== org.id));
        fireToast({ type: 'success', message: 'Org removed' });
      } catch (ex) {
        fireToast({ type: 'error', message: getErrorMessage(ex) });
      }
    }
  }

  return (
    <Card
      title="Salesforce Managed Package Authorized Orgs"
      className="slds-m-bottom_medium slds-card_boundary"
      icon={{ type: 'standard', icon: 'connected_apps' }}
      actions={
        canManage ? (
          <button
            className="slds-button slds-button_neutral"
            type="button"
            disabled={atLimit}
            title={atLimit ? `You have reached the limit of ${SALESFORCE_CANVAS_ORG_LIMIT} orgs` : undefined}
            onClick={() => setAddModalOpen(true)}
          >
            Authorize Org
          </button>
        ) : undefined
      }
    >
      {loading && <Spinner />}
      {loadingError && (
        <ScopedNotification theme="error" className="slds-m-vertical_small">
          {loadingError}
        </ScopedNotification>
      )}
      {!loading && !loadingError && (
        <>
          <p className="slds-text-color_weak slds-m-bottom_small">
            Authorize your production org id and My Domain so it can load the Jetstream Managed Package. All sandboxes that share the same
            My Domain are covered automatically.
          </p>
          {orgs.length === 0 ? (
            <p className="slds-text-color_weak">No orgs are authorized yet.</p>
          ) : (
            <ul className="slds-list">
              {orgs.map((org, index) => (
                <li key={org.id} className={index > 0 ? 'slds-p-top_x-small' : undefined}>
                  <Grid verticalAlign="center">
                    <GridCol className="slds-col">
                      <div>
                        <strong>{org.orgName || org.organizationId}</strong>
                      </div>
                      <div className="slds-text-body_small slds-text-color_weak">
                        {org.organizationId}
                        {org.myDomainBase ? ` · ${org.myDomainBase}.my.salesforce.com` : ''}
                      </div>
                    </GridCol>
                    {canManage && (
                      <GridCol bump="left">
                        <button
                          className="slds-button slds-button_icon slds-button_icon-border-filled"
                          type="button"
                          title="Remove"
                          onClick={() => handleDelete(org)}
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
        </>
      )}

      {addModalOpen && <AddCanvasOrgModal onClose={() => setAddModalOpen(false)} onSave={handleAdd} />}
    </Card>
  );
}

function AddCanvasOrgModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (payload: CreateSalesforceCanvasOrgRequest) => Promise<void>;
}) {
  const connectedOrgs = useAtomValue(fromAppState.salesforceOrgsState);
  const [saveError, setSaveError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(CreateSalesforceCanvasOrgRequestSchema),
    defaultValues: { organizationId: '', myDomainBase: '', orgName: '' },
  });

  async function handleSave(values: CreateSalesforceCanvasOrgRequest) {
    setSaveError(null);
    try {
      await onSave(values);
    } catch (ex) {
      setSaveError(getErrorMessage(ex));
    }
  }

  const connectedOrgItems = useMemo<ListItem[]>(
    () =>
      connectedOrgs.map((org) => ({
        id: org.uniqueId,
        label: org.label,
        secondaryLabel: org.orgIsSandbox ? 'Sandbox' : 'Production',
        value: org.uniqueId,
      })),
    [connectedOrgs],
  );

  function handlePrefillFromOrg(selectedItems: ListItem[]) {
    const selectedOrg = connectedOrgs.find((org) => org.uniqueId === selectedItems[0]?.id);
    if (!selectedOrg) {
      return;
    }
    setValue('organizationId', selectedOrg.organizationId, { shouldValidate: true, shouldDirty: true });
    setValue('myDomainBase', parseMyDomainBaseFromInstanceUrl(selectedOrg.instanceUrl), { shouldValidate: true, shouldDirty: true });
    setValue('orgName', selectedOrg.orgName || selectedOrg.label, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <Modal
      header="Authorize an Org"
      onClose={onClose}
      footer={
        <>
          <button className="slds-button slds-button_neutral" type="button" onClick={onClose}>
            Cancel
          </button>
          <button form="canvas-org-form" className="slds-button slds-button_brand" type="submit" disabled={isSubmitting}>
            Authorize
          </button>
        </>
      }
    >
      <form id="canvas-org-form" onSubmit={handleSubmit(handleSave)}>
        {saveError && (
          <ScopedNotification theme="error" className="slds-m-bottom_small">
            {saveError}
          </ScopedNotification>
        )}
        {connectedOrgItems.length > 0 && (
          <>
            <Picklist
              className="slds-m-bottom_x-small"
              label="Prefill from a connected org"
              placeholder="Select a connected org"
              helpText="Optional: fills in the fields below from an org you've already connected. You can still edit them."
              items={connectedOrgItems}
              allowDeselection
              onChange={handlePrefillFromOrg}
            />
            <p className="slds-m-bottom_small slds-text-color_weak slds-text-body_small">Or enter the details manually.</p>
          </>
        )}
        <Input
          label="Production Organization Id"
          errorMessage={errors.organizationId?.message}
          hasError={!!errors.organizationId}
          isRequired
        >
          <input className="slds-input" type="text" {...register('organizationId')} placeholder="00Dxxxxxxxxxxxxxxx" />
        </Input>
        <Input
          className="slds-m-top_small"
          label="My Domain"
          errorMessage={errors.myDomainBase?.message}
          hasError={!!errors.myDomainBase}
          isRequired
        >
          <input className="slds-input" type="text" {...register('myDomainBase')} placeholder="acme" />
        </Input>
        <Input className="slds-m-top_small" label="Label (optional)" errorMessage={errors.orgName?.message} hasError={!!errors.orgName}>
          <input className="slds-input" type="text" {...register('orgName')} placeholder="Acme Production" />
        </Input>
        <p className="slds-m-top_small slds-text-color_weak">
          Enter your production org id and just the My Domain name (for example, <code>acme</code> for <code>acme.my.salesforce.com</code>).
          All sandboxes that share this My Domain will be able to use the Managed Package.
        </p>
      </form>
    </Modal>
  );
}
