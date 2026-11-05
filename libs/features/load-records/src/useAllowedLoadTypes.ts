import { InsertUpdateUpsertDelete } from '@jetstream/types';
import { useCanPerformOperation } from '@jetstream/ui/app-state';
import { useMemo } from 'react';

const WRITE_LOAD_TYPES: InsertUpdateUpsertDelete[] = ['INSERT', 'UPDATE', 'UPSERT'];
const DELETE_LOAD_TYPES: InsertUpdateUpsertDelete[] = ['DELETE', 'HARD_DELETE'];

export const LOAD_NOT_ALLOWED_MESSAGE = `Your Jetstream access does not include loading records.`;
export const LOAD_TYPE_NOT_ALLOWED_MESSAGE = `Your Jetstream access does not include this type of data load.`;

/** Load types the member's team access profile allows, in the order they are shown */
export function useAllowedLoadTypes(): InsertUpdateUpsertDelete[] {
  const canWriteRecords = useCanPerformOperation('records.write');
  const canDeleteRecords = useCanPerformOperation('records.delete');
  return useMemo(
    () => [...(canWriteRecords ? WRITE_LOAD_TYPES : []), ...(canDeleteRecords ? DELETE_LOAD_TYPES : [])],
    [canWriteRecords, canDeleteRecords],
  );
}
