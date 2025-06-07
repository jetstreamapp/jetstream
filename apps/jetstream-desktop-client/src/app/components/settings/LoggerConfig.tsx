import { enableLogger, logBuffer, logger } from '@jetstream/shared/client-logger';
import { CheckboxToggle, Grid } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';

export const LoggerConfig: FunctionComponent = () => {
  const [isEnabled, setIsEnabled] = useState(logger.isEnabled);

  function handleChange(value: boolean) {
    setIsEnabled(value);
    enableLogger(value);
  }

  function handleLogBuffer() {
    if (logBuffer) {
      logger.group('buffer');
      logBuffer.forEach((item) => logger.log(item));
      logger.groupEnd('buffer');
    }
  }

  return (
    <>
      <Grid verticalAlign="start">
        <div>
          <CheckboxToggle id="logging-toggle" checked={isEnabled} label="Logging" onChange={handleChange} />
        </div>
        {isEnabled && (
          <div className="slds-m-left_medium">
            <button className="slds-button slds-button_neutral" onClick={handleLogBuffer}>
              Print Prior Logs
            </button>
          </div>
        )}
      </Grid>
      <p className="slds-text-color_wea">This controls logs tracked in your browser, enabled if requested by Jetstream Support.</p>
    </>
  );
};

export default LoggerConfig;
