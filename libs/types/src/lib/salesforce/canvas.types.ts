/* eslint-disable @typescript-eslint/no-explicit-any */

export type SfdcCanvasSignedRequestAlgorithm = 'HMACSHA256' | string;

export interface SfdcCanvasSignedRequest {
  algorithm: SfdcCanvasSignedRequestAlgorithm;
  /** Unix epoch seconds (as provided by Canvas) */
  issuedAt: number;
  userId: string;

  client: SfdcCanvasSignedRequestClient;

  context: SfdcCanvasSignedRequestContext;
  /**
   * Present only when OAuth login is required
   */
  loginParams?: Record<string, string>;
}

export interface SfdcCanvasSignedRequestClient {
  refreshToken: string | null;
  instanceId: string;
  targetOrigin: string;
  instanceUrl: string;
  oauthToken: string;
}

export interface SfdcCanvasSignedRequestContext {
  user: SfdcCanvasSignedRequestUser;
  links: SfdcCanvasSignedRequestLinks;
  application: SfdcCanvasSignedRequestApplication;
  organization: SfdcCanvasSignedRequestOrganization;
  environment: SfdcCanvasSignedRequestEnvironment;
}

export interface SfdcCanvasSignedRequestUser {
  userId: string;
  userName: string;

  firstName: string;
  lastName: string;
  email: string;
  fullName: string;

  locale: string; // e.g. "en_US"
  language: string; // e.g. "en_US"
  timeZone: string; // e.g. "America/Los_Angeles"

  profileId: string;
  roleId: string | null;

  userType: string; // e.g. "STANDARD"
  currencyISOCode: string; // e.g. "USD"

  profilePhotoUrl: string;
  profileThumbnailUrl: string;

  siteUrl: string | null;
  siteUrlPrefix: string | null;
  networkId: string | null;

  accessibilityModeEnabled: boolean;
  isDefaultNetwork: boolean;
}

export interface SfdcCanvasSignedRequestLinks {
  loginUrl: string;

  enterpriseUrl: string;
  metadataUrl: string;
  partnerUrl: string;

  restUrl: string;
  sobjectUrl: string;
  searchUrl: string;
  queryUrl: string;
  recentItemsUrl: string;

  chatterFeedsUrl: string;
  chatterGroupsUrl: string;
  chatterUsersUrl: string;
  chatterFeedItemsUrl: string;

  userUrl: string;
}

export interface SfdcCanvasSignedRequestApplication {
  name: string;
  canvasUrl: string;

  applicationId: string;
  version: string;

  authType: string; // e.g. "SIGNED_REQUEST"
  referenceId: string;

  options: unknown[];

  samlInitiationMethod: string; // e.g. "None"
  developerName: string;

  isInstalledPersonalApp: boolean;

  /** Empty string when not namespaced */
  namespace: string;
}

export interface SfdcCanvasSignedRequestOrganization {
  organizationId: string;
  name: string;

  multicurrencyEnabled: boolean;
  namespacePrefix: string | null;
  currencyIsoCode: string;
}

export interface SfdcCanvasSignedRequestEnvironment {
  referer: string | null;
  locationUrl: string;

  displayLocation: string | null;
  sublocation: string | null;

  uiTheme: string; // e.g. "Theme3"

  dimensions: SfdcCanvasSignedRequestDimensions;

  parameters: Record<string, unknown>;
  record: Record<string, unknown>;

  version: SfdcCanvasSignedRequestVersion;
}

export interface SfdcCanvasSignedRequestDimensions {
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
  clientWidth: string;
  clientHeight: string;
}

export interface SfdcCanvasSignedRequestVersion {
  season: string; // e.g. "WINTER"
  api: string; // e.g. "65.0"
}

/** Core helpers hung directly on Sfdc.canvas (aliased from internal `$`) */
export interface SfdcCanvasCore {
  // --- type guards / predicates ---

  /**
   * Checks whether an object contains an uninherited property.
   * @param obj - The object to check
   * @param prop - The property name to check for
   * @returns `true` if the property exists for the object and isn't inherited; otherwise `false`
   */
  hasOwn(obj: object, prop: PropertyKey): boolean;

