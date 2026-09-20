import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listAdminActions } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, PAGE_PARAMS_PROPERTIES, requireCredentials, TIME_WINDOW_PROPERTIES, textResult } from './shared.js';

export const ADMIN_ACTIONS_TOOLS: Tool[] = [
  {
    name: 'island_list_admin_actions',
    description:
      'List actions taken by administrators in the Island Management Console (e.g. policy changes, user/role changes) within a time window, newest first. Use start/end to bound the window; omit both for Island\'s server-side default window.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TIME_WINDOW_PROPERTIES,
        ...PAGE_PARAMS_PROPERTIES,
      },
    },
  },
];

const TOOL_NAMES = new Set(ADMIN_ACTIONS_TOOLS.map((t) => t.name));
export function isAdminActionsTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleAdminActionsTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'island_list_admin_actions') {
      return textResult(
        await listAdminActions(creds!, {
          start: args.start as string | undefined,
          end: args.end as string | undefined,
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
