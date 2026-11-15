import { css } from '@emotion/react';
import { createTeamAccessProfile, updateTeamAccessProfile } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  ACCESS_PROFILE_DESCRIPTION_MAX_LENGTH,
  ACCESS_PROFILE_NAME_MAX_LENGTH,
  ACCESS_PROFILE_OPERATIONS,
  ACCESS_PROFILE_SURFACES,
  ACCESS_PROFILE_TOOL_GROUPS,
  ACCESS_PROFILE_TOOLS,
  AccessProfileOperationKey,
  AccessProfilePolicyRequest,
  AccessProfilePolicyWarning,
  AccessProfileSurfaceKey,
  AccessProfileToolGroup,
  AccessProfileToolKey,
  FULL_ACCESS_POLICY,
  getAccessProfilePolicyWarnings,
  TeamAccessProfile,
  TeamUserFacing,
} from '@jetstream/types';
import { Checkbox, Input, Modal, ScopedNotification, Spinner, Textarea } from '@jetstream/ui';
import { useMemo, useState } from 'react';

interface TeamAccessProfileEditorModalProps {
  teamId: string;
  /** Omitted when creating a new profile */
  accessProfile?: TeamAccessProfile;
  onClose: (team?: TeamUserFacing) => void;
}

const sectionHeadingStyles = css`
  margin-top: 1rem;
  margin-bottom: 0.25rem;
`;

