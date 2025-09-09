/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { hasModifierKey, hasShiftModifierKey, isHKey, useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { ButtonGroupContainer, getModifierKey, Icon, KeyboardShortcut, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import { ErrorBoundaryFallback, fromQueryHistoryState } from '../..';
import { useAmplitude } from '../../analytics';
import { QueryHistoryModal, QueryHistoryType } from './QueryHistoryModal';

export interface QueryHistoryRef {
  open: (type: fromQueryHistoryState.QueryHistoryType) => void;
}

export interface QueryHistoryProps {
  className?: string;
  selectedOrg: SalesforceOrgUi;
  onRestore?: (soql: string, tooling: boolean) => void;
}

export const QueryHistory = forwardRef<any, QueryHistoryProps>(({ className, selectedOrg, onRestore }, ref) => {
  const location = useLocation();
  const { trackEvent } = useAmplitude();
  const [whichType, setWhichType] = useState<QueryHistoryType>('HISTORY');

  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => {
    return {
      open: (type: fromQueryHistoryState.QueryHistoryType = 'HISTORY') => {
        handleOpenModal(type, 'externalAction');
      },
    };
  });

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen && hasModifierKey(event as any) && isHKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        handleOpenModal(hasShiftModifierKey(event as any) ? 'SAVED' : 'HISTORY', 'keyboardShortcut');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen],
  );

  useGlobalEventHandler('keydown', onKeydown);

  useEffect(() => {
    if (isOpen) {
      setIsOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  function handleOpenModal(type: fromQueryHistoryState.QueryHistoryType = 'HISTORY', source = 'buttonClick') {
    setWhichType(type);
    setIsOpen(true);
    trackEvent(ANALYTICS_KEYS.query_HistoryModalOpened, { source, type });
  }

  function handleModalClose() {
    setIsOpen(false);
    setWhichType('HISTORY');
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
      <ButtonGroupContainer>
        <Tooltip
          ariaRole="label"
          content={
            <div className="slds-p-bottom_small">
              View query history
              <KeyboardShortcut inverse keys={[getModifierKey(), 'h']} />
            </div>
          }
        >
          <button
            aria-label="Query History"
            className={classNames('slds-button slds-button_neutral slds-button_first', className)}
            css={css`
              padding: 0.5rem;
            `}
            aria-haspopup="true"
            onClick={() => handleOpenModal('HISTORY')}
          >
            <Icon type="utility" icon="date_time" className="slds-button__icon" omitContainer />
          </button>
        </Tooltip>
        <Tooltip
          ariaRole="label"
          content={
            <div className="slds-p-bottom_small">
              View saved queries
              <KeyboardShortcut inverse keys={[getModifierKey(), 'shift', 'h']} />
            </div>
          }
        >
          <button
            aria-label="Saved Queries"
            className={classNames('slds-button slds-button_neutral slds-button_last', className)}
            css={css`
              padding: 0.5rem;
            `}
            aria-haspopup="true"
            onClick={() => handleOpenModal('SAVED')}
          >
            <Icon type="utility" icon="favorite" className="slds-button__icon" omitContainer />
          </button>
        </Tooltip>
      </ButtonGroupContainer>
      {isOpen && <QueryHistoryModal initialType={whichType} selectedOrg={selectedOrg} onRestore={onRestore} onclose={handleModalClose} />}
    </ErrorBoundary>
  );
});
