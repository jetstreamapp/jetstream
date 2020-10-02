// /** @jsx jsx */
// import { jsx } from '@emotion/core';
// import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
// import { InsertUpdateUpsertDelete, SalesforceOrgUi } from '@jetstream/types';
// import { FileSelector, Grid, GridCol, Icon, ProgressIndicator, RadioButton, RadioGroup, Spinner } from '@jetstream/ui';
// import { DescribeGlobalSObjectResult } from 'jsforce';
// import isString from 'lodash/isString';
// import { parse as parseCsv } from 'papaparse';
// import { FunctionComponent, useEffect, useState } from 'react';
// import * as XLSX from 'xlsx';
// import LoadRecordsFieldMapping from './field-mapping/LoadRecordsFieldMapping';
// import { EntityParticleRecordWithRelatedExtIds, FieldMapping } from './load-records-types';
// import LoadRecordsLoadTypeButtons from './LoadRecordsLoadTypeButtons';
// import { autoMapFields, getFieldMetadata } from './utils/load-records-utils';

// export interface LoadRecordsConfigurationProps {
//   selectedOrg: SalesforceOrgUi;
//   selectedSObject: DescribeGlobalSObjectResult;
// }

// export const LoadRecordsConfiguration: FunctionComponent<LoadRecordsConfigurationProps> = ({ selectedOrg, selectedSObject }) => {
//   const [loading, setLoading] = useState<boolean>(false);
//   const [loadingFields, setLoadingFields] = useState<boolean>(false);
//   const [fileData, setFileData] = useState<any[]>();
//   const [errorMessage, setErrorMessage] = useState<string>(null);
//   const [fieldMappingModalOpen, setFieldMappingModalOpen] = useState(false);
//   const [inputHeader, setInputHeader] = useState<string[]>([]);
//   const [fields, setFields] = useState<EntityParticleRecordWithRelatedExtIds[]>([]);
//   const [externalIdFields, setExternalIdFields] = useState<EntityParticleRecordWithRelatedExtIds[]>([]);
//   const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
//   const [fieldMappingText, setFieldMappingText] = useState<string>('');
//   const [loadType, setLoadType] = useState<InsertUpdateUpsertDelete>('INSERT');
//   const [externalId, setExternalId] = useState<string>(null);

//   useEffect(() => {
//     let isSubscribed = true;
//     if (selectedSObject) {
//       // fetch all fields
//       setLoadingFields(true);
//       (async () => {
//         const { sobject, fields } = await getFieldMetadata(selectedOrg, selectedSObject.name);
//         // ensure object did not change and that component is still mounted
//         if (isSubscribed && selectedSObject.name === sobject) {
//           setFields(fields);
//           setLoadingFields(false);
//         }
//       })();
//     }
//     return () => (isSubscribed = false);
//   }, [selectedSObject]);

//   useEffect(() => {
//     if (selectedSObject && inputHeader && fields) {
//       setFieldMapping(autoMapFields(inputHeader, fields));
//     }
//   }, [selectedSObject, inputHeader, fields]);

//   useEffect(() => {
//     const fieldMappingItems = Object.values(fieldMapping);
//     if (!fieldMappingItems.length) {
//       setFieldMappingText('');
//     } else {
//       const numItemsMapped = fieldMappingItems.filter((item) => item.targetField).length;
//       setFieldMappingText(`${numItemsMapped} of ${inputHeader.length} fields are mapped to Salesforce fields.`);
//     }
//   }, [fieldMapping]);

//   useEffect(() => {
//     setExternalIdFields(fields.filter((field) => field.IsIdLookup));
//   }, [fields]);

