import { retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollRetrieveMetadataResultsUntilDone } from '@jetstream/shared/ui-utils';
import { RetrieveResult, SalesforceOrgUi } from '@jetstream/types';
import JSZip from 'jszip';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AutomationPackageItem, buildActivationPackage, getAutomationFullName } from '../automation-control-package-utils';
import { FlowViewRecord } from '../automation-control-types';

vi.mock('@jetstream/shared/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/data')>()),
  retrieveMetadataFromListMetadata: vi.fn(),
}));
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  pollRetrieveMetadataResultsUntilDone: vi.fn(),
}));

const selectedOrg = { uniqueId: 'org-1' } as SalesforceOrgUi;

const OBJECT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <validationRules>
        <fullName>Rule_A</fullName>
        <active>true</active>
        <errorConditionFormula>CONTAINS(Name, &quot;Account&quot;)</errorConditionFormula>
        <errorMessage>No &amp; never</errorMessage>
    </validationRules>
    <validationRules>
        <fullName>Rule_B</fullName>
        <active>true</active>
        <errorConditionFormula>false</errorConditionFormula>
        <errorMessage>B</errorMessage>
    </validationRules>
</CustomObject>
`;

const WORKFLOW_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">
    <rules>
        <fullName>WF_1</fullName>
        <active>true</active>
        <triggerType>onCreateOnly</triggerType>
    </rules>
</Workflow>
`;

const TRIGGER_META_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ApexTrigger xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <status>Active</status>
</ApexTrigger>
`;

const DUPLICATE_RULE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<DuplicateRule xmlns="http://soap.sforce.com/2006/04/metadata">
    <actionOnInsert>Allow</actionOnInsert>
    <isActive>true</isActive>
    <masterLabel>Dup</masterLabel>
</DuplicateRule>
`;

async function mockRetrieve(files: Record<string, string>) {
  const zip = new JSZip();
  Object.entries(files).forEach(([fileName, content]) => zip.file(fileName, content));
  vi.mocked(retrieveMetadataFromListMetadata).mockResolvedValue({ id: 'retrieve-1' } as RetrieveResult);
  vi.mocked(pollRetrieveMetadataResultsUntilDone).mockResolvedValue({
    success: true,
    zipFile: await zip.generateAsync({ type: 'base64' }),
  } as RetrieveResult);
}

function inactive(item: Omit<AutomationPackageItem, 'state'>): AutomationPackageItem {
  return { ...item, state: { isActive: false, activeVersionNumber: null } };
}

