import { FunctionComponent } from 'react';
import { ManagePermissionsSelection } from './ManagePermissionsSelection';

/** Permission analysis entry: same selection UX as Manage Permissions with objects disabled (v1). */
export const PermissionAnalysisSelection: FunctionComponent = () => (
  <ManagePermissionsSelection selectionMode="permission-analysis" />
);

export default PermissionAnalysisSelection;
