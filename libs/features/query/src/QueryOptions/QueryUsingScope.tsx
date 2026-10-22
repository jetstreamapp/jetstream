import { ListItem } from '@jetstream/types';
import { ComboboxWithItems, ScopedNotification } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { useAtom, useAtomValue } from 'jotai';
import { useMemo } from 'react';

export const QueryUsingScope = () => {
  const supportedScopes = useAtomValue(fromQueryState.selectSupportedScopes);
  const [usingScope, setUsingScope] = useAtom(fromQueryState.queryUsingScopeState);

  const items = useMemo<ListItem[]>(
    () =>
      (supportedScopes || []).map(({ label, name }) => ({
        id: name,
        label,
        secondaryLabel: name,
        secondaryLabelOnNewLine: true,
        value: name,
      })),
    [supportedScopes],
  );

  if (!supportedScopes) {
    return null;
  }

  if (!items.length) {
    return <ScopedNotification theme="info">This object does not support Using Scope</ScopedNotification>;
  }

  return (
    <ComboboxWithItems
      comboboxProps={{
        label: 'Using Scope',
        labelHelp: 'Limit the results to a subset of records, such as only the records you own.',
        placeholder: 'Select a scope',
        onClear: () => setUsingScope(''),
      }}
      items={items}
      selectedItemId={usingScope || null}
      onSelected={({ value }) => setUsingScope(value)}
    />
  );
};

export default QueryUsingScope;