//   function handleFile({ filename, extension, content }: { filename: string; extension: string; content: string | ArrayBuffer }) {
//     if (isString(content)) {
//       // csv - read from papaparse
//       const csvResult = parseCsv(content, {
//         delimiter: ',', // FIXME: support other delimiters based on locale
//         header: true,
//         skipEmptyLines: true,
//         preview: 0, // TODO: should we parse entire file now (could be slow), or use worker, or just get preview?
//       });
//       setInputHeader(csvResult.meta.fields);
//       setFileData(csvResult.data);
//     } else {
//       // ArrayBuffer - xlsx file
//       const workbook = XLSX.read(content, { cellText: false, cellDates: true, type: 'array' });
//       const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
//         dateNF: 'yyyy"-"mm"-"dd"T"hh:mm:ss',
//         defval: '',
//         blankrows: false,
//       });
//       if (data.length > 0) {
//         setInputHeader(Object.keys(data[0]));
//       }
//       setFileData(data);
//     }
//   }

//   function handleFieldMappingClose(updatedFieldMapping?: FieldMapping) {
//     setFieldMappingModalOpen(false);
//     if (updatedFieldMapping) {
//       setFieldMapping(updatedFieldMapping);
//     }
//   }

//   function handleLoadTypeChange(type: InsertUpdateUpsertDelete, externalId?: string) {
//     setLoadType(type);
//     setExternalId(externalId);
//   }

//   return (
//     <div>
//       {/* TODO: set empty state in modal (e.x. no rows of data) */}
//       {/* FIXME: set a min-height on the modal. if the file only has a couple of fields then the dropdown scrolling is super janky! */}
//       {/* FIXME: maybe we should add some forced extra space at the bottom so that the combobox opens on the last row without jank */}
//       {fieldMappingModalOpen && (
//         <LoadRecordsFieldMapping
//           selectedOrg={selectedOrg}
//           selectedSObject={selectedSObject}
//           fields={fields}
//           fieldMapping={fieldMapping}
//           inputHeader={inputHeader}
//           fileData={fileData}
//           onClose={handleFieldMappingClose}
//         />
//       )}
//       <Grid vertical>
//         <GridCol>
//           <ProgressIndicator totalSteps={5} currentStep={3} readOnly></ProgressIndicator>
//           <div>Could do vertical tile - https://www.lightningdesignsystem.com/components/progress-indicator/#Vertical</div>
//           <div>
//             could do summary detail and show info about step completion -
//             https://www.lightningdesignsystem.com/components/summary-detail/#Closed-with-Complex-title
//           </div>
//         </GridCol>
//         <GridCol>
//           <Grid verticalAlign="center">
//             <GridCol growNone>
//               <FileSelector
//                 id="load-record-file"
//                 label="File to Load"
//                 accept={[INPUT_ACCEPT_FILETYPES.CSV, INPUT_ACCEPT_FILETYPES.EXCEL]}
//                 userHelpText="Choose CSV or XLSX file to upload"
//                 onReadFile={handleFile}
//               ></FileSelector>
//             </GridCol>
//             <GridCol growNone>
//               <button
//                 className="slds-button slds-button_brand"
//                 onClick={() => setFieldMappingModalOpen(true)}
//                 disabled={!selectedSObject || !fileData || !fileData.length || loadingFields}
//               >
//                 {loadingFields && <Spinner size="small" />}
//                 <Icon type="utility" icon="data_mapping" className="slds-button__icon slds-button__icon_left" />
//                 Map Fields
//               </button>
//             </GridCol>
//             <GridCol grow>
//               <span>{fieldMappingText}</span>
//             </GridCol>
//           </Grid>
//         </GridCol>
//         <GridCol>
//           <LoadRecordsLoadTypeButtons
//             selectedType={loadType}
//             externalIdFields={externalIdFields}
//             loadingFields={loadingFields}
//             onChange={handleLoadTypeChange}
//           />
//         </GridCol>
//         <GridCol>
//           TODO: other options:
//           <ul>
//             <li>Date format (locale base)</li>
//             <li>Blank values should clear in salesforce (does not apply to insert or delete - disable for those)</li>
//             <li>Serial Mode</li>
//             <li>Batch Size</li>
//             <li>Bulk API / Batch API (maybe!)</li>
//           </ul>
//           Show a summary of what is going to be loaded in - then load!
//         </GridCol>
//       </Grid>
//     </div>
//   );
// };

// export default LoadRecordsConfiguration;
