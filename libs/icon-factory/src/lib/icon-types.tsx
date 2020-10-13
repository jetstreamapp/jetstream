/* eslint-disable @typescript-eslint/camelcase */
/**
 * Every icon used in the application must be individually imported
 */
import React from 'react';

export type IconName = StandardIcon | UtilityIcon;
export type StandardIcon = keyof StandardIconObj;
export type UtilityIcon = keyof UtilityIconObj;
type IconEl = (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
export interface StandardIconObj {
  activations: IconEl;
  entity: IconEl;
  opportunity: IconEl;
  record: IconEl;
  related_list: IconEl;
  data_streams: IconEl;
}

export interface UtilityIconObj {
  add: IconEl;
  apex_plugin: IconEl;
  arrowdown: IconEl;
  arrowup: IconEl;
  back: IconEl;
  chart: IconEl;
  check: IconEl;
  chevrondown: IconEl;
  chevronright: IconEl;
  clear: IconEl;
  close: IconEl;
  collapse_all: IconEl;
  component_customization: IconEl;
  copy: IconEl;
  dash: IconEl;
  date_time: IconEl;
  delete: IconEl;
  down: IconEl;
  download: IconEl;
  error: IconEl;
  event: IconEl;
  expand_all: IconEl;
  fallback: IconEl;
  favorite: IconEl;
  forward: IconEl;
  help: IconEl;
  info: IconEl;
  left: IconEl;
  logout: IconEl;
  moneybag: IconEl;
  new_window: IconEl;
  notification: IconEl;
  play: IconEl;
  refresh: IconEl;
  right: IconEl;
  search: IconEl;
  settings: IconEl;
  success: IconEl;
  switch: IconEl;
  sync: IconEl;
  undo: IconEl;
  upload: IconEl;
  warning: IconEl;
}
