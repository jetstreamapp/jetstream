/**
 * Every icon used in the application must be individually imported
 * This ensures that we do not include icons that are not used in the application in the final bundle
 */
import { SerializedStyles } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import classNames from 'classnames';
import ActionIcon_Announcement from './icons/action/Announcement';
import BrandIcon_Jetstream from './icons/brand/Jetstream';
import BrandIcon_JetstreamInverse from './icons/brand/JetstreamInverse';
import CustomIcon_Heart from './icons/custom/Heart';
import DoctypeIcon_Attachment from './icons/doctype/Attachment';
import DoctypeIcon_Excel from './icons/doctype/Excel';
import DoctypeIcon_Gdrive from './icons/doctype/Gdrive';
import DoctypeIcon_Gsheet from './icons/doctype/Gsheet';
import DoctypeIcon_Image from './icons/doctype/Image';
import DoctypeIcon_Pack from './icons/doctype/Pack';
import DoctypeIcon_Xml from './icons/doctype/Xml';
import DoctypeIcon_Zip from './icons/doctype/Zip';
import StandardIcon_ActionsAndButtons from './icons/standard/ActionsAndButtons';
import StandardIcon_Activations from './icons/standard/Activations';
import StandardIcon_Apex from './icons/standard/Apex';
import StandardIcon_AssetRelationship from './icons/standard/AssetRelationship';
import StandardIcon_Billing from './icons/standard/Billing';
import StandardIcon_BundleConfig from './icons/standard/BundleConfig';
import StandardIcon_ConnectedApps from './icons/standard/ConnectedApps';
import StandardIcon_DataStreams from './icons/standard/DataStreams';
import StandardIcon_EmployeeOrganization from './icons/standard/EmployeeOrganization';
import StandardIcon_Entity from './icons/standard/Entity';
import StandardIcon_Events from './icons/standard/Events';
import StandardIcon_Feed from './icons/standard/Feed';
import StandardIcon_Feedback from './icons/standard/Feedback';
import StandardIcon_Form from './icons/standard/Form';
import StandardIcon_Formula from './icons/standard/Formula';
import StandardIcon_MultiPicklist from './icons/standard/MultiPicklist';
import StandardIcon_Opportunity from './icons/standard/Opportunity';
import StandardIcon_Outcome from './icons/standard/Outcome';
import StandardIcon_PicklistChoice from './icons/standard/PicklistChoice';
import StandardIcon_Portal from './icons/standard/Portal';
import StandardIcon_PortalRolesAndSubordinates from './icons/standard/PortalRolesAndSubordinates';
import StandardIcon_ProductConsumed from './icons/standard/ProductConsumed';
import StandardIcon_Record from './icons/standard/Record';
import StandardIcon_RecordCreate from './icons/standard/RecordCreate';
import StandardIcon_RecordDelete from './icons/standard/RecordDelete';
import StandardIcon_RecordLookup from './icons/standard/RecordLookup';
import StandardIcon_RecordUpdate from './icons/standard/RecordUpdate';
import StandardIcon_RelatedList from './icons/standard/RelatedList';
import StandardIcon_Screen from './icons/standard/Screen';
import StandardIcon_Settings from './icons/standard/Settings';
import StandardIcon_User from './icons/standard/User';
import StandardIcon_YourAccount from './icons/standard/YourAccount';
import UtilityIcon_Add from './icons/utility/Add';
import UtilityIcon_Apex from './icons/utility/Apex';
import UtilityIcon_ApexPlugin from './icons/utility/ApexPlugin';
import UtilityIcon_Archive from './icons/utility/Archive';
import UtilityIcon_Arrowdown from './icons/utility/Arrowdown';
import UtilityIcon_Arrowup from './icons/utility/Arrowup';
import UtilityIcon_Back from './icons/utility/Back';
import UtilityIcon_Ban from './icons/utility/Ban';
import UtilityIcon_Billing from './icons/utility/Billing';
import UtilityIcon_Bold from './icons/utility/Bold';
import UtilityIcon_ChangeRecordType from './icons/utility/ChangeRecordType';
import UtilityIcon_Chart from './icons/utility/Chart';
import UtilityIcon_Check from './icons/utility/Check';
import UtilityIcon_Chevrondown from './icons/utility/Chevrondown';
import UtilityIcon_Chevronright from './icons/utility/Chevronright';
import UtilityIcon_Clear from './icons/utility/Clear';
import UtilityIcon_Clock from './icons/utility/Clock';
import UtilityIcon_Close from './icons/utility/Close';
import UtilityIcon_CollapseAll from './icons/utility/CollapseAll';
import UtilityIcon_ComponentCustomization from './icons/utility/ComponentCustomization';
import UtilityIcon_ContractAlt from './icons/utility/ContractAlt';
import UtilityIcon_Copy from './icons/utility/Copy';
import UtilityIcon_CopyToClipboard from './icons/utility/CopyToClipboard';
import UtilityIcon_Dash from './icons/utility/Dash';
import UtilityIcon_DateTime from './icons/utility/DateTime';
import UtilityIcon_Delete from './icons/utility/Delete';
import UtilityIcon_Down from './icons/utility/Down';
import UtilityIcon_Download from './icons/utility/Download';
import UtilityIcon_DragAndDrop from './icons/utility/DragAndDrop';
import UtilityIcon_Edit from './icons/utility/Edit';
import UtilityIcon_Error from './icons/utility/Error';
import UtilityIcon_Event from './icons/utility/Event';
import UtilityIcon_ExpandAll from './icons/utility/ExpandAll';
import UtilityIcon_ExpandAlt from './icons/utility/ExpandAlt';
import UtilityIcon_Fallback from './icons/utility/Fallback';
import UtilityIcon_Favorite from './icons/utility/Favorite';
import UtilityIcon_File from './icons/utility/File';
import UtilityIcon_Filter from './icons/utility/Filter';
import UtilityIcon_FilterList from './icons/utility/FilterList';
import UtilityIcon_Formula from './icons/utility/Formula';
import UtilityIcon_Forward from './icons/utility/Forward';
import UtilityIcon_Help from './icons/utility/Help';
import UtilityIcon_HelpDocExt from './icons/utility/HelpDocExt';
import UtilityIcon_Home from './icons/utility/Home';
import UtilityIcon_Image from './icons/utility/Image';
import UtilityIcon_Info from './icons/utility/Info';
import UtilityIcon_InsertTagField from './icons/utility/InsertTagField';
import UtilityIcon_Italic from './icons/utility/Italic';
import UtilityIcon_Left from './icons/utility/Left';
import UtilityIcon_Link from './icons/utility/Link';
import UtilityIcon_Logout from './icons/utility/Logout';
import UtilityIcon_Magicwand from './icons/utility/Magicwand';
import UtilityIcon_MergeField from './icons/utility/MergeField';
import UtilityIcon_MinimizeWindow from './icons/utility/MinimizeWindow';
import UtilityIcon_Moneybag from './icons/utility/Moneybag';
import UtilityIcon_MultiSelectCheckbox from './icons/utility/MultiSelectCheckbox';
import UtilityIcon_NewWindow from './icons/utility/NewWindow';
import UtilityIcon_Notification from './icons/utility/Notification';
import UtilityIcon_Open from './icons/utility/Open';
import UtilityIcon_OpenFolder from './icons/utility/OpenFolder';
import UtilityIcon_Page from './icons/utility/Page';
import UtilityIcon_Paste from './icons/utility/Paste';
import UtilityIcon_Pause from './icons/utility/Pause';
import UtilityIcon_People from './icons/utility/People';
import UtilityIcon_Play from './icons/utility/Play';
import UtilityIcon_Preview from './icons/utility/Preview';
import UtilityIcon_ProfileAlt from './icons/utility/ProfileAlt';
import UtilityIcon_PromptEdit from './icons/utility/PromptEdit';
import UtilityIcon_QuotationMarks from './icons/utility/QuotationMarks';
import UtilityIcon_RecordCreate from './icons/utility/RecordCreate';
import UtilityIcon_RecordDelete from './icons/utility/RecordDelete';
import UtilityIcon_RecordLookup from './icons/utility/RecordLookup';
import UtilityIcon_RecordUpdate from './icons/utility/RecordUpdate';
import UtilityIcon_Refresh from './icons/utility/Refresh';
import UtilityIcon_RemoveFormatting from './icons/utility/RemoveFormatting';
import UtilityIcon_Richtextbulletedlist from './icons/utility/Richtextbulletedlist';
import UtilityIcon_Richtextindent from './icons/utility/Richtextindent';
import UtilityIcon_Richtextnumberedlist from './icons/utility/Richtextnumberedlist';
import UtilityIcon_Richtextoutdent from './icons/utility/Richtextoutdent';
import UtilityIcon_Right from './icons/utility/Right';
import UtilityIcon_Rotate from './icons/utility/Rotate';
import UtilityIcon_Salesforce1 from './icons/utility/Salesforce1';
import UtilityIcon_Save from './icons/utility/Save';
import UtilityIcon_Search from './icons/utility/Search';
import UtilityIcon_Settings from './icons/utility/Settings';
import UtilityIcon_Setup from './icons/utility/Setup';
import UtilityIcon_SetupAssistantGuide from './icons/utility/SetupAssistantGuide';
import UtilityIcon_Share from './icons/utility/Share';
import UtilityIcon_Shortcuts from './icons/utility/Shortcuts';
import UtilityIcon_Steps from './icons/utility/Steps';
import UtilityIcon_Strategy from './icons/utility/Strategy';
import UtilityIcon_Strikethrough from './icons/utility/Strikethrough';
import UtilityIcon_Success from './icons/utility/Success';
import UtilityIcon_Switch from './icons/utility/Switch';
import UtilityIcon_Sync from './icons/utility/Sync';
import UtilityIcon_Table from './icons/utility/Table';
import UtilityIcon_Task from './icons/utility/Task';
import UtilityIcon_Text from './icons/utility/Text';
import UtilityIcon_ToggleOff from './icons/utility/ToggleOff';
import UtilityIcon_ToggleOn from './icons/utility/ToggleOn';
import UtilityIcon_Undelete from './icons/utility/Undelete';
import UtilityIcon_Underline from './icons/utility/Underline';
import UtilityIcon_Undo from './icons/utility/Undo';
import UtilityIcon_Up from './icons/utility/Up';
import UtilityIcon_Upload from './icons/utility/Upload';
import UtilityIcon_Warning from './icons/utility/Warning';
import UtilityIcon_YourAccount from './icons/utility/YourAccount';

