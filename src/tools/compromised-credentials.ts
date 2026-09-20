import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listCompromisedCredentials } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, PAGE_PARAMS_PROPERTIES, requireCredentials, TIME_WINDOW_PROPERTIES, textResult } from './shared.js';

export const COMPROMISED_CREDENTIALS_TOOLS: Tool[] = [
  {
    name: 'island_list_compromised_credentials',
    description:
      "List credentials Island has detected as compromised (e.g. via dark-web/breach-corpus matching on credentials entered into the browser) within a time window, newest first. Use start/end to bound the window; omit both for Island's server-side default window. Note: at least one third-party integrator has reported this endpoint's offset pagination as unreliable in practice (returning the same page regardless of offset) - treat limit/offset as best-effort.",
    inputSchema: {
      type: 'object',
      properties: {
        ...TIME_WINDOW_PROPERTIES,
        ...PAGE_PARAMS_PROPERTIES,
      },
    },
  },
];

const TOOL_NAMES = new Set(COMPROMISED_CREDENTIALS_TOOLS.map((t) => t.name));
export function isCompromisedCredentialsTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleCompromisedCredentialsTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'island_list_compromised_credentials') {
      return textResult(
        await listCompromisedCredentials(creds!, {
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