  /**
   * Checks whether an object is currently undefined.
   * @param value - The object to check
   * @returns `true` if the object or value is of type undefined; otherwise `false`
   */
  isUndefined(value: unknown): value is undefined;

  /**
   * Checks whether an object is undefined, null, or an empty string.
   * @param value - The object to check
   * @returns `true` if the object or value is undefined, null, or an empty string; otherwise `false`
   */
  isNil(value: unknown): boolean;

  /**
   * Checks whether a value is a number. This function doesn't resolve strings to numbers.
   * @param value - Object to check
   * @returns `true` if the object or value is a number; otherwise `false`
   */
  isNumber(value: unknown): value is number;

  /**
   * Checks whether an object is a function.
   * @param value - The object to check
   * @returns `true` if the object or value is a function; otherwise `false`
   */
  isFunction<T extends (...args: any[]) => any>(value: unknown): value is T;

  /**
   * Checks whether an object is an array.
   * @param value - The object to check
   * @returns `true` if the object or value is of type array; otherwise `false`
   */
  isArray<T = unknown>(value: unknown): value is T[];

  /**
   * Checks whether an object is the argument set for a function.
   * @param value - The object to check
   * @returns `true` if the object or value is the argument set for a function; otherwise `false`
   */
  isArguments(value: unknown): value is IArguments;

  /**
   * Checks whether a value is of type object and isn't null.
   * @param value - The object to check
   * @returns `true` if the object or value is of type object; otherwise `false`
   */
  isObject(value: unknown): value is Record<string, unknown>;

  /**
   * Checks whether a value is of type string and isn't null.
   * @param value - The string to check
   * @returns `true` if the string or value is of type string; otherwise `false`
   */
  isString(value: unknown): value is string;

  /**
   * Checks whether the value appears to be JSON.
   * @param value - The JSON string to check
   * @returns `true` if the string starts and stops with `{}`, otherwise `false`
   */
  appearsJson(value: unknown): boolean;

  // --- functional helpers ---

  /**
   * An empty or blank function.
   */
  nop(): void;

  /**
   * Runs the specified function.
   * @param fn - The function to run
   */
  invoker(fn?: unknown): void;

  /**
   * Returns the argument.
   * @param obj - The object to return, untouched
   * @returns The argument used for this function call
   */
  identity<T>(obj: T): T;

  /**
   * Calls a defined function for each element in an object.
   * @param obj - The object to loop through. The object can be an array, an array like object, or a map of properties
   * @param it - The callback function to run for each element
   * @param ctx - The context object to be used for the callback function. Defaults to the original object if not provided
   */
  each<T>(
    obj: ArrayLike<T> | Record<string, T> | null | undefined,
    it: (value: T, keyOrIndex: number | string, list: any) => boolean | void,
    ctx?: any,
  ): void;

  /**
   * Convenience method to prepend a method with a fully qualified url, if the method does not begin with http protocol.
   * @param orig - The original URL
   * @param newUrl - The new URL to use if orig doesn't start with http
   * @returns The URL starting with http
   */
  startsWithHttp(orig: unknown, newUrl: string): unknown;

  /**
   * Creates a new array with the results of calling the function on each element in the object.
   * @param obj - The object to use
   * @param it - The callback function to run for each element
   * @param ctx - The context object to be used for the callback function. Defaults to the original object if not provided
   * @returns The array that is created by calling the function on each element in the object
   */
  map<T, R>(
    obj: ArrayLike<T> | Record<string, T> | null | undefined,
    it: (value: T, keyOrIndex: number | string, list: any) => R,
    ctx?: any,
  ): R[];

  /**
   * Creates an array containing all the elements of the given object.
   * @param obj - The object to convert
   * @returns An array containing all the elements of the given object
   */
  values<T>(obj: Record<string, T>): T[];

