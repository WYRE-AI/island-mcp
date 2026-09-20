import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from './utils/logger.js';
import { IslandApiError, IslandAuthError, IslandRateLimitError } from './types.js';
import type {
  CompromisedCredentialsParams,
  IslandApiResponse,
  IslandCredentials,
  ListDevicesParams,
  TimeWindowPageParams,
} from './types.js';

/**
 * Default Island Management API host. Confirmed via a published third-party
 * log-collector integration's executable configuration (a Cribl Pack that
 * ships real REST-collector job definitions against this exact host and
 * path prefix) - not from Island's own authoritative reference, which sits
 * behind a customer login. See README's Base URL note. `getCredentials()`
 * below lets a customer override this if their tenant is provisioned
 * elsewhere.
 */
export const DEFAULT_BASE_URL = 'https://management.island.io/api';

// Request-scoped credential store. In gateway mode the HTTP layer runs each
// request inside runWithCredentials({apiKey, baseUrl}); getCredentials()
// reads from it. Falls back to process.env for stdio/single-tenant mode.
const credStore = new AsyncLocalStorage<IslandCredentials>();

export function runWithCredentials<T>(creds: IslandCredentials, fn: () => T): T {
  return credStore.run(creds, fn);
}

export function getCredentials(): IslandCredentials | null {
  const scoped = credStore.getStore();
  if (scoped?.apiKey) return scoped;
  const apiKey = process.env.ISLAND_API_KEY;
  if (!apiKey) {
    logger.warn('Missing credentials', { hasApiKey: !!apiKey });
    return null;
  }
  return { apiKey, baseUrl: process.env.ISLAND_BASE_URL || undefined };
}

function baseUrlFor(creds: IslandCredentials): string {
  return (creds.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function buildQuery(params: Record<string, unknown> = {}): URLSearchParams {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    qs.append(key, String(value));
  }
  return qs;
}

function handleErrorStatus(res: Response, path: string): void {
  if (res.status === 401) {
    throw new IslandAuthError(`Island rejected the API key (HTTP 401): ${path}`);
  }
  if (res.status === 429) {
    throw new IslandRateLimitError(`Island rate-limited the request (HTTP 429): ${path}`);
  }
  if (!res.ok) {
    throw new IslandApiError(`Island ${path} failed: HTTP ${res.status}`, res.status);
  }
}

async function doGet(
  creds: IslandCredentials,
  path: string,
  query?: Record<string, unknown>
): Promise<IslandApiResponse> {
  const qs = query ? buildQuery(query).toString() : '';
  const url = `${baseUrlFor(creds)}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Api-Key': creds.apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  handleErrorStatus(res, path);
  return (await res.json()) as IslandApiResponse;
}

/**
 * POST-with-body read, for Island's search/filter endpoints (devices,
 * compromised credentials). Not a mutation - same "POST for a filtered
 * read" shape this gateway already uses for UniFi's isp-metrics query tool.
 */
async function doPostSearch(
  creds: IslandCredentials,
  path: string,
  body: Record<string, unknown>,
  query?: Record<string, unknown>
): Promise<IslandApiResponse> {
  const qs = query ? buildQuery(query).toString() : '';
  const url = `${baseUrlFor(creds)}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': creds.apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  handleErrorStatus(res, path);
  return (await res.json()) as IslandApiResponse;
}

// ---------------------------------------------------------------------
// Admin Actions
// ---------------------------------------------------------------------

/** GET /external/v1/adminActions - actions taken by administrators in the Island Management Console within a time window, offset-paginated. */
export async function listAdminActions(
  creds: IslandCredentials,
  params: TimeWindowPageParams = {}
): Promise<IslandApiResponse> {
  return doGet(creds, '/external/v1/adminActions', {
    Start: params.start,
    End: params.end,
    offset: params.offset,
    limit: params.limit,
  });
}

// ---------------------------------------------------------------------
// Audit (Island's own endpoint name is "timeline")
// ---------------------------------------------------------------------

/** GET /external/v1/timeline - browser/session audit events within a time window, offset-paginated. */
export async function listAuditEvents(
  creds: IslandCredentials,
  params: TimeWindowPageParams = {}
): Promise<IslandApiResponse> {
  return doGet(creds, '/external/v1/timeline', {
    Start: params.start,
    End: params.end,
    offset: params.offset,
    limit: params.limit,
  });
}

// ---------------------------------------------------------------------
// Compromised Credentials
// ---------------------------------------------------------------------

/** POST /external/v1/compromised-credentials - credentials Island has detected as compromised within a time window. A filtered read (POST-with-body on Island's own API), not a mutation. */
export async function listCompromisedCredentials(
  creds: IslandCredentials,
  params: CompromisedCredentialsParams = {}
): Promise<IslandApiResponse> {
  const body: Record<string, unknown> = {};
  if (params.start !== undefined) body.start = params.start;
  if (params.end !== undefined) body.end = params.end;
  if (params.limit !== undefined) body.limit = params.limit;
  if (params.offset !== undefined) body.offset = params.offset;
  return doPostSearch(creds, '/external/v1/compromised-credentials', body, {
    start: params.start,
    end: params.end,
  });
}

// ---------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------

/** POST /external/v1/devices - devices managed by this Island account, optionally filtered by last-seen time. A filtered read (POST-with-body on Island's own API), not a mutation. */
export async function listDevices(
  creds: IslandCredentials,
  params: ListDevicesParams = {}
): Promise<IslandApiResponse> {
  const body: Record<string, unknown> = {};
  if (params.limit !== undefined) body.Limit = params.limit;
  if (params.offset !== undefined) body.Offset = params.offset;
  if (params.sortBy !== undefined) body.SortBy = params.sortBy;
  if (params.sortDirection !== undefined) body.SortDirection = params.sortDirection;
  return doPostSearch(creds, '/external/v1/devices', body, {
    LastSeen: params.lastSeen,
  });
}
