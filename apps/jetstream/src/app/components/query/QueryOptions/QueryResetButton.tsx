/* eslint-disable @typescript-eslint/no-unused-vars */
/** @jsx jsx */
import { jsx, SerializedStyles } from '@emotion/react';
import { Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { useResetRecoilState } from 'recoil';
import * as fromQueryState from '../query.state';

export interface QueryResetButtonProps {
  className?: string;
  css?: SerializedStyles;
}

export const QueryResetButton: FunctionComponent<QueryResetButtonProps> = ({ css, className }) => {
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
    useResetRecoilState(fromQueryState.queryLimit),
    useResetRecoilState(fromQueryState.queryLimitSkip),
    useResetRecoilState(fromQueryState.queryOrderByState),
    useResetRecoilState(fromQueryState.querySoqlState),
  ];

  function resetQuery() {
    resetFns.forEach((fn) => fn());
  }

  return (
    <button css={css} className={classNames('slds-button slds-button_neutral', className)} title="Reset Query" onClick={resetQuery}>
      <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
      Reset Page
    </button>
  );
};

export default QueryResetButton;