  /**
   * Creates a new array containing the selected elements of the given array.
   * @param array - The array to subset
   * @param begin - The index that specifies where to start the selection (defaults to 0)
   * @param end - The index that specifies where to end the selection (defaults to array.length)
   * @returns A new array that contains the selected elements
   */
  slice<T>(array: ArrayLike<T>, begin?: number, end?: number): T[];

  /**
   * Creates an array from an object.
   * @param iterable - The object to convert to an array
   * @returns An array created from the object
   */
  toArray<T>(iterable: ArrayLike<T> | Record<string, T> | null | undefined): T[];

  /**
   * Calculates the number of elements in an object.
   * @param obj - The object to size
   * @returns The number of elements in the object
   */
  size(obj: unknown): number;

  /**
   * Returns the location of an element in an array.
   * @param array - The array to check
   * @param item - The item to search for within the array
   * @returns The index of the element within the array. Returns -1 if the element isn't found
   */
  indexOf<T>(array: T[] | null | undefined, item: T): number;

  /**
   * Returns true if the object is null, or the object has no enumerable properties/attributes.
   * @param obj - The object to check
   * @returns `true` if the object or value is null, or is an object with no enumerable properties/attributes
   */
  isEmpty(obj: unknown): boolean;

  /**
   * Removes an element from an array.
   * @param array - The array to modify
   * @param item - The element to remove from the array
   */
  remove<T>(array: T[], item: T): void;

  // --- querystring/url helpers ---

  /**
   * Serializes an object into a string that can be used as a URL query string.
   * @param a - The array or object to serialize
   * @param encode - Indicates that the string should be encoded (defaults to false)
   * @returns A string representing the object as a URL query string
   */
  param(a: any[] | Record<string, any>, encode?: boolean): string;

  /**
   * Converts a query string into an object.
   * @param q - Query string (e.g., "param1=value1&param1=value2&param2=value2")
   * @returns Object representation (e.g., {param1: ['value1', 'value2'], param2: 'value2'})
   */
  objectify(q: string | null | undefined): Record<string, string | string[]>;

  /**
   * Strips out the URL to {scheme}://{host}:{port}.
   * @param url - The URL to strip
   * @returns The stripped URL containing only scheme, host, and port
   */
  stripUrl(url: string | null | undefined): string | null;

  /**
   * Appends the query string to the end of the URL and removes any hash tag.
   * @param url - The URL to be appended to
   * @param q - The query string to append
   * @returns The URL with the query string appended
   */
  query(url: string, q: string | null | undefined): string;

  // --- misc string helpers ---

  /**
   * Adds the contents of two or more objects to a destination object.
   * @param dest - The destination object to modify
   * @param mixins - An unlimited number of objects to add to the destination object
   * @returns The modified destination object
   */
  extend<T extends object, U extends object[]>(dest: T, ...mixins: U): T & U[number];

  /**
   * Determines if a string ends with a particular suffix.
   * @param str - The string to check
   * @param suffix - The suffix to check for
   * @returns `true` if the string ends with suffix; otherwise `false`
   */
  endsWith(str: string, suffix: string): boolean;

  capitalize(str: string): string;
  uncapitalize(str: string): string;

  // --- base64-ish decode helpers used by SDK ---

  /**
   * Decode a base 64 string.
   * @param str - Base64 encoded string
   * @returns Decoded string
   */
  decode(str: string): string;

  escapeToUTF8(str: string): string;

  // --- event name validation (Canvas streaming/event bus) ---

  /**
   * Validates the event name.
   * @param name - The event name to validate
   * @param res - Reserved namespaces
   * @returns 0 if ok, 1 if too many namespaces, 2 if reserved namespace, 3 if invalid identifier parts
   */
  validEventName(name: string, res: string | string[]): 0 | 1 | 2 | 3;

  // --- module system ---

  /**
   * Returns the prototype of the specified object.
   * @param obj - The object for which to find the prototype
   * @returns The object that is the prototype of the given object
   */
  prototypeOf<T extends object>(obj: T): any;

