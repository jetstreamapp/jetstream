import { Checkbox } from '@jetstream/ui';
import { CreateObjectPermissions } from './create-object-types';

export interface CreateNewObjectPermissionsProps {
  objectPermissions: CreateObjectPermissions;
  loading: boolean;
  onChange: (objectPermissions: CreateObjectPermissions) => void;
}

export const CreateNewObjectPermissionsCheckboxes = ({ objectPermissions, loading, onChange }: CreateNewObjectPermissionsProps) => {
  const allSelected =
    objectPermissions.allowCreate &&
    objectPermissions.allowDelete &&
    objectPermissions.allowEdit &&
    objectPermissions.allowRead &&
    objectPermissions.modifyAllRecords &&
    objectPermissions.viewAllRecords;

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
      <Checkbox
        id="objectPermissions.selectAll"
        label="Select All"
        className="slds-m-bottom_xx-small"
        checked={allSelected}
        onChange={handleSelectAll}
        disabled={loading}
      />
      <Checkbox
        id="objectPermissions.allowCreate"
        label="Allow Create"
        checked={objectPermissions.allowCreate}
        onChange={(value) => onChange({ ...objectPermissions, allowCreate: value })}
        disabled={loading}
      />
      <Checkbox
        id="objectPermissions.allowDelete"
        label="Allow Delete"
        checked={objectPermissions.allowDelete}
        onChange={(value) => onChange({ ...objectPermissions, allowDelete: value })}
        disabled={loading}
      />
      <Checkbox
        id="objectPermissions.allowEdit"
        label="Allow Edit"
        checked={objectPermissions.allowEdit}
        onChange={(value) => onChange({ ...objectPermissions, allowEdit: value })}
        disabled={loading}
      />
      <Checkbox
        id="objectPermissions.allowRead"
        label="Allow Read"
        checked={objectPermissions.allowRead}
        onChange={(value) => onChange({ ...objectPermissions, allowRead: value })}
        disabled={loading}
      />
      <Checkbox
        id="objectPermissions.modifyAllRecords"
        label="Modify All Records"
        checked={objectPermissions.modifyAllRecords}
        onChange={(value) => onChange({ ...objectPermissions, modifyAllRecords: value })}
        disabled={loading}
      />
      <Checkbox
        id="objectPermissions.viewAllRecords"
        label="View All Records"
        checked={objectPermissions.viewAllRecords}
        onChange={(value) => onChange({ ...objectPermissions, viewAllRecords: value })}
        disabled={loading}
      />
    </>
  );
};
