import { INDEXED_DB } from '@jetstream/shared/constants';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { EmptyState, FishIllustration, Modal, Select, Tooltip } from '@jetstream/ui';
import localforage from 'localforage';
import { Fragment, FunctionComponent, useCallback, useEffect, useState } from 'react';
import { TableRowItemSnapshot } from './automation-control-types';
/**
 * TODO:
 * Started implementing this but turned out to be a ton of work
 * this is here for future use, but is not complete
 */
export interface AutomationControlEditorReviewModalProps {
  selectedOrg: SalesforceOrgUi;
  onRestore: (snapshot: TableRowItemSnapshot[]) => void;
}

export const AutomationControlEditorReviewModal: FunctionComponent<AutomationControlEditorReviewModalProps> = ({
  selectedOrg,
  onRestore,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<MapOf<TableRowItemSnapshot[]>>();
  const [snapshotsItems, setSnapshotItems] = useState<string[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>();

  const getSnapshots = useCallback(async () => {
    try {
      const snapshotMap =
        (await localforage.getItem<MapOf<TableRowItemSnapshot[]>>(`${INDEXED_DB.KEYS.automationControlHistory}:${selectedOrg.uniqueId}`)) ||
        {};
      setSnapshots(snapshotMap);
      setSnapshotItems(Object.keys(snapshotMap));
      setSelectedSnapshot(Object.keys(snapshotMap)[0]);
    } catch (ex) {
      // TODO: handle error
    }
  }, [selectedOrg.uniqueId]);

  useEffect(() => {
    if (isOpen) {
      getSnapshots();
    }
  }, [getSnapshots, isOpen]);

  function handleClose() {
    setIsOpen(false);
  }

  async function handleRestore() {
    onRestore(snapshots[selectedSnapshot]);
    handleClose();
  }

  return (
    <div>
      {isOpen && (
        <Modal
          header="Restore Snapshot"
          className="slds-is-relative"
          onClose={handleClose}
          footer={
            <Fragment>
              <button className="slds-button slds-button_neutral" onClick={handleClose}>
                Cancel
              </button>
              <button className="slds-button slds-button_brand" onClick={handleRestore} disabled={!selectedSnapshot}>
                Restore Snapshot
              </button>
            </Fragment>
          }
        >
          <div className="slds-is-relative slds-p-around_x-large">
            <p>
              Recalling a saved snapshot will update the table based on what was configured at the time of the snapshot. If any items no
              longer exist, then they will be ignored when restored.
            </p>
            {!!snapshotsItems?.length && (
              <Select id={'restore'} label={'Snapshots'}>
                <select
                  aria-describedby="restore"
                  className="slds-select"
                  id="restore-select"
                  required
                  value={selectedSnapshot}
                  onChange={(event) => setSelectedSnapshot(event.target.value)}
                >
                  {snapshotsItems.map((item, i) => (
                    <option key={`${i}-${item}`} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Select>
            )}
            {!snapshotsItems?.length && (
              <EmptyState headline="There are no saved snapshots" illustration={<FishIllustration />}></EmptyState>
            )}
          </div>
        </Modal>
      )}
      <Tooltip content="Restoring a snapshot will update the table based on a historical point in time.">
        <button className="slds-button slds-button_neutral slds-m-left_x-small" onClick={() => setIsOpen(true)}>
          Restore Snapshot
        </button>
      </Tooltip>
    </div>
  );
};

export default AutomationControlEditorReviewModal;
