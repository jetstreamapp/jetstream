import { formatNumber } from '@jetstream/shared/ui-utils';
import {
  AutoFullHeightContainer,
  Badge,
  Checkbox,
  ColumnWithFilter,
  DataTable,
  Grid,
  Icon,
  SearchInput,
  setColumnFromType,
  Tooltip,
} from '@jetstream/ui';
import { FunctionComponent, useMemo, useState } from 'react';
import { OrgAlignmentTypeResult } from './orgAlignmentTypes';

interface SummaryRow {
  type: string;
  typeLabel: string;
  statusLabel: string;
  different: number;
  onlyInSource: number;
  onlyInTarget: number;
  same: number;
  notCompared: number;
  typeResult: OrgAlignmentTypeResult;
}

const getRowKey = ({ type }: SummaryRow) => type;

const EXECUTION_STATUS_LABELS: Record<OrgAlignmentTypeResult['executionStatus'], string> = {
  pending: 'Waiting',
  listing: 'In Progress',
  retrieving: 'In Progress',
  comparing: 'In Progress',
  complete: 'Complete',
  error: 'Failed',
  canceled: 'Canceled',
  uncomparable: 'Not Compared',
};

function hasDifferences({ counts }: OrgAlignmentTypeResult) {
  return counts.different > 0 || counts.onlyInSource > 0 || counts.onlyInTarget > 0;
}

function getStatusCell({ type, executionStatus, progressMessage, uncomparableReason, errorMessage }: OrgAlignmentTypeResult) {
  const label = EXECUTION_STATUS_LABELS[executionStatus];
  switch (executionStatus) {
    case 'listing':
    case 'retrieving':
    case 'comparing':
      return <span className="slds-text-color_weak slds-truncate">{progressMessage || 'Processing...'}</span>;
    case 'complete':
      return <Badge type="success">{label}</Badge>;
    case 'canceled':
      return <Badge type="warning">{label}</Badge>;
    case 'uncomparable':
      return (
        <Tooltip id={`org-alignment-summary-skipped-${type}`} content={uncomparableReason || 'Cannot be compared reliably'}>
          <Badge type="light">{label}</Badge>
        </Tooltip>
      );
    case 'error':
      return (
        <Tooltip id={`org-alignment-summary-error-${type}`} content={errorMessage || 'Failed to compare this type'}>
          <Badge type="error">{label}</Badge>
        </Tooltip>
      );
    default:
      return <Badge type="light">{label}</Badge>;
  }
}

function getColumns(
  canRetry: boolean,
  onViewComponents: (metadataType: string) => void,
  onRetry: (metadataTypes: string[]) => void,
): ColumnWithFilter<SummaryRow>[] {
  const getCountColumn = (key: keyof SummaryRow & string, name: string): ColumnWithFilter<SummaryRow> => ({
    ...setColumnFromType(key, 'number'),
    name,
    key,
    width: 140,
    cellClass: 'slds-text-align_right',
    renderCell: ({ row }) => formatNumber(row[key] as number),
  });

  return [
    {
      key: 'actions',
      name: '',
      width: 40,
      minWidth: 40,
      maxWidth: 40,
      resizable: false,
      sortable: false,
      frozen: true,
      renderCell: ({ row }) => {
        const { type, executionStatus, components } = row.typeResult;
        const isIncomplete = executionStatus === 'error' || executionStatus === 'canceled';
        const canView = executionStatus === 'complete' && components.length > 0;
        if (!canView && !(isIncomplete && canRetry)) {
          return null;
        }
        const label = canView ? 'View the components of this type' : 'Compare this type again';
        return (
          <div className="slds-grid slds-grid_align-center slds-grid_vertical-align-center h-100 w-100">
            <Tooltip ariaRole="label" content={label}>
              <button
                type="button"
                className="slds-button slds-button_icon"
                onClick={() => (canView ? onViewComponents(type) : onRetry([type]))}
                tabIndex={-1}
              >
                <Icon type="utility" icon={canView ? 'preview' : 'refresh'} className="slds-button__icon" omitContainer title={label} />
              </button>
            </Tooltip>
          </div>
        );
      },
    },
    { ...setColumnFromType('typeLabel', 'text'), name: 'Metadata Type', key: 'typeLabel', frozen: true, width: 280 },
    {
      ...setColumnFromType('statusLabel', 'text'),
      name: 'Status',
      key: 'statusLabel',
      width: 220,
      renderCell: ({ row }) => <div className="slds-grid slds-grid_vertical-align-center h-100">{getStatusCell(row.typeResult)}</div>,
    },
    getCountColumn('different', 'Different'),
    getCountColumn('onlyInSource', 'Only in Source'),
    getCountColumn('onlyInTarget', 'Only in Target'),
    getCountColumn('same', 'Same'),
    {
      ...getCountColumn('notCompared', 'Not Compared'),
      renderCell: ({ row }) => {
        const { type, counts } = row.typeResult;
        if (row.notCompared === 0) {
          return '0';
        }
        return (
          <Tooltip
            id={`org-alignment-summary-not-compared-${type}`}
            content={`${formatNumber(counts.uncomparable)} could not be compared, ${formatNumber(counts.managedSkipped)} managed package components were skipped`}
          >
            <span>{formatNumber(row.notCompared)}</span>
          </Tooltip>
        );
      },
    },
  ];
}

