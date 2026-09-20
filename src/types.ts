/**
 * Island authenticates its Management API with a static API key, sent as a
 * custom `Api-Key` header (not `Authorization: Bearer`) - generated in the
 * Island Management Console under Modules > Platform Settings > System
 * Settings > Integrations > API, with a "Read Only" role option distinct
 * from "Full Admin"/"System Admin" (see README's Credential Scope section
 * for what is and isn't independently verified about that role). There is
 * no OAuth flow - this connector, like every other WYRE Conduit sidecar for
 * a static-key vendor, receives the key per-request via a custom header and
 * itself sends it as Island's own `Api-Key` header when calling Island's
 * API.
 *
 * `baseUrl` is an optional override: Island's Management API is reachable
 * at a single documented host (`https://management.island.io/api`,
 * confirmed via a published third-party log-collector integration's
 * executable configuration - see README's Base URL note for the exact
 * source and its confidence level), but this connector allows a customer to
 * override it in case their tenant is provisioned on a different host.
 */
export interface IslandCredentials {
  apiKey: string;
  baseUrl?: string;
}

/** Thrown when Island rejects the API key (HTTP 401) - distinct from rate limiting so callers get an honest error. */
export class IslandAuthError extends Error {}

/** Thrown when Island rate-limits the request (HTTP 429) - distinct from an auth failure. */
export class IslandRateLimitError extends Error {}

/** Thrown for any other non-2xx / unexpected vendor response. */
export class IslandApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export type SortDirection = 'Asc' | 'Desc';

// ---------------------------------------------------------------------
// Admin Actions / Audit (timeline) - both are GET, time-windowed, and
// offset-paginated per the same documented shape.
// ---------------------------------------------------------------------

export interface TimeWindowPageParams {
  /** Inclusive lower bound, ISO 8601. Island defaults to a recent window server-side when omitted; not independently confirmed. */
  start?: string;
  /** Inclusive upper bound, ISO 8601. Defaults to "now" server-side when omitted; not independently confirmed. */
  end?: string;
  offset?: number;
  limit?: number;
}

// ---------------------------------------------------------------------
// Compromised Credentials - POST-with-body search, same time-window +
// offset/limit shape as the GET endpoints above (documented pagination is
// offset/limit; at least one third-party integrator has noted it returning
// a fixed page regardless of offset in practice - see README).
// ---------------------------------------------------------------------

export interface CompromisedCredentialsParams {
  start?: string;
  end?: string;
  offset?: number;
  limit?: number;
}

// ---------------------------------------------------------------------
// Devices - POST-with-body search/filter, not a mutation (same "POST for a
// filtered read" shape UniFi's isp-metrics query tool already uses in this
// gateway).
// ---------------------------------------------------------------------

export interface ListDevicesParams {
  /** Filter to devices last seen at/after this time, ISO 8601. */
  lastSeen?: string;
  /** Field to sort by. Only "LastSeen" is confirmed from Island's own published example payloads; other values are passed through as-is. */
  sortBy?: string;
  sortDirection?: SortDirection;
  offset?: number;
  limit?: number;
}

/**
 * Island's list/search response envelopes are not documented in any source
 * available to this connector (Island's authoritative API reference sits
 * behind a customer login - see README). Response bodies are passed through
 * exactly as received rather than re-modeled into a guessed shape.
 */
export type IslandApiResponse = Record<string, unknown>;
