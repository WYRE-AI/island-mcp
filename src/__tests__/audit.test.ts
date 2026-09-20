import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAuditTool } from '../tools/audit.js';
import { runWithCredentials } from '../client.js';
import { jsonResponse, textOf } from './test-helpers.js';

describe('handleAuditTool', () => {
  const fetchMock = vi.fn();
  const creds = { apiKey: 'key-1' };

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('island_list_audit_events hits the timeline endpoint with the Api-Key header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 'e1', type: 'file.download' }] }));

    const result = await runWithCredentials(creds, () =>
      handleAuditTool('island_list_audit_events', { start: '2026-09-01T00:00:00Z' })
    );

    expect(result.isError).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/external/v1/timeline');
    expect(new URL(url).searchParams.get('Start')).toBe('2026-09-01T00:00:00Z');
    expect((init.headers as Record<string, string>)['Api-Key']).toBe('key-1');
    expect(JSON.parse(textOf(result)).data[0].id).toBe('e1');
  });

  it('respects a customer-supplied base URL override', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    await runWithCredentials({ apiKey: 'key-1', baseUrl: 'https://tenant.example.island.io/api' }, () =>
      handleAuditTool('island_list_audit_events', {})
    );

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('https://tenant.example.island.io/api/external/v1/timeline');
  });

  it('surfaces a 429 as a readable rate-limit error rather than throwing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429));

    const result = await runWithCredentials(creds, () => handleAuditTool('island_list_audit_events', {}));

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/rate-limited/i);
  });

  it('returns a credential error without calling fetch when no key is configured', async () => {
    const result = await handleAuditTool('island_list_audit_events', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/ISLAND_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
