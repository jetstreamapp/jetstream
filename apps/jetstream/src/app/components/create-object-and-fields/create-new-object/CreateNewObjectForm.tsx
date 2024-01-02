import { Checkbox, ComboboxWithItems, Grid, GridCol, Input, RadioButton, RadioGroup, TabIconList, Textarea } from '@jetstream/ui';
import { FunctionComponent, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import * as fromCreateObjectState from './create-object-state';
import { generateApiNameFromLabel } from './create-object-utils';

export interface CreateNewObjectFormProps {
  loading: boolean;
}

export const CreateNewObjectForm: FunctionComponent<CreateNewObjectFormProps> = ({ loading }) => {
  const [label, setLabel] = useRecoilState(fromCreateObjectState.labelState);
  const [pluralLabel, setPluralLabel] = useRecoilState(fromCreateObjectState.pluralLabelState);
  const [startsWith, setStartsWith] = useRecoilState(fromCreateObjectState.startsWithState);
  const [apiName, setApiName] = useRecoilState(fromCreateObjectState.apiNameState);
  const [description, setDescription] = useRecoilState(fromCreateObjectState.descriptionState);
  const [recordName, setRecordName] = useRecoilState(fromCreateObjectState.recordNameState);
  const [dataType, setDataType] = useRecoilState(fromCreateObjectState.dataTypeState);
  const [displayFormat, setDisplayFormat] = useRecoilState(fromCreateObjectState.displayFormatState);
  const [startingNumber, setStartingNumber] = useRecoilState(fromCreateObjectState.startingNumberState);
  const [allowReports, setAllowReports] = useRecoilState(fromCreateObjectState.allowReportsState);
  const [allowActivities, setAllowActivities] = useRecoilState(fromCreateObjectState.allowActivitiesState);
  const [trackFieldHistory, setTrackFieldHistory] = useRecoilState(fromCreateObjectState.trackFieldHistoryState);
  const [allowInChatterGroups, setAllowInChatterGroups] = useRecoilState(fromCreateObjectState.allowInChatterGroupsState);
  const [allowSharingBulkStreaming, setAllowSharingBulkStreaming] = useRecoilState(fromCreateObjectState.allowSharingBulkStreamingState);
  const [allowSearch, setAllowSearch] = useRecoilState(fromCreateObjectState.allowSearchState);

  const [createTab, setCreateTab] = useRecoilState(fromCreateObjectState.createTabState);
  const [selectedTabIcon, setSelectedTabIcon] = useRecoilState(fromCreateObjectState.selectedTabIconState);

  useEffect(() => {
    setApiName(generateApiNameFromLabel(label));
    setPluralLabel(label);
    setRecordName(label ? `${label} Name` : '');
  }, [label, setApiName, setPluralLabel, setRecordName]);

  function handleSelectAllCheckboxes() {
    setAllowReports(true);
    setAllowActivities(true);
    setTrackFieldHistory(true);
    setAllowInChatterGroups(true);
    setAllowSharingBulkStreaming(true);
    setAllowSearch(true);
  }

  return (
    <Grid wrap guttersDirect verticalAlign="start">
      <GridCol size={12} sizeMedium={6}>
        <Input label="Label" isRequired>
          <input
            className="slds-input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={loading}
            maxLength={40}
            required
          />
        </Input>
      </GridCol>

      <GridCol size={12} sizeMedium={6}>
        <ComboboxWithItems
          comboboxProps={{
            label: 'Label Starts With',
            isRequired: true,
          }}
          items={[
            { id: 'Consonant', label: 'Consonant', value: 'Consonant' },
            { id: 'Vowel', label: 'Vowel', value: 'Vowel' },
            { id: 'Special', label: 'Special (for nouns starting with z, or s plus consonants)', value: 'Special' },
          ]}
          selectedItemId={startsWith}
          onSelected={(item) => setStartsWith(item.value as 'Consonant' | 'Vowel' | 'Special')}
        />
      </GridCol>

      <GridCol size={12} sizeMedium={6}>
        <Input label="Plural Label" isRequired>
          <input
            className="slds-input"
            value={pluralLabel}
            onChange={(event) => setPluralLabel(event.target.value)}
            disabled={loading}
            maxLength={40}
            required
          />
        </Input>
      </GridCol>

      <GridCol size={12} sizeMedium={6}>
        <Input label="Api Name" isRequired>
          <input
            className="slds-input"
            value={apiName}
            onChange={(event) => setApiName(event.target.value)}
            disabled={loading}
            maxLength={40}
            required
          />
        </Input>
      </GridCol>

      <GridCol size={12}>
        <Textarea id={`description`} label={'Description'}>
          <textarea
            id={`description`}
            name="description"
            className="slds-textarea"
            value={description}
            disabled={loading}
            rows={2}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
          />
        </Textarea>
      </GridCol>

      <GridCol size={12} sizeMedium={6}>
        <Input label="Record Name" isRequired>
          <input
            className="slds-input"
            value={recordName}
            onChange={(event) => setRecordName(event.target.value)}
            disabled={loading}
            maxLength={80}
            required
          />
        </Input>
      </GridCol>

      <GridCol size={12} sizeMedium={6}>
        <RadioGroup label="Name Type" isButtonGroup>
          <RadioButton
            id="data-type-text"
            name="data-type"
            label="Text"
            value="Text"
            checked={dataType === 'Text'}
            onChange={(value) => setDataType(value as 'Text' | 'AutoNumber')}
            disabled={loading}
          />
          <RadioButton
            id="data-type-auto-number"
            name="data-type"
            label="Auto-Number"
            value="AutoNumber"
            checked={dataType === 'AutoNumber'}
            onChange={(value) => setDataType(value as 'Text' | 'AutoNumber')}
            disabled={loading}
          />
        </RadioGroup>

        {dataType === 'AutoNumber' && (
          <Grid wrap gutters>
            <GridCol size={12} sizeSmall={6}>
              <Input
                label="Display Format"
                isRequired
                labelHelp={
                  <ul className="slds-list_dotted">
                    <li>
                      {'{0}'} Required Sequence number. One or more zeros enclosed in curly braces represent the sequence number itself. The
                      number of zeros in the curly braces dictates the minimum number of digits that will be displayed. If the actual number
                      has fewer digits than this, it will be padded with leading zeros. Maximum is 10 digits.
                    </li>
                    <li>
                      {'{YY} {YYYY}'} Optional Year. 2 or 4 "Y" characters enclosed in curly braces represent the year of the record
                      creation date. You can display 2 digits (for example, "04") or all 4 digits (for example, "2004") of the year.
                    </li>
                    <li>
                      {'{MM}'} Optional Month. 2 "M" characters enclosed in curly braces represent the numeric month (for example, "01" for
                      January, "02" for February) of the record creation date.
                    </li>
                    <li>
                      {'{DD}'} Optional Day. 2 "D" characters enclosed in curly braces represent the numeric day of the month (for example,
                      "01" to "31" are valid days in January) of the record creation date.
                    </li>
                  </ul>
                }
              >
                <input
                  className="slds-input"
                  placeholder="A-{0000}"
                  value={displayFormat}
                  onChange={(event) => setDisplayFormat(event.target.value)}
                  disabled={loading}
                  maxLength={50}
                  required
                />
              </Input>
            </GridCol>
            <GridCol size={12} sizeSmall={6}>
              <Input label="Starting Number" isRequired>
                <input
                  className="slds-input"
                  value={startingNumber}
                  pattern="[0-9]+"
                  onChange={(event) => setStartingNumber(event.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  maxLength={50}
                  required
                />
              </Input>
            </GridCol>
          </Grid>
        )}
      </GridCol>

      <GridCol size={12}>
        <hr className="slds-m-vertical_small" />
      </GridCol>

      <GridCol size={12}>
        <Grid>
          <GridCol>
            <Checkbox id="allowReports" label="Allow Reports" checked={allowReports} onChange={setAllowReports} disabled={loading} />
            <Checkbox
              id="allowActivities"
              label="Allow Activities"
              checked={allowActivities}
              onChange={setAllowActivities}
              disabled={loading}
            />
            <Checkbox
              id="trackFieldHistory"
              label="Track Field History"
              checked={trackFieldHistory}
              onChange={setTrackFieldHistory}
              disabled={loading}
            />
            <Checkbox
              id="allowInChatterGroups"
              label="Allow in Chatter Groups"
              checked={allowInChatterGroups}
              onChange={setAllowInChatterGroups}
              disabled={loading}
            />
          </GridCol>
          <GridCol>
            <Checkbox
              id="allowSharingBulkStreaming"
              label="Allow Sharing, Bulk API, and Streaming API"
              checked={allowSharingBulkStreaming}
              onChange={setAllowSharingBulkStreaming}
              disabled={loading}
            />

            <Checkbox id="allowSearch" label="Allow Search" checked={allowSearch} onChange={setAllowSearch} disabled={loading} />
          </GridCol>
        </Grid>
        <button className="slds-button" type="button" onClick={handleSelectAllCheckboxes}>
          Select All
        </button>
      </GridCol>

      <GridCol size={12}>
        <hr className="slds-m-vertical_small" />
      </GridCol>

      <GridCol size={12}>
        <Checkbox id="create-tab" label="Create tab for this object" checked={createTab} onChange={setCreateTab} disabled={loading} />
      </GridCol>
      {createTab && (
        <GridCol size={12}>
          <TabIconList selectedItem={selectedTabIcon} disabled={loading} onSelected={setSelectedTabIcon} />
        </GridCol>
      )}
    </Grid>
  );
};

export default CreateNewObjectFormProps;
