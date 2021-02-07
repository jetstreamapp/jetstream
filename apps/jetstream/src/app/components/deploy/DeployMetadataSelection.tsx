/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { COMMON_METADATA_TYPES, DescribeMetadataList, getMetadataLabelFromFullName } from '@jetstream/connected-ui';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  DatePicker,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  RadioButton,
  RadioGroup,
  ReadonlyList,
} from '@jetstream/ui';
import DeployMetadataPackage from './deploy-metadata-package/DeployMetadataPackage';
import addDays from 'date-fns/addDays';
import isBoolean from 'lodash/isBoolean';
import { Fragment, FunctionComponent, useState } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import Split from 'react-split';
import { CSSTransition } from 'react-transition-group';
import { useRecoilState, useRecoilValue } from 'recoil';
import * as fromDeployMetadataState from './deploy-metadata.state';
import { AllUser, CommonUser, YesNo } from './deploy-metadata.types';
import './DeployMetadataSelection.scss';
import DeployMetadataUserList from './DeployMetadataUserList';
import DownloadMetadataPackage from './download-metadata-package/DownloadMetadataPackage';

interface RadioButtonItem<T = string> {
  name: T;
  label: string;
  value: T;
}

const HEIGHT_BUFFER = 170;

const METADATA_TYPES_RADIO_BUTTONS: RadioButtonItem<CommonUser>[] = [
  {
    name: 'user',
    label: 'Let Me Choose',
    value: 'user',
  },
  {
    name: 'common',
    label: 'Common Types',
    value: 'common',
  },
];

const DATE_RANGE_RADIO_BUTTONS: RadioButtonItem<AllUser>[] = [
  {
    name: 'all',
    label: 'Any Date',
    value: 'all',
  },
  {
    name: 'user',
    label: 'Specific Date',
    value: 'user',
  },
];

const INCL_MANAGED_PACKAGE_RADIO_BUTTONS: RadioButtonItem<YesNo>[] = [
  {
    name: 'No',
    label: 'Unmanaged Only',
    value: 'No',
  },
  {
    name: 'Yes',
    label: 'Include Managed',
    value: 'Yes',
  },
];

const USER_SELECTION_RADIO_BUTTONS: RadioButtonItem<AllUser>[] = [
  {
    name: 'all',
    label: 'All Users',
    value: 'all',
  },
  {
    name: 'user',
    label: 'Specific Users',
    value: 'user',
  },
];

export interface DeployMetadataSelectionProps {
  selectedOrg: SalesforceOrgUi;
}

