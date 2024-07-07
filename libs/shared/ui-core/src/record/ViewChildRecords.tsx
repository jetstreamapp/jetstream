/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, SOBJECT_NAME_FIELD_MAP } from '@jetstream/shared/constants';
import { queryAll, queryAllFromList, queryAllWithCache } from '@jetstream/shared/data';
import { groupByFlat, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ChildRelationship, Maybe, QueryResult, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  DataTree,
  Grid,
  Icon,
  PopoverErrorButton,
  SalesforceLogin,
  ScopedNotification,
  Spinner,
  Tooltip,
  setColumnFromType,
} from '@jetstream/ui';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import groupBy from 'lodash/groupBy';
import { FunctionComponent, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useAmplitude } from '../analytics';
import { applicationCookieState, selectSkipFrontdoorAuth } from '../state-management/app-state';

function getRowId(row: SalesforceRecord<ChildRecordRow>): string {
  return `${row.Id}-${row._idx}`;
}

const groupedRows = ['_groupByLabel'] as const;

function getRows(childRelationships: ChildRelationship[], record: SalesforceRecord) {
  return (childRelationships || [])
    .flatMap((childRelationship): SalesforceRecord<ChildRecordRow>[] => {
      if (childRelationship.relationshipName && record[childRelationship.relationshipName]) {
        const childQueryResults: QueryResult<any> = record[childRelationship.relationshipName];
        return childQueryResults.records.map((record, i) => ({
          _groupByLabel: `${childRelationship.childSObject} (${childRelationship.relationshipName})`,
          _record: record._record,
          _idx: i,
          Id: record.Id,
          Name: record[SOBJECT_NAME_FIELD_MAP[childRelationship.childSObject] || 'Name'],
          CreatedDate: record.CreatedDate,
          CreatedByName: record.CreatedBy?.Name || 'unknown',
          LastModifiedDate: record.LastModifiedDate,
          LastModifiedByName: record.LastModifiedBy?.Name || 'unknown',
        }));
      }
      return []; // allow type inference to work
    })
    .filter(Boolean);
}

interface ChildRecordRow {
  _groupByLabel: string; // sobject + relationship name
  _record: any; // original record
  _idx: number;
  Name: string;
  CreatedDate: string;
  CreatedByName: string;
  LastModifiedDate: string;
  LastModifiedByName: string;
}

export interface ViewChildRecordsProps {
  selectedOrg: SalesforceOrgUi;
  sobjectName: string;
  parentRecordId: string;
  initialData?: SalesforceRecord;
  childRelationships: ChildRelationship[];
  modalRef?: MutableRefObject<Maybe<HTMLDivElement>>;
  onChildrenData?: (parentRecordId: string, record: SalesforceRecord) => void;
}

