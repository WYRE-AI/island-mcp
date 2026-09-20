import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listDevices } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const DEVICE_TOOLS: Tool[] = [
  {
    name: 'island_list_devices',
    description:
      'List devices running Island Browser under this account, optionally filtered to devices last seen at/after a given time. Sortable by field (e.g. LastSeen).',
    inputSchema: {
      type: 'object',
      properties: {
        last_seen: {
          type: 'string',
          format: 'date-time',
          description: 'Filter to devices last seen at/after this time, ISO 8601.',
        },
        sort_by: {
          type: 'string',
          description: 'Field to sort by. "LastSeen" is confirmed from Island\'s own published example payloads; other field names are passed through as-is.',
        },
        sort_direction: {
          type: 'string',
          enum: ['Asc', 'Desc'],
          description: 'Sort direction. Defaults to Asc.',
        },
        ...PAGE_PARAMS_PROPERTIES,
      },
    },
  },
];

const TOOL_NAMES = new Set(DEVICE_TOOLS.map((t) => t.name));
export function isDeviceTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleDeviceTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'island_list_devices') {
      return textResult(
        await listDevices(creds!, {
          lastSeen: args.last_seen as string | undefined,
          sortBy: args.sort_by as string | undefined,
          sortDirection: args.sort_direction as 'Asc' | 'Desc' | undefined,
          offset: args.offset as number | undefined,
          limit: args.limit as number | undefined,
        })
      );
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
