/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import SearchInput from '../form/search-input/SearchInput';
import EmptyState from '../illustrations/EmptyState';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import List from '../list/List';
import Spinner from '../widgets/Spinner';
import numeral from 'numeral';

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
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (sobjects && sobjects.length > 0 && searchTerm) {
      const lowercaseTerm = searchTerm.toLowerCase();
      const filteredSobject = sobjects.filter((obj) => `${obj.name || ''}${obj.label || ''}`.toLowerCase().includes(lowercaseTerm));
      setFilteredSobjects(filteredSobject);
    } else {
      setFilteredSobjects(sobjects);
    }
  }, [sobjects, searchTerm]);

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
              <SearchInput id="object-filter" placeholder="Filter Objects" onChange={setSearchTerm} />
              <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                Showing {numeral(filteredSobjects.length).format('0,0')} of {numeral(sobjects.length).format('0,0')} objects
              </div>
            </div>
            <AutoFullHeightContainer>
              <List
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
