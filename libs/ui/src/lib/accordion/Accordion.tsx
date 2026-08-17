// https://www.lightningdesignsystem.com/components/Accordion/#Fixed-Text

import { UiSection } from '@jetstream/types';
import classNames from 'classnames';
import isFunction from 'lodash/isFunction';
import { Fragment, FunctionComponent, ReactNode, useEffect, useRef, useState } from 'react';
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
  onActiveIdsChange,
}) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(initOpenIds));
  // initOpenIds is only honored as the accordion mounts, so the section to scroll to is captured the same way
  const scrollTargetIdRef = useRef(initOpenIds[0]);
  const scrollTargetRef = useRef<HTMLLIElement | null>(null);

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
      <ul className={classNames('slds-accordion', className)}>
        {sections.map((item) => {
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
                      aria-controls={item.id}
                      aria-expanded={isOpen}
                      className="slds-button slds-button_reset slds-accordion__summary-action"
                      onClick={() => handleClick(item.id)}
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
