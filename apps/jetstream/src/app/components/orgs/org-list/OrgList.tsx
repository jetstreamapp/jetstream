import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, clearQueryHistoryForOrg, deleteOrg, getOrgs, updateOrg } from '@jetstream/shared/data';
import { SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Grid, Page } from '@jetstream/ui';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import * as fromAppState from '../../../app-state';
import OrgListItem from './OrgListItem';

export function OrgList() {
  const { serverUrl } = useRecoilValue(fromAppState.applicationCookieState);
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

  // TODO:
  // function handleAddOrg(org: SalesforceOrgUi, switchActiveOrg: boolean) {
  //   const sortedOrgs = uniqBy(orderBy([org, ...orgs], 'username'), 'uniqueId');
  //   setOrgs(sortedOrgs);
  //   if (switchActiveOrg) {
  //     setSelectedOrgId(org.uniqueId);
  //   }
  //   handleRefetchOrgs();
  // }

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
      // await updateOrg(org, updatedOrg);
      // TODO:
      handleRefetchOrgs();
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
      <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
        <Grid>
          {groupKeys.map((groupId) => (
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
                {groupedOrgs[groupId].map((org) => (
                  <OrgListItem
                    org={org}
                    serverUrl={serverUrl}
                    key={org.uniqueId}
                    onRefreshOrgInfo={handleRefreshOrg}
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
