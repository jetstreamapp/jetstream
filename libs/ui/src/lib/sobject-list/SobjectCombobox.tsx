import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal } from '@jetstream/shared/data';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import type { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import ComboboxWithItems from '../form/combobox/ComboboxWithItems';
import { filterSobjectFn, filterToolingSobjectFn } from './ConnectedSobjectList';

function sobjectToListItem(sobjects: DescribeGlobalSObjectResult[]): ListItem[] {
  return sobjects.map((sobject) => ({
    id: sobject.name,
    label: sobject.label,
    value: sobject.name,
    meta: sobject,
    secondaryLabel: sobject.name,
    secondaryLabelOnNewLine: true,
  }));
}

export interface SobjectComboboxProps {
  className?: string;
  label?: string;
  helpText?: string;
  labelHelp?: string;
  isRequired?: boolean;
  disabled?: boolean;
  selectedOrg: SalesforceOrgUi;
  selectedSObject: DescribeGlobalSObjectResult;
  isTooling?: boolean;
  filterFn?: (sobject: DescribeGlobalSObjectResult) => boolean;
  onSelectedSObject: (selectedSObject: DescribeGlobalSObjectResult) => void;
}

export const SobjectCombobox: FunctionComponent<SobjectComboboxProps> = ({
  className,
  label = 'Objects',
  helpText,
  labelHelp,
  isRequired,
  disabled,
  selectedOrg,
  selectedSObject,
  isTooling,
  filterFn = isTooling ? filterToolingSobjectFn : filterSobjectFn,
  onSelectedSObject,
}) => {
  const isMounted = useRef(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [sobjects, setSObjects] = useState<ListItem[]>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadObjects = useCallback(async () => {
    const uniqueId = selectedOrg.uniqueId;
    const priorToolingValue = isTooling;
    try {
      setLoading(true);
      const resultsWithCache = await describeGlobal(selectedOrg, isTooling);
      const results = resultsWithCache.data;
      if (!isMounted.current || uniqueId !== selectedOrg.uniqueId || priorToolingValue !== isTooling) {
        return;
      }
      // if (resultsWithCache.cache) {
      //   const cache = resultsWithCache.cache;
      //   setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
      // }
      setSObjects(sobjectToListItem(orderObjectsBy(results.sobjects.filter(filterFn), 'label')));
    } catch (ex) {
      logger.error(ex);
      if (!isMounted.current || uniqueId !== selectedOrg.uniqueId || priorToolingValue !== isTooling) {
        return;
      }
      setErrorMessage(ex.message);
    }
    setLoading(false);
  }, [filterFn, selectedOrg, isTooling]);

  useEffect(() => {
    if (selectedOrg && !loading && !errorMessage && !sobjects) {
      loadObjects();
    }
  }, [selectedOrg, loading, errorMessage, loadObjects, sobjects]);

  return (
    <ComboboxWithItems
      comboboxProps={{
        className,
        label,
        helpText,
        errorMessage: errorMessage,
        hasError: !!errorMessage,
        labelHelp,
        isRequired,
        disabled,
        itemLength: 10,
        loading,
        placeholder: 'Select an Object',
      }}
      items={sobjects || []}
      selectedItemId={selectedSObject?.name}
      onSelected={(item) => onSelectedSObject(item.meta)}
    />
  );
};

export default SobjectCombobox;
