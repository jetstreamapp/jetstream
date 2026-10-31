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
  AccessProfileSurfaceKey,
  AccessProfileToolGroup,
  AccessProfileToolKey,
  getAccessProfilePolicyWarnings,
  TeamAccessProfile,
  TeamUserFacing,
} from '@jetstream/types';
import { ariaDisabledButtonProps, AssistiveStatus, Checkbox, Input, Modal, ScopedNotification, Spinner, Textarea } from '@jetstream/ui';
import { useMemo, useState } from 'react';
import { ACCESS_PROFILE_PRESETS } from './access-profile.utils';

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
    accessProfile ? accessProfile.policy : (ACCESS_PROFILE_PRESETS[0]?.policy ?? { tools: [], operations: [], surfaces: [] }),
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(isNew ? (ACCESS_PROFILE_PRESETS[0]?.id ?? null) : null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const enabledTools = useMemo(() => new Set(policy.tools), [policy.tools]);
  const enabledOperations = useMemo(() => new Set(policy.operations), [policy.operations]);
  const enabledSurfaces = useMemo(() => new Set(policy.surfaces), [policy.surfaces]);
  const warnings = useMemo(() => getAccessProfilePolicyWarnings(policy), [policy]);
  // The warning notice mounts with its text when a checkbox is toggled, which screen readers do not announce
  const warningAnnouncement = warnings.length ? `Warning: ${warnings.map(({ message }) => message).join(' ')}` : '';
  const trimmedName = name.trim();

  function updatePolicy(nextPolicy: AccessProfilePolicyRequest) {
    setPolicy(nextPolicy);
    setSelectedPresetId(null);
  }

  function applyPreset(presetId: string) {
    const preset = ACCESS_PROFILE_PRESETS.find(({ id }) => id === presetId);
    if (!preset) {
      return;
    }
    setPolicy(preset.policy);
    setSelectedPresetId(preset.id);
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
    // Enter in a field submits the form without going through Save's guarded click
    if (!trimmedName || loading) {
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
          {/* The form's onSubmit owns the save; aria-disabled keeps focus on Save while the save it started runs */}
          <button
            type="submit"
            form="team-access-profile-editor-form"
            className="slds-button slds-button_brand slds-is-relative"
            {...ariaDisabledButtonProps(!trimmedName || loading, () => {})}
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

        {isNew && (
          <fieldset className="slds-form-element slds-m-bottom_small">
            <legend className="slds-form-element__legend slds-form-element__label">Start from</legend>
            <div className="slds-form-element__control">
              <div className="slds-button-group" role="group">
                {ACCESS_PROFILE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={selectedPresetId === preset.id ? 'slds-button slds-button_brand' : 'slds-button slds-button_neutral'}
                    aria-pressed={selectedPresetId === preset.id}
                    title={preset.description}
                    aria-describedby={getPresetDescriptionId(preset.id)}
                    disabled={loading}
                    onClick={() => applyPreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {ACCESS_PROFILE_PRESETS.map(({ id, description }) => (
                <span key={id} id={getPresetDescriptionId(id)} className="slds-assistive-text">
                  {description}
                </span>
              ))}
            </div>
          </fieldset>
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
        {ACCESS_PROFILE_OPERATIONS.map(({ key, label, description }) => (
          <Checkbox
            key={key}
            id={`access-profile-operation-${key}`}
            checked={enabledOperations.has(key)}
            label={label}
            helpText={description}
            disabled={loading}
            onChange={(checked) => setOperationEnabled(key, checked)}
          />
        ))}

        <h3 className="slds-text-heading_small" css={sectionHeadingStyles}>
          Which applications members can use
        </h3>
        <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">
          Jetstream refuses sign in to the desktop application and browser extension when they are turned off, and signs out members who are
          already signed in within a few hours. Turning off the web application still lets members sign in to it, but Jetstream refuses to
          connect it to Salesforce.
        </p>
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

        <AssistiveStatus message={warningAnnouncement} />
        {warnings.length > 0 && (
          <ScopedNotification theme="warning" className="slds-m-top_small">
            <ul className="slds-list_dotted">
              {warnings.map(({ message }) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </ScopedNotification>
        )}
      </form>
    </Modal>
  );
}

function getPresetDescriptionId(presetId: string) {
  return `access-profile-preset-${presetId}-description`;
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
      <div className="slds-p-left_medium" role="group" aria-label={group.label}>
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
