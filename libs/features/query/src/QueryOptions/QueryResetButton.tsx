/* eslint-disable @typescript-eslint/no-unused-vars */

import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { Icon } from '@jetstream/ui';
import { fromQueryState, useAmplitude } from '@jetstream/ui-core';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { useResetRecoilState } from 'recoil';

export interface QueryResetButtonProps {
  className?: string;
}

export const QueryResetButton: FunctionComponent<QueryResetButtonProps> = ({ className }) => {
  const { trackEvent } = useAmplitude();

  const resetFns = [
    useResetRecoilState(fromQueryState.sObjectsState),
    useResetRecoilState(fromQueryState.selectedSObjectState),
    useResetRecoilState(fromQueryState.queryFieldsKey),
    useResetRecoilState(fromQueryState.queryChildRelationships),
    useResetRecoilState(fromQueryState.queryFieldsMapState),
    useResetRecoilState(fromQueryState.selectedQueryFieldsState),
    useResetRecoilState(fromQueryState.selectedSubqueryFieldsState),
    useResetRecoilState(fromQueryState.filterQueryFieldsState),
    useResetRecoilState(fromQueryState.orderByQueryFieldsState),
    useResetRecoilState(fromQueryState.queryFiltersState),
    useResetRecoilState(fromQueryState.queryHavingState),
    useResetRecoilState(fromQueryState.fieldFilterFunctions),
    useResetRecoilState(fromQueryState.queryGroupByState),
    useResetRecoilState(fromQueryState.queryOrderByState),
    useResetRecoilState(fromQueryState.queryLimit),
    useResetRecoilState(fromQueryState.queryLimitSkip),
    useResetRecoilState(fromQueryState.querySoqlState),
  ];

  function resetQuery() {
    resetFns.forEach((fn) => fn());
    trackEvent(ANALYTICS_KEYS.query_ResetPage);
  }

  return (
    <button
      className={classNames('slds-button slds-button_neutral collapsible-button collapsible-button-lg', className)}
      onClick={resetQuery}
    >
      <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
      <span>Reset Page</span>
    </button>
  );
};

export default QueryResetButton;
