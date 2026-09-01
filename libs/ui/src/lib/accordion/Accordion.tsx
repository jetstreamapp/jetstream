// https://www.lightningdesignsystem.com/components/Accordion/#Fixed-Text

import { isArrowDownKey, isArrowUpKey, isEndKey, isHomeKey } from '@jetstream/shared/ui-utils';
import { UiSection } from '@jetstream/types';
import classNames from 'classnames';
import isFunction from 'lodash/isFunction';
import { Fragment, FunctionComponent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react';
import Icon from '../widgets/Icon';

export interface AccordionProps {
  className?: string;
  initOpenIds: string[];
  sections: UiSection[];
  allowMultiple?: boolean;
  showExpandCollapseAll?: boolean; // only applies if allowMultiple
  expandAllClassName?: string;
  expandAllContainerClassName?: string;
  /**
   * Additional content to display next to the expand/collapse all button.
   */
  expandAllExtraContent?: ReactNode;
  /**
   * Scroll the section opened by `initOpenIds` into view as the accordion mounts, for when the accordion is
   * rendered already scrolled past the section that matters.
   */
  scrollInitOpenIdIntoView?: boolean;
  /**
   * Roving-tabindex composite: the section headers share ONE page tab stop — ArrowUp/ArrowDown move
   * between headers (wrapping, skipping disabled sections), Home/End jump to the ends, and
   * Enter/Space toggle the focused section natively. Tab moves from the header into the open
   * section's content, so embedded controls stay reachable without a tab stop per header.
   *
   * Use for long, data-driven accordions (an object's child relationships) where a tab stop per
   * header makes the page untraversable; short static accordions keep the default
   * tab-stop-per-header behavior, which is the baseline APG accordion pattern.
   */
  singleTabStop?: boolean;
  onActiveIdsChange?: (openIds: string[]) => void;
}

export const Accordion: FunctionComponent<AccordionProps> = ({
  className,
  sections,
  initOpenIds,
  allowMultiple = true,
  showExpandCollapseAll = false,
  expandAllClassName,
  expandAllContainerClassName,
  expandAllExtraContent,
  scrollInitOpenIdIntoView = false,
  singleTabStop = false,
  onActiveIdsChange,
}) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(initOpenIds));
  // initOpenIds is only honored as the accordion mounts, so the section to scroll to is captured the same way
  const scrollTargetIdRef = useRef(initOpenIds[0]);
  const scrollTargetRef = useRef<HTMLLIElement | null>(null);

  // Roving tabindex (singleTabStop): the header carrying tabIndex=0. Starts on the initially open
  // section so tabbing in lands where the user (or a navigator jump) left off. Filtering can shrink
  // `sections`, so the index is clamped at render rather than synced with an effect.
  const [focusedIndex, setFocusedIndex] = useState(() => {
    const initialOpenIndex = sections.findIndex(({ id }) => initOpenIds.includes(id));
    return initialOpenIndex >= 0 ? initialOpenIndex : 0;
  });
  const headerButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rovingIndex = Math.min(focusedIndex, Math.max(sections.length - 1, 0));

  useEffect(() => {
    if (scrollInitOpenIdIntoView) {
      scrollTargetRef.current?.scrollIntoView({ block: 'nearest' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClick(id: string) {
    if (allowMultiple) {
      if (openIds.has(id)) {
        openIds.delete(id);
      } else {
        openIds.add(id);
      }
    } else {
      if (openIds.has(id)) {
        openIds.clear();
      } else {
        openIds.clear();
        openIds.add(id);
      }
    }
    setOpenIds(new Set(openIds));
    if (onActiveIdsChange) {
      onActiveIdsChange(Array.from(openIds));
    }
  }

  function handleExpandAll() {
    const newOpenIds = new Set(sections.map((section) => section.id));
    setOpenIds(newOpenIds);
    if (onActiveIdsChange) {
      onActiveIdsChange(Array.from(newOpenIds));
    }
  }
  function handleCollapseAll() {
    setOpenIds(new Set());
    if (onActiveIdsChange) {
      onActiveIdsChange([]);
    }
  }

  /** Next non-disabled header from `start` in `direction`, wrapping; null when none qualifies */
  function findEnabledHeaderIndex(start: number, direction: 1 | -1): number | null {
    for (let step = 1; step <= sections.length; step++) {
      const index = (((start + direction * step) % sections.length) + sections.length) % sections.length;
      if (!sections[index].disabled) {
        return index;
      }
    }
    return null;
  }

  /**
   * Delegated on the ul, but only acts when the event comes from a section HEADER — arrow keys
   * inside an open section's content (field lists, search inputs) belong to that content.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (!(event.target instanceof HTMLElement) || !event.target.closest('.slds-accordion__summary-action')) {
      return;
    }
    let nextIndex: number | null = null;
    if (isArrowDownKey(event)) {
      nextIndex = findEnabledHeaderIndex(rovingIndex, 1);
    } else if (isArrowUpKey(event)) {
      nextIndex = findEnabledHeaderIndex(rovingIndex, -1);
    } else if (isHomeKey(event)) {
      nextIndex = sections.findIndex((section) => !section.disabled);
    } else if (isEndKey(event)) {
      nextIndex = sections.findLastIndex((section) => !section.disabled);
    }
    if (nextIndex !== null && nextIndex >= 0) {
      event.preventDefault();
      event.stopPropagation();
      setFocusedIndex(nextIndex);
      headerButtonRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <Fragment>
      {allowMultiple && showExpandCollapseAll && (
        <div className={expandAllContainerClassName}>
          {openIds.size < sections.length ? (
            <button type="button" className={classNames(expandAllClassName, 'slds-button')} title="Expand All" onClick={handleExpandAll}>
              <Icon type="utility" icon="expand_all" className="slds-button__icon slds-button__icon_left" omitContainer />
              Expand All
            </button>
          ) : (
            <button
              type="button"
              className={classNames(expandAllClassName, 'slds-button')}
              title="Collapse All"
              onClick={handleCollapseAll}
            >
              <Icon type="utility" icon="collapse_all" className="slds-button__icon slds-button__icon_left" omitContainer />
              Collapse All
            </button>
          )}
          {expandAllExtraContent}
        </div>
      )}
      <ul className={classNames('slds-accordion', className)} onKeyDown={singleTabStop ? handleKeyDown : undefined}>
        {sections.map((item, index) => {
          const isOpen = openIds.has(item.id);
          let content = item.content;
          if (isFunction(item.content)) {
            if (isOpen) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
              content = (content as Function)();
            } else {
              content = '';
            }
          }
          return (
            <li
              className={classNames('slds-accordion__list-item', item.className)}
              key={item.id}
              ref={item.id === scrollTargetIdRef.current ? scrollTargetRef : undefined}
              style={item.style || undefined}
            >
              <section className={classNames('slds-accordion__section', { 'slds-is-open': isOpen })}>
                <div className="slds-accordion__summary">
                  <h3 className="slds-accordion__summary-heading">
                    <button
                      type="button"
                      data-testid={item.testId}
                      ref={
                        singleTabStop
                          ? (node) => {
                              headerButtonRefs.current[index] = node;
                            }
                          : undefined
                      }
                      tabIndex={singleTabStop ? (index === rovingIndex ? 0 : -1) : undefined}
                      aria-controls={item.id}
                      aria-expanded={isOpen}
                      className="slds-button slds-button_reset slds-accordion__summary-action"
                      onClick={() => {
                        if (singleTabStop) {
                          setFocusedIndex(index);
                        }
                        handleClick(item.id);
                      }}
                      disabled={!!item.disabled}
                    >
                      <Icon
                        type="utility"
                        icon="switch"
                        className="slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left"
                        omitContainer
                      />
                      <span className="slds-accordion__summary-content slds-grid" title={item.titleText || (item.title as string)}>
                        {item.title}
                        {!isOpen && item.titleSummaryIfCollapsed}
                      </span>
                    </button>
                  </h3>
                </div>
                <div className="slds-accordion__content" id={item.id}>
                  {content as ReactNode}
                </div>
              </section>
            </li>
          );
        })}
      </ul>
    </Fragment>
  );
};

export default Accordion;
