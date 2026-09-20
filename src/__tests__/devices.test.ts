import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDeviceTool } from '../tools/devices.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleDeviceTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'key-1' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('island_list_devices POSTs a JSON body and forwards last_seen/sort as query + body params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 'd1', hostname: 'laptop-1' }] }));

    const result = await runWithCredentials(creds, () =>
      handleDeviceTool('island_list_devices', {
        last_seen: '2026-09-01T00:00:00Z',
        sort_by: 'LastSeen',
        sort_direction: 'Desc',
        limit: 100,
      })
    );

    expect(result.isError).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/external/v1/devices');
    expect(new URL(url).searchParams.get('LastSeen')).toBe('2026-09-01T00:00:00Z');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Api-Key']).toBe('key-1');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ SortBy: 'LastSeen', SortDirection: 'Desc', Limit: 100 });
    expect(JSON.parse(textOf(result)).data[0].id).toBe('d1');
  });

  it('surfaces a non-2xx, non-401/429 status as a generic API error', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'server error' }, 500));

    const result = await runWithCredentials(creds, () => handleDeviceTool('island_list_devices', {}));

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/HTTP 500/);
  });

  it('returns a credential error without calling fetch when no key is configured', async () => {
    const result = await handleDeviceTool('island_list_devices', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/ISLAND_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
