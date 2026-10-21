import { queryAll, retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollRetrieveMetadataResultsUntilDone } from '@jetstream/shared/ui-utils';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  AutomationControlActivationState,
  AutomationControlHistoryItem,
  AutomationMetadataType,
  ListMetadataResult,
  SalesforceOrgUi,
} from '@jetstream/types';
import JSZip from 'jszip';
import { getDuplicateRuleFullName } from './automation-control-data-utils';
import { getFlowVersionsQuery } from './automation-control-soql-utils';
import {
  DuplicateRuleRecord,
  FlowViewRecord,
  TableRowItem,
  ToolingApexTriggerRecord,
  ToolingValidationRuleRecord,
  ToolingWorkflowRuleRecord,
} from './automation-control-types';

/**
 * Builds Metadata API packages that set the active state of automation, for deploying later from
 * Deploy Metadata (e.g. to roll back after the browser history is gone, or to apply the same change
 * to another org).
 *
 * Everything except the active state comes from the CURRENT metadata in Salesforce, retrieved when
 * the package is built — the same thing a rollback from Automation Control deploys.
 */

export type AutomationPackageVariant = 'before' | 'after';

export interface AutomationPackageItem {
  key: string;
  type: AutomationMetadataType;
  /** Metadata API fullName, see {@link getAutomationMetadataMember} */
  fullName: string;
  label: string;
  state: AutomationControlActivationState;
}

export interface AutomationPackage {
  data: ArrayBuffer;
  includedCount: number;
  missingItems: { key: string; label: string }[];
}

interface AutomationMetadataMember {
  /** Metadata API type — flows are activated through their FlowDefinition */
  metadataType: 'ApexTrigger' | 'DuplicateRule' | 'ValidationRule' | 'WorkflowRule' | 'FlowDefinition';
  fullName: string;
  /** Path of the file holding the active state within a retrieved package */
  fileName: string;
}

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const METADATA_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata';
const RETRIEVE_POLL_INTERVAL_MS = 2000;
const RETRIEVE_POLL_MAX_ATTEMPTS = 300;

/** Splits an `Object.Name` fullName (validation and workflow rules) */
function splitObjectMemberName(fullName: string) {
  const separatorIndex = fullName.indexOf('.');
  return { objectName: fullName.slice(0, separatorIndex), memberName: fullName.slice(separatorIndex + 1) };
}

export function getAutomationMetadataMember(type: AutomationMetadataType, fullName: string): AutomationMetadataMember {
  switch (type) {
    case 'ApexTrigger':
      return { metadataType: 'ApexTrigger', fullName, fileName: `triggers/${fullName}.trigger-meta.xml` };
    case 'DuplicateRule':
      return { metadataType: 'DuplicateRule', fullName, fileName: `duplicateRules/${fullName}.duplicateRule` };
    case 'ValidationRule':
      return { metadataType: 'ValidationRule', fullName, fileName: `objects/${splitObjectMemberName(fullName).objectName}.object` };
    case 'WorkflowRule':
      return { metadataType: 'WorkflowRule', fullName, fileName: `workflows/${splitObjectMemberName(fullName).objectName}.workflow` };
    case 'FlowRecordTriggered':
    case 'FlowProcessBuilder':
    default:
      return { metadataType: 'FlowDefinition', fullName, fileName: `flowDefinitions/${fullName}.flowDefinition` };
  }
}

/**
 * Metadata API fullName for an automation record. A flow in a namespace (including the org's own) is
 * only found by its namespaced name.
 */
export function getAutomationFullName(type: AutomationMetadataType, record: TableRowItem['record']): string {
  switch (type) {
    case 'ApexTrigger':
      return (record as ToolingApexTriggerRecord).Name;
    case 'DuplicateRule':
      return getDuplicateRuleFullName(record as DuplicateRuleRecord);
    case 'ValidationRule':
      return (record as ToolingValidationRuleRecord).FullName;
    case 'WorkflowRule':
      return (record as ToolingWorkflowRuleRecord).FullName;
    case 'FlowRecordTriggered':
    case 'FlowProcessBuilder':
    default: {
      const { ApiName, NamespacePrefix } = record as FlowViewRecord;
      return NamespacePrefix ? `${NamespacePrefix}__${ApiName}` : ApiName;
    }
  }
}

/** Items for a package of changes about to be (or just) deployed from the review modal */
export function getPackageItemsFromRows(rows: TableRowItem[], variant: AutomationPackageVariant): AutomationPackageItem[] {
  return rows.map((row) => ({
    key: row.key,
    type: row.type,
    fullName: getAutomationFullName(row.type, row.record),
    label: row.label,
    state:
      variant === 'before'
        ? { isActive: row.isActiveInitialState, activeVersionNumber: row.activeVersionNumberInitialState ?? null }
        : { isActive: row.isActive, activeVersionNumber: row.activeVersionNumber ?? null },
  }));
}

