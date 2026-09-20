# Island MCP Server

MCP server for [Island](https://www.island.io/)'s Enterprise Browser Management API - administrator actions, browser/session audit events, compromised-credential detections, and device inventory - for AI assistants and the WYRE Conduit gateway.

## Scope: 4 read-only tools, one per documented resource group

This connector implements exactly the four resource groups Island documents for its v1 Management API: **Admin Actions**, **Audit** (Island's own endpoint name for this is `timeline`), **Compromised Credential**, and **Device**. Island also documents a fifth resource, **User**, which is deliberately out of scope for this connector (not requested; can be added as a follow-up).

Two of the four - Compromised Credential and Device - are `POST`-with-body operations on Island's own API rather than plain `GET`s. Neither mutates anything: both are filtered/searched reads that happen to take their filter parameters in a JSON body instead of a query string, the same "`POST` for a filtered read, not a mutation" shape this gateway's UniFi connector already uses for its ISP-metrics query tool. No tool in this connector calls a `PATCH`/`PUT`/`DELETE` endpoint, and none reaches Island's broader Management Console surface (policy CRUD, user/browser-configuration-policy management) - see `src/client.ts`, which implements only these four read operations.

**Island's authoritative API reference (`documentation.island.io/apidocs`) redirects to an authenticated customer portal and was not accessible for this build.** Endpoint paths, the `Api-Key` header name, the request/response shape, and the default base URL below were all confirmed independently against a different, publicly-readable source: [`criblpacks/cribl-island-browser-rest-io`](https://github.com/criblpacks/cribl-island-browser-rest-io), a published third-party log-collector integration whose repository ships real, executable REST-collector job definitions (`default/jobs.yml`) against Island's live API - not marketing copy or a prose guess. Response body field names are **not** independently confirmed from any source and are passed through exactly as Island returns them (see `IslandApiResponse` in `src/types.ts`) rather than re-modeled into a guessed shape.

## Base URL

Every endpoint below is confirmed at a single fixed host: `https://management.island.io/api`, taken verbatim from that Cribl pack's `island_browser_api_base_url` variable, which its own five REST-collector jobs all reference. This connector uses that as the default and lets a customer override it via an optional `baseUrl`/`ISLAND_BASE_URL` field, in case a given tenant is provisioned on a different host - a second, lower-confidence source (a third-party SIEM-integration doc, prose only, not executable config) describes the host as `https://api.<company>.island.io`, which this connector could not independently confirm or rule out. State plainly: the fixed-host reading is the better-evidenced one and is what ships as the default; the override exists specifically to not silently break a tenant for which it's wrong.

## Authentication

Island's Management API authenticates with a static **API key**, generated in the Island Management Console under **Modules > Platform Settings > System Settings > Integrations > API > + Create**. There is no OAuth flow - this connector only ever holds a live API key, sent as Island's own custom `Api-Key` header (not `Authorization: Bearer`). In gateway mode the key arrives per-request via the `X-Island-Api-Key` header; in local/stdio mode it's read once from `ISLAND_API_KEY`.

### Credential scope: what "Read Only" actually restricts

Two separate claims here, at deliberately different confidence levels - don't collapse them into one "read-only" statement:

- **Structurally verified (checked directly, stated with full confidence):** this connector's own code makes zero mutating calls. Every function in `client.ts` calls one of the four read operations above; no `PATCH`/`PUT`/`DELETE` call exists anywhere in `src/`, and no policy/user/browser-configuration-management endpoint is referenced under any name.
- **Vendor-documented, not independently verified (hedged deliberately):** Island's API-key creation dialog offers a "Read Only" role alongside "Full Admin"/"System Admin" - so some server-side scoping evidently exists - but Island's authoritative documentation of what that role actually restricts sits behind the same customer-only login noted above, and was not accessible to confirm independently. Whether "Read Only" genuinely blocks server-side access to Island's broader Management API surface (policy CRUD, user management, browser configuration policies - none of which this connector implements or calls) versus being a UI-level label has not been tested. **Do not read this connector, or this README, as having established what the underlying API key can or cannot do if a non-Read-Only role were selected** - only that this connector's own code never attempts anything beyond the four reads above, regardless of which role the customer's key was issued with.

## Configuration

| Env var | Description |
|---|---|
| `ISLAND_API_KEY` | API key issued by the Island Management Console, sent as the `Api-Key` header. |
| `ISLAND_BASE_URL` | Optional override of the Management API base URL. Defaults to `https://management.island.io/api` - see Base URL above. |
| `MCP_TRANSPORT` | `stdio` (default) or `http`. |
| `AUTH_MODE` | `env` (default, reads the vars above) or `gateway` (credentials arrive per-request via `X-Island-Api-Key`/`X-Island-Base-URL`, injected by the Conduit gateway). |
| `CONDUIT_S2S_SECRET` | When set, the HTTP transport requires a valid `X-Gateway-S2S` header (Conduit sidecar auth) on every `/mcp` request. |
| `LOG_LEVEL` | `debug` \| `info` (default) \| `warn` \| `error`. |

## Tools

All four tools are classified `isAdmin: true` in the Conduit gateway - every resource group here is security/compliance-sensitive (who administrators are and what they changed, browser audit trail, detected compromised credentials, and the managed device inventory) even though every one of them is a plain read.

### Admin Actions
- `island_list_admin_actions` - list actions taken by administrators in the Island Management Console (policy changes, user/role changes) within a time window, offset-paginated.

### Audit
- `island_list_audit_events` - list browser/session audit events (navigation, file transfer, clipboard, print, policy-enforcement events) within a time window, offset-paginated. Island's own endpoint name for this is `timeline`.

### Compromised Credential
- `island_list_compromised_credentials` - list credentials Island has detected as compromised within a time window. `POST`-with-body on Island's own API (a filtered read, not a mutation - see Scope above). At least one third-party integrator's published collector config notes this endpoint's offset pagination as unreliable in practice (returning the same page regardless of offset); treat `limit`/`offset` as best-effort here for the same reason.

### Device
- `island_list_devices` - list devices running Island Browser under this account, optionally filtered to devices last seen at/after a given time, sortable by field. `POST`-with-body on Island's own API (a filtered read, not a mutation - see Scope above).

## Excluded, by design

**Hard-excluded (out of this connector's requested scope, not a technical block):**
- The **User** resource (`GET /external/v1/users` on Island's API) - Island documents this alongside the four implemented here; not requested for this connector. Can be added as a follow-up, after a deliberate scope decision.

**Hard-excluded (write/provisioning - Island's broader Management API, never implemented):**
- Policy create/read/update/delete, policy-element management, and browser-configuration-policy management. This connector's four tools cover only the read-only data endpoints documented for Admin Actions, Audit, Compromised Credential, and Device; it does not implement any endpoint that creates, updates, or deletes a policy, user, or browser configuration.

They can be added as a follow-up if there's demand, after a deliberate scope decision - not by default.

## Development

```bash
npm install
npm run build
npm test
npm run lint   # tsc --noEmit
```

## Docker

```bash
docker build -t island-mcp .
docker run -p 8080:8080 -e ISLAND_API_KEY=... island-mcp
```

## License

Apache-2.0
