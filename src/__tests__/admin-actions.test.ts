import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdminActionsTool } from '../tools/admin-actions.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleAdminActionsTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'key-1' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('island_list_admin_actions sends the Api-Key header and forwards the time window', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 'a1', action: 'policy.updated' }] }));

    const result = await runWithCredentials(creds, () =>
      handleAdminActionsTool('island_list_admin_actions', {
        start: '2026-09-01T00:00:00Z',
        end: '2026-09-02T00:00:00Z',
      })
    );

    expect(result.isError).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/external/v1/adminActions');
    expect(new URL(url).searchParams.get('Start')).toBe('2026-09-01T00:00:00Z');
    expect(new URL(url).searchParams.get('End')).toBe('2026-09-02T00:00:00Z');
    expect((init.method as string | undefined)).toBe('GET');
    expect((init.headers as Record<string, string>)['Api-Key']).toBe('key-1');
    expect(JSON.parse(textOf(result)).data[0].id).toBe('a1');
  });

  it('forwards offset/limit pagination', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    await runWithCredentials(creds, () =>
      handleAdminActionsTool('island_list_admin_actions', { offset: 100, limit: 25 })
    );

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('offset')).toBe('100');
    expect(url.searchParams.get('limit')).toBe('25');
  });

  it('surfaces a 401 as a readable auth error rather than throwing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, 401));

    const result = await runWithCredentials(creds, () =>
      handleAdminActionsTool('island_list_admin_actions', {})
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/rejected the API key/i);
  });

  it('returns a credential error without calling fetch when no key is configured', async () => {
    const result = await handleAdminActionsTool('island_list_admin_actions', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/ISLAND_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