export type IconType = 'action' | 'custom' | 'doctype' | 'standard' | 'utility' | 'brand';

export type IconName = ActionIcon | StandardIcon | CustomIcon | UtilityIcon | DoctypeIcon | BrandIcon;

export type ActionIconObj = typeof actionIcons;
export type StandardIconObj = typeof standardIcons;
export type CustomIconObj = typeof customIcons;
export type DoctypeIconObj = typeof doctypeIcons;
export type UtilityIconObj = typeof utilityIcons;
export type BrandIconObj = typeof brandIcons;

export type ActionIcon = keyof ActionIconObj;
export type StandardIcon = keyof StandardIconObj;
export type CustomIcon = keyof CustomIconObj;
export type DoctypeIcon = keyof DoctypeIconObj;
export type UtilityIcon = keyof UtilityIconObj;
export type BrandIcon = keyof BrandIconObj;

export interface IconObj {
  type: IconType;
  icon: IconName;
  title?: string;
  description?: string;
}

const actionIcons = {
  announcement: ActionIcon_Announcement,
} as const;

const standardIcons = {
  actions_and_buttons: StandardIcon_ActionsAndButtons,
  activations: StandardIcon_Activations,
  apex: StandardIcon_Apex,
  asset_relationship: StandardIcon_AssetRelationship,
  billing: StandardIcon_Billing,
  bundle_config: StandardIcon_BundleConfig,
  connected_apps: StandardIcon_ConnectedApps,
  data_streams: StandardIcon_DataStreams,
  employee_organization: StandardIcon_EmployeeOrganization,
  entity: StandardIcon_Entity,
  events: StandardIcon_Events,
  feed: StandardIcon_Feed,
  feedback: StandardIcon_Feedback,
  form: StandardIcon_Form,
  formula: StandardIcon_Formula,
  multi_picklist: StandardIcon_MultiPicklist,
  opportunity: StandardIcon_Opportunity,
  outcome: StandardIcon_Outcome,
  picklist_choice: StandardIcon_PicklistChoice,
  portal: StandardIcon_Portal,
  portal_roles_and_subordinates: StandardIcon_PortalRolesAndSubordinates,
  product_consumed: StandardIcon_ProductConsumed,
  record_create: StandardIcon_RecordCreate,
  record_delete: StandardIcon_RecordDelete,
  record_lookup: StandardIcon_RecordLookup,
  record_update: StandardIcon_RecordUpdate,
  record: StandardIcon_Record,
  related_list: StandardIcon_RelatedList,
  screen: StandardIcon_Screen,
  settings: StandardIcon_Settings,
  user: StandardIcon_User,
  your_account: StandardIcon_YourAccount,
} as const;

