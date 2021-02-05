/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, DeployOptionsTestLevel } from '@jetstream/types';
import { Checkbox, Icon, Radio, RadioGroup, Textarea, Tooltip } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';

const SPLIT_LINE_COMMA = /(\n|, |,)/g;

const testLevelOptions: { label: string; value: DeployOptionsTestLevel }[] = [
  { label: 'Default - Run non-managed tests in production, do not run any tests in other types of orgs', value: undefined },
  { label: 'Run specified Tests', value: 'RunSpecifiedTests' },
  { label: 'Do not run any tests', value: 'NoTestRun' },
  { label: 'Run non-managed tests', value: 'RunLocalTests' },
  { label: 'Run all tests in org', value: 'RunAllTestsInOrg' },
];

export interface DeployMetadataToOrgConfigOptionsProps {
  deployOptions?: DeployOptions;
  hiddenOptions?: Set<keyof DeployOptions>;
  disabledOptions?: Set<keyof DeployOptions>;
  onChange: (deployOptions: DeployOptions) => void;
}

export const DeployMetadataToOrgConfigOptions: FunctionComponent<DeployMetadataToOrgConfigOptionsProps> = ({
  deployOptions,
  hiddenOptions = new Set(),
  disabledOptions = new Set(),
  onChange,
}) => {
  const [allowMissingFiles, setAllowMissingFiles] = useState(deployOptions.allowMissingFiles ?? false);
  const [autoUpdatePackage, setAutoUpdatePackage] = useState(deployOptions.autoUpdatePackage ?? false);
  const [checkOnly, setCheckOnly] = useState(deployOptions.checkOnly ?? false);
  const [ignoreWarnings, setIgnoreWarnings] = useState(deployOptions.ignoreWarnings ?? false);
  const [purgeOnDelete, setPurgeOnDelete] = useState(deployOptions.purgeOnDelete ?? false);
  const [rollbackOnError, setRollbackOnError] = useState(deployOptions.rollbackOnError ?? true);
  const [singlePackage, setSinglePackage] = useState(deployOptions.singlePackage ?? true);
  const [testLevel, setTestLevel] = useState<DeployOptionsTestLevel>(deployOptions.testLevel ?? undefined);
  const [runTests, setRunTests] = useState<string[]>(deployOptions.runTests ?? []);

  const [runSpecifiedTestsVisible, setRunSpecifiedTestsVisible] = useState(testLevel === 'RunSpecifiedTests');
  const [runTestsStr, setRunTestsStr] = useState<string>(deployOptions.runTests?.join('\n') ?? '');

  useNonInitialEffect(() => {
    setRunSpecifiedTestsVisible(testLevel === 'RunSpecifiedTests');
  }, [testLevel]);

  useNonInitialEffect(() => {
    setRunTests(
      (runTestsStr || '')
        .replace(SPLIT_LINE_COMMA, ',')
        .split(',')
        .map((val) => val.trim())
        .filter((val) => val)
    );
  }, [runTestsStr]);

  useNonInitialEffect(() => {
    onChange({
      allowMissingFiles,
      autoUpdatePackage,
      checkOnly,
      ignoreWarnings,
      purgeOnDelete,
      rollbackOnError,
      singlePackage,
      testLevel,
      runTests,
    });
  }, [
    allowMissingFiles,
    autoUpdatePackage,
    checkOnly,
    ignoreWarnings,
    onChange,
    purgeOnDelete,
    rollbackOnError,
    runTests,
    singlePackage,
    testLevel,
  ]);

  return (
    <Fragment>
      <fieldset className="slds-form-element slds-m-top_small">
        <legend className="slds-form-element__legend slds-form-element__label">Deployment Options</legend>
        <div className="slds-form-element__icon">
          <Tooltip id="upload-options" content="Learn more about these options">
            <a
              href="https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm#deploy_options"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon type="utility" icon="new_window" className="slds-icon slds-text-link slds-icon_xx-small cursor-pointer" />
            </a>
          </Tooltip>
        </div>
        {/* TODO: disable this if org is a production org (parent should own this) */}
        {!hiddenOptions.has('allowMissingFiles') && (
          <Checkbox
            id="deploy-allowMissingFiles"
            checked={allowMissingFiles}
            label="Allow Missing Files"
            labelHelp="allowMissingFiles - Allows the deployment to succeed if files are specified in your package.xml but are not included in the deployment. Not allowed for production orgs."
            onChange={setAllowMissingFiles}
            disabled={disabledOptions.has('allowMissingFiles')}
          />
        )}
        {!hiddenOptions.has('autoUpdatePackage') && (
          <Checkbox
            id="deploy-autoUpdatePackage"
            checked={autoUpdatePackage}
            label="Auto Update Package"
            labelHelp="autoUpdatePackage - Allow files in your package to be deployed even if omitted from the package.xml. Usee this option to update an existing outbound changeset."
            onChange={setAutoUpdatePackage}
            disabled={disabledOptions.has('autoUpdatePackage')}
          />
        )}
        {!hiddenOptions.has('checkOnly') && (
          <Checkbox
            id="deploy-checkOnly"
            checked={checkOnly}
            label="Validate Only"
            labelHelp="checkOnly - Set to true to validate the deployment without making actual changes."
            onChange={setCheckOnly}
            disabled={disabledOptions.has('checkOnly')}
          />
        )}
        {!hiddenOptions.has('ignoreWarnings') && (
          <Checkbox
            id="deploy-ignoreWarnings"
            checked={ignoreWarnings}
            label="Ignore Warnings"
            labelHelp="ignoreWarnings - Allow deployment to succeed even if there are warnings."
            onChange={setIgnoreWarnings}
            disabled={disabledOptions.has('ignoreWarnings')}
          />
        )}
        {!hiddenOptions.has('rollbackOnError') && (
          <Checkbox
            id="deploy-rollbackOnError"
            checked={rollbackOnError}
            label="Rollback on Error"
            labelHelp="rollbackOnError - Allow deployment to partially succeed even if there are errors with some components."
            onChange={setRollbackOnError}
            disabled={disabledOptions.has('rollbackOnError')}
          />
        )}
        {!hiddenOptions.has('purgeOnDelete') && (
          <Checkbox
            id="deploy-purgeOnDelete"
            checked={purgeOnDelete}
            label="Skip Recycle Bin on Delete"
            labelHelp="purgeOnDelete - Skip the recycle bin for deleted components in a destructive package."
            onChange={setPurgeOnDelete}
            disabled={disabledOptions.has('purgeOnDelete')}
          />
        )}
        {!hiddenOptions.has('singlePackage') && (
          <Checkbox
            id="deploy-singlePackage"
            checked={singlePackage}
            label="Single Package"
            labelHelp="singlePackage - Set to true if your package.xml is in the root of your zip file."
            onChange={setSinglePackage}
            disabled={disabledOptions.has('singlePackage')}
          />
        )}
      </fieldset>

      {!hiddenOptions.has('testLevel') && (
        <RadioGroup
          className="slds-m-top_small"
          idPrefix="deploy"
          label="Unit Tests to Run"
          labelHelp="testLevel - This determines which unit tests will be initiated as part of the deployment."
        >
          {testLevelOptions.map((item) => (
            <Radio
              key={item.value || 'default'}
              name={item.label}
              label={item.label}
              value={item.value || ''}
              disabled={disabledOptions.has('testLevel')}
              checked={item.value === testLevel}
              onChange={(value: DeployOptionsTestLevel) => setTestLevel(value || undefined)}
            />
          ))}
          <div
            css={css`
              min-height: 110px;
            `}
          >
            {runSpecifiedTestsVisible && !hiddenOptions.has('runTests') && (
              <Textarea
                id="deploy-runTests"
                label="Specified Tests"
                labelHelp="runTests - One test per line or comma delimited."
                helpText="One test per line or comma delimited"
              >
                <textarea
                  id="deploy-runTests"
                  className="slds-textarea"
                  disabled={disabledOptions.has('runTests')}
                  value={runTestsStr}
                  onChange={(event) => setRunTestsStr(event.target.value)}
                  maxLength={2500}
                />
              </Textarea>
            )}
          </div>
        </RadioGroup>
      )}
    </Fragment>
  );
};

export default DeployMetadataToOrgConfigOptions;
