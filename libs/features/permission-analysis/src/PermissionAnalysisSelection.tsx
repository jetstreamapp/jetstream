import { ManagePermissionsSelection } from '@jetstream/feature/manage-permissions';
import { FunctionComponent } from 'react';

/** Permission analysis entry: same selection UX as Manage Permissions; object selection is optional (used to scope the export). */
export const PermissionAnalysisSelection: FunctionComponent = () => <ManagePermissionsSelection selectionMode="permission-analysis" />;

export default PermissionAnalysisSelection;
