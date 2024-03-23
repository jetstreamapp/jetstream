import { css } from '@emotion/react';
import { formatNumber, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult, Maybe, UpDown } from '@jetstream/types';
import { Fragment, FunctionComponent, createRef, useEffect, useState } from 'react';
import SearchInput from '../form/search-input/SearchInput';
import EmptyState from '../illustrations/EmptyState';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import List from '../list/List';
import Spinner from '../widgets/Spinner';

export interface SobjectListProps {
  isTooling?: boolean;
  sobjects: Maybe<DescribeGlobalSObjectResult[]>;
  selectedSObject: Maybe<DescribeGlobalSObjectResult>;
  loading: boolean;
  errorMessage?: Maybe<string>;
  initialSearchTerm?: string;
  onSelected: (sobject: DescribeGlobalSObjectResult) => void;
  errorReattempt: () => void;
  onSearchTermChange?: (searchTerm: string) => void;
}

export const SobjectList: FunctionComponent<SobjectListProps> = ({
  isTooling,
  sobjects,
  selectedSObject,
  loading,
  errorMessage,
  initialSearchTerm,
  onSelected,
  errorReattempt,
  onSearchTermChange,
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [filteredSobjects, setFilteredSobjects] = useState<DescribeGlobalSObjectResult[]>(() => {
    if (sobjects && sobjects.length > 0 && searchTerm) {
      return sobjects.filter(multiWordObjectFilter(['name', 'label'], searchTerm));
    } else {
      return sobjects || [];
    }
  });
  const [searchInputId] = useState(`object-filter-${Date.now()}`);
  const ulRef = createRef<HTMLUListElement>();

  useEffect(() => {
    if (sobjects && sobjects.length > 0 && searchTerm) {
      setFilteredSobjects(sobjects.filter(multiWordObjectFilter(['name', 'label'], searchTerm)));
    } else {
      setFilteredSobjects(sobjects || []);
    }
  }, [sobjects, searchTerm]);

  useEffect(() => onSearchTermChange && onSearchTermChange(searchTerm), [onSearchTermChange, searchTerm]);

  useNonInitialEffect(() => {
    setSearchTerm('');
  }, [isTooling]);

  function handleSearchKeyboard(direction: UpDown) {
    if (ulRef && ulRef.current) {
      ulRef.current.focus();
    }
  }

  return (
    <Fragment>
      {loading && !sobjects && (
        <div
          data-testid="sobject-list"
          className="slds-is-relative"
          css={css`
            min-height: 50px;
          `}
        >
          <Spinner />
        </div>
      )}
      <div data-testid="sobject-list">
        {errorMessage && (
          <p className="slds-p-around_medium slds-text-align_center">
            <span className="slds-text-color_error">There was an error loading objects for the selected org.</span>
            <button className="slds-button slds-m-left_xx-small" onClick={() => errorReattempt()}>
              Try Again?
            </button>
          </p>
        )}
        {sobjects && filteredSobjects && (
          <Fragment>
            <div className="slds-p-bottom--xx-small">
              <SearchInput
                id={searchInputId}
                placeholder="Filter Objects"
                value={searchTerm}
                onChange={setSearchTerm}
                onArrowKeyUpDown={handleSearchKeyboard}
              />
              <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                Showing {formatNumber(filteredSobjects.length)} of {formatNumber(sobjects.length)} objects
              </div>
            </div>
            <AutoFullHeightContainer bottomBuffer={25}>
              <List
                ref={ulRef}
                autoScrollToFocus
                items={filteredSobjects}
                isActive={(item: DescribeGlobalSObjectResult) => item.name === selectedSObject?.name}
                onSelected={(key) => {
                  const selected = sobjects.find((item) => item.name === key);
                  selected && onSelected(selected);
                }}
                getContent={(item: DescribeGlobalSObjectResult) => ({
                  key: item.name,
                  testId: item.name,
                  heading: item.label,
                  subheading: item.name,
                })}
                searchTerm={searchTerm}
                highlightText
              />
              {!loading && !filteredSobjects.length && (
                <EmptyState headline="There are no matching objects" subHeading="Adjust your selection."></EmptyState>
              )}
            </AutoFullHeightContainer>
          </Fragment>
        )}
      </div>
    </Fragment>
  );
};

export default SobjectList;