export const DeployMetadataSelection: FunctionComponent<DeployMetadataSelectionProps> = ({ selectedOrg }) => {
  const match = useRouteMatch();

  const [maxDate] = useState(() => addDays(new Date(), 1));

  const [metadataSelectionType, setMetadataSelectionType] = useRecoilState<CommonUser>(fromDeployMetadataState.metadataSelectionTypeState);
  const [userSelection, setUserSelection] = useRecoilState<AllUser>(fromDeployMetadataState.userSelectionState);
  const [dateRangeSelection, setDateRangeSelection] = useRecoilState<AllUser>(fromDeployMetadataState.dateRangeSelectionState);
  const [includeManagedPackageItems, setIncludeManagedPackageItems] = useRecoilState<YesNo>(
    fromDeployMetadataState.includeManagedPackageItems
  );
  const [dateRange, setDateRange] = useRecoilState<Date>(fromDeployMetadataState.dateRangeState);

  const [metadataItems, setMetadataItems] = useRecoilState(fromDeployMetadataState.metadataItemsState);
  const [metadataItemsMap, setMetadataItemsMap] = useRecoilState(fromDeployMetadataState.metadataItemsMapState);
  const [selectedMetadataItems, setSelectedMetadataItems] = useRecoilState(fromDeployMetadataState.selectedMetadataItemsState);
  // const [configuration, setConfiguration] = useRecoilState(fromDeployMetadataState.selectedConfiguration);
  // const resetConfiguration = useResetRecoilState(fromDeployMetadataState.selectedConfiguration);

  const [usersList, setUsersList] = useRecoilState(fromDeployMetadataState.usersList);
  const [selectedUsers, setSelectedUsers] = useRecoilState(fromDeployMetadataState.selectedUsersState);
  const hasSelectionsMade = useRecoilValue(fromDeployMetadataState.hasSelectionsMadeSelector);
  const hasSelectionsMadeMessage = useRecoilValue(fromDeployMetadataState.hasSelectionsMadeMessageSelector);

  function handleSelection(items: string[], selectAllValue?: boolean) {
    // add or remove all
    if (isBoolean(selectAllValue)) {
      if (selectAllValue) {
        setSelectedMetadataItems(new Set(Array.from(selectedMetadataItems).concat(items)));
      } else {
        const itemsToRemove = new Set(items);
        setSelectedMetadataItems(new Set(Array.from(selectedMetadataItems).filter((item) => !itemsToRemove.has(item))));
      }
    } else {
      // toggle each item - there should only be one item in items[]
      const existingItems = new Set(selectedMetadataItems);
      items.forEach((item) => {
        if (existingItems.has(item)) {
          existingItems.delete(item);
        } else {
          existingItems.add(item);
        }
      });
      setSelectedMetadataItems(existingItems);
    }
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'asset_relationship' }} label="Deploy Metadata Between Orgs" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <DownloadMetadataPackage selectedOrg={selectedOrg} />
            <DeployMetadataPackage selectedOrg={selectedOrg} />
            {hasSelectionsMade && (
              <Link
                className="slds-button slds-button_brand"
                to={{
                  pathname: `${match.url}/deploy`,
                }}
              >
                Continue
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </Link>
            )}
            {!hasSelectionsMade && (
              <button className="slds-button slds-button_brand" disabled>
                Continue
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </button>
            )}
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div
            className="slds-col_bump-left"
            css={css`
              min-height: 19px;
            `}
          >
            {hasSelectionsMadeMessage && <span>{hasSelectionsMadeMessage}</span>}
          </div>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer
        bottomBuffer={10}
        className="slds-p-horizontal_x-small slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        <Split
          sizes={[33, 33, 33]}
          minSize={[300, 300, 300]}
          gutterSize={metadataItems?.length ? 10 : 0}
          className="slds-gutters"
          css={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div className="slds-p-horizontal_x-small">
            <div className="slds-align_absolute-center">
              <RadioButtonSelection
                label={'Which Metadata types do you want to include?'}
                items={METADATA_TYPES_RADIO_BUTTONS}
                checkedValue={metadataSelectionType}
                disabled={false}
                onChange={(value: CommonUser) => setMetadataSelectionType(value)}
              />
            </div>
            <hr className="slds-m-vertical_small" />
            {metadataSelectionType === 'common' && (
              <AutoFullHeightContainer bottomBuffer={10}>
                <h2 className="slds-text-heading_medium slds-grow slds-text-align_center">Metadata Types</h2>
                <ReadonlyList
                  items={COMMON_METADATA_TYPES}
                  getContent={(item: string) => ({
                    key: item,
                    heading: getMetadataLabelFromFullName(item),
                    subheading: item,
                  })}
                />
              </AutoFullHeightContainer>
            )}
            {metadataSelectionType === 'user' && (
              <DescribeMetadataList
                inputLabelPlural="Metadata Types"
                org={selectedOrg}
                initialItems={metadataItems}
                initialItemMap={metadataItemsMap}
                selectedItems={selectedMetadataItems}
                onItems={setMetadataItems}
                onItemsMap={setMetadataItemsMap}
                onSelected={handleSelection}
              />
            )}
          </div>
          <div className="slds-p-horizontal_x-small">
            <div className="slds-align_absolute-center">
              <RadioButtonSelection
                label={'Show metadata modified by which users'}
                items={USER_SELECTION_RADIO_BUTTONS}
                checkedValue={userSelection}
                onChange={(value: AllUser) => setUserSelection(value)}
              />
            </div>
            {userSelection === 'user' && (
              <Fragment>
                <hr className="slds-m-vertical_small" />
                <DeployMetadataUserList
                  selectedOrg={selectedOrg}
                  initialUsers={usersList}
                  selectedUsers={selectedUsers}
                  onUsers={setUsersList}
                  onSelection={setSelectedUsers}
                />
              </Fragment>
            )}
          </div>
          <div className="slds-p-horizontal_x-small">
            <div className="slds-align_absolute-center">
              <RadioButtonSelection
                label={'Show metadata created or changed since'}
                items={DATE_RANGE_RADIO_BUTTONS}
                checkedValue={dateRangeSelection}
                onChange={(value: AllUser) => setDateRangeSelection(value)}
              />
            </div>
            <CSSTransition in={dateRangeSelection === 'user'} timeout={300} classNames="animation-item">
              <div
                key="modified-since"
                css={css`
                  min-height: 80px;
                `}
              >
                {dateRangeSelection === 'user' && (
                  <Fragment>
                    <DatePicker
                      id="modified-since"
                      label="Modified Since"
                      className="slds-m-top_small slds-form-element_stacked slds-is-editing"
                      maxAvailableDate={maxDate}
                      // containerDisplay="contents"
                      errorMessage="Choose a valid date in the past"
                      labelHelp="All metadata items that were created or modified since this date will be shown"
                      isRequired
                      hasError={false}
                      errorMessageId={`modified-since-error`}
                      initialSelectedDate={dateRange}
                      onChange={setDateRange}
                    />
                  </Fragment>
                )}
              </div>
            </CSSTransition>
            <hr className="slds-m-vertical_small" />
            <div className="slds-align_absolute-center">
              <RadioButtonSelection
                label={'Include Managed Package Metadata'}
                items={INCL_MANAGED_PACKAGE_RADIO_BUTTONS}
                checkedValue={includeManagedPackageItems}
                helpText={<em className="slds-text-color_weak">Managed components may not allow deployment or modification</em>}
                onChange={(value: YesNo) => setIncludeManagedPackageItems(value)}
              />
            </div>
          </div>
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default DeployMetadataSelection;

interface RadioButtonSelectionProps {
  label: string;
  items: RadioButtonItem[];
  checkedValue: string;
  disabled?: boolean;
  helpText?: string | JSX.Element;
  onChange: (value: string) => void;
}

const RadioButtonSelection: FunctionComponent<RadioButtonSelectionProps> = ({
  label,
  items,
  checkedValue,
  disabled,
  helpText,
  onChange,
}) => {
  return (
    <RadioGroup label={label} isButtonGroup formControlClassName="slds-align_absolute-center" helpText={helpText}>
      {items.map((item) => (
        <RadioButton
          key={item.value}
          name={label}
          label={item.label}
          value={item.value}
          disabled={disabled}
          checked={item.value === checkedValue}
          onChange={onChange}
        />
      ))}
    </RadioGroup>
  );
};
