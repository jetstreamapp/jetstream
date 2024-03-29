import { css } from '@emotion/react';
import { FunctionComponent } from 'react';
import Radio from '../form/radio/Radio';
import RadioGroup from '../form/radio/RadioGroup';
import Popover from '../popover/Popover';
import Icon from '../widgets/Icon';
import { FilterType } from './SobjectFieldListTypes';
import classNames from 'classnames';

export interface SobjectFieldListFilterProps {
  active: FilterType;
  onChange: (active: FilterType) => void;
}

export const SobjectFieldListFilter: FunctionComponent<SobjectFieldListFilterProps> = ({ active = 'all', onChange }) => {
  return (
    <Popover
      placement="right"
      content={
        <RadioGroup label="Which fields should be shown?" className="slds-m-bottom_small">
          <Radio name="radio-filter-all" label="All Fields" value="all" checked={active === 'all'} onChange={onChange} />
          <Radio
            name="radio-filter-creatable"
            label="Creatable Fields"
            value="creatable"
            checked={active === 'creatable'}
            onChange={onChange}
          />
          <Radio
            name="radio-filter-updateable"
            label="Updateable Fields"
            value="updateable"
            checked={active === 'updateable'}
            onChange={onChange}
          />
          <Radio name="radio-filter-custom" label="Custom Fields" value="custom" checked={active === 'custom'} onChange={onChange} />
          <Radio
            name="radio-filter-non-managed"
            label="Non-Managed Fields"
            value="non-managed"
            checked={active === 'non-managed'}
            onChange={onChange}
          />
          <Radio
            name="radio-filter-non-managed"
            label="Non-Managed Custom Fields"
            value="custom-non-managed"
            checked={active === 'custom-non-managed'}
            onChange={onChange}
          />
          <Radio
            name="radio-filter-selected"
            label="Selected Fields"
            value="selected"
            checked={active === 'selected'}
            onChange={onChange}
          />
        </RadioGroup>
      }
      buttonProps={{
        className: classNames('slds-button slds-button_icon', { 'slds-text-color_brand': active !== 'all' }),
        title: 'open filters menu',
      }}
    >
      <Icon
        type="utility"
        icon="filter"
        description="Open filters menu"
        className="slds-button__icon slds-button__icon_large"
        omitContainer
      />
    </Popover>
  );
};

export default SobjectFieldListFilter;
