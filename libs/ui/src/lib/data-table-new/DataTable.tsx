// import { css } from '@emotion/react';
import { FunctionComponent, memo, useMemo, useRef, useState } from 'react';
import DataGrid, { Column, DataGridProps, SortColumn, SortStatusProps } from 'react-data-grid';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
// import AutoFullHeightContainerFn from '../layout/AutoFullHeightContainerFn';
import 'react-data-grid/lib/styles.css';
import './data-table-styles.scss';
import Icon from '../widgets/Icon';
import { IconName } from '@jetstream/icon-factory';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { configIdLinkRenderer } from './DataTableRenderers';

function sortStatus({ sortDirection, priority }: SortStatusProps) {
  const iconName: IconName = sortDirection === 'ASC' ? 'arrowup' : 'arrowdown';
  return (
    <>
      {sortDirection !== undefined ? (
        <Icon type="utility" icon={iconName} className="slds-icon slds-icon-text-default slds-is-sortable__icon" />
      ) : null}
      {/* <span className={sortPriorityClassname}>{priority}</span> */}
    </>
  );
}

export interface DataTableNewProps extends Omit<DataGridProps<any>, 'columns' | 'rows'> {
  data: any[];
  columns: Column<any>[];
  serverUrl?: string;
  org?: SalesforceOrgUi;
}

const DataTable: FunctionComponent<DataTableNewProps> = ({ data, columns, serverUrl, org, ...rest }) => {
  // const [columnResizeMode, setColumnResizeMode] = useState<ColumnResizeMode>('onChange');

  // const table = useReactTable({
  //   data,
  //   columns,
  //   columnResizeMode: 'onChange',
  //   getCoreRowModel: getCoreRowModel(),
  //   debugTable: true,
  //   // debugHeaders: true,
  //   // debugColumns: true,
  //   // debugRows: true,
  // });

  const tableContainerRef = useRef<HTMLTableSectionElement>(null);
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);

  // const { rows } = table.getRowModel();

  // const rowVirtualizer = useVirtual({
  //   parentRef: tableContainerRef,
  //   size: rows.length,
  //   overscan: 50,
  // });

  // const rowVirtualizer = useVirtualizer({
  //   count: rows.length,
  //   getScrollElement: () => tableContainerRef.current,
  //   estimateSize: () => 28.5,
  //   // debug: true,
  //   initialOffset: 30,
  //   overscan: 50,
  // });

  // const virtualRows = rowVirtualizer.getVirtualItems();
  // const totalSize = rowVirtualizer.getTotalSize();

  // const { virtualItems: virtualRows, totalSize } = rowVirtualizer;

  // const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  // const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) : 0;

  const sortedRows = useMemo((): readonly any[] => {
    if (sortColumns.length === 0) {
      return data;
    }
    return orderObjectsBy(
      data,
      sortColumns.map(({ columnKey }) => columnKey) as any,
      sortColumns.map(({ direction }) => (direction === 'ASC' ? 'asc' : 'desc'))
    );
  }, [data, sortColumns]);

  if (serverUrl && org) {
    configIdLinkRenderer(serverUrl, org);
  }

  return (
    <DataGrid
      className="rdg-light fill-grid"
      columns={columns}
      rows={sortedRows}
      renderers={{ sortStatus }}
      sortColumns={sortColumns}
      onSortColumnsChange={setSortColumns}
      {...rest}
    />

    // <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={10}>
    //   {({ cssStyles }) => (
    //     <div ref={tableContainerRef} css={cssStyles}>
    // <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={10}>
    //   {({ cssStyles }) => (
    //     <table className="slds-table  slds-table_bordered slds-table_col-bordered slds-table_fixed-layout slds-table_resizable-cols">
    //       <thead>
    //         {table.getHeaderGroups().map((headerGroup) => (
    //           <tr key={headerGroup.id} className="slds-line-height_reset">
    //             {headerGroup.headers.map((header) => (
    //               <th
    //                 key={header.id}
    //                 scope="col"
    //                 className="slds-is-resizable slds-is-sortable slds-cell_action-mode"
    //                 style={{ width: header.getSize() }}
    //               >
    //                 {header.isPlaceholder ? null : (
    //                   <>
    //                     {/* TODO: title */}
    //                     <div className="slds-truncate slds-p-horizontal_x-small slds-p-vertical_xx-small">
    //                       {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
    //                     </div>
    //                     {header.column.getCanResize() && (
    //                       <div className="slds-resizable">
    //                         <input type="range" className="slds-resizable__input slds-assistive-text" max="1000" min="20" tabIndex={0} />
    //                         <span
    //                           className="slds-resizable__handle"
    //                           onMouseDown={header.getResizeHandler()}
    //                           onTouchStart={header.getResizeHandler()}
    //                         >
    //                           <span className="slds-resizable__divider"></span>
    //                         </span>
    //                       </div>
    //                     )}
    //                   </>
    //                 )}
    //               </th>
    //             ))}
    //             <th />
    //           </tr>
    //         ))}
    //       </thead>
    //       <tbody ref={tableContainerRef} css={cssStyles}>
    //         {/* <tbody> */}
    //         {/* {paddingTop > 0 && (
    //             <tr>
    //               <td style={{ height: `${paddingTop}px` }} />
    //             </tr>
    //           )} */}
    //         {rows.map((row) => {
    //           //virtualRows.map((virtualRow) => {
    //           // const row = rows[virtualRow.index] as Row<any>;
    //           return (
    //             <tr key={row.id} className="slds-hint-parent">
    //               {/* TODO: checkbox column changes this a bit */}
    //               {row.getVisibleCells().map((cell, i) =>
    //                 i === 0 ? (
    //                   <th key={cell.id} scope="row" className="slds-cell_action-mode">
    //                     {flexRender(cell.column.columnDef.cell, cell.getContext())}
    //                   </th>
    //                 ) : (
    //                   <td key={cell.id} role="gridcell" className="slds-cell_action-mode">
    //                     {flexRender(cell.column.columnDef.cell, cell.getContext())}
    //                   </td>
    //                 )
    //               )}
    //               <td />
    //             </tr>
    //           );
    //         })}
    //         {/* {paddingBottom > 0 && (
    //             <tr>
    //               <td style={{ height: `${paddingBottom}px` }} />
    //             </tr>
    //           )} */}
    //       </tbody>
    //     </table>
    //   )}
    // </AutoFullHeightContainer>
    // </div>
  );
};

export const DataTableNew = memo(DataTable);

export default DataTableNew;
