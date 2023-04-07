import { css } from '@emotion/react';
import { genericRequest } from '@jetstream/shared/data';
import { ListItem, SalesforceApiVersion, SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import Picklist, { PicklistProps } from '../form/picklist/Picklist';

export interface ApiVersionDropdownProps {
  className?: string;
  label?: string;
  selectedOrg: SalesforceOrgUi;
  picklistProps?: PicklistProps;
  onChange: (version: string) => void;
}

export const ApiVersionDropdown: FunctionComponent<ApiVersionDropdownProps> = ({
  className,
  label = 'API Version',
  selectedOrg,
  picklistProps,
  onChange,
}) => {
  const [loadTimestamp, setLoadTimestamp] = useState(() => new Date().getTime());
  const [items, setItems] = useState<ListItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<ListItem[]>([]);
  const [hasError, setHasError] = useState(false);
  const [loading, setIsLoading] = useState(false);

  useEffect(() => {
    genericRequest<SalesforceApiVersion[]>(selectedOrg, { method: 'GET', url: `/services/data`, isTooling: false })
      .then((results) => results.reverse())
      .then((results) => {
        const _items = results.map((item) => ({
          id: item.version,
          label: item.version,
          value: item.version,
        }));
        setSelectedItems([_items[0]]);
        setItems(_items);
        setLoadTimestamp(new Date().getTime());
        onChange(_items[0].id);
      })
      .catch((err) => {
        setHasError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [onChange, selectedOrg]);

  const handleChange = useCallback(
    (selectedItems: ListItem[]) => {
      setSelectedItems(selectedItems);
      selectedItems[0] && onChange(selectedItems[0].id);
    },
    [onChange]
  );

  return (
    <Picklist
      css={css`
        width: 75px;
      `}
      key={loadTimestamp}
      className={className}
      label={label}
      hideLabel
      allowDeselection={false}
      placeholder="Select a Package"
      items={items}
      selectedItems={selectedItems}
      disabled={loading}
      onChange={handleChange}
      hasError={hasError}
      errorMessage="There was a problem loading API versions."
      errorMessageId="api-version-dropdown-error-message"
      {...picklistProps}
    ></Picklist>
  );
};

export default ApiVersionDropdown;
