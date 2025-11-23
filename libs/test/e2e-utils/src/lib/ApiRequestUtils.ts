import { HTTP } from '@jetstream/shared/constants';
import { HttpMethod } from '@jetstream/types';
import { APIRequestContext, APIResponse, Cookie, Page } from '@playwright/test';

export class ApiRequestUtils {
  readonly page: Page;
  readonly BASE_URL: string;
  readonly E2E_LOGIN_USERNAME: string;

  csrfCookie: Cookie | undefined;
  request: APIRequestContext;

  selectedOrgId: string;

  constructor(page: Page, e2eLoginUsername: string) {
    this.BASE_URL = process.env.JETSTREAM_SERVER_URL;
    this.page = page;
    this.E2E_LOGIN_USERNAME = e2eLoginUsername;
    this.request = page.request;
  }

  // Used to change request context for the page
  setRequest(request: APIRequestContext) {
    this.request = request;
  }

  async selectDefaultOrg() {
    await this.page.goto('/app');
    await this.page.getByPlaceholder('Select an Org').click();
    await this.page.getByRole('option', { name: this.E2E_LOGIN_USERNAME }).click();

    this.selectedOrgId = await this.page.evaluate(async () => {
      return window.atob(localStorage.getItem('SELECTED_ORG')!);
    });
  }

  async makeRequest<T>(method: HttpMethod, path: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    const response = await this.makeRequestRaw(method, path, data, headers);
    const results = await response.json();
    if (!response.ok()) {
      console.warn('\n\nREQUEST ERROR');
      console.log(results);
      throw new Error('Request failed\n\n');
    }
    return results.data;
  }

  async makeRequestRaw(method: HttpMethod, path: string, data?: unknown, headers?: Record<string, string>): Promise<APIResponse> {
    await this.ensureCsrfCookieIsSet();
    const url = `${this.BASE_URL}${path}`;
    const options = {
      data,
      headers: {
        [HTTP.HEADERS.ACCEPT]: HTTP.CONTENT_TYPE.JSON,
        [HTTP.HEADERS.X_SFDC_ID]: this.selectedOrgId,
        [HTTP.HEADERS.X_CSRF_TOKEN]: this.csrfCookie?.value,
        ...headers,
      },
    };
    let response: APIResponse;
    switch (method) {
      case 'GET':
        response = await this.request.get(url, options);
        break;
      case 'POST':
        response = await this.request.post(url, options);
        break;
      case 'PATCH':
        response = await this.request.patch(url, options);
        break;
      case 'PUT':
        response = await this.request.put(url, options);
        break;
      case 'DELETE':
        response = await this.request.delete(url, options);
        break;
      default:
        throw new Error('Invalid method');
    }
    return response;
  }

  async ensureCsrfCookieIsSet(): Promise<void> {
    if (this.csrfCookie) {
      return;
    }
    this.csrfCookie = await this.page
      .context()
      .cookies()
      .then((cookies) => cookies.find((cookie) => cookie.name.endsWith(HTTP.COOKIE.CSRF_SUFFIX)));
  }
}
