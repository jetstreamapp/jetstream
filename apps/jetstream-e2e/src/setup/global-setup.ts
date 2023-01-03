import { request } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3333';

async function globalSetup() {
  console.log('GLOBAL SETUP');
  console.log('Ensuring E2E org exists');
  const requestContext = await request.newContext();
  await requestContext.post(`${baseURL}/test/e2e-integration-org`, {
    failOnStatusCode: true,
  });
  await requestContext.dispose();
}

export default globalSetup;
