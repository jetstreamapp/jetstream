// import { INDEXED_DB } from '@jetstream/shared/constants';
// import { MapOf, SalesforceOrgUi } from '@jetstream/types';
// import { Input, Modal, Tooltip } from '@jetstream/ui';
// import localforage from 'localforage';
// import { Fragment, FunctionComponent, useState } from 'react';
// import { isTableRowItem } from './automation-control-data-utils';
// import { FlowViewRecord, TableRowItem, TableRowItemSnapshot, TableRowOrItemOrChild } from './automation-control-types';

// export interface AutomationControlEditorReviewModalProps {
//   selectedOrg: SalesforceOrgUi;
//   rows: TableRowOrItemOrChild[];
// }

// export const AutomationControlEditorReviewModal: FunctionComponent<AutomationControlEditorReviewModalProps> = ({ selectedOrg, rows }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [name, setName] = useState('');
//   const [loading, setLoading] = useState(false);

//   function handleClose() {
//     setIsOpen(false);
//   }

//   async function handleSave() {
//     setLoading(true);
//     try {
//       const snapshot = rows
//         .filter((row) => isTableRowItem(row))
//         .map(({ type, sobject, record, isActive, activeVersionNumber }: TableRowItem): TableRowItemSnapshot => {
//           if (type === 'FlowRecordTriggered' || type === 'FlowProcessBuilder') {
//             return {
//               key: `${type}_${(record as FlowViewRecord).DurableId}`,
//               type,
//               sobject,
//               isActive,
//               activeVersionNumber,
//             };
//           } else {
//             return {
//               key: `${type}_${record.Id}`,
//               type,
//               sobject,
//               isActive,
//               activeVersionNumber,
//             };
//           }
//         });
//       const snapshotMap =
//         (await localforage.getItem<Record<string, TableRowItemSnapshot[]>>(`${INDEXED_DB.KEYS.automationControlHistory}:${selectedOrg.uniqueId}`)) ||
//         {};
//       snapshotMap[name] = snapshot;

//       await localforage.setItem(`${INDEXED_DB.KEYS.automationControlHistory}:${selectedOrg.uniqueId}`, snapshotMap);
//       handleClose();
//     } catch (ex) {
//       setLoading(false);
//       // TODO: show error message
//     }
//   }

//   return (
//     <div>
//       {isOpen && (
//         <Modal
//           header="Save Snapshot"
//           className="slds-is-relative"
//           onClose={handleClose}
//           footer={
//             <Fragment>
//               <button className="slds-button slds-button_neutral" onClick={handleClose}>
//                 Cancel
//               </button>
//               <button className="slds-button slds-button_brand" onClick={handleSave} disabled={!name || loading}>
//                 Save Snapshot
//               </button>
//             </Fragment>
//           }
//         >
//           <div className="slds-is-relative slds-p-around_x-large">
//             <p>
//               You can save a snapshot of all items in their current state. When you recall a snapshot, the table with all the metadata will
//               be updated to match the snapshot and allow you to make changes before deploying.
//             </p>
//             <Input label="Snapshot Name" isRequired className="slds-p-vertical_medium">
//               <input
//                 id="snapshot-name"
//                 className="slds-input"
//                 placeholder="Choose a name"
//                 value={name}
//                 onChange={(event) => setName(event.target.value)}
//               />
//             </Input>
//           </div>
//         </Modal>
//       )}
//       <Tooltip content="Saving a snapshot allows you to rollback to this configuration in the future.">
//         <button className="slds-button slds-button_neutral" onClick={() => setIsOpen(true)}>
//           Save Snapshot
//         </button>
//       </Tooltip>
//     </div>
//   );
// };

// export default AutomationControlEditorReviewModal;
