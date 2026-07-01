import { FunctionComponent } from 'react';
import { ManagePermissionsSelection } from './ManagePermissionsSelection';

/** Permission analysis entry: same selection UX as Manage Permissions; object selection is optional (used to scope the export). */
export const PermissionAnalysisSelection: FunctionComponent = () => (
  <ManagePermissionsSelection selectionMode="permission-analysis" />
);

export default PermissionAnalysisSelection;
