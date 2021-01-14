/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { UpDown } from '@jetstream/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { createRef, Fragment, FunctionComponent, useEffect, useState } from 'react';
import SearchInput from '../form/search-input/SearchInput';
import EmptyState from '../illustrations/EmptyState';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import List from '../list/List';
import Spinner from '../widgets/Spinner';

export interface SobjectListProps {
  sobjects: DescribeGlobalSObjectResult[];
  selectedSObject: DescribeGlobalSObjectResult;
  loading: boolean;
  errorMessage?: string; // TODO:
  onSelected: (sobject: DescribeGlobalSObjectResult) => void;
  errorReattempt: () => void;
}

export const SobjectList: FunctionComponent<SobjectListProps> = ({
  sobjects,
  selectedSObject,
  loading,
  errorMessage,
  onSelected,
  errorReattempt,
}) => {
  const [filteredSobjects, setFilteredSobjects] = useState<DescribeGlobalSObjectResult[]>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInputId] = useState(`object-filter-${Date.now()}`);
  const ulRef = createRef<HTMLUListElement>();

  useEffect(() => {
    if (sobjects && sobjects.length > 0 && searchTerm) {
      setFilteredSobjects(sobjects.filter(multiWordObjectFilter(['name', 'label'], searchTerm)));
    } else {
      setFilteredSobjects(sobjects);
    }
  }, [sobjects, searchTerm]);

  function handleSearchKeyboard(direction: UpDown) {
    if (ulRef && ulRef.current) {
      ulRef.current.focus();
    }
  }

  return (
    <Fragment>
      {loading && (
        <div
          className="slds-is-relative"
          css={css`
            min-height: 50px;
          `}
        >
          <Spinner />
        </div>
      )}
      <div>
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
                onChange={setSearchTerm}
                onArrowKeyUpDown={handleSearchKeyboard}
              />
              <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                Showing {formatNumber(filteredSobjects.length)} of {formatNumber(sobjects.length)} objects
              </div>
            </div>
            <AutoFullHeightContainer bottomBuffer={20}>
              <List
                ref={ulRef}
                autoScrollToFocus
                items={filteredSobjects}
                isActive={(item: DescribeGlobalSObjectResult) => item.name === selectedSObject?.name}
                onSelected={(key) => onSelected(sobjects.find((item) => item.name === key))}
                getContent={(item: DescribeGlobalSObjectResult) => ({
                  key: item.name,
                  heading: item.label,
                  subheading: item.name,
                })}
              />
              {!filteredSobjects.length && (
                <EmptyState imageWidth={200}>
                  <p>There are no matching objects</p>
                  <p>Adjust your selection.</p>
                </EmptyState>
              )}
            </AutoFullHeightContainer>
          </Fragment>
        )}
      </div>
    </Fragment>
  );
};

export default SobjectList;
