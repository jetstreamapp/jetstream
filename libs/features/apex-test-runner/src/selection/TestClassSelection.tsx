import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { AutoFullHeightContainer, SearchInput } from '@jetstream/ui';
import { FunctionComponent, useMemo, useState } from 'react';
import type { TestClassListItem } from '../apex-test-runner-types';
import TestClassSelectionRow, { ClassSelection } from './TestClassSelectionRow';

export interface TestClassSelectionProps {
  testClasses: TestClassListItem[];
  unknownClasses: TestClassListItem[];
  selectedClasses: Map<string, Set<string> | 'ALL'>;
  onToggleClass: (classId: string) => void;
  onToggleMethod: (classId: string, method: string) => void;
}

export const TestClassSelection: FunctionComponent<TestClassSelectionProps> = ({
  testClasses,
  unknownClasses,
  selectedClasses,
  onToggleClass,
  onToggleMethod,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(() => new Set());
  const [showUnknownClasses, setShowUnknownClasses] = useState(false);

  const filteredTestClasses = useMemo(
    () => (searchTerm ? testClasses.filter(multiWordObjectFilter(['name'], searchTerm)) : testClasses),
    [testClasses, searchTerm],
  );
  const filteredUnknownClasses = useMemo(
    () => (searchTerm ? unknownClasses.filter(multiWordObjectFilter(['name'], searchTerm)) : unknownClasses),
    [unknownClasses, searchTerm],
  );

  function handleToggleExpand(classId: string) {
    setExpandedClasses((prior) => {
      const updated = new Set(prior);
      updated.has(classId) ? updated.delete(classId) : updated.add(classId);
      return updated;
    });
  }

  function getSelection(classId: string): ClassSelection {
    return selectedClasses.get(classId);
  }

  return (
    <div>
      <SearchInput id="test-class-search" className="slds-m-bottom_x-small" placeholder="Filter test classes" onChange={setSearchTerm} />
      <AutoFullHeightContainer bottomBuffer={25}>
        <ul>
          {filteredTestClasses.map((item) => (
            <TestClassSelectionRow
              key={item.classId}
              item={item}
              selection={getSelection(item.classId)}
              expanded={expandedClasses.has(item.classId)}
              onToggleExpand={handleToggleExpand}
              onToggleClass={onToggleClass}
              onToggleMethod={onToggleMethod}
            />
          ))}
        </ul>
        {!filteredTestClasses.length && <p className="slds-m-vertical_medium slds-text-align_center">No test classes found</p>}
        {!!filteredUnknownClasses.length && (
          <div className="slds-m-top_small">
            <button className="slds-button" onClick={() => setShowUnknownClasses((prior) => !prior)}>
              {showUnknownClasses ? 'Hide' : 'Show'} {filteredUnknownClasses.length}{' '}
              {filteredUnknownClasses.length === 1 ? 'class' : 'classes'} that couldn't be analyzed
            </button>
            {showUnknownClasses && (
              <ul>
                {filteredUnknownClasses.map((item) => (
                  <TestClassSelectionRow
                    key={item.classId}
                    item={item}
                    selection={getSelection(item.classId)}
                    expanded={false}
                    onToggleExpand={handleToggleExpand}
                    onToggleClass={onToggleClass}
                    onToggleMethod={onToggleMethod}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </AutoFullHeightContainer>
    </div>
  );
};

export default TestClassSelection;