export function getPackageItemsFromHistory(
  items: AutomationControlHistoryItem[],
  variant: AutomationPackageVariant,
): AutomationPackageItem[] {
  return items.map(({ key, type, fullName, label, previous, deployed }) => ({
    key,
    type,
    fullName,
    label,
    state: variant === 'before' ? previous : deployed,
  }));
}

function getChildElement(parent: Element, name: string) {
  return Array.from(parent.children).find(({ localName }) => localName === name);
}

function setChildElementText(parent: Element, name: string, value: string) {
  let element = getChildElement(parent, name);
  if (!element) {
    element = parent.ownerDocument.createElementNS(parent.namespaceURI, name);
    parent.appendChild(element);
  }
  element.textContent = value;
}

/**
 * Sets the active state of one item within its metadata file.
 * @returns false when the item is not in the file
 */
function setActiveStateInDocument(root: Element, { type, fullName, state }: AutomationPackageItem): boolean {
  switch (type) {
    case 'ApexTrigger':
      setChildElementText(root, 'status', state.isActive ? 'Active' : 'Inactive');
      return true;
    case 'DuplicateRule':
      setChildElementText(root, 'isActive', String(state.isActive));
      return true;
    case 'ValidationRule':
    case 'WorkflowRule': {
      const { memberName } = splitObjectMemberName(fullName);
      const rule = Array.from(root.children).find(
        (element) =>
          element.localName === (type === 'ValidationRule' ? 'validationRules' : 'rules') &&
          getChildElement(element, 'fullName')?.textContent === memberName,
      );
      if (!rule) {
        return false;
      }
      setChildElementText(rule, 'active', String(state.isActive));
      return true;
    }
    default:
      return false;
  }
}

function serializeXml(document: Document) {
  const xml = new XMLSerializer().serializeToString(document);
  return xml.startsWith('<?xml') ? xml : `${XML_DECLARATION}\n${xml}`;
}

/** A FlowDefinition holds nothing but the active version, so it is generated rather than retrieved */
/** 0 deactivates the flow */
function getFlowActiveVersionNumber({ state }: AutomationPackageItem) {
  return state.isActive && state.activeVersionNumber ? state.activeVersionNumber : 0;
}

