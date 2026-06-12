import { REGEX } from '@jetstream/shared/utils';
import { FieldWrapper } from '@jetstream/types';
import { FilterTypes } from './SobjectFieldListFilter';

/**
 * Background for each nesting level of related-object fields.
 * Palette tokens resolve via light-dark(), so the ramp inverts in dark mode
 * (the old hardcoded blues stayed light and made dark-mode text unreadable).
 */
export function getBgColor(level: number): string | undefined {
  switch (level) {
    case 1: {
      return 'var(--slds-g-color-palette-blue-95, #eef1f6)';
    }
    case 2: {
      return 'var(--slds-g-color-palette-blue-90, #c5d5ea)';
    }
    case 3: {
      return 'var(--slds-g-color-palette-blue-80, #a9d3ff)';
    }
    case 4: {
      return 'var(--slds-g-color-palette-blue-70, #96c5f7)';
    }
    case 5: {
      return 'var(--slds-g-color-palette-blue-65, #758ecd)';
    }
  }
}

export function filterFieldsFn(FilterTypes: FilterTypes, selectedFields?: Set<string>) {
  return (field: FieldWrapper) => {
    if (FilterTypes.selected === 'selected' && !selectedFields?.has(field.name)) {
      return false;
    }

    if (FilterTypes.editable === 'editable' && !field.metadata.updateable) {
      return false;
    } else if (FilterTypes.editable === 'creatable' && !field.metadata.updateable && !field.metadata.createable) {
      return false;
    } else if (FilterTypes.editable === 'read-only' && field.metadata.updateable) {
      return false;
    }

    if (FilterTypes.required === 'allows-nulls' && !field.metadata.nillable) {
      return false;
    }

    if (FilterTypes.required === 'allows-nulls' && !field.metadata.nillable) {
      return false;
    } else if (FilterTypes.required === 'does-not-allow-nulls' && field.metadata.nillable) {
      return false;
    }

    if (FilterTypes.default === 'has-default' && !field.metadata.defaultedOnCreate) {
      return false;
    } else if (FilterTypes.default === 'no-default' && field.metadata.defaultedOnCreate) {
      return false;
    }

    if (FilterTypes.standardCustom === 'standard' && field.metadata.custom) {
      return false;
    } else if (FilterTypes.standardCustom === 'custom' && !field.metadata.custom) {
      return false;
    }

    if (FilterTypes.managed === 'managed' && !REGEX.HAS_NAMESPACE.test(field.metadata.name)) {
      return false;
    }
    if (FilterTypes.managed === 'unmanaged' && REGEX.HAS_NAMESPACE.test(field.metadata.name)) {
      return false;
    }

    return true;
  };
}