export interface OrgAlignmentSummaryTableProps {
  typeResults: OrgAlignmentTypeResult[];
  /** Types that failed or were canceled */
  incompleteTypes: string[];
  isRunning: boolean;
  /** Changes whenever content above the table grows or collapses so the table height is measured again */
  layoutKey: string;
  onViewComponents: (metadataType: string) => void;
  onRetry: (metadataTypes: string[]) => void;
}

export const OrgAlignmentSummaryTable: FunctionComponent<OrgAlignmentSummaryTableProps> = ({
  typeResults,
  incompleteTypes,
  isRunning,
  layoutKey,
  onViewComponents,
  onRetry,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyTypesWithDifferences, setOnlyTypesWithDifferences] = useState(false);

  const columns = useMemo(() => getColumns(!isRunning, onViewComponents, onRetry), [isRunning, onRetry, onViewComponents]);

  const rows = useMemo(
    () =>
      typeResults
        .filter((typeResult) => !onlyTypesWithDifferences || typeResult.executionStatus !== 'complete' || hasDifferences(typeResult))
        .map((typeResult): SummaryRow => ({
          type: typeResult.type,
          typeLabel: typeResult.typeLabel === typeResult.type ? typeResult.type : `${typeResult.typeLabel} (${typeResult.type})`,
          statusLabel: EXECUTION_STATUS_LABELS[typeResult.executionStatus],
          different: typeResult.counts.different,
          onlyInSource: typeResult.counts.onlyInSource,
          onlyInTarget: typeResult.counts.onlyInTarget,
          same: typeResult.counts.same,
          notCompared: typeResult.counts.uncomparable + typeResult.counts.managedSkipped,
          typeResult,
        })),
    [onlyTypesWithDifferences, typeResults],
  );

  return (
    <div>
      <Grid align="spread" verticalAlign="center" wrap className="slds-m-bottom_x-small">
        <Grid verticalAlign="center" wrap>
          <div className="slds-m-right_small">
            <SearchInput
              id="org-alignment-type-summary-search"
              placeholder="Search metadata types..."
              value={searchTerm}
              onChange={(value) => setSearchTerm(value || '')}
            />
          </div>
          <Checkbox
            id="org-alignment-only-types-with-differences"
            label="Only show types with differences"
            checked={onlyTypesWithDifferences}
            onChange={setOnlyTypesWithDifferences}
          />
        </Grid>
        {incompleteTypes.length > 0 && !isRunning && (
          <button type="button" className="slds-button slds-button_neutral" onClick={() => onRetry(incompleteTypes)}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Retry {formatNumber(incompleteTypes.length)} Incomplete {incompleteTypes.length === 1 ? 'Type' : 'Types'}
          </button>
        )}
      </Grid>
      <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25} minHeight="22rem" recalculateKey={layoutKey}>
        <DataTable columns={columns} data={rows} getRowKey={getRowKey} includeQuickFilter quickFilterText={searchTerm} />
      </AutoFullHeightContainer>
    </div>
  );
};

export default OrgAlignmentSummaryTable;