  /**
   * Adds a module to the global.Sfdc.canvas object.
   * @param ns - The namespace for the new module
   * @param decl - The module declaration
   * @returns The global.Sfdc.canvas object with a new module added
   */
  module<T extends object>(ns: string, decl: T | (() => T)): T;

  // --- DOM helpers ---

  document(): Document;

  /**
   * Returns the DOM element with the given ID in the current document.
   * @param id - The ID of the DOM element
   * @returns The DOM element with the given ID. Returns null if the element doesn't exist
   */
  byId(id: string): HTMLElement | null;

  /**
   * Returns a set of DOM elements with the given class names in the current document.
   * @param clazz - The class names to find in the DOM; multiple classnames can be passed, separated by whitespace
   * @returns Set of DOM elements that all have the given class name
   */
  byClass(clazz: string): HTMLCollectionOf<Element>;

  /**
   * Returns the value for the given attribute name on the given DOM element.
   * @param el - The element on which to check the attribute
   * @param name - The name of the attribute for which to find a value
   * @returns The given attribute's value
   */
  attr(el: Element, name: string): string | undefined;

  // --- readiness ---

  /**
   * Registers a callback to be called after the DOM is ready.
   * @param cb - The callback function to be called
   */
  onReady(cb: () => void): void;

  /**
   * You can call Sfdc.canvas(fn) to register a ready handler too.
   * @param cb - The function to run when ready
   */
  (cb?: () => void): void;