const customIcons = {
  heart: CustomIcon_Heart,
} as const;

const doctypeIcons = {
  attachment: DoctypeIcon_Attachment,
  excel: DoctypeIcon_Excel,
  gdrive: DoctypeIcon_Gdrive,
  gsheet: DoctypeIcon_Gsheet,
  image: DoctypeIcon_Image,
  pack: DoctypeIcon_Pack,
  xml: DoctypeIcon_Xml,
  zip: DoctypeIcon_Zip,
} as const;

const utilityIcons = {
  add: UtilityIcon_Add,
  apex_plugin: UtilityIcon_ApexPlugin,
  apex: UtilityIcon_Apex,
  archive: UtilityIcon_Archive,
  arrowdown: UtilityIcon_Arrowdown,
  arrowup: UtilityIcon_Arrowup,
  back: UtilityIcon_Back,
  ban: UtilityIcon_Ban,
  billing: UtilityIcon_Billing,
  bold: UtilityIcon_Bold,
  change_record_type: UtilityIcon_ChangeRecordType,
  chart: UtilityIcon_Chart,
  check: UtilityIcon_Check,
  chevrondown: UtilityIcon_Chevrondown,
  chevronright: UtilityIcon_Chevronright,
  clear: UtilityIcon_Clear,
  clock: UtilityIcon_Clock,
  close: UtilityIcon_Close,
  collapse_all: UtilityIcon_CollapseAll,
  component_customization: UtilityIcon_ComponentCustomization,
  contract_alt: UtilityIcon_ContractAlt,
  copy_to_clipboard: UtilityIcon_CopyToClipboard,
  copy: UtilityIcon_Copy,
  dash: UtilityIcon_Dash,
  date_time: UtilityIcon_DateTime,
  delete: UtilityIcon_Delete,
  down: UtilityIcon_Down,
  download: UtilityIcon_Download,
  drag_and_drop: UtilityIcon_DragAndDrop,
  edit: UtilityIcon_Edit,
  error: UtilityIcon_Error,
  event: UtilityIcon_Event,
  expand_all: UtilityIcon_ExpandAll,
  expand_alt: UtilityIcon_ExpandAlt,
  fallback: UtilityIcon_Fallback,
  favorite: UtilityIcon_Favorite,
  file: UtilityIcon_File,
  filter: UtilityIcon_Filter,
  filterList: UtilityIcon_FilterList,
  formula: UtilityIcon_Formula,
  forward: UtilityIcon_Forward,
  help_doc_ext: UtilityIcon_HelpDocExt,
  help: UtilityIcon_Help,
  home: UtilityIcon_Home,
  image: UtilityIcon_Image,
  info: UtilityIcon_Info,
  insert_tag_field: UtilityIcon_InsertTagField,
  italic: UtilityIcon_Italic,
  left: UtilityIcon_Left,
  link: UtilityIcon_Link,
  logout: UtilityIcon_Logout,
  magicwand: UtilityIcon_Magicwand,
  merge_field: UtilityIcon_MergeField,
  minimize_window: UtilityIcon_MinimizeWindow,
  moneybag: UtilityIcon_Moneybag,
  multi_select_checkbox: UtilityIcon_MultiSelectCheckbox,
  new_window: UtilityIcon_NewWindow,
  notification: UtilityIcon_Notification,
  open_folder: UtilityIcon_OpenFolder,
  open: UtilityIcon_Open,
  page: UtilityIcon_Page,
  paste: UtilityIcon_Paste,
  pause: UtilityIcon_Pause,
  people: UtilityIcon_People,
  play: UtilityIcon_Play,
  preview: UtilityIcon_Preview,
  profile_alt: UtilityIcon_ProfileAlt,
  prompt_edit: UtilityIcon_PromptEdit,
  quotation_marks: UtilityIcon_QuotationMarks,
  record_create: UtilityIcon_RecordCreate,
  record_delete: UtilityIcon_RecordDelete,
  record_lookup: UtilityIcon_RecordLookup,
  record_update: UtilityIcon_RecordUpdate,
  refresh: UtilityIcon_Refresh,
  remove_formatting: UtilityIcon_RemoveFormatting,
  richtextbulletedlist: UtilityIcon_Richtextbulletedlist,
  richtextindent: UtilityIcon_Richtextindent,
  richtextnumberedlist: UtilityIcon_Richtextnumberedlist,
  richtextoutdent: UtilityIcon_Richtextoutdent,
  right: UtilityIcon_Right,
  rotate: UtilityIcon_Rotate,
  salesforce1: UtilityIcon_Salesforce1,
  save: UtilityIcon_Save,
  search: UtilityIcon_Search,
  settings: UtilityIcon_Settings,
  setup: UtilityIcon_Setup,
  setup_assistant_guide: UtilityIcon_SetupAssistantGuide,
  share: UtilityIcon_Share,
  shortcuts: UtilityIcon_Shortcuts,
  steps: UtilityIcon_Steps,
  strategy: UtilityIcon_Strategy,
  strikethrough: UtilityIcon_Strikethrough,
  success: UtilityIcon_Success,
  switch: UtilityIcon_Switch,
  sync: UtilityIcon_Sync,
  table: UtilityIcon_Table,
  task: UtilityIcon_Task,
  text: UtilityIcon_Text,
  toggle_off: UtilityIcon_ToggleOff,
  toggle_on: UtilityIcon_ToggleOn,
  undelete: UtilityIcon_Undelete,
  underline: UtilityIcon_Underline,
  undo: UtilityIcon_Undo,
  up: UtilityIcon_Up,
  upload: UtilityIcon_Upload,
  warning: UtilityIcon_Warning,
  your_account: UtilityIcon_YourAccount,
} as const;

