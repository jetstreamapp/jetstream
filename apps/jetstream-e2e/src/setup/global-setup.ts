import { request } from '@playwright/test';

const baseURL = process.env.CI ? 'http://localhost:3333' : 'http://localhost:4200';

async function globalSetup() {
  console.log('GLOBAL SETUP - STARTED');
  console.log('Ensuring E2E org exists');
  const requestContext = await request.newContext();
  await requestContext.post(`${baseURL}/test/e2e-integration-org`, {
    failOnStatusCode: true,
  });
  await requestContext.dispose();
  console.log('GLOBAL SETUP - FINISHED\n');
}

export default globalSetup;