  // --- console wrapper ---
  console: {
    enable(): void;
    disable(): void;
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

/** Modules installed by your pasted snippet: cookies, oauth, xd, client */
export interface SfdcCanvasModules {
  cookies: SfdcCanvasCookies;
  oauth: SfdcCanvasOAuth;
  xd: SfdcCanvasXd;
  client: SfdcCanvasClient;
}

export interface SfdcCanvasCookies {
  set(name: string, value: string, days?: number): void;
  /** If name is omitted in the implementation it returns raw cookie split; but signature here matches the public use. */
  get(name?: string): string | string[] | null;
  remove(name: string): void;
}

/** What oauth.client() returns and what client.validateClient requires */
export interface SfdcCanvasOAuthClient {
  oauthToken: string | null;
  instanceId: string | null;
  targetOrigin: string | null;
  /** set by some embed contexts; checked by subscribe/unsubscribe */
  isVF?: boolean;
}

export interface SfdcCanvasOAuthLoginContext {
  uri?: string; // default '/rest/oauth2'
  callback?: string; // used as fallback for state
  params?: {
    state?: string;
    display?: string; // default 'popup'
    redirect_uri?: string; // may be rewritten to absolute
    [k: string]: any;
  };
}

export interface SfdcCanvasOAuth {
  init(): void;

  /**
   * Opens the OAuth popup window to retrieve an OAuth token.
   * @param ctx - The context object that contains the URL, the response type, the client ID, and the callback URL
   * @example
   * ```typescript
   * const uri = Sfdc.canvas.oauth.loginUrl();
   * Sfdc.canvas.oauth.login({
   *   uri: uri,
   *   params: {
   *     response_type: "token",
   *     client_id: "your_client_id",
   *     redirect_uri: encodeURIComponent("/sdk/callback.html")
   *   }
   * });
   * ```
   */
  login(ctx?: SfdcCanvasOAuthLoginContext): void;

  /**
   * Removes the `access_token` OAuth token from this object.
   */
  logout(): void;

  /**
   * Returns the login state.
   * @returns `true` if the `access_token` is available in this JS object.
   * @remarks Note: `access_token`s (for example, OAuth tokens) should be stored server-side for more durability.
   * Never store OAuth tokens in cookies as this can lead to a security risk.
   */
  loggedin(): boolean;

  /**
   * Returns the URL for the OAuth authorization service.
   * @returns The URL for the OAuth authorization service or default if there's
   * no value for loginUrl in the current URL's query string
   */
  loginUrl(): string;

  /**
   * Sets, gets, or removes the `access_token` from this JavaScript object.
   *
   * This function does one of three things:
   * 1. If the 't' parameter isn't passed in, the current value for the `access_token` value is returned.
   * 2. If the 't' parameter is null, the `access_token` value is removed.
   * 3. Otherwise the `access_token` value is set to the 't' parameter and then returned.
   *
   * @param t - The OAuth token to set as the `access_token` value
   * @returns The resulting `access_token` value if set; otherwise null
   * @remarks Note: for longer-term storage of the OAuth token, store it server-side in the session.
   * Access tokens should never be stored in cookies.
   */
  token(): string | null;
  token(t: string | null): string | null;

  /**
   * Sets, gets, or removes the `instance_url` cookie.
   *
   * This function does one of three things:
   * 1. If the 'i' parameter is not passed in, the current value for the `instance_url` cookie is returned.
   * 2. If the 'i' parameter is null, the `instance_url` cookie is removed.
   * 3. Otherwise, the `instance_url` cookie value is set to the 'i' parameter and then returned.
   *
   * @param i - The value to set as the `instance_url` cookie
   * @returns The resulting `instance_url` cookie value if set; otherwise null
   */
  instance(): string | null;
  instance(i: string | null): string | null;

  /** Reads document.location.hash to populate access_token, instance_url, etc. */
  // parseHash is internal; not exposed.
  targetOrigin(to?: string): string | null;
  instanceId(id?: string): string | null;

  client(): SfdcCanvasOAuthClient;

  /**
   * Refreshes the parent window only if the child window is closed.
   * @deprecated This method is no longer used. Leaving in for backwards compatibility.
   */
  checkChildWindowStatus(): void;

  /**
   * Parses the hash value that is passed in and sets the
   * `access_token` and `instance_url` cookies if they exist.
   * Use this method during User-Agent OAuth Authentication Flow to pass the OAuth token.
   * @param hash - A string of key-value pairs delimited by the ampersand character
   * @example
   * ```typescript
   * Sfdc.canvas.oauth.childWindowUnloadNotification(self.location.hash);
   * ```
   */
  childWindowUnloadNotification(hash: string): void;
}

type SfdcCanvasXdMessage = string | Record<string, any>;

export interface SfdcCanvasXd {
  post(message: SfdcCanvasXdMessage, target_url: string, target?: Window): void;

  /**
   * If source_origin is a string, it must match e.origin.
   * If it's a function, it can validate and return an arbitrary "r" passed to callback(data, r).
   */
  receive(callback: (data: any, r?: any) => void, source_origin?: string | ((origin: string, data: any) => any | false)): void;

  remove(): void;
}

/** `Sfdc.canvas.client.ajax` settings inferred from defaults + code */
export interface SfdcCanvasClientAjaxSettings {
  success: (response: SfdcCanvasClientResponse<any>) => void;
  /** Called when the XHR returns a non-2xx/304 status or on network error. */
  failure?: (responseText: string, xhr: XMLHttpRequest, config: SfdcCanvasClientAjaxSettings) => void;
  /** Called before the request is sent. Return `false` to cancel. */
  beforerequest?: () => boolean;
  /** Called after success or failure, regardless of outcome. */
  complete?: (responseText: string, xhr: XMLHttpRequest, config: SfdcCanvasClientAjaxSettings) => void;
  /** The `this` context used when invoking success/failure/complete callbacks. */
  context?: any;

  client: SfdcCanvasOAuthClient;

  method?: string; // default 'GET'
  async?: boolean; // default true
  contentType?: string; // default 'application/json'
  headers?: Record<string, string>;
  data?: any;

  /** sometimes referenced as config.targetOrigin */
  targetOrigin?: string;
  [k: string]: any;
}

export interface SfdcCanvasClientResponse<TPayload = any> {
  seq?: number;
  status: number;
  statusText: string;
  parentVersion?: string;
  payload: TPayload;
  [k: string]: any;
}

export interface SfdcCanvasClientVersion {
  clientVersion: string; // '41.0' in snippet
  parentVersion: string | undefined;
}

export interface SfdcCanvasClientFrameSize {
  heights: { contentHeight: number; pageHeight: number; scrollTop: number };
  widths: { contentWidth: number; pageWidth: number; scrollLeft: number };
}

export interface SfdcCanvasClientResizeSize {
  height?: string;
  width?: string;
}

export interface SfdcCanvasClientEventSubscription {
  name: string; // validated identifier like "ns.event"
  params?: Record<string, any>;
  onData?: (payload: any) => void;
  onComplete?: (payload: { success: true; handle: string[] } | { success: false; errorMessage: string }) => void;
}

export interface SfdcCanvasClientPublishEvent {
  name: string;
  params?: Record<string, any>;
  payload?: any;
}

/** Module registered at `Sfdc.canvas.client` */
export interface SfdcCanvasClient {
  /**
   * Returns the context for the current user and organization.
   * @param clientscb - The callback function to run when the call to ctx completes
   * @param client - The signedRequest.client
   * @example
   * ```typescript
   * function callback(msg) {
   *   if (msg.status !== 200) {
   *     alert("Error: " + msg.status);
   *     return;
   *   }
   *   alert("Payload: ", msg.payload);
   * }
   * const client = Sfdc.canvas.oauth.client();
   * Sfdc.canvas.client.ctx(callback, client);
   * ```
   */
  ctx(clientscb: (response: SfdcCanvasClientResponse<any>) => void, client?: SfdcCanvasOAuthClient): void;

  /**
   * Performs a cross-domain, asynchronous HTTP request.
   *
   * Note: this method shouldn't be used for same domain requests.
   * @param url - The URL to which the request is sent
   * @param settings - A set of key/value pairs to configure the request.
   * The success setting is required at minimum and should be a callback function
   * @throws An error if the URL is missing or the settings object doesn't contain a success callback function
   * @example
   * ```typescript
   * // Posting to a Chatter feed:
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * const url = sr.context.links.chatterFeedsUrl + "/news/" +
   *   sr.context.user.userId + "/feed-items";
   * const body = {
   *   body: {
   *     messageSegments: [{type: "Text", text: "Some Chatter Post"}]
   *   }
   * };
   * Sfdc.canvas.client.ajax(url, {
   *   client: sr.client,
   *   method: 'POST',
   *   contentType: "application/json",
   *   data: JSON.stringify(body),
   *   success: function(data) {
   *     if (201 === data.status) {
   *       alert("Success");
   *     }
   *   }
   * });
   * ```
   * @example
   * ```typescript
   * // Gets a list of Chatter users:
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * const chatterUsersUrl = sr.context.links.chatterUsersUrl;
   * Sfdc.canvas.client.ajax(chatterUsersUrl, {
   *   client: sr.client,
   *   success: function(data) {
   *     if (data.status === 200) {
   *       alert("Got back " + data.payload.users.length + " users");
   *     }
   *   }
   * });
   * ```
   */
  ajax(url: string, settings: SfdcCanvasClientAjaxSettings): void;

  /**
   * Stores or gets the oauth token in a local javascript variable.
   *
   * Note: if longer term (survive page refresh) storage is needed, store the oauth token on the server side.
   * @param t - OAuth token, if supplied it will be stored in a volatile local JS variable
   * @returns The oauth token
   */
  token(t?: string | null): string | null;

  /**
   * Returns the current version of the client.
   * @returns Object containing clientVersion and parentVersion (e.g., {clientVersion: "29.0", parentVersion: "29.0"})
   */
  version(): SfdcCanvasClientVersion;

  /**
   * Returns the current size of the iFrame.
   * @returns Object containing:
   * - `heights.contentHeight`: the height of the virtual iFrame, all content, not just visible content
   * - `heights.pageHeight`: the height of the visible iFrame in the browser
   * - `heights.scrollTop`: the position of the scroll bar measured from the top
   * - `widths.contentWidth`: the width of the virtual iFrame, all content, not just visible content
   * - `widths.pageWidth`: the width of the visible iFrame in the browser
   * - `widths.scrollLeft`: the position of the scroll bar measured from the left
   * @example
   * ```typescript
   * const sizes = Sfdc.canvas.client.size();
   * console.log("contentHeight: " + sizes.heights.contentHeight);
   * console.log("pageHeight: " + sizes.heights.pageHeight);
   * console.log("scrollTop: " + sizes.heights.scrollTop);
   * console.log("contentWidth: " + sizes.widths.contentWidth);
   * console.log("pageWidth: " + sizes.widths.pageWidth);
   * console.log("scrollLeft: " + sizes.widths.scrollLeft);
   * ```
   */
  size(): SfdcCanvasClientFrameSize;

  /**
   * Informs the parent window to resize the canvas iFrame.
   *
   * If no parameters are specified, the parent window attempts to determine the height of the canvas app
   * based on the content and then sets the iFrame width and height accordingly. To explicitly set the
   * dimensions, pass in an object with height and/or width properties.
   * @param client - The object from the signed request
   * @param size - The optional height and width information
   * @example
   * ```typescript
   * // Automatically determine the size
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.resize(sr.client);
   * ```
   * @example
   * ```typescript
   * // Set the height and width explicitly
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.resize(sr.client, {height: "1000px", width: "900px"});
   * ```
   * @example
   * ```typescript
   * // Set only the height
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.resize(sr.client, {height: "1000px"});
   * ```
   */
  resize(client: SfdcCanvasOAuthClient, size?: SfdcCanvasClientResizeSize): void;

  /**
   * Starts or stops a timer which checks the content size of the iFrame and adjusts the frame accordingly.
   *
   * Use this function when you know your content is changing size, but you're not sure when. There's a delay
   * as the resizing is done asynchronously. Therefore, if you know when your content changes size, you should
   * explicitly call the resize() method and save browser CPU cycles.
   *
   * Note: you should turn off scrolling before this call, otherwise you might get a flicker.
   * @param client - The object from the signed request
   * @param enabled - Whether it's turned on or off; defaults to `true`
   * @param interval - The interval used to check content size; default timeout is 300ms
   * @example
   * ```typescript
   * // Turn on auto grow with default settings
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.autogrow(sr.client);
   * ```
   * @example
   * ```typescript
   * // Turn on auto grow with a polling interval of 100ms (milliseconds)
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.autogrow(sr.client, true, 100);
   * ```
   * @example
   * ```typescript
   * // Turn off auto grow
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.autogrow(sr.client, false);
   * ```
   */
  autogrow(client: SfdcCanvasOAuthClient, enabled?: boolean, interval?: number): void;

  /**
   * Subscribes to parent or custom events.
   *
   * Events with the namespaces 'canvas', 'sfdc', 'force', 'salesforce', and 'chatter' are reserved by Salesforce.
   * Developers can choose their own namespace and event names.
   * Event names must be in the form `namespace.eventname`.
   * @param client - The object from the signed request
   * @param s - The subscriber object or array of objects with name and callback functions
   * @example
   * ```typescript
   * // Subscribe to the parent window onscroll event
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.subscribe(sr.client, {
   *   name: 'canvas.scroll',
   *   onData: function(event) {
   *     console.log("Parent's contentHeight: " + event.heights.contentHeight);
   *     console.log("Parent's pageHeight: " + event.heights.pageHeight);
   *     console.log("Parent's scrollTop: " + event.heights.scrollTop);
   *   }
   * });
   * ```
   * @example
   * ```typescript
   * // Subscribe to a custom event
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.subscribe(sr.client, {
   *   name: 'mynamespace.someevent',
   *   onData: function(event) {
   *     console.log("Got custom event", event);
   *   }
   * });
   * ```
   * @example
   * ```typescript
   * // Subscribe to multiple events
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.subscribe(sr.client, [
   *   {name: 'mynamespace.someevent1', onData: handler1},
   *   {name: 'mynamespace.someevent2', onData: handler2}
   * ]);
   * ```
   * @example
   * ```typescript
   * // Subscribe to Streaming API events
   * // The PushTopic to subscribe to must be passed in
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.subscribe(sr.client, {
   *   name: 'sfdc.streamingapi',
   *   params: {topic: "/topic/InvoiceStatements"},
   *   onData: function() { console.log("onData done"); },
   *   onComplete: function() { console.log("onComplete done"); }
   * });
   * ```
   */
  subscribe(client: SfdcCanvasOAuthClient, s: SfdcCanvasClientEventSubscription | SfdcCanvasClientEventSubscription[]): void;

  /**
   * Unsubscribes from parent or custom events.
   * @param client - The object from the signed request
   * @param s - The events to unsubscribe from
   * @example
   * ```typescript
   * // Unsubscribe from the canvas.scroll method
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.unsubscribe(sr.client, "canvas.scroll");
   * ```
   * @example
   * ```typescript
   * // Unsubscribe from the canvas.scroll method by specifying the object name
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.unsubscribe(sr.client, {name: "canvas.scroll"});
   * ```
   * @example
   * ```typescript
   * // Unsubscribe from multiple events
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.unsubscribe(sr.client, ['canvas.scroll', 'foo.bar']);
   * ```
   * @example
   * ```typescript
   * // Unsubscribe from Streaming API events
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.unsubscribe(sr.client, {
   *   name: 'sfdc.streamingapi',
   *   params: {topic: "/topic/InvoiceStatements"}
   * });
   * ```
   */
  unsubscribe(
    client: SfdcCanvasOAuthClient,
    s: string | SfdcCanvasClientEventSubscription | (SfdcCanvasClientEventSubscription | string)[],
  ): void;

  /**
   * Publishes a custom event.
   *
   * Events are published to all subscribing canvas applications on the same page, regardless of domain.
   * Choose a unique namespace so the event doesn't collide with other application events.
   * Events can have payloads of arbitrary JSON objects.
   * @param client - The object from the signed request
   * @param e - The event to publish
   * @example
   * ```typescript
   * // Publish the foo.bar event with the specified payload
   * const sr = JSON.parse('<%=signedRequestJson%>');
   * Sfdc.canvas.client.publish(sr.client, {
   *   name: "foo.bar",
   *   payload: {some: 'stuff'}
   * });
   * ```
   */
  publish(client: SfdcCanvasOAuthClient, e: SfdcCanvasClientPublishEvent): void;

  /**
   * Temporary storage for the signed request.
   *
   * An alternative for users storing SR in a global variable.
   * Note: if you would like a new signed request, take a look at refreshSignedRequest().
   * @param s - Signed request to be temporarily stored in Sfdc.canvas.client object
   * @returns The value previously stored
   */
  signedrequest(): any;
  signedrequest(s: any): any;

  /**
   * Refresh the signed request. Obtain a new signed request on demand.
   *
   * Note: the authentication mechanism of the canvas app must be set to SignedRequest and not OAuth.
   * @param clientscb - The client's callback function to receive the base64 encoded signed request
   * @example
   * ```typescript
   * // Gets a signed request on demand
   * Sfdc.canvas.client.refreshSignedRequest(function(data) {
   *   if (data.status === 200) {
   *     const signedRequest = data.payload.response;
   *     const part = signedRequest.split('.')[1];
   *     const obj = JSON.parse(Sfdc.canvas.decode(part));
   *   }
   * });
   * ```
   */
  refreshSignedRequest(clientscb: (response: SfdcCanvasClientResponse<any>) => void): void;

  /**
   * Repost the signed request. Instruct the parent window to initiate a new post to the canvas url.
   *
   * Note: the authentication mechanism of the canvas app must be set to SignedRequest and not OAuth.
   * @param refresh - Refreshes the signed request when set to true (defaults to false)
   * @example
   * ```typescript
   * // Gets a signed request on demand, without refreshing the signed request
   * Sfdc.canvas.client.repost();
   *
   * // Gets a signed request on demand, first by refreshing the signed request
   * Sfdc.canvas.client.repost(true);
   * ```
   */
  repost(refresh?: boolean): void;
}
