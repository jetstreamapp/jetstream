/* eslint-disable @typescript-eslint/no-unused-vars */
import { Icon } from '@jetstream/ui';
import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import { useResetRecoilState } from 'recoil';
import * as fromQueryState from '../query.state';

export const QueryResetButton: FunctionComponent = () => {
  const resetFns = [
    useResetRecoilState(fromQueryState.sObjectsState),
    useResetRecoilState(fromQueryState.selectedSObjectState),
    useResetRecoilState(fromQueryState.selectedQueryFieldsState),
    useResetRecoilState(fromQueryState.filterQueryFieldsState),
    useResetRecoilState(fromQueryState.queryFiltersState),
    useResetRecoilState(fromQueryState.queryLimit),
    useResetRecoilState(fromQueryState.queryLimitSkip),
    useResetRecoilState(fromQueryState.queryOrderByState),
    useResetRecoilState(fromQueryState.querySoqlState),
  ];

  function resetQuery() {
    resetFns.forEach((fn) => fn());
  }

  return (
    <button className={classNames('slds-button slds-button_neutral')} title="Reset Query" onClick={resetQuery}>
      <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
      Reset Page
    </button>
  );
};

export default QueryResetButton;
