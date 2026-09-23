import { enableLogger, logBuffer, logger } from '@jetstream/shared/client-logger';
import { CheckboxToggle } from '@jetstream/ui';
import { useState } from 'react';
import { getSettingsRowIds, SettingsRow } from './layout/SettingsSection';

const ROW_ID = 'setting-diagnostic-logging';

export const DiagnosticLoggingSetting = () => {
  const [isEnabled, setIsEnabled] = useState(logger.isEnabled);

  function handleChange(value: boolean) {
    setIsEnabled(value);
    enableLogger(value);
  }

  function handlePrintPriorLogs() {
    if (logBuffer) {
      logger.group('buffer');
      logBuffer.forEach((item) => logger.log(item));
      logger.groupEnd('buffer');
    }
  }

  return (
    <SettingsRow
      id={ROW_ID}
      title="Diagnostic logging"
      description="Write detailed logs to the developer console. Only needed when Jetstream Support asks for them."
    >
      {isEnabled && (
        <button className="slds-button slds-button_neutral" onClick={handlePrintPriorLogs}>
          Print Prior Logs
        </button>
      )}
      <CheckboxToggle
        id={ROW_ID}
        label="Diagnostic logging"
        hideLabel
        onText=""
        offText=""
        checked={isEnabled}
        ariaDescribedBy={getSettingsRowIds(ROW_ID).descriptionId}
        onChange={handleChange}
      />
    </SettingsRow>
  );
};
