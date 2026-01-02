import { HTTP } from '@jetstream/shared/constants';
import { v4 as uuid } from 'uuid';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('Desktop / Web-Extension Authentication', () => {
  // // Reset storage state for this file to avoid being authenticated
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('Desktop Authentication - success', async ({ page, teamCreationUtils1User }) => {
    const deviceId = uuid();
    const token = uuid();

    await page.goto(`/desktop-app/auth/?deviceId=${deviceId}&token=${token}`);
    await expect(page.getByText('You are successfully authenticated, you can close this tab.')).toBeVisible();
  });

  test('Desktop Authentication - Missing query params', async ({ page, teamCreationUtils1User }) => {
    await page.goto(`/desktop-app/auth/`);
    await expect(page.getByText('Error communicating with desktop application, is the application open?')).toBeVisible();
  });

  test('Desktop Authentication - API', async ({ page, teamCreationUtils1User, apiRequestUtils }) => {
    const deviceId = uuid();
    const response = await apiRequestUtils.request.post(`/desktop-app/auth/session`, {
      headers: {
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(response.status()).toBe(200);
    const data = await response.json().then(({ data }) => data);
    expect(typeof data.accessToken).toBe('string');

    let verifyResponse = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(verifyResponse.status()).toBe(200);
    const verifyData = await verifyResponse.json().then(({ data }) => data);
    expect(verifyData.success).toBe(true);
    expect(verifyData.userProfile).toBeDefined();

    verifyResponse = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: 'invalid-device-id',
      },
    });
    verifyResponse.url();
    expect(verifyResponse.status()).toBe(401);
    const invalidVerifyData1 = await verifyResponse.json();
    expect(invalidVerifyData1.success).toBe(false);
    expect(invalidVerifyData1.message).toBe('Unauthorized');

    verifyResponse = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer invalid-access-token`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(verifyResponse.status()).toBe(401);
    const invalidVerifyData2 = await verifyResponse.json();
    expect(invalidVerifyData2.success).toBe(false);
    expect(invalidVerifyData2.message).toBe('Unauthorized');
  });

  // TODO: we don't have a way to test this currently since the extension is not installed
  test('Web Extension Authentication - Extension not installed', async ({ page, teamCreationUtils1User }) => {
    await page.goto(`/web-extension/auth/`);
    await expect(page.getByText('Authentication in progress...')).toBeVisible();
  });

  test('Web Extension Authentication - API', async ({ page, teamCreationUtils1User, apiRequestUtils }) => {
    const deviceId = uuid();
    const response = await apiRequestUtils.request.post(`/web-extension/auth/session`, {
      headers: {
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(response.status()).toBe(200);
    const data = await response.json().then(({ data }) => data);
    expect(typeof data.accessToken).toBe('string');

    let verifyResponse = await apiRequestUtils.request.post(`/web-extension/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(verifyResponse.status()).toBe(200);
    const verifyData = await verifyResponse.json().then(({ data }) => data);
    expect(verifyData.success).toBe(true);
    expect(verifyData.userProfile).toBeDefined();

    verifyResponse = await apiRequestUtils.request.post(`/web-extension/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: 'invalid-device-id',
      },
    });
    expect(verifyResponse.status()).toBe(401);
    const invalidVerifyData1 = await verifyResponse.json();
    expect(invalidVerifyData1.success).toBe(false);
    expect(invalidVerifyData1.message).toBe('Unauthorized');

    verifyResponse = await apiRequestUtils.request.post(`/web-extension/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer 'invalid-access-token'`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(verifyResponse.status()).toBe(401);
    const invalidVerifyData2 = await verifyResponse.json();
    expect(invalidVerifyData2.success).toBe(false);
    expect(invalidVerifyData2.message).toBe('Unauthorized');

    verifyResponse = await apiRequestUtils.request.post(`/web-extension/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer 'invalid-access-token'`,
      },
    });
    expect(verifyResponse.status()).toBe(401);
    const invalidVerifyData3 = await verifyResponse.json();
    expect(invalidVerifyData3.success).toBe(false);
    expect(invalidVerifyData3.message).toBe('Unauthorized');
  });
});

test.describe('Desktop / Web-Extension Authentication - Not Logged In', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('Desktop Authentication Redirected to Login', async ({ page }) => {
    const deviceId = uuid();
    const token = uuid();

    await page.goto(`/desktop-app/auth/?deviceId=${deviceId}&token=${token}`);
    expect(page.url()).toContain('/auth/login/');
  });

  test('Web Extension - Extension not installed', async ({ page }) => {
    await page.goto(`/web-extension/auth/`);
    expect(page.url()).toContain('/auth/login/');
  });
});

test.describe('Desktop / Web-Extension Authentication - No Access', () => {
  test('Desktop Authentication - no subscription', async ({ page }) => {
    const deviceId = uuid();
    const token = uuid();

    await page.goto(`/desktop-app/auth/?deviceId=${deviceId}&token=${token}`);
    await expect(page.getByText('You do not have a valid subscription to use the desktop application')).toBeVisible();
  });

  test('Desktop Authentication - Missing query params', async ({ page }) => {
    await page.goto(`/desktop-app/auth/`);
    await expect(page.getByText('Error communicating with desktop application, is the application open?')).toBeVisible();
  });

  // TODO: we don't have a way to test this currently since the extension is not installed
  test('Web Extension - Extension not installed', async ({ page }) => {
    await page.goto(`/web-extension/auth/`);
    await expect(page.getByText('Authentication in progress...')).toBeVisible();
  });
});
