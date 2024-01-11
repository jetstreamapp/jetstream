import { SerializedStyles, css } from '@emotion/react';
import { getOrgType } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Badge,
  ColorSwatchItem,
  ColorSwatches,
  CopyToClipboard,
  DropDown,
  Grid,
  Icon,
  Page,
  SalesforceLogin,
} from '@jetstream/ui';
import { useRecoilValue } from 'recoil';
import * as fromAppState from '../../../app-state';

function getSelectedItemStyle(org: SalesforceOrgUi): SerializedStyles | undefined {
  if (!org || !org.color || !!org.connectionError) {
    return;
  }
  return css({
    borderColor: `${org.color} !important`,
    boxShadow: `inset 0 0 0 1px ${org.color} !important`,
    backgroundClip: 'padding-box !important',
  });
}

const EMPTY_COLOR = '_none_';

const ORG_COLORS: ColorSwatchItem[] = [
  { id: EMPTY_COLOR, color: '#fff' },
  { id: '#D1D5DB', color: '#D1D5DB' },
  { id: '#6B7280', color: '#6B7280' },
  { id: '#EF4444', color: '#EF4444' },
  { id: '#FDE68A', color: '#FDE68A' },
  { id: '#F59E0B', color: '#F59E0B' },
  { id: '#10B981', color: '#10B981' },
  { id: '#60A5FA', color: '#60A5FA' },
  { id: '#1D4ED8', color: '#1D4ED8' },
  { id: '#8B5CF6', color: '#8B5CF6' },
  { id: '#DB2777', color: '#DB2777' },
];

export function OrgList() {
  const { serverUrl } = useRecoilValue(fromAppState.applicationCookieState);
  const groupedOrgs = useRecoilValue(fromAppState.selectGroupedOrgs);

  /*
      Create columns for each group
      with a min width of 12rem and max width of 25rem
      */

  return (
    <Page>
      <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
        <Grid>
          {Object.keys(groupedOrgs).map((groupId) => (
            <div
              key={groupId}
              css={css`
                min-width: 20rem;
                max-width: 25rem;
              `}
              className="slds-p-around_medium"
            >
              <h2 className="slds-text-heading_large">{groupId}</h2>
              <ul className="slds-has-dividers_around-space">
                {groupedOrgs[groupId].map((org) => {
                  const orgType = getOrgType(org);
                  return (
                    <li key={org.uniqueId} className="slds-item read-only slds-card" css={getSelectedItemStyle(org)}>
                      <Grid align="spread">
                        <p className="slds-truncate slds-grid slds-grid_align-spread slds-grid_vertical-align-center slds-p-vertical_xx-small">
                          {/* <span className="slds-text-color_weak">{org.username}</span> */}
                          <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType}>
                            {orgType}
                          </Badge>
                        </p>
                        <DropDown
                          buttonClassName="slds-button slds-button_icon slds-button_icon-x-small slds-button_icon-border-filled"
                          position="right"
                          items={[
                            { id: 're-authenticate', value: 'Re-Authenticate' },
                            { id: 'update', value: 'Update Org Info', trailingDivider: true },
                            { id: 'delete', value: 'Delete', spanClassName: 'slds-text-color_error' },
                          ]}
                          onSelected={(item) => {}}
                        />
                      </Grid>
                      <p
                        className="slds-p-right_xx-small slds-line-clamp_small slds-p-vertical_xx-small"
                        title={org.label}
                        css={css`
                          word-break: break-all;
                        `}
                      >
                        <span>{org.label}</span>
                        <button className="slds-button slds-button_icon slds-m-left_xx-small">
                          <Icon className="slds-button__icon" type="utility" icon="edit" />
                        </button>
                      </p>
                      {/* dropdown menu - delete, edit, etc
                        position: absolute;
                        top: var(--lwc-spacingXSmall,0.5rem);
                        right: var(--lwc-spacingXSmall,0.5rem);
                        line-height: var(--lwc-spacingNone, 0);
                    */}
                      {org.username !== org.label && <p className="slds-truncate">{org.username}</p>}
                      <p className="slds-truncate slds-p-vertical_xx-small" title={org.organizationId}>
                        <span className="slds-text-color_weak">{org.organizationId}</span>
                        <CopyToClipboard content={org.organizationId} className="slds-m-left_xx-small" />
                      </p>
                      <p className="slds-line-clamp_small slds-p-vertical_xx-small" title={org.instanceUrl}>
                        <span className="slds-text-color_weak">{org.orgInstanceName}</span>
                      </p>
                      <p className="slds-line-clamp_small slds-p-vertical_xx-small" title={org.instanceUrl}>
                        <SalesforceLogin serverUrl={serverUrl} omitIcon org={org} title="Login" returnUrl="/lightning/page/home">
                          {org.instanceUrl}
                        </SalesforceLogin>
                      </p>
                      {org.connectionError && (
                        <div>
                          <p className="slds-line-clamp_small slds-p-vertical_xx-small" title={org.connectionError}>
                            <span className="slds-text-color_error">{org.connectionError}</span>
                          </p>
                          {/* TODO: add reconnect button */}
                        </div>
                      )}
                      <div>
                        {/* <ColorSlider
                          label="Org Color"
                          showValueLabel={false}
                          channel="hue"
                          // defaultValue="hsl(120, 100%, 50%)"
                          value={value}
                          onChange={setValue}
                          // contextualHelp={
                          //   <ContextualHelp>
                          //     <Heading>What is an accent color?</Heading>
                          //     <Content>
                          //       An accent color is the primary foreground color for your theme, used
                          //       across all components.
                          //     </Content>
                          //   </ContextualHelp>
                          // }
                        /> */}
                      </div>
                      {/* TODO: this is a lot, we should require something to open this up */}
                      <ColorSwatches items={ORG_COLORS} selectedItem={org.color} onSelection={() => {}} />
                      <Grid>
                        {/* <SalesforceLogin
                          serverUrl={serverUrl}
                          className="slds-button"
                          org={org}
                          title="Login to Salesforce Home"
                          returnUrl="/lightning/page/home"
                        >
                          Open
                        </SalesforceLogin> */}
                        {/* this should be in a menu */}
                        {/* <button className="slds-button">Refresh Details</button> */}
                        {/* <button className="slds-button">Select Org</button> */}
                      </Grid>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Grid>
      </AutoFullHeightContainer>
    </Page>
  );
}

export default OrgList;
