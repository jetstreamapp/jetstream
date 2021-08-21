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
  multi_picklist: IconEl;
  opportunity: IconEl;
  portal: IconEl;
  record: IconEl;
  related_list: IconEl;
  record_lookup: IconEl;
  settings: IconEl;
}

export interface DoctypeIconObj {
  xml: IconEl;
  excel: IconEl;
  pack: IconEl;
  zip: IconEl;
  gsheet: IconEl;
  gdrive: IconEl;
}

export interface UtilityIconObj {
  add: IconEl;
  apex_plugin: IconEl;
  apex: IconEl;
  arrowdown: IconEl;
  arrowup: IconEl;
  back: IconEl;
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
  info: IconEl;
  left: IconEl;
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
  record_lookup: IconEl;
  refresh: IconEl;
  right: IconEl;
  salesforce1: IconEl;
  save: IconEl;
  search: IconEl;
  settings: IconEl;
  setup: IconEl;
  share: IconEl;
  steps: IconEl;
  strategy: IconEl;
  success: IconEl;
  switch: IconEl;
  sync: IconEl;
  task: IconEl;
  undo: IconEl;
  up: IconEl;
  upload: IconEl;
  warning: IconEl;
}
