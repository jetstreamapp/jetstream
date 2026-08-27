import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { setItemInLocalStorage } from '@jetstream/shared/ui-utils';
import { PermissionTableFieldCell, PermissionTableSummaryRow } from '@jetstream/types';
import { ColumnWithFilter } from '@jetstream/ui';
import { useAnalytics } from '@jetstream/ui-core';
import { STORAGE_KEYS } from '@jetstream/ui/app-state';
import { useCallback, useState } from 'react';
import {
  FIELD_AUDIT_COLUMN_KEYS,
  FieldAuditColumnKey,
  isFieldAuditColumnKey,
  parseVisibleFieldAuditColumns,
  serializeVisibleFieldAuditColumns,
} from './utils/permission-manager-field-audit-columns';

/**
 * A stale or hand-edited value should not break the table, so anything unparseable is discarded and the columns
 * fall back to hidden.
 */
function getStoredVisibleFieldAuditColumns(): ReadonlySet<FieldAuditColumnKey> {
  try {
    return parseVisibleFieldAuditColumns(localStorage.getItem(STORAGE_KEYS.PERMISSION_MANAGER_FIELD_AUDIT_COLUMNS));
  } catch (ex) {
    logger.warn('[MANAGE PERMISSIONS] Could not read stored field audit columns', ex);
    return new Set();
  }
}

/**
 * Owns which optional audit columns are shown on the field permissions table: the in-memory set, its persistence
 * to local storage, and the analytics event fired on every change.
 */
export function useVisibleFieldAuditColumns() {
  const { trackEvent } = useAnalytics();
  const [visibleColumns, setVisibleColumns] = useState<ReadonlySet<FieldAuditColumnKey>>(getStoredVisibleFieldAuditColumns);

  const persist = useCallback(
    (newValue: ReadonlySet<FieldAuditColumnKey>, columnKey: FieldAuditColumnKey | 'all', visible: boolean) => {
      setVisibleColumns(newValue);
      setItemInLocalStorage(STORAGE_KEYS.PERMISSION_MANAGER_FIELD_AUDIT_COLUMNS, serializeVisibleFieldAuditColumns(newValue));
      trackEvent(ANALYTICS_KEYS.permission_manager_field_audit_columns_toggled, { columnKey, visible });
    },
    [trackEvent],
  );

  const toggleColumn = useCallback(
    (columnKey: FieldAuditColumnKey, visible: boolean) => {
      const newValue = new Set(visibleColumns);
      if (visible) {
        newValue.add(columnKey);
      } else {
        newValue.delete(columnKey);
      }
      persist(newValue, columnKey, visible);
    },
    [persist, visibleColumns],
  );

  const toggleAll = useCallback(
    (visible: boolean) => {
      persist(visible ? new Set(FIELD_AUDIT_COLUMN_KEYS) : new Set<FieldAuditColumnKey>(), 'all', visible);
    },
    [persist],
  );

  /** Drops the audit columns that are currently hidden; every other column passes through untouched. */
  const filterColumns = useCallback(
    (columns: ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>[]) =>
      columns.filter((column) => !isFieldAuditColumnKey(column.key) || visibleColumns.has(column.key)),
    [visibleColumns],
  );

  return { visibleColumns, toggleColumn, toggleAll, filterColumns };
}
