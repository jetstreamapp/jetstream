import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import {
  checkOrgHealth,
  clearCacheForOrg,
  clearQueryHistoryForOrg,
  deleteOrg,
  getOrgs,
  refreshOrg,
  updateOrg,
} from '@jetstream/shared/data';
import { SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Grid, Page, PageHeader, PageHeaderRow, PageHeaderTitle, fireToast } from '@jetstream/ui';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import * as fromAppState from '../../../app-state';
import OrgListItem from './OrgListItem';

export function OrgList() {
  const setSelectedOrgId = useSetRecoilState(fromAppState.selectedOrgIdState);
  const selectedOrg = useRecoilValue(fromAppState.selectedOrgState);
  const { groupedOrgs, groupKeys } = useRecoilValue(fromAppState.selectGroupedOrgs);
  const setOrgs = useSetRecoilState(fromAppState.salesforceOrgsState);

  async function handleRefetchOrgs() {
    try {
      setOrgs(await getOrgs());
    } catch (ex) {
      logger.warn('Error refreshing orgs', ex);
    }
  }

  async function handleRemoveOrg(org: SalesforceOrgUi) {
    try {
      await deleteOrg(org);
      handleRefetchOrgs();
      // If selected org is removed, clear selected org
      if (selectedOrg.uniqueId === org.uniqueId) {
        setSelectedOrgId(null);
      }
      // async, but results are ignored as this will not throw
      clearCacheForOrg(org);
      clearQueryHistoryForOrg(org);
    } catch (ex) {
      logger.warn('Error removing org', ex);
    }
  }

  async function handleRefreshOrg(org: SalesforceOrgUi) {
    try {
      await refreshOrg(org);
      await handleRefetchOrgs();
    } catch (ex) {
      logger.warn('Error updating org', ex);
    }
  }

  async function handleVerifyOrg(org: SalesforceOrgUi) {
    try {
      await checkOrgHealth(org);
      if (org.connectionError) {
        await handleRefetchOrgs();
      }
      fireToast({
        message: 'Your org is valid.',
        type: 'success',
      });
    } catch (ex) {
      logger.warn('Error updating org', ex);
    }
  }

  async function handleUpdateOrg(org: SalesforceOrgUi, updatedOrg: Partial<SalesforceOrgUi>) {
    try {
      await updateOrg(org, updatedOrg);
      handleRefetchOrgs();
    } catch (ex) {
      logger.warn('Error updating org', ex);
    }
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'default' }}
            label="Salesforce Orgs"
            // docsPath="/load/with-related"
          />
          {/* <PageHeaderActions colType="actions" buttonType="separate">
            <button
              className="slds-button slds-button_neutral"
              disabled={fileProcessingLoading || dataLoadLoading}
              onClick={() => handleAddOrg()}
            >
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" />
              Add Org
            </button>
          </PageHeaderActions> */}
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
        <Grid wrap>
          {groupKeys.map((groupId) => (
            <div
              key={groupId}
              css={css`
                max-width: 25rem;
              `}
              className="slds-p-around_medium"
            >
              <h2 className="slds-text-heading_large">{groupId}</h2>
              <ul className="slds-has-dividers_around-space">
                {groupedOrgs[groupId].map((org) => (
                  <OrgListItem
                    org={org}
                    key={org.uniqueId}
                    onRefreshOrgInfo={handleRefreshOrg}
                    onVerifyOrg={handleVerifyOrg}
                    onRemoveOrg={handleRemoveOrg}
                    onUpdateOrg={handleUpdateOrg}
                  />
                ))}
              </ul>
            </div>
          ))}
        </Grid>
      </AutoFullHeightContainer>
    </Page>
  );
}

export default OrgList;