function getFlowDefinitionXml(item: AutomationPackageItem) {
  const activeVersionNumber = getFlowActiveVersionNumber(item);
  return [
    XML_DECLARATION,
    `<FlowDefinition xmlns="${METADATA_NAMESPACE}">`,
    `    <activeVersionNumber>${activeVersionNumber}</activeVersionNumber>`,
    '</FlowDefinition>',
    '',
  ].join('\n');
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getPackageXml(membersByType: Record<string, string[]>, apiVersion: string) {
  return [
    XML_DECLARATION,
    `<Package xmlns="${METADATA_NAMESPACE}">`,
    ...Object.keys(membersByType)
      .sort()
      .flatMap((metadataType) => [
        '    <types>',
        ...[...membersByType[metadataType]].sort().map((member) => `        <members>${escapeXml(member)}</members>`),
        `        <name>${metadataType}</name>`,
        '    </types>',
      ]),
    `    <version>${apiVersion}</version>`,
    '</Package>',
    '',
  ].join('\n');
}

async function retrieveCurrentMetadata(selectedOrg: SalesforceOrgUi, items: AutomationPackageItem[]) {
  const listMetadataItems = items.reduce((output: Record<string, ListMetadataResult[]>, { type, fullName }) => {
    const { metadataType, fileName } = getAutomationMetadataMember(type, fullName);
    output[metadataType] = output[metadataType] || [];
    output[metadataType].push({
      createdById: null,
      createdByName: null,
      createdDate: null,
      fileName,
      fullName,
      id: '',
      lastModifiedById: null,
      lastModifiedByName: null,
      lastModifiedDate: null,
      manageableState: 'unmanaged',
      namespacePrefix: null,
      type: metadataType,
    });
    return output;
  }, {});
  const { id } = await retrieveMetadataFromListMetadata(selectedOrg, listMetadataItems);
  const results = await pollRetrieveMetadataResultsUntilDone(selectedOrg, id, {
    interval: RETRIEVE_POLL_INTERVAL_MS,
    maxAttempts: RETRIEVE_POLL_MAX_ATTEMPTS,
  });
  if (!results.success || typeof results.zipFile !== 'string') {
    throw new Error(results.errorMessage || 'There was a problem retrieving metadata from Salesforce.');
  }
  return await JSZip.loadAsync(results.zipFile, { base64: true });
}

/**
 * Version numbers of each flow that still exists, keyed by its namespaced fullName.
 * Flow API names cannot contain `__`, so anything before the first one is the namespace.
 */
async function getCurrentFlowVersions(selectedOrg: SalesforceOrgUi, fullNames: string[]): Promise<Map<string, Set<number>>> {
  const apiNames = Array.from(new Set(fullNames.map((fullName) => fullName.split('__').pop() as string)));
  const records = (
    await Promise.all(
      splitArrayToMaxSize(apiNames, 300).map((currApiNames) =>
        queryAll<Pick<FlowViewRecord, 'ApiName' | 'NamespacePrefix' | 'Versions'>>(selectedOrg, getFlowVersionsQuery(currApiNames), false),
      ),
    )
  ).flatMap(({ queryResults }) => queryResults.records);
  return new Map(
    records.map(({ ApiName, NamespacePrefix, Versions }) => [
      NamespacePrefix ? `${NamespacePrefix}__${ApiName}` : ApiName,
      new Set((Versions?.records || []).map(({ VersionNumber }) => VersionNumber)),
    ]),
  );
}

/**
 * Build a deployable package that sets each item to its `state`. Items missing from Salesforce (e.g.
 * deleted since) are left out of the package and reported so the package still deploys.
 *
 * @param apiVersion e.g. `v68.0` or `68.0`
 */
export async function buildActivationPackage(
  selectedOrg: SalesforceOrgUi,
  apiVersion: string,
  items: AutomationPackageItem[],
): Promise<AutomationPackage> {
  const missingItems: AutomationPackage['missingItems'] = items
    .filter(({ fullName }) => !fullName)
    .map(({ key, label }) => ({ key, label }));
  const packageItems = items.filter(({ fullName }) => !!fullName);
  const flowItems = packageItems.filter(({ type }) => type === 'FlowRecordTriggered' || type === 'FlowProcessBuilder');
  const retrievedItems = packageItems.filter((item) => !flowItems.includes(item));
  const retrievedPackage = retrievedItems.length > 0 ? await retrieveCurrentMetadata(selectedOrg, retrievedItems) : new JSZip();

  const output = new JSZip();
  const membersByType: Record<string, string[]> = {};
  const includeMember = ({ metadataType, fullName }: AutomationMetadataMember) => {
    membersByType[metadataType] = membersByType[metadataType] || [];
    membersByType[metadataType].push(fullName);
  };

  // Several items can share a file (rules on one object), so each file is parsed once and written after every item is applied
  const documentsByFileName = new Map<string, Document | null>();
  const appliedFileNames = new Set<string>();
  for (const item of retrievedItems) {
    const member = getAutomationMetadataMember(item.type, item.fullName);
    if (!documentsByFileName.has(member.fileName)) {
      const xml = await retrievedPackage.file(member.fileName)?.async('string');
      const document = xml ? new DOMParser().parseFromString(xml, 'application/xml') : null;
      documentsByFileName.set(member.fileName, document && !document.querySelector('parsererror') ? document : null);
    }
    const document = documentsByFileName.get(member.fileName);
    if (!document?.documentElement || !setActiveStateInDocument(document.documentElement, item)) {
      missingItems.push({ key: item.key, label: item.label });
      continue;
    }
    appliedFileNames.add(member.fileName);
    includeMember(member);
    if (item.type === 'ApexTrigger') {
      // the trigger body is deployed alongside its meta file
      const bodyFileName = member.fileName.replace(/-meta\.xml$/, '');
      const body = await retrievedPackage.file(bodyFileName)?.async('string');
      if (body !== undefined) {
        output.file(bodyFileName, body);
      }
    }
  }
  documentsByFileName.forEach((document, fileName) => {
    if (document && appliedFileNames.has(fileName)) {
      output.file(fileName, serializeXml(document));
    }
  });

  // a flow deleted since, or whose target version was, would fail the whole deploy
  const currentFlowVersions =
    flowItems.length > 0
      ? await getCurrentFlowVersions(
          selectedOrg,
          flowItems.map(({ fullName }) => fullName),
        )
      : null;
  flowItems.forEach((item) => {
    const versionNumbers = currentFlowVersions?.get(item.fullName);
    const activeVersionNumber = getFlowActiveVersionNumber(item);
    if (!versionNumbers || (activeVersionNumber > 0 && !versionNumbers.has(activeVersionNumber))) {
      missingItems.push({ key: item.key, label: item.label });
      return;
    }
    const member = getAutomationMetadataMember(item.type, item.fullName);
    output.file(member.fileName, getFlowDefinitionXml(item));
    includeMember(member);
  });

  output.file('package.xml', getPackageXml(membersByType, apiVersion.replace(/^v/, '')));

  return {
    data: await output.generateAsync({ type: 'arraybuffer' }),
    includedCount: items.length - missingItems.length,
    missingItems,
  };
}
