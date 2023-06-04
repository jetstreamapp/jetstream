import { css } from '@emotion/react';
import { encodeHtmlEntitySalesforceCompatible, orderObjectsBy, orderStringsBy } from '@jetstream/shared/utils';
import { ListItem, MapOf } from '@jetstream/types';
import { ColumnWithFilter, Grid, Icon, SummaryFilterRenderer, Tooltip, setColumnFromType } from '@jetstream/ui';
import { ChangeEvent, FunctionComponent, useState } from 'react';
import { FormatterProps } from 'react-data-grid';
import { RecordTypeData } from '../usePermissionRecordTypes';
import { ColumnSearchFilter, ColumnSearchFilterSummary } from './permission-manager-table-utils';
import {
  DirtyRow,
  LayoutAssignment,
  PermissionManagerObjectWithRecordType,
  PermissionManagerObjectWithRecordTypes,
  PermissionManagerRecordTypeRow,
  PermissionTableSummaryRow,
  RecordTypeSaveData,
  RecordTypeVisibility,
} from './permission-manager-types';

export const REC_TYPE_COLUMN_SUFFIX = {
  LAYOUT: '-layout-assignment',
  VISIBLE: '-record-type-visible',
  DEFAULT: '-record-type-default',
};

export function getDirtyRecordTypePermissions(
  dirtyRows: MapOf<DirtyRow<PermissionManagerRecordTypeRow>>
): PermissionManagerObjectWithRecordType[] {
  return Object.values(dirtyRows).flatMap(({ row }) =>
    Object.values(row.permissions).filter((permission) =>
      isRecordTypePermissionDirty(permission, row.permissionsOriginal[permission.profile])
    )
  );
}

export function isRecordTypePermissionDirty(
  permission: PermissionManagerObjectWithRecordType,
  permissionsOriginal: PermissionManagerObjectWithRecordType
): boolean {
  return (
    permission.default !== permissionsOriginal.default ||
    permission.visible !== permissionsOriginal.visible ||
    permission.layoutName !== permissionsOriginal.layoutName
  );
}

export function prepareRecordTypePermissionSaveData(dirtyPermissions: PermissionManagerObjectWithRecordType[]): RecordTypeSaveData {
  return dirtyPermissions.reduce(
    (
      output: { [profile: string]: { layoutAssignments: LayoutAssignment[]; recordTypeVisibilities: RecordTypeVisibility[] } },
      permission,
      i
    ) => {
      const profile = encodeHtmlEntitySalesforceCompatible(permission.profile);
      output[profile] = output[profile] || {
        layoutAssignments: [],
        recordTypeVisibilities: [],
      };
      // TODO: it is possible that only one of these is dirty, but we are saving both
      output[profile].layoutAssignments.push({
        layout: encodeHtmlEntitySalesforceCompatible(permission.layoutName),
        recordType: `${permission.recordType.SobjectType}.${permission.recordType.DeveloperName}`,
      });
      output[profile].recordTypeVisibilities.push({
        default: permission.default,
        recordType: `${permission.recordType.SobjectType}.${permission.recordType.DeveloperName}`,
        visible: permission.visible,
      });
      return output;
    },
    {}
  );
}

