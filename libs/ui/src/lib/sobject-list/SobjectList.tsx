/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { useState, useEffect, FunctionComponent, Fragment } from 'react';
import { DescribeGlobalSObjectResult } from 'jsforce';
import SearchInput from '../form/search-input/SearchInput';
import Spinner from '../widgets/Spinner';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import List from '../list/List';

export interface SobjectListProps {
  sobjects: DescribeGlobalSObjectResult[];
  loading: boolean;
  errorMessage?: string;
  onSelected?: (sobject: DescribeGlobalSObjectResult) => void;
}

export const SobjectList: FunctionComponent<SobjectListProps> = ({ sobjects, loading, errorMessage, onSelected }) => {
  const [filteredSobjects, setFilteredSobjects] = useState<DescribeGlobalSObjectResult[]>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [activeSObject, setActiveSObject] = useState<DescribeGlobalSObjectResult>(null);

  useEffect(() => {
    if (onSelected) {
      onSelected(activeSObject);
    }
  }, [onSelected, activeSObject]);

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
        {filteredSobjects && (
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
                isActive={(item: DescribeGlobalSObjectResult) => item.name === activeSObject?.name}
                onSelected={(key) => setActiveSObject(sobjects.find((item) => item.name === key))}
                getContent={(item: DescribeGlobalSObjectResult) => ({
                  key: item.name,
                  heading: item.label,
                  subheading: item.name,
                })}
              />
            </AutoFullHeightContainer>
          </Fragment>
        )}
      </div>
    </Fragment>
  );
};

export default SobjectList;
