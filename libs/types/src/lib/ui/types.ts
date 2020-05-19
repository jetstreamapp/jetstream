import { MapOf } from '@silverthorn/types';
import { FieldDefinition } from '../salesforce/types';
import { Field } from 'jsforce';

export type IconType = 'action' | 'custom' | 'doctype' | 'standard' | 'utility';
export interface IconObj {
  type: IconType;
  icon: string;
}

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

// Generic position types
export type PositionLeftRight = PositionLeft | PositionRight;
export type PositionLeft = 'left';
export type PositionRight = 'right';

export type MimeType = MimeTypePlainText | MimeTypeCsv;
export type MimeTypePlainText = 'text/plain;charset=utf-8';
export type MimeTypeCsv = 'text/csv;charset=utf-8';

// Generic status types
export type Info = 'info';
export type Success = 'success';
export type Warning = 'warning';
export type Error = 'error';

export type Default = 'default';
export type Inverse = 'inverse';
export type Light = 'light';

export type InfoSuccessWarningError = Info | Success | Warning | Error;
export type SuccessWarningError = Success | Warning | Error;
export type DefaultInverseLight = Default | Inverse | Light;
export type BadgeTypes = SuccessWarningError | DefaultInverseLight;
