import { css } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult, Maybe, UpDown } from '@jetstream/types';
import { ForwardedRef, forwardRef, Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import SearchInput from '../form/search-input/SearchInput';
import EmptyState from '../illustrations/EmptyState';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import List, { focusListEntryRow } from '../list/List';
import Tabs from '../tabs/Tabs';
import ShowingCountStatus from '../widgets/ShowingCountStatus';
import Spinner from '../widgets/Spinner';

export interface SobjectListProps {
  isTooling?: boolean;
  sobjects: Maybe<DescribeGlobalSObjectResult[]>;
  selectedSObject: Maybe<DescribeGlobalSObjectResult>;
  loading: boolean;
  errorMessage?: Maybe<string>;
  initialSearchTerm?: string;
  recentItemsEnabled?: boolean;
  recentItems?: Maybe<DescribeGlobalSObjectResult[]>;
  onSelected: (sobject: DescribeGlobalSObjectResult) => void;
  errorReattempt: () => void;
  onSearchTermChange?: (searchTerm: string) => void;
}

export const SobjectList: FunctionComponent<SobjectListProps> = ({
  isTooling,
  sobjects: allSobjects,
  selectedSObject,
  loading,
  errorMessage,
  initialSearchTerm,
  recentItemsEnabled,
  recentItems,
  onSelected,
  errorReattempt,
  onSearchTermChange,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'recent'>('all');
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');

  const sobjects = recentItemsEnabled && activeTab === 'recent' ? recentItems : allSobjects;

  const [filteredSobjects, setFilteredSobjects] = useState<DescribeGlobalSObjectResult[]>(() => {
    if (sobjects && sobjects.length > 0 && searchTerm) {
      return sobjects.filter(multiWordObjectFilter(['name', 'label'], searchTerm));
    } else {
      return sobjects || [];
    }
  });
  const [searchInputId] = useState(`object-filter-${Date.now()}`);
  const ulRef = useRef<HTMLUListElement>(null);

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

  // ArrowDown from the filter lands directly on the active (else first) row — not on the list, which
  // needed a second press
  function handleSearchKeyboard(_direction: UpDown) {
    focusListEntryRow(ulRef.current);
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
              <ShowingCountStatus filteredCount={filteredSobjects.length} totalCount={sobjects.length} noun="objects" />
            </div>
            {recentItemsEnabled ? (
              <Tabs
                initialActiveId="all"
                onChange={(id) => setActiveTab(id as 'all' | 'recent')}
                tabs={[
                  {
                    id: 'all',
                    title: 'All Objects',
                    titleText: 'View all objects',
                    content: (
                      <AutoFullHeightContainer bottomBuffer={25}>
                        <SobjectListContent
                          ref={ulRef}
                          sobjects={sobjects}
                          selectedSObject={selectedSObject}
                          loading={loading}
                          filteredSobjects={filteredSobjects}
                          onSelected={onSelected}
                          searchTerm={searchTerm}
                        />
                      </AutoFullHeightContainer>
                    ),
                  },
                  {
                    id: 'recent',
                    title: 'Recent Objects',
                    titleText: 'View recently used objects',
                    content: (
                      <AutoFullHeightContainer bottomBuffer={25}>
                        <SobjectListContent
                          ref={ulRef}
                          sobjects={sobjects}
                          selectedSObject={selectedSObject}
                          loading={loading}
                          filteredSobjects={filteredSobjects}
                          onSelected={onSelected}
                          searchTerm={searchTerm}
                        />
                      </AutoFullHeightContainer>
                    ),
                  },
                ]}
              />
            ) : (
              <AutoFullHeightContainer bottomBuffer={25}>
                <SobjectListContent
                  ref={ulRef}
                  sobjects={sobjects}
                  selectedSObject={selectedSObject}
                  loading={loading}
                  filteredSobjects={filteredSobjects}
                  onSelected={onSelected}
                  searchTerm={searchTerm}
                />
              </AutoFullHeightContainer>
            )}
          </Fragment>
        )}
      </div>
    </Fragment>
  );
};

interface SobjectListContentProps extends Pick<SobjectListProps, 'selectedSObject' | 'loading' | 'onSelected'> {
  sobjects: DescribeGlobalSObjectResult[];
  filteredSobjects: DescribeGlobalSObjectResult[];
  searchTerm: string;
}

const SobjectListContent = forwardRef(
  (
    { sobjects, selectedSObject, loading, filteredSobjects, onSelected, searchTerm }: SobjectListContentProps,
    ref: ForwardedRef<HTMLUListElement>,
  ) => {
    return (
      <>
        <List
          ref={ref}
          ariaLabel="Salesforce objects"
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
      </>
    );
  },
);

export default SobjectList;
