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

  // A freshly issued session token is well outside the refresh window (TOKEN_AUTO_REFRESH_DAYS), so
  // verifying with the rotation header must NOT rotate it: the response succeeds without a new
  // accessToken and the original token keeps working. Rotation only fires as a token nears expiry.
  // The full gating + rotation mechanics (skip-when-fresh, rotate-when-near-expiry, race-loss-none
  // -> 401, no-header -> no rotation) are covered against mocked time/DB in
  // desktop-app.controller.spec.ts, web-extension.controller.spec.ts, and external-auth.service.spec.ts.
  test('Desktop - fresh token is not rotated when rotation is supported', async ({ page, teamCreationUtils1User, apiRequestUtils }) => {
    const deviceId = uuid();

    // 1. Create session and get original token
    const sessionResponse = await apiRequestUtils.request.post(`/desktop-app/auth/session`, {
      headers: { [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId },
    });
    expect(sessionResponse.status()).toBe(200);
    const { accessToken: originalToken } = await sessionResponse.json().then(({ data }) => data);
    expect(typeof originalToken).toBe('string');

    // 2. Verify with rotation header — fresh token is not near expiry, so it is not rotated
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
    expect(rotateData.accessToken).toBeUndefined();

    // 3. Original token still works — verifying did not rotate or invalidate it
    const verifyWithOriginal = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${originalToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
        [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1',
      },
    });
    expect(verifyWithOriginal.status()).toBe(200);
  });

  test('Web extension - fresh token is not rotated when rotation is supported', async ({
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

    // 2. Verify with rotation header — fresh token is not near expiry, so it is not rotated
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
    expect(rotateData.accessToken).toBeUndefined();

    // 3. Original token still works — verifying did not rotate or invalidate it
    const verifyWithOriginal = await apiRequestUtils.request.post(`/web-extension/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${originalToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
        [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1',
      },
    });
    expect(verifyWithOriginal.status()).toBe(200);
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

  test('Logout invalidates the session token', async ({ page, teamCreationUtils1User, apiRequestUtils }) => {
    const deviceId = uuid();

    // 1. Create session
    const sessionResponse = await apiRequestUtils.request.post(`/desktop-app/auth/session`, {
      headers: { [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId },
    });
    const { accessToken } = await sessionResponse.json().then(({ data }) => data);

    // 2. Logout with the token
    const logoutResponse = await apiRequestUtils.request.delete(`/desktop-app/auth/logout`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: deviceId,
      },
    });
    expect(logoutResponse.status()).toBe(200);

    // 3. Token is now invalid (removed from the DB by logout)
    const verifyAfterLogout = await apiRequestUtils.request.post(`/desktop-app/auth/verify`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
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
