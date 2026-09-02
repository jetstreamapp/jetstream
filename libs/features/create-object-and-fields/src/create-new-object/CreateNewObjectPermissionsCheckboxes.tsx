import { Checkbox, Icon, Tooltip } from '@jetstream/ui';
import { CreateObjectPermissions } from './create-object-types';
import { setSObjectPermissionDependencies } from './create-object-utils';

export interface CreateNewObjectPermissionsProps {
  /** Unique per rendered group — checkbox ids are keyed on it (labels can repeat across profiles/permission sets) */
  id: string;
  label: string;
  objectPermissions: CreateObjectPermissions;
  loading: boolean;
  onChange: (objectPermissions: CreateObjectPermissions) => void;
}

export const CreateNewObjectPermissionsCheckboxes = ({
  id,
  label,
  objectPermissions,
  loading,
  onChange,
}: CreateNewObjectPermissionsProps) => {
  const allSelected =
    objectPermissions.allowCreate &&
    objectPermissions.allowDelete &&
    objectPermissions.allowEdit &&
    objectPermissions.allowRead &&
    objectPermissions.modifyAllRecords &&
    objectPermissions.viewAllRecords &&
    objectPermissions.viewAllFields;

  const noneSelected =
    !objectPermissions.allowCreate &&
    !objectPermissions.allowDelete &&
    !objectPermissions.allowEdit &&
    !objectPermissions.allowRead &&
    !objectPermissions.modifyAllRecords &&
    !objectPermissions.viewAllRecords &&
    !objectPermissions.viewAllFields;

  function handleSelectAll(value: boolean) {
    onChange({
      allowCreate: value,
      allowDelete: value,
      allowEdit: value,
      allowRead: value,
      modifyAllRecords: value,
      viewAllRecords: value,
      viewAllFields: value,
    });
  }

  return (
    // The same seven checkboxes repeat for every profile / permission set — the fieldset gives each
    // checkbox its group context so "Allow Create" is announced with which profile it applies to
    <fieldset className="slds-form-element">
      <legend className="slds-form-element__legend slds-form-element__label">
        <h3 className="slds-text-heading_small slds-m-top_medium slds-m-bottom_x-small">
          {label}
          {noneSelected && (
            <Tooltip content="Choose at least one permission">
              <Icon
                className="slds-icon slds-icon_x-small slds-icon-text-warning slds-m-left_xx-small"
                type="utility"
                icon="warning"
                description="No permissions selected"
              />
            </Tooltip>
          )}
        </h3>
      </legend>
      <Checkbox
        id={`${id}-objectPermissions.selectAll`}
        label="Select All"
        className="slds-m-bottom_xx-small"
        checked={allSelected}
        onChange={handleSelectAll}
        disabled={loading}
      />
      <Checkbox
        id={`${id}-objectPermissions.allowCreate`}
        label="Allow Create"
        checked={objectPermissions.allowCreate}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'allowCreate', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${id}-objectPermissions.allowDelete`}
        label="Allow Delete"
        checked={objectPermissions.allowDelete}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'allowDelete', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${id}-objectPermissions.allowEdit`}
        label="Allow Edit"
        checked={objectPermissions.allowEdit}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'allowEdit', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${id}-objectPermissions.allowRead`}
        label="Allow Read"
        checked={objectPermissions.allowRead}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'allowRead', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${id}-objectPermissions.modifyAllRecords`}
        label="Modify All Records"
        checked={objectPermissions.modifyAllRecords}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'modifyAllRecords', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${id}-objectPermissions.viewAllRecords`}
        label="View All Records"
        checked={objectPermissions.viewAllRecords}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'viewAllRecords', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${id}-objectPermissions.viewAllFields`}
        label="View All Fields"
        checked={objectPermissions.viewAllFields}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'viewAllFields', value))}
        disabled={loading}
      />
    </fieldset>
  );
};
