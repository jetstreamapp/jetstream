import { HTTP } from '@jetstream/shared/constants';
import { v4 as uuid } from 'uuid';
import { expect, test } from '../../../fixtures/fixtures';

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

test.describe('Desktop / Web-Extension Token Rotation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('Desktop token rotation - rotated token works, old token is invalidated', async ({
    page,
    teamCreationUtils1User,
    apiRequestUtils,
  }) => {
    const deviceId = uuid();

    // 1. Create session and get original token
    const sessionResponse = await apiRequestUtils.request.post(`/desktop-app/auth/session`, {
      headers: { [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId },
    });
    expect(sessionResponse.status()).toBe(200);
    const { accessToken: originalToken } = await sessionResponse.json().then(({ data }) => data);
    expect(typeof originalToken).toBe('string');

    // 2. Verify with rotation header — should get a new token
    const rotateResponse = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${originalToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
        [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1',
      },
    });
    expect(rotateResponse.status()).toBe(200);
    const rotateData = await rotateResponse.json().then(({ data }) => data);
    expect(rotateData.success).toBe(true);
    expect(rotateData.accessToken).toBeDefined();
    expect(rotateData.accessToken).not.toBe(originalToken);
    const rotatedToken = rotateData.accessToken;

    // 3. Rotated token works for subsequent verify
    const verifyWithRotated = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rotatedToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
        [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1',
      },
    });
    expect(verifyWithRotated.status()).toBe(200);

    // 4. Original token is now invalid (its hash was replaced in the DB)
    const verifyWithOriginal = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${originalToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(verifyWithOriginal.status()).toBe(401);
  });

  test('Web extension token rotation - rotated token works, old token is invalidated', async ({
    page,
    teamCreationUtils1User,
    apiRequestUtils,
  }) => {
    const deviceId = uuid();

    // 1. Create session and get original token
    const sessionResponse = await apiRequestUtils.request.post(`/web-extension/auth/session`, {
      headers: { [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId },
    });
    expect(sessionResponse.status()).toBe(200);
    const { accessToken: originalToken } = await sessionResponse.json().then(({ data }) => data);
    expect(typeof originalToken).toBe('string');

    // 2. Verify with rotation header — should get a new token
    const rotateResponse = await apiRequestUtils.request.post(`/web-extension/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${originalToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
        [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1',
      },
    });
    expect(rotateResponse.status()).toBe(200);
    const rotateData = await rotateResponse.json().then(({ data }) => data);
    expect(rotateData.success).toBe(true);
    expect(rotateData.accessToken).toBeDefined();
    expect(rotateData.accessToken).not.toBe(originalToken);
    const rotatedToken = rotateData.accessToken;

    // 3. Rotated token works
    const verifyWithRotated = await apiRequestUtils.request.post(`/web-extension/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rotatedToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
        [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1',
      },
    });
    expect(verifyWithRotated.status()).toBe(200);

    // 4. Original token is now invalid
    const verifyWithOriginal = await apiRequestUtils.request.post(`/web-extension/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${originalToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(verifyWithOriginal.status()).toBe(401);
  });

  test('No rotation without header (backward compat)', async ({ page, teamCreationUtils1User, apiRequestUtils }) => {
    const deviceId = uuid();

    // 1. Create session
    const sessionResponse = await apiRequestUtils.request.post(`/desktop-app/auth/session`, {
      headers: { [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId },
    });
    expect(sessionResponse.status()).toBe(200);
    const { accessToken } = await sessionResponse.json().then(({ data }) => data);

    // 2. Verify WITHOUT rotation header — should not include accessToken in response
    const verifyResponse = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(verifyResponse.status()).toBe(200);
    const verifyData = await verifyResponse.json().then(({ data }) => data);
    expect(verifyData.success).toBe(true);
    expect(verifyData.accessToken).toBeUndefined();

    // 3. Same token still works (was not rotated)
    const verifyAgain = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(verifyAgain.status()).toBe(200);
  });

  test('Logout invalidates rotated token', async ({ page, teamCreationUtils1User, apiRequestUtils }) => {
    const deviceId = uuid();

    // 1. Create session
    const sessionResponse = await apiRequestUtils.request.post(`/desktop-app/auth/session`, {
      headers: { [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId },
    });
    const { accessToken: originalToken } = await sessionResponse.json().then(({ data }) => data);

    // 2. Rotate the token
    const rotateResponse = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${originalToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
        [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1',
      },
    });
    const { accessToken: rotatedToken } = await rotateResponse.json().then(({ data }) => data);

    // 3. Logout with the rotated token
    const logoutResponse = await apiRequestUtils.request.delete(`/desktop-app/auth/logout`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${rotatedToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(logoutResponse.status()).toBe(200);

    // 4. Rotated token is now invalid
    const verifyAfterLogout = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rotatedToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(verifyAfterLogout.status()).toBe(401);
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
  // Use a fresh unauthenticated state and sign up a new user without any team/entitlements.
  // This avoids relying on the default storageState (which can expire) and ensures the user
  // has no desktop subscription, which is required for these "no access" tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('Desktop Authentication - no subscription', async ({ page, newUser: _newUser }) => {
    const deviceId = uuid();
    const token = uuid();

    await page.goto(`/desktop-app/auth/?deviceId=${deviceId}&token=${token}`);
    await expect(page.getByText('You do not have a valid subscription to use the desktop application')).toBeVisible();
  });

  test('Desktop Authentication - Missing query params', async ({ page, newUser: _newUser }) => {
    await page.goto(`/desktop-app/auth/`);
    await expect(page.getByText('Error communicating with desktop application, is the application open?')).toBeVisible();
  });

  // TODO: we don't have a way to test this currently since the extension is not installed
  test('Web Extension - Extension not installed', async ({ page, newUser: _newUser }) => {
    await page.goto(`/web-extension/auth/`);
    await expect(page.getByText('Authentication in progress...')).toBeVisible();
  });
});