const brandIcons = {
  jetstream: BrandIcon_Jetstream,
  jetstream_inverse: BrandIcon_JetstreamInverse,
} as const;

export function getIcon(type: IconType, icon: string, className?: string, svgCss?: SerializedStyles) {
  let found = false;
  let IconOrFallback = UtilityIcon_Fallback;
  switch (type) {
    case 'action':
      if (actionIcons[icon]) {
        IconOrFallback = actionIcons[icon];
        found = true;
      }
      break;
    case 'standard':
      if (standardIcons[icon]) {
        IconOrFallback = standardIcons[icon];
        found = true;
      }
      break;
    case 'custom':
      if (customIcons[icon]) {
        IconOrFallback = customIcons[icon];
        found = true;
      }
      break;
    case 'doctype':
      if (doctypeIcons[icon]) {
        IconOrFallback = doctypeIcons[icon];
        found = true;
      }
      break;
    case 'utility':
      if (utilityIcons[icon]) {
        IconOrFallback = utilityIcons[icon];
        found = true;
      }
      break;
    case 'brand':
      if (brandIcons[icon]) {
        IconOrFallback = brandIcons[icon];
        found = true;
      }
      break;
    default:
      break;
  }
  if (!found) {
    logger.warn('[ICON NOT FOUND]', `icon ${type}-${icon} not found, providing fallback`);
  }
  return <IconOrFallback className={classNames(className || 'slds-icon')} css={svgCss} />;
}

export function getIconTypes(type: Omit<IconType, 'action' | 'custom'>): IconName[] {
  switch (type) {
    case 'action':
      return Object.keys(actionIcons) as ActionIcon[];
    case 'doctype':
      return Object.keys(doctypeIcons) as StandardIcon[];
    case 'standard':
      return Object.keys(standardIcons) as DoctypeIcon[];
    case 'brand':
      return Object.keys(brandIcons) as BrandIcon[];
    case 'utility':
    default:
      return Object.keys(utilityIcons) as UtilityIcon[];
  }
}
