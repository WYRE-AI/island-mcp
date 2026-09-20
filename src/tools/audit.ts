import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listAuditEvents } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, PAGE_PARAMS_PROPERTIES, requireCredentials, TIME_WINDOW_PROPERTIES, textResult } from './shared.js';

export const AUDIT_TOOLS: Tool[] = [
  {
    name: 'island_list_audit_events',
    description:
      "List browser/session audit events from Island's timeline (e.g. navigation, file transfer, clipboard, print, and policy-enforcement events) within a time window, newest first. Use start/end to bound the window; omit both for Island's server-side default window.",
    inputSchema: {
      type: 'object',
      properties: {
        ...TIME_WINDOW_PROPERTIES,
        ...PAGE_PARAMS_PROPERTIES,
      },
    },
  },
];

const TOOL_NAMES = new Set(AUDIT_TOOLS.map((t) => t.name));
export function isAuditTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleAuditTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'island_list_audit_events') {
      return textResult(
        await listAuditEvents(creds!, {
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
