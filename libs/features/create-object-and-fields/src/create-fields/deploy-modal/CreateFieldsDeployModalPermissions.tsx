import { css } from '@emotion/react';
import { useFetchPageLayouts } from '@jetstream/shared/ui-utils';
import { PermissionSetNoProfileRecord, PermissionSetWithProfileRecord, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, ScopedNotification, Spinner } from '@jetstream/ui';
import { FieldValues } from '@jetstream/ui-core';
import { FunctionComponent, useEffect } from 'react';

export interface CreateFieldsDeployModalPermissionsProps {
  selectedOrg: SalesforceOrgUi;
  profiles: string[];
  permissionSets: string[];
  profilesAndPermSetsById: Record<string, PermissionSetWithProfileRecord | PermissionSetNoProfileRecord>;
  sObjects: string[];
  rows: FieldValues[];
  loading: boolean;
  onPermissionsChange: (data: any) => void; // TODO:
  onLayoutsChange: (selectedLayoutIds: Set<string>) => void;
}

export const CreateFieldsDeployModalPermissions: FunctionComponent<CreateFieldsDeployModalPermissionsProps> = ({
  selectedOrg,
  profiles,
  permissionSets,
  profilesAndPermSetsById,
  sObjects,
  rows,
  loading,
  onLayoutsChange,
}) => {
  // const { trackEvent } = useAmplitude();
  // const [{ defaultApiVersion, serverUrl, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const {
    loading: loadingLayouts,
    error: loadingLayoutsError,
    layoutsByObject,
    selectedLayoutIds,
    handleSelectLayout,
  } = useFetchPageLayouts(selectedOrg, sObjects);

  useEffect(() => {
    onLayoutsChange(selectedLayoutIds);
  }, [selectedLayoutIds]);

  return (
    <>
      <div>Permission configured here</div>
      <div
        className="slds-is-relative"
        dir="rtl"
        css={css`
          width: 400px;
        `}
      >
        {loadingLayoutsError && (
          <div className="slds-m-around-medium">
            <ScopedNotification theme="error" className="slds-m-top_medium">
              <p>{loadingLayoutsError}</p>
            </ScopedNotification>
          </div>
        )}
        {loadingLayouts && <Spinner />}
        <div className="slds-text-heading_small slds-truncate" title="Add to Page Layouts">
          Add to Page Layouts
        </div>
        {Object.keys(layoutsByObject).map((objectName) => (
          <fieldset className="slds-form-element slds-m-top_small slds-p-right_x-small" key={`layout-heading-${objectName}`}>
            <legend
              className="slds-form-element__label slds-truncate"
              title={objectName}
              css={css`
                font-weight: 700;
              `}
            >
              {objectName}
            </legend>
            {layoutsByObject[objectName].map((layout) => (
              <Checkbox
                key={`layout-${layout.Id}`}
                id={`layout-${layout.Id}`}
                label={layout.Name}
                checked={selectedLayoutIds.has(layout.Id)}
                disabled={loadingLayouts || loading}
                onChange={(value) => handleSelectLayout(layout.Id)}
              />
            ))}
          </fieldset>
        ))}
      </div>
    </>
  );
};

export default CreateFieldsDeployModalPermissions;
