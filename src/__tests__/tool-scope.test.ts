import { describe, expect, it } from 'vitest';
import { ALL_TOOLS } from '../tools/index.js';

/**
 * Hard scope boundary (see README's Scope section for the full accounting):
 * this connector must NEVER expose a tool that mutates, provisions, or
 * deletes anything, and must never expose a tool reaching Island's broader
 * policy/user/device-management surface (create/update/delete policies,
 * users, browser configuration). Pin the exact tool set so an accidental
 * addition - a copy-pasted "create_policy", "update_user", "delete_device",
 * or any other write tool - fails this test immediately rather than
 * silently shipping.
 */
describe('ALL_TOOLS scope boundary', () => {
  const EXPECTED_TOOL_NAMES = [
    'island_list_admin_actions',
    'island_list_audit_events',
    'island_list_compromised_credentials',
    'island_list_devices',
  ].sort();

  it("exposes exactly this connector's 4 read-only tools - nothing more, nothing less", () => {
    const names = ALL_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
    expect(names).toHaveLength(4);
  });

  it('never exposes a write, delete, create, update, or provisioning tool', () => {
    // Forbidden as a whole underscore-token, not a substring.
    const FORBIDDEN_TOKENS = new Set([
      'create',
      'update',
      'delete',
      'provision',
      'set',
      'put',
      'patch',
      'remove',
      'policy', // policy CRUD is part of Island's broader Management API, not implemented here
      'policies',
    ]);

    for (const tool of ALL_TOOLS) {
      const tokens = tool.name.split('_');
      for (const token of tokens) {
        expect(
          FORBIDDEN_TOKENS.has(token),
          `Tool "${tool.name}" contains forbidden token "${token}" - this connector must stay read-only.`
        ).toBe(false);
      }
    }
  });

  it('every tool name is prefixed with island_', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name.startsWith('island_')).toBe(true);
    }
  });
});
