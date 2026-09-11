import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { AutoFullHeightContainer, Checkbox, Grid, SearchInput } from '@jetstream/ui';
import { FunctionComponent, useMemo, useState } from 'react';
import type { TestClassListItem } from '../apex-test-runner-types';
import TestClassSelectionRow, { ClassSelection, methodRovingId } from './TestClassSelectionRow';
import { useRovingCheckboxList } from './useRovingCheckboxList';

export interface TestClassSelectionProps {
  testClasses: TestClassListItem[];
  unknownClasses: TestClassListItem[];
  selectedClasses: Map<string, Set<string> | 'ALL'>;
  onToggleClass: (classId: string) => void;
  onToggleMethod: (classId: string, method: string) => void;
  /** Bulk select/deselect — applied only to the currently visible (filtered) classes */
  onSelectAllVisible: (classIds: string[], select: boolean) => void;
}

export const TestClassSelection: FunctionComponent<TestClassSelectionProps> = ({
  testClasses,
  unknownClasses,
  selectedClasses,
  onToggleClass,
  onToggleMethod,
  onSelectAllVisible,
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

  const visibleClasses = useMemo(
    () => (showUnknownClasses ? [...filteredTestClasses, ...filteredUnknownClasses] : filteredTestClasses),
    [filteredTestClasses, filteredUnknownClasses, showUnknownClasses],
  );

  const visibleSelectedCount = visibleClasses.filter(({ classId }) => selectedClasses.has(classId)).length;
  const allVisibleSelected = visibleClasses.length > 0 && visibleSelectedCount === visibleClasses.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  const filteredClassesById = useMemo(() => new Map(filteredTestClasses.map((item) => [item.classId, item])), [filteredTestClasses]);

  // The class/method tree is one tab stop: ArrowUp/Down move through the visible checkboxes,
  // ArrowRight expands a class (then steps into its first method), ArrowLeft collapses (or steps
  // from a method back to its class) — the tree idiom the shared Tree component uses
  const classListRovingIds = useMemo(() => {
    const ids: string[] = [];
    for (const { classId, methods } of filteredTestClasses) {
      ids.push(classId);
      if (expandedClasses.has(classId)) {
        methods.forEach((method) => ids.push(methodRovingId(classId, method)));
      }
    }
    return ids;
  }, [filteredTestClasses, expandedClasses]);

  const classList = useRovingCheckboxList({
    ids: classListRovingIds,
    onArrowRight: (id) => {
      const item = filteredClassesById.get(id);
      if (!item?.methods.length) {
        return;
      }
      if (!expandedClasses.has(id)) {
        setExpandedClasses((prior) => new Set(prior).add(id));
      } else {
        classList.focusItem(methodRovingId(id, item.methods[0]));
      }
    },
    onArrowLeft: (id) => {
      if (id.includes(':')) {
        classList.focusItem(id.split(':')[0]);
        return;
      }
      if (expandedClasses.has(id)) {
        setExpandedClasses((prior) => {
          const updated = new Set(prior);
          updated.delete(id);
          return updated;
        });
      }
    },
  });

  // The unknown-classes list sits after its show/hide toggle button, so it is its own single tab stop
  const unknownClassList = useRovingCheckboxList({
    ids: useMemo(
      () => (showUnknownClasses ? filteredUnknownClasses.map(({ classId }) => classId) : []),
      [showUnknownClasses, filteredUnknownClasses],
    ),
  });

  function handleToggleExpand(classId: string) {
    setExpandedClasses((prior) => {
      const updated = new Set(prior);
      updated.has(classId) ? updated.delete(classId) : updated.add(classId);
      return updated;
    });
  }

  function handleSelectAll() {
    onSelectAllVisible(
      visibleClasses.map(({ classId }) => classId),
      !allVisibleSelected,
    );
  }

  function getSelection(classId: string): ClassSelection {
    return selectedClasses.get(classId);
  }

  return (
    <div>
      <SearchInput id="test-class-search" className="slds-m-bottom_x-small" placeholder="Filter test classes" onChange={setSearchTerm} />
      <Grid verticalAlign="center">
        <Checkbox
          id="test-class-select-all"
          checked={allVisibleSelected}
          indeterminate={someVisibleSelected}
          disabled={visibleClasses.length === 0}
          label="Select All"
          onChange={handleSelectAll}
        />
        <span className="slds-m-left_small slds-text-body_small slds-text-color_weak">
          Showing {formatNumber(filteredTestClasses.length)} of {formatNumber(testClasses.length)} test classes
        </span>
      </Grid>
      <AutoFullHeightContainer
        bottomBuffer={25}
        // The scroll container clipped the chevron/checkbox focus rings at its left and top edges —
        // pad the rings back into view; the negative margin keeps the rows aligned with the header above
        baseCss={css`
          padding: 0.25rem 0 0 0.25rem;
          margin-left: -0.25rem;
        `}
      >
        {/* Composite-widget pattern: the ul delegates keyboard handling for its checkboxes */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <ul aria-label="Test classes" {...classList.containerProps}>
          {filteredTestClasses.map((item) => (
            <TestClassSelectionRow
              key={item.classId}
              item={item}
              selection={getSelection(item.classId)}
              expanded={expandedClasses.has(item.classId)}
              getItemProps={classList.getItemProps}
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
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
              <ul aria-label="Classes that could not be analyzed" {...unknownClassList.containerProps}>
                {filteredUnknownClasses.map((item) => (
                  <TestClassSelectionRow
                    key={item.classId}
                    item={item}
                    selection={getSelection(item.classId)}
                    expanded={false}
                    getItemProps={unknownClassList.getItemProps}
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
