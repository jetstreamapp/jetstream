import { appActionObservable$, useObservable } from '@jetstream/shared/ui-utils';
import { Modal } from '@jetstream/ui';
import { useEffect, useState } from 'react';

/**
 * Stand-in for ViewEditCloneRecordWrapper: mounts the real Modal in response to VIEW_RECORD through
 * the same steps as the wrapper (observable → state → effect → await → state), so the modal mounts
 * in a later commit than whatever emitted the event and the popover → modal focus hand-off runs
 * through the same floating-ui focus managers as production, without the record form's data needs.
 */
export function ViewRecordModalStandIn() {
  const appAction = useObservable(appActionObservable$);
  const [recordId, setRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (appAction?.action !== 'VIEW_RECORD') {
      return;
    }
    let cancelled = false;
    // The wrapper awaits a describe call before it opens the modal
    Promise.resolve().then(() => {
      if (!cancelled) {
        setRecordId(appAction.payload.recordId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [appAction]);

  if (!recordId) {
    return null;
  }

  return (
    <Modal header={`Record ${recordId}`} onClose={() => setRecordId(null)}>
      <p>Record details</p>
    </Modal>
  );
}