export function getTableDataForRecordTypes(recordTypeData: RecordTypeData) {
  const { profilesWithLayoutAndRecordTypeVisibilities, recordTypes, layouts } = recordTypeData;

  const layoutsBySobject = layouts.reduce((acc: MapOf<RecordTypeData['layouts']>, layout) => {
    acc[layout.EntityDefinition.QualifiedApiName] = acc[layout.EntityDefinition.QualifiedApiName] || [];
    acc[layout.EntityDefinition.QualifiedApiName].push(layout);
    return acc;
  }, {});

  const objectsWithRecordTypes: PermissionManagerObjectWithRecordTypes = recordTypes.reduce((acc, recordType) => {
    acc[recordType.SobjectType] = acc[recordType.SobjectType] || {};
    acc[recordType.SobjectType][recordType.DeveloperName] = {};
    // FIXME: we should handle or ignore PersonAccounts since they have special behavior
    profilesWithLayoutAndRecordTypeVisibilities.forEach((item) => {
      acc[recordType.SobjectType][recordType.DeveloperName][item.profile] = {
        recordType,
        profile: item.profile,
        profileFullName: item.profileFullName,
      };
    });
    return acc;
  }, {});

  profilesWithLayoutAndRecordTypeVisibilities.forEach((item) => {
    // TODO: what if there are no layoutAssignments?
    item.layoutAssignments.forEach((layoutAssignment) => {
      if (!layoutAssignment.layout) {
        return;
      }
      let sobject = layoutAssignment.layout.split('-')[0];
      const [_, recordType] = layoutAssignment.recordType?.split('.') || [];
      // TODO: this has special behavior, we should only allow changing assignment - nothing else
      if (!recordType) {
        sobject = '--MASTER--';
      }
      if (sobject && recordType) {
        objectsWithRecordTypes[sobject][recordType][item.profile].layoutLabel = layoutAssignment.layout.split(`${sobject}-`)[1] || '';
        objectsWithRecordTypes[sobject][recordType][item.profile].layoutName = layoutAssignment.layout;
      }
    });

    item.recordTypeVisibilities.forEach((recordTypeVisibility) => {
      if (!recordTypeVisibility.recordType) {
        return;
      }
      const [sobject, recordType] = recordTypeVisibility.recordType?.split('.') || [];
      if (sobject && recordType) {
        objectsWithRecordTypes[sobject][recordType][item.profile].default = recordTypeVisibility.default;
        objectsWithRecordTypes[sobject][recordType][item.profile].visible = recordTypeVisibility.visible;
      }
    });
  });

  // FIXME: we need to have a master row
  const rows: PermissionManagerRecordTypeRow[] = Object.keys(objectsWithRecordTypes).flatMap((sobject) =>
    orderStringsBy(Object.keys(objectsWithRecordTypes[sobject])).map((recordType) => {
      return {
        key: `${sobject}-${recordType}`,
        sobject,
        recordType,
        permissions: objectsWithRecordTypes[sobject][recordType],
        permissionsOriginal: JSON.parse(JSON.stringify(objectsWithRecordTypes[sobject][recordType])),
      };
    })
  );

  const columns: ColumnWithFilter<PermissionManagerRecordTypeRow, PermissionTableSummaryRow>[] = [
    {
      ...setColumnFromType('sobject', 'text'),
      name: 'Object',
      key: 'sobject',
      width: 85,
      cellClass: 'bg-color-gray-dark',
      summaryCellClass: 'bg-color-gray-dark',
      groupFormatter: ({ isExpanded }) => (
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
      ...setColumnFromType('recordType', 'text'),
      name: 'Record Type',
      key: 'recordType',
      frozen: true,
      width: 250,
      // TODO: filter value should include SObject.Foo at the beginning
      groupFormatter: ({ groupKey, childRows, toggleGroup }) => (
        <>
          <button className="slds-button" onClick={toggleGroup}>
            {groupKey as string}
          </button>
          <span className="slds-m-left_xx-small slds-text-body_small slds-text-color_weak">({childRows.length})</span>
        </>
      ),
      summaryCellClass: 'bg-color-gray-dark no-outline',
      summaryFormatter: ({ row }) => {
        if (row.type === 'HEADING') {
          return <ColumnSearchFilterSummary />;
        } else if (row.type === 'ACTION') {
          return <ColumnSearchFilter />;
        }
        return undefined;
      },
    },
  ];

  profilesWithLayoutAndRecordTypeVisibilities.forEach(({ profile }) => {
    getColumnsForProfile(profile, layoutsBySobject).forEach((column) => columns.push(column));
  });

  return { objectsWithRecordTypes, rows, columns };
}

function getColumnsForProfile(
  profile: string,
  layoutsBySobject: MapOf<RecordTypeData['layouts']>
): ColumnWithFilter<PermissionManagerRecordTypeRow, PermissionTableSummaryRow>[] {
  return [
    {
      name: `${profile} (Profile)`,
      key: `${profile}${REC_TYPE_COLUMN_SUFFIX.LAYOUT}`,
      width: 250, // TODO:
      resizable: true,
      filters: ['TEXT', 'SET'],
      colSpan: (args) => (args.type === 'HEADER' ? 3 : undefined),
      cellClass: (row) => {
        const value = row.permissions[profile]?.layoutLabel;
        const originalValue = row.permissionsOriginal[profile]?.layoutLabel;
        if (value !== originalValue) {
          return 'active-item-yellow-bg';
        }
        return '';
      },
      formatter: getProfileSelectRenderer(profile, layoutsBySobject),
      getValue: ({ column, row }) => row.permissions[profile]?.layoutLabel,
      summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
      summaryFormatter: (args) => {
        if (args.row.type === 'HEADING') {
          return <SummaryFilterRenderer columnKey={`${profile}${REC_TYPE_COLUMN_SUFFIX.LAYOUT}`} label="Page Layout" />;
        }
        return undefined;
      },
    },
    {
      name: `${profile} (Profile)`,
      key: `${profile}${REC_TYPE_COLUMN_SUFFIX.VISIBLE}`,
      width: 100, // TODO:
      resizable: true,
      filters: ['BOOLEAN_SET'],
      cellClass: (row) => {
        const value = row.permissions[profile]?.visible;
        const originalValue = row.permissionsOriginal[profile]?.visible;
        if (value !== originalValue) {
          return 'active-item-yellow-bg';
        }
        return '';
      },
      formatter: ({ column, isCellSelected, row, onRowChange }) => {
        const errorMessage = row.permissions[profile]?.errorMessage;
        const value = row.permissions[profile]?.visible;

        function handleChange(value: boolean) {
          const newRow = {
            ...row,
            permissions: {
              ...row.permissions,
              [profile]: {
                ...row.permissions[profile],
                visible: value,
              },
            },
          };
          onRowChange(newRow);
        }

        return (
          <div className="slds-align_absolute-center h-100" onClick={() => handleChange(!value)}>
            <label
              className="slds-form-element__label slds-assistive-text"
              htmlFor={`${profile}-${row.key}${REC_TYPE_COLUMN_SUFFIX.VISIBLE}-checkbox`}
            >
              Record Type Visible
            </label>
            <input
              type="checkbox"
              id={`${profile}-${row.key}${REC_TYPE_COLUMN_SUFFIX.VISIBLE}-checkbox`}
              checked={value}
              onChange={(ev) => {
                ev.stopPropagation();
                handleChange(ev.target.checked);
              }}
            ></input>
            {errorMessage && (
              <div
                css={css`
                  position: fixed;
                  margin-left: 40px;
                `}
              >
                <Tooltip
                  content={
                    <div>
                      <strong>{errorMessage}</strong>
                    </div>
                  }
                >
                  <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small" />
                </Tooltip>
              </div>
            )}
          </div>
        );
      },
      getValue: ({ column, row }) => (row.permissions[profile]?.visible ? 'true' : 'false'),
      summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
      summaryFormatter: (args) => {
        if (args.row.type === 'HEADING') {
          return <SummaryFilterRenderer columnKey={`${profile}${REC_TYPE_COLUMN_SUFFIX.VISIBLE}`} label="Visible" />;
        }
        return undefined;
      },
    },
    {
      name: `${profile} (Profile)`,
      key: `${profile}${REC_TYPE_COLUMN_SUFFIX.DEFAULT}`,
      width: 100, // TODO:
      resizable: true,
      filters: ['BOOLEAN_SET'], // TODO:
      cellClass: (row) => {
        const value = row.permissions[profile]?.default;
        const originalValue = row.permissionsOriginal[profile]?.default;
        if (value !== originalValue) {
          return 'active-item-yellow-bg';
        }
        return '';
      },
      formatter: ({ column, isCellSelected, row, onRowChange }) => {
        const errorMessage = row.permissions[profile]?.errorMessage;
        const value = row.permissions[profile]?.default;

        function handleChange() {
          // Do not allow de-selection
          if (value) {
            return;
          }
          const newRow = {
            ...row,
            permissions: {
              ...row.permissions,
              [profile]: {
                ...row.permissions[profile],
                default: true,
              },
            },
          };
          onRowChange(newRow);
        }

        return (
          <div className="slds-align_absolute-center h-100" onClick={() => handleChange()}>
            <label
              className="slds-form-element__label slds-assistive-text"
              htmlFor={`${profile}-${row.key}${REC_TYPE_COLUMN_SUFFIX.DEFAULT}`}
            >
              Is default Record Type
            </label>
            <input
              type="radio"
              id={`${profile}-${row.key}${REC_TYPE_COLUMN_SUFFIX.DEFAULT}`}
              checked={value}
              onClick={(ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                handleChange();
              }}
              onChange={(ev) => {
                ev.stopPropagation();
                ev.preventDefault();
              }}
            ></input>
            {errorMessage && (
              <div
                css={css`
                  position: fixed;
                  margin-left: 40px;
                `}
              >
                <Tooltip
                  content={
                    <div>
                      <strong>{errorMessage}</strong>
                    </div>
                  }
                >
                  <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small" />
                </Tooltip>
              </div>
            )}
          </div>
        );
      },
      getValue: ({ column, row }) => (row.permissions[profile]?.default ? 'true' : 'false'),
      summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
      summaryFormatter: (args) => {
        if (args.row.type === 'HEADING') {
          return <SummaryFilterRenderer columnKey={`${profile}${REC_TYPE_COLUMN_SUFFIX.DEFAULT}`} label="Default" />;
        }
        return undefined;
      },
    },
  ];
}

// FIXME: this seems to have a complete re-render when item is modified
function getProfileSelectRenderer(profile: string, layoutsBySobject: MapOf<RecordTypeData['layouts']>) {
  const ProfileSelectRenderer: FunctionComponent<FormatterProps<PermissionManagerRecordTypeRow, PermissionTableSummaryRow>> = ({
    row,
    onRowChange,
  }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [items] = useState<ListItem[]>(() =>
      orderObjectsBy(layoutsBySobject[row.sobject], 'Name').map((layout) => ({
        id: `${row.sobject}-${layout.Name}`,
        label: layout.Name,
        value: `${row.sobject}-${layout.Name}`,
        meta: layout,
      }))
    );
    const errorMessage = row.permissions[profile]?.errorMessage;
    const value = row.permissions[profile]?.layoutName;

    function handleChange(event: ChangeEvent<HTMLSelectElement>) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const selectedItem = items.find((item) => item.value === event.target.value)!;
      const newRow = {
        ...row,
        permissions: {
          ...row.permissions,
          [profile]: {
            ...row.permissions[profile],
            layoutLabel: selectedItem.label,
            layoutName: selectedItem.value,
          },
        },
      };
      onRowChange(newRow);
    }
    return (
      <div className="slds-align_absolute-center h-100">
        <div className="slds-form-element">
          <label
            className="slds-form-element__label slds-assistive-text"
            htmlFor={`${profile}-${row.key}${REC_TYPE_COLUMN_SUFFIX.LAYOUT}-select`}
          >
            Page Layouts
          </label>
          <div className="slds-form-element__control">
            <select
              className="slds-select"
              id={`${profile}-${row.key}${REC_TYPE_COLUMN_SUFFIX.LAYOUT}-select`}
              value={value}
              onChange={handleChange}
            >
              {items.map((item) => (
                <option key={item.id} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {errorMessage && (
            <div
              css={css`
                position: fixed;
                margin-left: 40px;
              `}
            >
              <Tooltip
                content={
                  <div>
                    <strong>{errorMessage}</strong>
                  </div>
                }
              >
                <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small" />
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    );
  };
  return ProfileSelectRenderer;
}
