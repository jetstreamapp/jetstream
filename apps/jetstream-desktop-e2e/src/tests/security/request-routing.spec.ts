import { expect, test } from '../../fixtures/fixtures';

// window.electronAPI.request() is the one IPC channel that reaches Salesforce — and since
// sandbox:false widens a compromised renderer's blast radius, it's worth a regression guard that
// its routing does what ipc.service.ts's handleRequestEvent claims: only `url.pathname` is matched
// against desktopRoutes's fixed table of ~40 internal routes. The host component is never used to
// decide where the request actually goes (outbound Salesforce calls are built server-side from the
// org's real instanceUrl).
function buildRequest(url: string) {
  // `request.url` mirrors the outer `url` the way the renderer's own transport builds this payload
  // (IcpRequest carries its own url, which handleRequestEvent feeds to `new Request(...)`).
  return { url, request: { url, method: 'GET', headers: {}, body: null } };
}

test.describe('window.electronAPI.request() — routing', () => {
  test('an undefined path is not proxied anywhere — returns a plain 404, not a network error', async ({ electronApiClient }) => {
    const result = await electronApiClient.invoke('request', buildRequest('http://localhost:3333/api/this-route-does-not-exist'));

    expect(result.status).toBe(404);
  });

  // Deliberately a route that MATCHES and does real work. An unmatched path would prove nothing
  // here: handleRequestEvent returns 404 from its `!route` early return before it ever looks at
  // the host, so both hosts would agree for a reason unrelated to what this test guards.
  // `/api/heartbeat` is the cheapest matched GET — it needs no org and no auth.
  test('the request host is ignored on a route that matches — an attacker-controlled host gets the same response', async ({
    electronApiClient,
  }) => {
    const legitimate = await electronApiClient.invoke('request', buildRequest('http://localhost:3333/api/heartbeat'));
    const attackerControlled = await electronApiClient.invoke('request', buildRequest('https://attacker.example.com/api/heartbeat'));

    expect(legitimate.status).toBe(200);
    expect(attackerControlled.status).toBe(legitimate.status);
    expect(attackerControlled.body).toEqual(legitimate.body);
  });
});
