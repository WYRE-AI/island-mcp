import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ADMIN_ACTIONS_TOOLS, handleAdminActionsTool, isAdminActionsTool } from './admin-actions.js';
import { AUDIT_TOOLS, handleAuditTool, isAuditTool } from './audit.js';
import {
  COMPROMISED_CREDENTIALS_TOOLS,
  handleCompromisedCredentialsTool,
  isCompromisedCredentialsTool,
} from './compromised-credentials.js';
import { DEVICE_TOOLS, handleDeviceTool, isDeviceTool } from './devices.js';
import type { CallToolResult } from './types.js';

export const ALL_TOOLS: Tool[] = [
  ...ADMIN_ACTIONS_TOOLS,
  ...AUDIT_TOOLS,
  ...COMPROMISED_CREDENTIALS_TOOLS,
  ...DEVICE_TOOLS,
];

export async function dispatchToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  if (isAdminActionsTool(name)) return handleAdminActionsTool(name, args);
  if (isAuditTool(name)) return handleAuditTool(name, args);
  if (isCompromisedCredentialsTool(name)) return handleCompromisedCredentialsTool(name, args);
  if (isDeviceTool(name)) return handleDeviceTool(name, args);
  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
}
