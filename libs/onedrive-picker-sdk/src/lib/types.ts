export interface IFilePickerOptions {
  sdk: '8.0';
  messaging: IMessagingConfiguration;
  entry: IEntryConfiguration;
  telemetry?: ITelemetryConfiguration;
  authentication: IAuthenticationConfiguration;
  localization?: ILocalizationConfiguration;

  /**
   * Specifies what types of items may be picked and where they come from.
   */
  typesAndSources?: ITypesAndSourcesConfiguration;
  /**
   * Specified how many items may be picked.
   */
  selection?: ISelectionConfiguration;
  /**
   * Specifies what happens when users pick files and what the user may do with files in the picker.
   */
  commands?: ICommandConfiguration;
  /**
   * Specifies accessibility cues such as auto-focus behaviors.
   */
  accessibility?: IAccessibilityConfiguration;

  // TBD.
  navigation?: INavigationConfiguration;
}

export interface IAuthenticateCommand {
  command: 'authenticate';
  resource: string;
  type: 'SharePoint' | 'Graph';
  claimsChallenge?: {
    claims: string;
    token?: string;
    error: any; // IError;
  };
  expiration?: {
    error: any; // IError;
  };
}

export interface IAuthenticateResult {
  result: 'token';
  token: string;
}

/**
 * Establishes the messaging parameters used to setup the post message communications between
 * picker and host application
 */
interface IMessagingConfiguration {
  /**
   * A unique id assigned by the host app to this File Picker instance.
   */
  channelId: string;
  /**
   * The host app's authority, used as the target origin for post-messaging.
   */
  origin: string;
}

/**
 * Configuration for the entry location to which the File Picker will navigate on load.
 * The File Picker app will prioritize path-based navigation if provided, falling back to other address forms
 * on error (in case of Site redirection or content rename) or if path information is not provided.
 */
interface IEntryConfiguration {
  sharePoint?: {
    /**
     * Specify an exact SharePoint content location by path segments.
     */
    byPath?: {
      /**
       * Full URL to the root of a Web, or server-relative URL.
       * @example
       *  'https://contoso-my.sharepoint.com/personal/user_contoso_com'
       * @example
       *  '/path/to/web'
       * @example
       *  'subweb'
       */
      web?: string;
      /**
       * Full URL or path segement to identity a List.
       * If not preceded with a `/` or a URL scheme, this is assumed to be a list in the specified web.
       * @example
       *  'Shared Documents'
       * @example
       *  '/path/to/web/Shared Documents'
       * @example
       *  'https://contoso.sharepoint.com/path/to/web/Shared Documents'
       */
      list?: string;
      /**
       * Path segment to a folder within a list, or a server-relative URL to a folder.
       * @example
       *  'General'
       * @example
       *  'foo/bar'
       * @example
       *  '/path/to/web/Shared Documents/General'
       */
      folder?: string;
    };
    /**
     * Indicates SharePoint ID values which may be used as a backup in case path-based navigation to the initial item fails.
     * Id-based lookup in SharePoint is slower, as should only be used as a last-resort.
     * The File Picker will return an error if only ID values are specified.
     */
    byId?: {
      webId?: string;
      listId?: string;
      uniqueId?: string;
    };
  };
  /**
   * Indicates that the File Picker should start in the user's OneDrive.
   */
  oneDrive?: {
    /**
     * Specifies that File Picker should start in the user's Files tab.
     */
    files?: {
      /**
       * Path segment for sub-folder within the user's OneDrive.
       * @example
       *  'Pictures'
       * @example
       *  '/personal/user_contoso_com/Documents/Attachments'
       */
      folder?: string;
    };
    /**
     * Indicates that File Picker should start in the user's recent files.
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    recent?: {};
    /**
     * Indicates that File Picker should start in the files shared with the user.
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    sharedWithMe?: {};
  };

  // TBD Specifying sort/group/filter/view settings.
}

interface ITelemetryConfiguration {
  /**
   * A unique id for the host app's session. Used for telemetry correlation between apps.
   */
  sessionId?: string;
  /**
   * Additional data to be included in all telemetry events, in the 'extraData' payloads.
   */
  extraData?: {
    [key: string]: string | number | boolean;
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IAuthenticationConfiguration {
  // Nothing yet. Minimally, providing this object indicates that the host app can provide OAuth tokens
  // via the existing messaging support.
}

interface ILocalizationConfiguration {
  /**
   * The language code from the Host application.
   * File Picker will render components which are not user content using the specified language.
   * If the backing SharePoint Web has an override language setting, some strings such as column headers will render
   * using the Web's language instead.
   */
  language: string;
}

/**
 * Configuration for what item types may be selected within the picker and returned to the host.
 */
interface ISelectionConfiguration {
  /**
   * @default 'single'
   */
  mode?: 'single' | 'multiple' | 'pick';
  maxCount?: number;
}

interface ITypesAndSourcesConfiguration {
  /**
   * Specifies the general category of items picked. Switches between 'file' vs. 'folder' picker mode,
   * or a general-purpose picker.
   * @default 'all'
   */
  mode?: 'files' | 'folders' | 'all';
  /**
   * @default `['folder']` if `itemTypes` is 'folders', otherwise `[]`
   */
  filters?: string[];

  /**
   * Configures whether or not specific pivots may be browsed for content by the user.
   */
  pivots?: {
    recent?: boolean;
    oneDrive?: boolean;
    sharedLibraries?: boolean;
    shared?: boolean;
    search?: boolean;
  };
}

interface IAccessibilityConfiguration {
  focusTrap?: 'initial' | 'always' | 'none';
}

interface ICommandConfiguration {
  /**
   * Sets the default 'pick' behavior once the user selects items.
   */
  pick?: {
    action: 'select' | 'share' | 'download' | 'move';
    /**
     * A custom label to apply to the button to pick the items.
     * The default varies based on `action`, but is typically 'Select'.
     * This string must be localized if provided.
     */
    label?: string;
  };
  close?: {
    /**
     * A custom label to apply to the button to close the picker.
     * The default is 'Cancel'.
     * This string must be localized if provided.
     */
    label?: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface INavigationConfiguration {}

export interface INotificationData {
  code: string;
  isExpected: boolean;
  message: string;
  notification: string;
  timestamp: number;
}

export interface IPickData {
  command: 'pick';
  items: SPItem[];
  keepSharing: false;
}

export interface SPItem {
  '@sharePoint.embedUrl': string;
  '@sharePoint.endpoint': string;
  '@sharePoint.listUrl': string;
  folder?: any;
  id: string;
  name: string;
  parentReference: {
    driveId: string;
    sharepointIds: {
      listId: string;
      siteId: string;
      siteUrl: string;
      webId: string;
    };
  };
  sharepointIds: {
    listId: string;
    listItemId: string;
    listItemUniqueId: string;
    siteId: string;
    siteUrl: string;
    webId: string;
  };
  size: number;
  webDavUrl: string;
  webUrl: string;
}