export const ViewChildRecords: FunctionComponent<ViewChildRecordsProps> = ({
  selectedOrg,
  sobjectName,
  parentRecordId,
  initialData,
  childRelationships,
  modalRef,
  onChildrenData,
}) => {
  const { trackEvent } = useAmplitude();
  const isMounted = useRef(true);
  const { serverUrl } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);
  const [loading, setLoading] = useState<boolean>(true);
  const [rows, setRows] = useState<SalesforceRecord<ChildRecordRow>[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState(new Set<any>());
  const [fetchErrors, setHasFetchErrors] = useState<string[]>([]);

  const columns = useMemo(
    (): ColumnWithFilter<SalesforceRecord<ChildRecordRow>>[] => [
      {
        ...setColumnFromType<SalesforceRecord<ChildRecordRow>>('_groupByLabel', 'text'),
        key: '_groupByLabel',
        name: '',
        width: 40,
        frozen: true,
        renderGroupCell: ({ isExpanded }) => (
          <Grid align="end" verticalAlign="center" className="h-100">
            <Icon
              icon={isExpanded ? 'chevrondown' : 'chevronright'}
              type="utility"
              className="slds-icon slds-icon-text-default slds-icon_x-small"
              title="Toggle collapse"
            />
          </Grid>
        ),
      },
      {
        ...setColumnFromType('Id', 'text'),
        key: 'Id',
        name: 'Id',
        renderCell: ({ row }) => {
          return (
            <Grid>
              <SalesforceLogin
                serverUrl={serverUrl}
                org={selectedOrg}
                skipFrontDoorAuth={skipFrontDoorAuth}
                returnUrl={`/${row.Id}`}
                iconPosition="right"
                title="View record in Salesforce"
              >
                {row.Id}
              </SalesforceLogin>
            </Grid>
          );
        },
        renderGroupCell: ({ toggleGroup, groupKey, childRows }) => (
          <button
            css={css`
              white-space: nowrap;
            `}
            className="slds-button"
            onClick={toggleGroup}
          >
            {groupKey as string}
          </button>
        ),
      },
      {
        ...setColumnFromType('Name', 'text'),
        key: 'Name',
        name: 'Name',
      },
      {
        ...setColumnFromType('LastModifiedByName', 'text'),
        key: 'LastModifiedByName',
        name: 'Modified By',
      },
      {
        ...setColumnFromType('LastModifiedDate', 'date'),
        key: 'LastModifiedDate',
        name: 'Last Modified',
      },
      {
        ...setColumnFromType('CreatedByName', 'date'),
        key: 'CreatedByName',
        name: 'Created By',
      },
      {
        ...setColumnFromType('CreatedDate', 'date'),
        key: 'CreatedDate',
        name: 'Created',
      },
    ],
    [selectedOrg, serverUrl, skipFrontDoorAuth]
  );

  const fetchChildRecords = useCallback(
    async (skipCache?: boolean) => {
      try {
        setRows([]);
        setExpandedGroupIds(new Set());
        setLoading(true);
        // Some child objects are missing basic fields like Name and CreatedDate, and others are not queryable
        // This fetches all the fields so the subqueries can be constructed with valid fields
        const fields = ['Id', 'Name', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById'].concat(
          Array.from(new Set(Object.values(SOBJECT_NAME_FIELD_MAP)))
        );
        const entityParticleQueries = splitArrayToMaxSize(Array.from(new Set(childRelationships.map((item) => item.childSObject))), 50).map(
          (childRelationshipObjects) =>
            composeQuery({
              sObject: 'EntityDefinition',
              fields: [
                getField('Id'),
                getField('QualifiedApiName'),
                getField({
                  subquery: {
                    relationshipName: 'Fields',
                    fields: [getField('Id'), getField('QualifiedApiName')],
                    where: {
                      left: {
                        field: 'QualifiedApiName',
                        operator: 'IN',
                        value: fields,
                        literalType: 'STRING',
                      },
                    },
                  },
                }),
              ],
              where: {
                left: {
                  field: 'QualifiedApiName',
                  operator: 'IN',
                  value: childRelationshipObjects,
                  literalType: 'STRING',
                },
                operator: 'AND',
                right: {
                  left: {
                    field: 'IsQueryable',
                    operator: '=',
                    value: 'true',
                    literalType: 'BOOLEAN',
                  },
                },
              },
            })
        );

        const entityQueryResults = await queryAllFromList<{
          Id: string;
          QualifiedApiName: string;
          Fields: QueryResult<{ Id: string; QualifiedApiName: string }> | null;
        }>(selectedOrg, entityParticleQueries);

        const queryResultsByObject = groupByFlat(entityQueryResults.queryResults.records, 'QualifiedApiName');

        const subqueries = childRelationships
          .filter((item) => item.relationshipName && queryResultsByObject[item.childSObject]?.Fields?.records.length)
          .map((childRelationship) => {
            const fields = new Set(
              queryResultsByObject[childRelationship.childSObject]?.Fields?.records?.map?.((record) => record.QualifiedApiName) || []
            );
            if (fields.has('CreatedById')) {
              fields.add('CreatedBy.Name');
            }
            if (fields.has('LastModifiedById')) {
              fields.add('LastModifiedBy.Name');
            }
            return getField({
              subquery: {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                relationshipName: childRelationship.relationshipName!,
                fields: Array.from(fields).map((field) => getField(field)),
              },
            });
          });

        // combine all results with subqueries into this one record
        let record = {};

        for (const subquery of splitArrayToMaxSize(subqueries, 11)) {
          try {
            const query = composeQuery({
              sObject: sobjectName,
              fields: [getField('Id'), getField(SOBJECT_NAME_FIELD_MAP[sobjectName] || 'Name'), ...subquery],
              where: {
                left: {
                  field: 'Id',
                  operator: '=',
                  value: parentRecordId,
                  literalType: 'STRING',
                },
              },
            });

            const { queryResults } = skipCache ? await queryAll(selectedOrg, query) : (await queryAllWithCache(selectedOrg, query)).data;
            if (!isMounted.current) {
              return;
            }
            record = { ...record, ...queryResults.records[0] };
          } catch (ex) {
            setHasFetchErrors((existing) => [...existing, ex.message]);
            logger.warn('Error querying child records', { ex });
          }
        }

        logger.log({ childRelationships, record });

        const _rows = getRows(childRelationships, record);
        setRows(_rows);
        setExpandedGroupIds(new Set(_rows.map((row) => row._groupByLabel)));

        onChildrenData && onChildrenData(parentRecordId, record);
        trackEvent(ANALYTICS_KEYS.record_modal_view_children, { subqueryCount: subqueries.length, childRecordCount: _rows });
      } catch (ex) {
        logger.warn('Error loading records', ex);
        setHasFetchErrors((existing) => [...existing, ex.message]);
      } finally {
        setLoading(false);
      }
    },
    [childRelationships, onChildrenData, parentRecordId, selectedOrg, sobjectName, trackEvent]
  );

  useEffect(() => {
    if (initialData) {
      const _rows = getRows(childRelationships, initialData);
      setRows(_rows);
      setExpandedGroupIds(new Set(_rows.map((row) => row._groupByLabel)));
      setLoading(false);
    } else {
      fetchChildRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchChildRecords]);

  if (loading) {
    return (
      <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={155}>
        <Spinner />
      </AutoFullHeightContainer>
    );
  }

  return (
    <>
      {!!fetchErrors.length && (
        <ScopedNotification theme="warning">
          There was an error fetching some child records. <PopoverErrorButton errors={fetchErrors} omitPortal />
        </ScopedNotification>
      )}
      <Grid
        align="end"
        css={css`
          margin-top: -0.5rem;
        `}
      >
        <Tooltip
          content={
            'Child records are cached to speed things up, but the records may be out of date. You can reload data to get the latest version of all the records.'
          }
        >
          <button className="slds-button slds-m-right_small" disabled={loading} onClick={() => fetchChildRecords(true)}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Reload Records
          </button>
        </Tooltip>
      </Grid>
      <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={155}>
        <DataTree
          columns={columns}
          data={rows}
          serverUrl={serverUrl}
          skipFrontdoorLogin={skipFrontDoorAuth}
          getRowKey={getRowId}
          includeQuickFilter
          groupBy={groupedRows}
          rowGrouper={groupBy}
          expandedGroupIds={expandedGroupIds}
          onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
          context={{ portalRefForFilters: modalRef }}
        />
      </AutoFullHeightContainer>
    </>
  );
};
