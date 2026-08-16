import { css } from '@emotion/react';
import { Icon, Popover, PopoverRef, RadioButton, RadioGroup } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent, MouseEvent, useId, useRef } from 'react';

export type SubqueryObjectFilter = 'all' | 'selected';

export const DEFAULT_SUBQUERY_OBJECT_FILTER: SubqueryObjectFilter = 'all';

const RESET_FILTERS_LABEL = 'Reset all filters';

const FILTER_ITEMS: { key: SubqueryObjectFilter; label: string }[] = [
  { key: 'all', label: 'All Objects' },
  { key: 'selected', label: 'Selected Objects' },
];

export interface QuerySubqueryFilterProps {
  selectedFilter: SubqueryObjectFilter;
  onChange: (selectedFilter: SubqueryObjectFilter) => void;
}

/**
 * Filter for the related object list, mirroring the fields list filter so both behave the same way.
 * Only one filter exists today, so the badge is really just an "a filter is active" indicator.
 */
export const QuerySubqueryFilter: FunctionComponent<QuerySubqueryFilterProps> = ({ selectedFilter, onChange }) => {
  const popoverRef = useRef<PopoverRef>(null);
  const idPrefix = useId();
  const hasActiveFilter = selectedFilter !== DEFAULT_SUBQUERY_OBJECT_FILTER;

  function handleReset(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    onChange(DEFAULT_SUBQUERY_OBJECT_FILTER);
    popoverRef.current?.close();
  }

  return (
    <Popover
      ref={popoverRef}
      size="large"
      placement="right"
      tooltipProps={{ content: 'Open filters menu', openDelay: 500 }}
      content={
        <Fragment>
          <RadioGroup
            label="Selected Related Objects"
            labelHelp="Only show related objects that are included in the query, including those with fields selected on a nested related object."
            isButtonGroup
          >
            {FILTER_ITEMS.map(({ key, label }) => (
              <RadioButton
                key={key}
                id={`${idPrefix}-subquery-object-${key}`}
                name="subquery-object-filter"
                label={label}
                value={key}
                checked={key === selectedFilter}
                onChange={() => onChange(key)}
              />
            ))}
          </RadioGroup>
          <hr className="slds-m-vertical_small" />
          <button className="slds-button slds-button_neutral" onClick={handleReset} disabled={!hasActiveFilter}>
            Reset Filters
          </button>
        </Fragment>
      }
      buttonProps={{
        className: classNames('slds-button slds-button_icon', {
          'slds-text-color_brand': hasActiveFilter,
        }),
      }}
      // Rendered as a sibling of the trigger button since a button cannot be nested within another button
      triggerAfterContent={
        hasActiveFilter && (
          <button
            type="button"
            title={RESET_FILTERS_LABEL}
            aria-label={RESET_FILTERS_LABEL}
            css={css`
              position: absolute;
              background-color: var(--slds-g-color-error-base-30, #ba0517);
              top: -0.8rem;
              right: -0.5rem;
              border: none;
              border-radius: 50%;
              padding: 0;
              width: 1rem;
              height: 1rem;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 10px;
              font-weight: bold;
              line-height: 1;
              cursor: pointer;
              &:after {
                content: '1';
              }
              &:hover:after,
              &:focus-visible:after {
                content: 'X';
              }
            `}
            onClick={handleReset}
          ></button>
        )
      }
    >
      <Icon type="utility" icon="filterList" description="Open filters menu" className="slds-button__icon" omitContainer />
    </Popover>
  );
};

export default QuerySubqueryFilter;
