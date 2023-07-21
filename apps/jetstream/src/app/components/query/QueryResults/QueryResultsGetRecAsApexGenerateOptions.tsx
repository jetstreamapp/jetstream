import { css } from '@emotion/react';
import { Checkbox, Grid, RadioButton, RadioGroup, Select } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { RecordToApexOptionsInitialOptions } from '../utils/query-apex-utils';

export interface QueryResultsGetRecAsApexGenerateOptionsProps {
  isList: boolean;
  onChange: (fields: Partial<RecordToApexOptionsInitialOptions>) => void;
}

export const QueryResultsGetRecAsApexGenerateOptions: FunctionComponent<QueryResultsGetRecAsApexGenerateOptionsProps> = ({
  isList,
  onChange,
}) => {
  const [options, setOptions] = useState<Partial<RecordToApexOptionsInitialOptions>>({
    inline: true,
    wrapInMethod: false,
    wrapInMethodStatic: false,
    indentation: 'spaces',
    tabSize: 2,
    replaceDateWithToday: true,
    insertStatement: false,
  });

  useEffect(() => {
    onChange(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  return (
    <Grid vertical>
      <fieldset className="slds-form-element">
        <legend className="slds-form-element__legend slds-form-element__label">Apex Options</legend>
        <Checkbox
          id="rec-to-apex-inline"
          checked={!!options.inline}
          label="Construct object inline"
          disabled={isList}
          onChange={(value) => setOptions({ ...options, inline: value })}
        />
        <Checkbox
          id="rec-to-apex-replace-date"
          checked={!!options.replaceDateWithToday}
          label="Use today for Date / DateTime fields"
          onChange={(value) => setOptions({ ...options, replaceDateWithToday: value })}
        />
        <Checkbox
          id="rec-to-apex-insert"
          checked={!!options.insertStatement}
          label="Include insert statement"
          onChange={(value) => setOptions({ ...options, insertStatement: value })}
        />
        <Checkbox
          id="rec-to-apex-wrapInMethod"
          checked={!!options.wrapInMethod}
          label="Wrap in method"
          onChange={(value) => setOptions({ ...options, wrapInMethod: value })}
        />
        <Checkbox
          id="rec-to-apex-replace-wrapInMethodStatic"
          className="slds-p-left_large"
          checked={!!options.wrapInMethodStatic}
          label="Wrapped method is static"
          onChange={(value) => setOptions({ ...options, wrapInMethodStatic: value })}
          disabled={!options.wrapInMethod}
        />
        <Grid>
          <RadioGroup label="Indentation" isButtonGroup>
            <RadioButton
              name="indentation"
              label="Spaces"
              value="spaces"
              checked={options.indentation === 'spaces'}
              onChange={(value) => setOptions({ ...options, indentation: value as 'spaces' | 'tabs' })}
            />
            <RadioButton
              name="indentation"
              label="Tabs"
              value="tabs"
              checked={options.indentation === 'tabs'}
              onChange={(value) => setOptions({ ...options, indentation: value as 'spaces' | 'tabs' })}
            />
          </RadioGroup>
          <Select
            id="rec-to-apex-tabSize"
            className="slds-p-horizontal_small"
            label={options.indentation === 'spaces' ? '# Spaces' : '# Tabs'}
            css={css`
              min-width: 85px;
            `}
          >
            <select
              className="slds-select"
              value={options.tabSize}
              onChange={(event) => setOptions({ ...options, tabSize: Number(event.target.value) })}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
            </select>
          </Select>
        </Grid>
      </fieldset>
    </Grid>
  );
};

export default QueryResultsGetRecAsApexGenerateOptions;
