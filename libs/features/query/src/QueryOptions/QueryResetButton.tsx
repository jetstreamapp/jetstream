/* eslint-disable @typescript-eslint/no-unused-vars */

import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { Icon } from '@jetstream/ui';
import { fromQueryState, useAmplitude } from '@jetstream/ui-core';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';

export interface QueryResetButtonProps {
  className?: string;
}

export const QueryResetButton: FunctionComponent<QueryResetButtonProps> = ({ className }) => {
  const { trackEvent } = useAmplitude();

  const resetFns = [
    useResetAtom(fromQueryState.sObjectsState),
    useResetAtom(fromQueryState.selectedSObjectState),
    useResetAtom(fromQueryState.queryFieldsKey),
    useResetAtom(fromQueryState.queryChildRelationships),
    useResetAtom(fromQueryState.queryFieldsMapState),
    useResetAtom(fromQueryState.selectedQueryFieldsState),
    useResetAtom(fromQueryState.selectedSubqueryFieldsState),
    useResetAtom(fromQueryState.filterQueryFieldsState),
    useResetAtom(fromQueryState.orderByQueryFieldsState),
    useResetAtom(fromQueryState.queryFiltersState),
    useResetAtom(fromQueryState.queryHavingState),
    useResetAtom(fromQueryState.fieldFilterFunctions),
    useResetAtom(fromQueryState.queryGroupByState),
    useResetAtom(fromQueryState.queryOrderByState),
    useResetAtom(fromQueryState.queryLimit),
    useResetAtom(fromQueryState.queryLimitSkip),
    useResetAtom(fromQueryState.querySoqlState),
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
