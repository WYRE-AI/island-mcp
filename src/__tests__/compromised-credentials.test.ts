import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCompromisedCredentialsTool } from '../tools/compromised-credentials.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleCompromisedCredentialsTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'key-1' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('island_list_compromised_credentials POSTs a JSON body with the time window, not a query-only GET', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 'c1', domain: 'example.com' }] }));

    const result = await runWithCredentials(creds, () =>
      handleCompromisedCredentialsTool('island_list_compromised_credentials', {
        start: '2026-09-01T00:00:00Z',
        end: '2026-09-02T00:00:00Z',
        limit: 50,
      })
    );

    expect(result.isError).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/external/v1/compromised-credentials');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Api-Key']).toBe('key-1');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      start: '2026-09-01T00:00:00Z',
      end: '2026-09-02T00:00:00Z',
      limit: 50,
    });
    expect(JSON.parse(textOf(result)).data[0].id).toBe('c1');
  });

  it('surfaces a 401 as a readable auth error rather than throwing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, 401));

    const result = await runWithCredentials(creds, () =>
      handleCompromisedCredentialsTool('island_list_compromised_credentials', {})
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/rejected the API key/i);
  });

  it('returns a credential error without calling fetch when no key is configured', async () => {
    const result = await handleCompromisedCredentialsTool('island_list_compromised_credentials', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/ISLAND_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
