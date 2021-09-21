/**
 * Every icon used in the application must be individually imported
 */
import React from 'react';

export type IconType = 'action' | 'custom' | 'doctype' | 'standard' | 'utility';

export interface IconObj {
  type: IconType;
  icon: IconName;
  title?: string;
  description?: string;
}

export type IconName = StandardIcon | UtilityIcon | DoctypeIcon;
export type StandardIcon = keyof StandardIconObj;
export type DoctypeIcon = keyof DoctypeIconObj;
export type UtilityIcon = keyof UtilityIconObj;
type IconEl = (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
export interface StandardIconObj {
  activations: IconEl;
  asset_relationship: IconEl;
  data_streams: IconEl;
  entity: IconEl;
  feedback: IconEl;
  multi_picklist: IconEl;
  opportunity: IconEl;
  portal: IconEl;
  record: IconEl;
  related_list: IconEl;
  record_lookup: IconEl;
  settings: IconEl;
}

export interface DoctypeIconObj {
  excel: IconEl;
  gdrive: IconEl;
  gsheet: IconEl;
  image: IconEl;
  pack: IconEl;
  xml: IconEl;
  zip: IconEl;
}

export interface UtilityIconObj {
  add: IconEl;
  apex_plugin: IconEl;
  apex: IconEl;
  arrowdown: IconEl;
  arrowup: IconEl;
  back: IconEl;
  bold: IconEl;
  change_record_type: IconEl;
  chart: IconEl;
  check: IconEl;
  chevrondown: IconEl;
  chevronright: IconEl;
  clear: IconEl;
  clock: IconEl;
  close: IconEl;
  collapse_all: IconEl;
  component_customization: IconEl;
  copy_to_clipboard: IconEl;
  copy: IconEl;
  dash: IconEl;
  date_time: IconEl;
  delete: IconEl;
  down: IconEl;
  download: IconEl;
  edit: IconEl;
  error: IconEl;
  event: IconEl;
  expand_all: IconEl;
  fallback: IconEl;
  favorite: IconEl;
  file: IconEl;
  filter: IconEl;
  filterList: IconEl;
  forward: IconEl;
  help: IconEl;
  image: IconEl;
  info: IconEl;
  insert_tag_field: IconEl;
  italic: IconEl;
  left: IconEl;
  link: IconEl;
  logout: IconEl;
  moneybag: IconEl;
  multi_select_checkbox: IconEl;
  new_window: IconEl;
  notification: IconEl;
  open_folder: IconEl;
  page: IconEl;
  play: IconEl;
  preview: IconEl;
  prompt_edit: IconEl;
  quotation_marks: IconEl;
  record_lookup: IconEl;
  refresh: IconEl;
  remove_formatting: IconEl;
  richtextbulletedlist: IconEl;
  richtextindent: IconEl;
  richtextnumberedlist: IconEl;
  richtextoutdent: IconEl;
  right: IconEl;
  rotate: IconEl;
  salesforce1: IconEl;
  save: IconEl;
  search: IconEl;
  settings: IconEl;
  setup: IconEl;
  share: IconEl;
  steps: IconEl;
  strategy: IconEl;
  strikethrough: IconEl;
  success: IconEl;
  switch: IconEl;
  sync: IconEl;
  task: IconEl;
  underline: IconEl;
  undo: IconEl;
  up: IconEl;
  upload: IconEl;
  warning: IconEl;
}
