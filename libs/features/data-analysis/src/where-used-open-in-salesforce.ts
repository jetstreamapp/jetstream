import type { WhereUsedDependencyRowParsed } from './field-usage-result-parse';

/**
 * Relative path (leading `/`) to open this dependency in Salesforce when the job did not store
 * {@link WhereUsedDependencyRowParsed.openInSalesforcePath} (older jobs) or for client-side fallback.
 */
export function getWhereUsedOpenInSalesforcePath(row: WhereUsedDependencyRowParsed): string | null {
  const fromJob = row.openInSalesforcePath?.trim();
  if (fromJob) {
    return fromJob;
  }
  const t = row.type.trim();
  if (t === 'ProcessDefinition') {
    return '/lightning/setup/ProcessAutomation/home';
  }
  const id = row.componentId?.trim();
  if (!id) {
    return null;
  }
  if (t === 'ApexClass') {
    return `/lightning/setup/ApexClasses/page?address=${encodeURIComponent(encodeURIComponent(`/${id}`))}`;
  }
  if (t === 'ApexTrigger') {
    return `/lightning/setup/ApexTriggers/page?address=${encodeURIComponent(encodeURIComponent(`/${id}`))}`;
  }
  if (t === 'ApexPage') {
    return `/lightning/setup/ApexPages/page?address=${encodeURIComponent(encodeURIComponent(`/${id}`))}`;
  }
  if (t === 'ApexComponent') {
    return `/lightning/setup/ApexComponents/page?address=${encodeURIComponent(encodeURIComponent(`/${id}`))}`;
  }
  if (t === 'FlexiPage') {
    return `/lightning/setup/FlexiPageList/page?address=${encodeURIComponent(encodeURIComponent(`/${id}`))}`;
  }
  if (t === 'Layout') {
    return `/lightning/setup/LayoutDefinitions/page?address=${encodeURIComponent(encodeURIComponent(`/${id}`))}`;
  }
  if (t === 'FieldSet') {
    return `/lightning/setup/FieldSets/page?address=${encodeURIComponent(encodeURIComponent(`/${id}`))}`;
  }
  if (t === 'WorkflowRule' || t === 'WorkflowFieldUpdate') {
    return `/lightning/setup/WorkflowRules/page?address=${encodeURIComponent(encodeURIComponent(`/${id}`))}`;
  }
  if (t === 'Flow') {
    return `/builder_platform_interaction/flowBuilder.app?flowId=${encodeURIComponent(id)}`;
  }
  if (t === 'FlowDefinition') {
    return '/lightning/setup/Flows/home';
  }
  return null;
}