export function TeamAccessProfileEditorModal({ teamId, accessProfile, onClose }: TeamAccessProfileEditorModalProps) {
  const isNew = !accessProfile;
  const [name, setName] = useState(accessProfile?.name ?? '');
  const [description, setDescription] = useState(accessProfile?.description ?? '');
  const [isDefault, setIsDefault] = useState(accessProfile?.isDefault ?? false);
  const [policy, setPolicy] = useState<AccessProfilePolicyRequest>(
    // A new profile starts with everything selected so the admin only has to remove what members should not have
    accessProfile
      ? accessProfile.policy
      : { tools: FULL_ACCESS_POLICY.tools, operations: FULL_ACCESS_POLICY.operations, surfaces: FULL_ACCESS_POLICY.surfaces },
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const enabledTools = useMemo(() => new Set(policy.tools), [policy.tools]);
  const enabledOperations = useMemo(() => new Set(policy.operations), [policy.operations]);
  const enabledSurfaces = useMemo(() => new Set(policy.surfaces), [policy.surfaces]);
  const warnings = useMemo(() => getAccessProfilePolicyWarnings(policy), [policy]);
  const trimmedName = name.trim();
  const warningsFor = (target: AccessProfilePolicyWarning['target']) => warnings.filter((warning) => warning.target === target);

  function updatePolicy(nextPolicy: AccessProfilePolicyRequest) {
    setPolicy(nextPolicy);
  }

  /** Turning a tool on also turns on the operations it needs, turning it off leaves operations alone */
  function setToolsEnabled(tools: AccessProfileToolKey[], enabled: boolean) {
    const nextTools = new Set(policy.tools);
    const nextOperations = new Set(policy.operations);
    tools.forEach((tool) => {
      if (enabled) {
        nextTools.add(tool);
        ACCESS_PROFILE_TOOLS.find(({ key }) => key === tool)?.requiredOperations.forEach((operation) => nextOperations.add(operation));
      } else {
        nextTools.delete(tool);
      }
    });
    updatePolicy({ ...policy, tools: Array.from(nextTools), operations: Array.from(nextOperations) });
  }

  function setOperationEnabled(operation: AccessProfileOperationKey, enabled: boolean) {
    const nextOperations = new Set(policy.operations);
    if (enabled) {
      nextOperations.add(operation);
    } else {
      nextOperations.delete(operation);
    }
    updatePolicy({ ...policy, operations: Array.from(nextOperations) });
  }

  function setSurfaceEnabled(surface: AccessProfileSurfaceKey, enabled: boolean) {
    const nextSurfaces = new Set(policy.surfaces);
    if (enabled) {
      nextSurfaces.add(surface);
    } else {
      nextSurfaces.delete(surface);
    }
    updatePolicy({ ...policy, surfaces: Array.from(nextSurfaces) });
  }

  async function handleSave() {
    if (!trimmedName) {
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    try {
      const request = { name: trimmedName, description: description.trim() || null, isDefault, policy };
      const team = accessProfile
        ? await updateTeamAccessProfile(teamId, accessProfile.id, request)
        : await createTeamAccessProfile(teamId, request);
      onClose(team);
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex) || 'There was an error saving this access profile, try again or contact support for assistance.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      testId="team-access-profile-editor-modal"
      header={isNew ? 'New Access Profile' : 'Edit Access Profile'}
      tagline="Choose which Jetstream tools and actions members with this profile can use"
      size="lg"
      onClose={() => onClose()}
      footer={
        <>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            form="team-access-profile-editor-form"
            className="slds-button slds-button_brand slds-is-relative"
            disabled={!trimmedName || loading}
          >
            Save
            {loading && <Spinner className="slds-spinner slds-spinner_small" />}
          </button>
        </>
      }
    >
      <form
        id="team-access-profile-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        {errorMessage && <ScopedNotification theme="error">{errorMessage}</ScopedNotification>}
        <ScopedNotification theme="info" className="slds-m-bottom_small">
          Access profiles control what members see and can use in Jetstream, which keeps people focused and helps prevent mistakes. They are
          not a security control: a member's Salesforce permissions still decide what they can do in Salesforce.
        </ScopedNotification>

        {!accessProfile?.memberCount ? null : (
          <ScopedNotification theme="warning" className="slds-m-bottom_small">
            Changes apply to {accessProfile.memberCount} {accessProfile.memberCount === 1 ? 'member' : 'members'} the next time Jetstream
            checks their access. Open web sessions update when the tab is focused, the desktop app and browser extension can take a few
            hours.
          </ScopedNotification>
        )}

        <Input id="access-profile-name" label="Name" isRequired>
          <input
            id="access-profile-name"
            className="slds-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={ACCESS_PROFILE_NAME_MAX_LENGTH}
            disabled={loading}
            placeholder="e.g. Sales Operations"
            autoComplete="off"
            required
          />
        </Input>
        <Textarea id="access-profile-description" label="Description" className="slds-m-top_x-small">
          <textarea
            id="access-profile-description"
            className="slds-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={ACCESS_PROFILE_DESCRIPTION_MAX_LENGTH}
            disabled={loading}
            rows={2}
          />
        </Textarea>
        <Checkbox
          id="access-profile-default"
          className="slds-m-top_x-small"
          checked={isDefault}
          label="Default profile for new members"
          helpText="Used for invitations that do not choose a profile, and for people who join through your verified domain or single sign-on."
          disabled={loading}
          onChange={setIsDefault}
        />

        <h3 className="slds-text-heading_small" css={sectionHeadingStyles}>
          Tools
        </h3>
        <div
          css={css`
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
            gap: 0.5rem 1.5rem;
          `}
        >
          {ACCESS_PROFILE_TOOL_GROUPS.map((group) => (
            <ToolGroup key={group.key} group={group} enabledTools={enabledTools} disabled={loading} onChange={setToolsEnabled} />
          ))}
        </div>

        <h3 className="slds-text-heading_small" css={sectionHeadingStyles}>
          Actions
        </h3>
        <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">
          Actions that are turned off are hidden in every tool, for example the delete button in query results.
        </p>
        <InlineWarnings warnings={warningsFor('operations')} />
        {ACCESS_PROFILE_OPERATIONS.map(({ key, label, description }) => (
          <div key={key}>
            <Checkbox
              id={`access-profile-operation-${key}`}
              checked={enabledOperations.has(key)}
              label={label}
              helpText={description}
              disabled={loading}
              onChange={(checked) => setOperationEnabled(key, checked)}
            />
            <InlineWarnings warnings={warningsFor(key)} />
            {key === 'orgs.connect' && !enabledOperations.has(key) && (
              <InlineWarnings
                messages={[
                  'Members will not be able to add new Salesforce orgs, but can keep using, and re-authorize, the orgs they have already connected.',
                ]}
              />
            )}
          </div>
        ))}

        <h3 className="slds-text-heading_small" css={sectionHeadingStyles}>
          Which applications members can use
        </h3>
        <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">
          Jetstream refuses sign in to the desktop application and browser extension when they are turned off, and signs out members who are
          already signed in within a few hours. Turning off the web application still lets members sign in to it, but Jetstream refuses to
          connect it to Salesforce.
        </p>
        <InlineWarnings warnings={warningsFor('surfaces')} />
        {ACCESS_PROFILE_SURFACES.map(({ key, label, description }) => (
          <Checkbox
            key={key}
            id={`access-profile-surface-${key}`}
            checked={enabledSurfaces.has(key)}
            label={label}
            helpText={description}
            disabled={loading}
            onChange={(checked) => setSurfaceEnabled(key, checked)}
          />
        ))}
      </form>
    </Modal>
  );
}

function ToolGroup({
  group,
  enabledTools,
  disabled,
  onChange,
}: {
  group: { key: AccessProfileToolGroup; label: string };
  enabledTools: Set<AccessProfileToolKey>;
  disabled: boolean;
  onChange: (tools: AccessProfileToolKey[], enabled: boolean) => void;
}) {
  const tools = ACCESS_PROFILE_TOOLS.filter((tool) => tool.group === group.key);
  const enabledCount = tools.filter(({ key }) => enabledTools.has(key)).length;
  const toolKeys = tools.map(({ key }) => key);

  return (
    <div>
      <Checkbox
        id={`access-profile-tool-group-${group.key}`}
        labelClassName="slds-text-title_caps"
        checked={enabledCount === tools.length}
        indeterminate={enabledCount > 0 && enabledCount < tools.length}
        label={group.label}
        disabled={disabled}
        onChange={(checked) => onChange(toolKeys, checked)}
      />
      <div className="slds-p-left_medium">
        {tools.map(({ key, label, description, isEscapeHatch }) => (
          <Checkbox
            key={key}
            id={`access-profile-tool-${key}`}
            checked={enabledTools.has(key)}
            label={label}
            helpText={isEscapeHatch ? `${description}. Can change data even when actions are hidden.` : description}
            disabled={disabled}
            onChange={(checked) => onChange([key], checked)}
          />
        ))}
      </div>
    </div>
  );
}

/** Warnings sit beside the setting they describe so they are not lost below the fold of a long modal */
function InlineWarnings({ warnings = [], messages = [] }: { warnings?: AccessProfilePolicyWarning[]; messages?: string[] }) {
  const allMessages = [...warnings.map(({ message }) => message), ...messages];
  if (!allMessages.length) {
    return null;
  }
  return (
    <ScopedNotification theme="warning" className="slds-m-top_x-small slds-m-bottom_small">
      {allMessages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </ScopedNotification>
  );
}
