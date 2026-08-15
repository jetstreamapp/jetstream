import { MAX_RECORDS_PER_GROUP } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import type { ColumnWithFilter, RowWithKey } from '@jetstream/ui';
import { AutoFullHeightContainer, DataTree, ExpandCollapseButton, ScopedNotification } from '@jetstream/ui';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useMemo } from 'react';
import { MIN_GRID_HEIGHT } from '../load-records-multi-object-constants';
import { LoadMultiObjectData, LoadMultiObjectGroupInfo } from '../load-records-multi-object-types';
import { getReferenceId } from '../load-records-multi-object-utils';
import { previewLayoutVersionState } from '../load-records-multi-object.state';
import useExpandedGroups from '../useExpandedGroups';

export interface LoadRecordsMultiObjectGroupsOverviewProps {
  datasets: LoadMultiObjectData[];
  groupsByRefId: Record<string, LoadMultiObjectGroupInfo>;
  groupNumbersByGraphId: Record<string, number>;
}

interface GroupOverviewRow {
  _key: string;
  _group: string;
  _groupSort: number;
  worksheet: string;
  referenceId: string;
  sobject: string;
  operation: string;
}

const COLUMNS: ColumnWithFilter<RowWithKey>[] = [
  { name: 'Group', key: '_group', width: 220, sortable: true, filters: ['SET'] },
  { name: 'Reference Id', key: 'referenceId', width: 200, sortable: true, filters: ['TEXT', 'SET'] },
  { name: 'Worksheet', key: 'worksheet', width: 180, sortable: true, filters: ['SET'] },
  { name: 'Object', key: 'sobject', width: 150, sortable: true, filters: ['SET'] },
  { name: 'Operation', key: 'operation', width: 120, sortable: true, filters: ['SET'] },
];

/**
 * The mental-model view: every record grouped by its computed record group, making the
 * "500 related records per group" limit tangible before loading.
 */
export const LoadRecordsMultiObjectGroupsOverview: FunctionComponent<LoadRecordsMultiObjectGroupsOverviewProps> = ({
  datasets,
  groupsByRefId,
  groupNumbersByGraphId,
}) => {
  const previewLayoutVersion = useAtomValue(previewLayoutVersionState);
  const rows = useMemo((): GroupOverviewRow[] => {
    const output: GroupOverviewRow[] = [];
    datasets.forEach((dataset) => {
      dataset.data.forEach((record, i) => {
        const referenceId = getReferenceId(record, dataset.referenceColumnHeader);
        const groupInfo = referenceId ? groupsByRefId[referenceId] : null;
        if (!referenceId || !groupInfo) {
          return;
        }
        const groupNumber = groupNumbersByGraphId[groupInfo.graphId];
        output.push({
          _key: `${dataset.worksheet}:${i}`,
          _group: `Group ${groupNumber} - ${formatNumber(groupInfo.size)} ${pluralizeFromNumber('record', groupInfo.size)}`,
          _groupSort: groupNumber,
          worksheet: dataset.worksheet,
          referenceId,
          sobject: dataset.sobject,
          operation: dataset.operation,
        });
      });
    });
    return output.sort((rowA, rowB) => rowA._groupSort - rowB._groupSort);
  }, [datasets, groupsByRefId, groupNumbersByGraphId]);

  const groupIds = useMemo(() => Array.from(new Set(rows.map(({ _group }) => _group))), [rows]);
  const { expandedGroupIds, setExpandedGroupIds, toggleAllGroups, hasExpandedGroups } = useExpandedGroups(groupIds);

  if (!rows.length) {
    return (
      <ScopedNotification theme="light" className="slds-m-vertical_x-small">
        Groups will appear here once the file has no validation errors.
      </ScopedNotification>
    );
  }

  return (
    <div>
      <p className="slds-text-color_weak slds-m-vertical_x-small">
        Records that reference each other form a group. Each group is sent to Salesforce as one all-or-nothing transaction: if any record in
        it fails, the whole group is rolled back. A group can contain up to {formatNumber(MAX_RECORDS_PER_GROUP)} records.
      </p>
      <ExpandCollapseButton isExpanded={hasExpandedGroups} onToggle={toggleAllGroups} />
      <AutoFullHeightContainer
        fillHeight
        setHeightAttr
        bottomBuffer={25}
        bufferIfNotRendered={320}
        minHeight={MIN_GRID_HEIGHT}
        recalculateKey={previewLayoutVersion}
      >
        <DataTree
          data={rows as unknown as RowWithKey[]}
          columns={COLUMNS}
          getRowKey={(row) => (row as unknown as GroupOverviewRow)._key}
          groupBy={['_group']}
          expandedGroupIds={expandedGroupIds}
          onExpandedGroupIdsChange={setExpandedGroupIds}
        />
      </AutoFullHeightContainer>
    </div>
  );
};

export default LoadRecordsMultiObjectGroupsOverview;
