import type { IslandCredentials } from '../types.js';
import type { CallToolResult } from './types.js';

export function textResult(value: unknown): CallToolResult {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text', text }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

/** Returns an error CallToolResult if credentials are missing, else null. */
export function requireCredentials(creds: IslandCredentials | null): CallToolResult | null {
  if (!creds) {
    return errorResult('No Island credentials configured. Set ISLAND_API_KEY.');
  }
  return null;
}

/** Shared input-schema fragment for the offset-paginated list endpoints (every Island list endpoint). */
export const PAGE_PARAMS_PROPERTIES = {
  offset: { type: 'number', description: 'Pagination offset (0-based). Defaults to 0.' },
  limit: { type: 'number', description: 'Items per page. Defaults to 100.' },
} as const;

/** Shared input-schema fragment for the time-windowed list endpoints (Admin Actions, Audit). */
export const TIME_WINDOW_PROPERTIES = {
  start: {
    type: 'string',
    format: 'date-time',
    description: 'Inclusive lower bound, ISO 8601 (e.g. 2026-09-01T00:00:00Z). Island applies a server-side default window when omitted.',
  },
  end: {
    type: 'string',
    format: 'date-time',
    description: 'Inclusive upper bound, ISO 8601. Defaults to now when omitted.',
  },
} as const;