describe('buildActivationPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('retrieves current metadata and sets only the active state of each item', async () => {
    await mockRetrieve({
      'package.xml': '<Package/>',
      'objects/Account.object': OBJECT_XML,
      'workflows/Account.workflow': WORKFLOW_XML,
      'triggers/MyTrigger.trigger': 'trigger MyTrigger on Account (before insert) {}',
      'triggers/MyTrigger.trigger-meta.xml': TRIGGER_META_XML,
      'duplicateRules/Account.Dup.duplicateRule': DUPLICATE_RULE_XML,
    });

    const { data, includedCount, missingItems } = await buildActivationPackage(selectedOrg, 'v68.0', [
      inactive({ key: 'vr-a', type: 'ValidationRule', fullName: 'Account.Rule_A', label: 'Rule A' }),
      inactive({ key: 'vr-missing', type: 'ValidationRule', fullName: 'Account.Deleted_Rule', label: 'Deleted Rule' }),
      inactive({ key: 'wf', type: 'WorkflowRule', fullName: 'Account.WF_1', label: 'WF 1' }),
      inactive({ key: 'trigger', type: 'ApexTrigger', fullName: 'MyTrigger', label: 'MyTrigger' }),
      inactive({ key: 'dup', type: 'DuplicateRule', fullName: 'Account.Dup', label: 'Dup' }),
      {
        key: 'flow',
        type: 'FlowRecordTriggered',
        fullName: 'test_ns__My_Flow',
        label: 'My Flow',
        state: { isActive: true, activeVersionNumber: 3 },
      },
      inactive({ key: 'pb', type: 'FlowProcessBuilder', fullName: 'My_Process', label: 'My Process' }),
    ]);

    // flows are never retrieved, their FlowDefinition is generated
    expect(vi.mocked(retrieveMetadataFromListMetadata).mock.calls[0][1]).not.toHaveProperty('FlowDefinition');
    expect(Object.keys(vi.mocked(retrieveMetadataFromListMetadata).mock.calls[0][1]).sort()).toEqual([
      'ApexTrigger',
      'DuplicateRule',
      'ValidationRule',
      'WorkflowRule',
    ]);

    expect(includedCount).toBe(6);
    expect(missingItems).toEqual([{ key: 'vr-missing', label: 'Deleted Rule' }]);

    const output = await JSZip.loadAsync(data);
    const fileNames = Object.values(output.files)
      .filter(({ dir }) => !dir)
      .map(({ name }) => name);
    expect(fileNames.sort()).toEqual([
      'duplicateRules/Account.Dup.duplicateRule',
      'flowDefinitions/My_Process.flowDefinition',
      'flowDefinitions/test_ns__My_Flow.flowDefinition',
      'objects/Account.object',
      'package.xml',
      'triggers/MyTrigger.trigger',
      'triggers/MyTrigger.trigger-meta.xml',
      'workflows/Account.workflow',
    ]);

    const objectXml = await output.file('objects/Account.object')!.async('string');
    const objectDocument = new DOMParser().parseFromString(objectXml, 'application/xml');
    const ruleActiveStates = Array.from(objectDocument.getElementsByTagName('validationRules')).map((rule) => [
      rule.getElementsByTagName('fullName')[0].textContent,
      rule.getElementsByTagName('active')[0].textContent,
    ]);
    expect(ruleActiveStates).toEqual([
      ['Rule_A', 'false'],
      // in the same file but not part of the package items
      ['Rule_B', 'true'],
    ]);
    expect(objectXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(objectDocument.getElementsByTagName('errorMessage')[0].textContent).toBe('No & never');

    expect(await output.file('workflows/Account.workflow')!.async('string')).toContain('<active>false</active>');
    expect(await output.file('triggers/MyTrigger.trigger-meta.xml')!.async('string')).toContain('<status>Inactive</status>');
    expect(await output.file('triggers/MyTrigger.trigger')!.async('string')).toBe('trigger MyTrigger on Account (before insert) {}');
    expect(await output.file('duplicateRules/Account.Dup.duplicateRule')!.async('string')).toContain('<isActive>false</isActive>');
    expect(await output.file('flowDefinitions/test_ns__My_Flow.flowDefinition')!.async('string')).toContain(
      '<activeVersionNumber>3</activeVersionNumber>',
    );
    // 0 deactivates a flow
    expect(await output.file('flowDefinitions/My_Process.flowDefinition')!.async('string')).toContain(
      '<activeVersionNumber>0</activeVersionNumber>',
    );

    // the missing rule is left out so the package still deploys
    expect(await output.file('package.xml')!.async('string')).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
        '    <types>',
        '        <members>MyTrigger</members>',
        '        <name>ApexTrigger</name>',
        '    </types>',
        '    <types>',
        '        <members>Account.Dup</members>',
        '        <name>DuplicateRule</name>',
        '    </types>',
        '    <types>',
        '        <members>My_Process</members>',
        '        <members>test_ns__My_Flow</members>',
        '        <name>FlowDefinition</name>',
        '    </types>',
        '    <types>',
        '        <members>Account.Rule_A</members>',
        '        <name>ValidationRule</name>',
        '    </types>',
        '    <types>',
        '        <members>Account.WF_1</members>',
        '        <name>WorkflowRule</name>',
        '    </types>',
        '    <version>68.0</version>',
        '</Package>',
        '',
      ].join('\n'),
    );
  });

  test('builds a flow-only package without retrieving anything', async () => {
    const { includedCount } = await buildActivationPackage(selectedOrg, '68.0', [
      inactive({ key: 'flow', type: 'FlowRecordTriggered', fullName: 'My_Flow', label: 'My Flow' }),
    ]);
    expect(includedCount).toBe(1);
    expect(retrieveMetadataFromListMetadata).not.toHaveBeenCalled();
  });

  test('fails when Salesforce cannot retrieve the metadata', async () => {
    vi.mocked(retrieveMetadataFromListMetadata).mockResolvedValue({ id: 'retrieve-1' } as RetrieveResult);
    vi.mocked(pollRetrieveMetadataResultsUntilDone).mockResolvedValue({
      success: false,
      errorMessage: 'INVALID_SESSION',
    } as RetrieveResult);

    await expect(
      buildActivationPackage(selectedOrg, '68.0', [
        inactive({ key: 'trigger', type: 'ApexTrigger', fullName: 'MyTrigger', label: 'MyTrigger' }),
      ]),
    ).rejects.toThrow('INVALID_SESSION');
  });
});

describe('getAutomationFullName', () => {
  test('qualifies a namespaced flow, which the Metadata API cannot find by its plain api name', () => {
    expect(getAutomationFullName('FlowRecordTriggered', { ApiName: 'My_Flow', NamespacePrefix: 'test_ns' } as FlowViewRecord)).toBe(
      'test_ns__My_Flow',
    );
    expect(getAutomationFullName('FlowProcessBuilder', { ApiName: 'My_Flow', NamespacePrefix: null } as FlowViewRecord)).toBe('My_Flow');
  });
});
