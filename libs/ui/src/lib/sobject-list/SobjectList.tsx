/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { useState, useEffect, FunctionComponent, Fragment } from 'react';
import { DescribeGlobalSObjectResult } from 'jsforce';
import SearchInput from '../form/search-input/SearchInput';
import Spinner from '../widgets/Spinner';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import List from '../list/List';
import { filter } from 'lodash';
import EmptyState from '../illustrations/EmptyState';

export interface SobjectListProps {
  sobjects: DescribeGlobalSObjectResult[];
  selectedSObject: DescribeGlobalSObjectResult;
  loading: boolean;
  errorMessage?: string; // TODO:
  onSelected: (sobject: DescribeGlobalSObjectResult) => void;
}

export const SobjectList: FunctionComponent<SobjectListProps> = ({ sobjects, selectedSObject, loading, errorMessage, onSelected }) => {
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
        {sobjects && filteredSobjects && (
          <Fragment>
            <div className="slds-p-bottom--xx-small">
              <SearchInput id="object-filter" placeholder="Filter Objects" onChange={setSearchTerm} />
              <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                Showing {filteredSobjects.length} of {sobjects.length} objects
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
