/**
 * Every icon used in the application must be individually imported
 */
import React from 'react';

export type IconType = 'action' | 'custom' | 'doctype' | 'standard' | 'utility';

export interface IconObj {
  type: IconType;
  icon: IconName;
  description?: string;
}

export type IconName = StandardIcon | UtilityIcon;
export type StandardIcon = keyof StandardIconObj;
export type UtilityIcon = keyof UtilityIconObj;
type IconEl = (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
export interface StandardIconObj {
  activations: IconEl;
  entity: IconEl;
  opportunity: IconEl;
  multi_picklist: IconEl;
  record: IconEl;
  related_list: IconEl;
  data_streams: IconEl;
  portal: IconEl;
}

export interface UtilityIconObj {
  add: IconEl;
  apex_plugin: IconEl;
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
  copy: IconEl;
  copy_to_clipboard: IconEl;
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
  forward: IconEl;
  help: IconEl;
  info: IconEl;
  left: IconEl;
  logout: IconEl;
  moneybag: IconEl;
  multi_select_checkbox: IconEl;
  new_window: IconEl;
  notification: IconEl;
  play: IconEl;
  prompt_edit: IconEl;
  record_lookup: IconEl;
  refresh: IconEl;
  right: IconEl;
  save: IconEl;
  search: IconEl;
  settings: IconEl;
  setup: IconEl;
  steps: IconEl;
  success: IconEl;
  switch: IconEl;
  sync: IconEl;
  task: IconEl;
  undo: IconEl;
  upload: IconEl;
  warning: IconEl;
}
