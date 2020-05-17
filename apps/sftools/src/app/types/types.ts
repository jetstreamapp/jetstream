import { MapOf, FieldDefinition } from '@silverthorn/api-interfaces';
import { Field } from 'jsforce';

export type IconType = 'action' | 'custom' | 'doctype' | 'standard' | 'utility';

export interface QueryFields {
  // this is also the path that will be appended to each field
  // this should end in a "." for related objects
  key: string;
  expanded: boolean;
  loading: boolean;
  filterTerm: string;
  sobject: string;
  fields: MapOf<FieldWrapper>;
  visibleFields: Set<string>;
  selectedFields: Set<string>;
}

export interface FieldWrapper {
  name: string; // this is also the field key
  label: string;
  type: string;
  sobject: string;
  relatedSobject?: string;
  // text used to filter data
  filterText: string;
  metadata: Field;
  fieldDefinition: FieldDefinition;
}

// Generic size types
export type SizeSmMdLg = SizeSm | SizeMd | SizeLg;
export type SizeSmMdLgXl = SizeSmMdLg | SizeXl;
export type SizeSmMdLgXlFull = SizeSmMdLgXl | SizeFull;
export type SizeSm = 'sm';
export type SizeMd = 'md';
export type SizeLg = 'lg';
export type SizeXl = 'xl';
export type SizeFull = 'full';

export type PositionLeftRight = PositionLeft | PositionRight;
export type PositionLeft = 'left';
export type PositionRight = 'right';
