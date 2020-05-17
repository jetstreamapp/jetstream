/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { useState, useEffect, FunctionComponent, Fragment } from 'react';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { describeGlobal } from '../../../utils/data';
import { orderObjectsBy } from '../../../utils/utils';
import List from '../../core/List';
import SearchInput from '../../core/SearchInput';
import Spinner from '../../core/Spinner';
import AutoFullHeightContainer from '../../core/AutoFullHeightContainer';

export interface SobjectListProps {
  onSelected?: (sobject: DescribeGlobalSObjectResult) => void;
}

export const SobjectList: FunctionComponent<SobjectListProps> = ({ onSelected }) => {
  const [sobjects, setSobjects] = useState<DescribeGlobalSObjectResult[]>(null);
  const [filteredSobjects, setFilteredSobjects] = useState<DescribeGlobalSObjectResult[]>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);

  const [activeSObject, setActiveSObject] = useState<DescribeGlobalSObjectResult>(null);

  useEffect(() => {
    if (!inProgress && !errorMessage && !sobjects) {
      (async () => {
        setInProgress(true);
        try {
          const results = await describeGlobal();
          setSobjects(orderObjectsBy(results.sobjects.filter(filterSobjectFn), 'label'));
        } catch (ex) {
          console.error(ex);
          setErrorMessage(ex.message);
        }
        setInProgress(false);
      })();
    }
  }, [inProgress, errorMessage, sobjects]);

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

  function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
    return sobject.queryable && !sobject.name.endsWith('CleanInfo');
  }

  return (
    <Fragment>
      {inProgress && (
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
