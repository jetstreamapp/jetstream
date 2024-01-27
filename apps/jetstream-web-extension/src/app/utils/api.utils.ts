export async function apiGetRest({
  method,
  session,
  url,
  body,
}: {
  method: 'GET' | 'POST';
  url: string;
  body?: any;
  session: { key: string; hostname: string };
}) {
  return fetch(`${session.hostname}${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${session.key}`,
      'Content-Type': 'application/json',
    },
  }).then(async (response) => {
    if (response.ok) {
      return response.json();
    }
    throw new Error(await response.text());
  });
}
