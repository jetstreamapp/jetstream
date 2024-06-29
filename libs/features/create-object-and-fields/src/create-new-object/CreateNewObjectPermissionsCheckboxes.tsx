import { Checkbox, Icon, Tooltip } from '@jetstream/ui';
import { CreateObjectPermissions } from './create-object-types';
import { setSObjectPermissionDependencies } from './create-object-utils';

export interface CreateNewObjectPermissionsProps {
  label: string;
  objectPermissions: CreateObjectPermissions;
  loading: boolean;
  onChange: (objectPermissions: CreateObjectPermissions) => void;
}

export const CreateNewObjectPermissionsCheckboxes = ({ label, objectPermissions, loading, onChange }: CreateNewObjectPermissionsProps) => {
  const allSelected =
    objectPermissions.allowCreate &&
    objectPermissions.allowDelete &&
    objectPermissions.allowEdit &&
    objectPermissions.allowRead &&
    objectPermissions.modifyAllRecords &&
    objectPermissions.viewAllRecords;

  const noneSelected =
    !objectPermissions.allowCreate &&
    !objectPermissions.allowDelete &&
    !objectPermissions.allowEdit &&
    !objectPermissions.allowRead &&
    !objectPermissions.modifyAllRecords &&
    !objectPermissions.viewAllRecords;

  function handleSelectAll(value: boolean) {
    onChange({
      allowCreate: value,
      allowDelete: value,
      allowEdit: value,
      allowRead: value,
      modifyAllRecords: value,
      viewAllRecords: value,
    });
  }

  return (
    <>
      <div>
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
        <Checkbox
          id={`${label}-objectPermissions.selectAll`}
          label="Select All"
          className="slds-m-bottom_xx-small"
          checked={allSelected}
          onChange={handleSelectAll}
          disabled={loading}
        />
      </div>
      <Checkbox
        id={`${label}-objectPermissions.allowCreate`}
        label="Allow Create"
        checked={objectPermissions.allowCreate}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'allowCreate', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${label}-objectPermissions.allowDelete`}
        label="Allow Delete"
        checked={objectPermissions.allowDelete}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'allowDelete', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${label}-objectPermissions.allowEdit`}
        label="Allow Edit"
        checked={objectPermissions.allowEdit}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'allowEdit', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${label}-objectPermissions.allowRead`}
        label="Allow Read"
        checked={objectPermissions.allowRead}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'allowRead', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${label}-objectPermissions.modifyAllRecords`}
        label="Modify All Records"
        checked={objectPermissions.modifyAllRecords}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'modifyAllRecords', value))}
        disabled={loading}
      />
      <Checkbox
        id={`${label}-objectPermissions.viewAllRecords`}
        label="View All Records"
        checked={objectPermissions.viewAllRecords}
        onChange={(value) => onChange(setSObjectPermissionDependencies(objectPermissions, 'viewAllRecords', value))}
        disabled={loading}
      />
    </>
  );
};
