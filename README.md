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

Copy [`.env.example`](.env.example) and set the variables below. Leave `CONDUIT_S2S_SECRET` empty in that file.

| Env var | Required | Description |
|---|---|---|
| `ISLAND_API_KEY` | For stdio and `AUTH_MODE=env` | API key issued by the Island Management Console, sent as the `Api-Key` header. |
| `ISLAND_BASE_URL` | No | Optional override of the Management API base URL. Defaults to `https://management.island.io/api` - see Base URL above. |
| `MCP_TRANSPORT` | No | `stdio` (default) or `http`. |
| `AUTH_MODE` | No | `gateway` (Docker image and Compose) or `env`. Gateway mode requires `X-Island-Api-Key` on each `/mcp` request (`X-Island-Base-URL` is optional) and never falls back to `ISLAND_API_KEY`. `env` uses that variable only after S2S auth succeeds. Unset means `env` (stdio and single-tenant HTTP). |
| `CONDUIT_S2S_SECRET` | Yes for HTTP | Service-to-service secret. The HTTP server logs an error and exits non-zero when this is empty or a known placeholder (`changeme`, `secret`, `replace-me`, `replace-with-a-real-secret`, and the other example values). Generate one with `openssl rand -hex 32`. Compose will not start without it. The value is never logged. |
| `MCP_ALLOW_INSECURE_DEV` | No | Set to exactly `1` only for local development to start HTTP without `CONDUIT_S2S_SECRET`. The process logs a warning, does not enforce `X-Gateway-S2S`, and binds `127.0.0.1` only. A non-loopback `MCP_HTTP_HOST` refuses to start. A known placeholder secret still refuses to start. |
| `MCP_HTTP_HOST` | No | Bind address when a real `CONDUIT_S2S_SECRET` is set. Unset keeps `0.0.0.0`, the historical container bind. The image and Compose set `0.0.0.0` inside the container. |
| `MCP_HTTP_PORT` | No | HTTP port. Defaults to `8080`. |
| `LOG_LEVEL` | No | `debug` \| `info` (default) \| `warn` \| `error`. |

`/health` and `/healthz` stay unauthenticated and do not read credentials. The stdio transport does not use `CONDUIT_S2S_SECRET`.

### HTTP authentication

With `MCP_TRANSPORT=http` and `CONDUIT_S2S_SECRET` set, every `/mcp` request must include `X-Gateway-S2S`. The check is `verifyS2sHeader` in [`src/s2s-verify.ts`](src/s2s-verify.ts): the header value is `t=<unix seconds>,v1=<hex>`, where the hex is HMAC-SHA256 of the literal string `t=<unix seconds>` keyed with `CONDUIT_S2S_SECRET` (64 lowercase hex characters). The timestamp must be within 300 seconds of the server clock. A missing or invalid header is HTTP 401, before vendor credentials are read.

```bash
TS=$(date +%s)
SIG=$(printf 't=%s' "$TS" | openssl dgst -sha256 -hmac "$CONDUIT_S2S_SECRET" -hex | awk '{print $NF}')
curl -sS http://127.0.0.1:8080/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "X-Gateway-S2S: t=${TS},v1=${SIG}" \
  -H "X-Island-Api-Key: $ISLAND_API_KEY" \
  -H "X-Island-Base-URL: $ISLAND_BASE_URL" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

In `AUTH_MODE=gateway`, `/mcp` also requires `X-Island-Api-Key`. That header is the only API-key source for that request. `X-Island-Base-URL` is optional. `AUTH_MODE=env` still requires the signed `X-Gateway-S2S` header, then uses `ISLAND_API_KEY` and `ISLAND_BASE_URL` from the environment.

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

The image listens on `0.0.0.0` inside the container (`MCP_HTTP_HOST`) and defaults to `AUTH_MODE=gateway`. Publish the port on loopback and pass a real S2S secret (`openssl rand -hex 32`). In gateway mode, Island credentials arrive on each request as headers; they are not read from the environment. Do not pass the placeholder `your-s2s-secret` — startup rejects known placeholders.

```bash
docker build -t island-mcp .
docker run \
  -e CONDUIT_S2S_SECRET="$CONDUIT_S2S_SECRET" \
  -p 127.0.0.1:8080:8080 \
  island-mcp
```

Compose refuses to start when `CONDUIT_S2S_SECRET` is unset. The gateway service sets `AUTH_MODE=gateway`, does not inject `ISLAND_API_KEY` or `ISLAND_BASE_URL`, and publishes `127.0.0.1:8080:8080`:

```bash
CONDUIT_S2S_SECRET="$CONDUIT_S2S_SECRET" docker compose up
```

Single-tenant HTTP (`AUTH_MODE=env`) still requires the S2S secret, then uses `ISLAND_API_KEY`:

```bash
docker run \
  -e CONDUIT_S2S_SECRET="$CONDUIT_S2S_SECRET" \
  -e AUTH_MODE=env \
  -e ISLAND_API_KEY="$ISLAND_API_KEY" \
  -e ISLAND_BASE_URL=https://management.island.io/api \
  -p 127.0.0.1:8080:8080 \
  island-mcp
```

Local HTTP without a secret is development-only. It binds `127.0.0.1` and logs a warning. A non-loopback `MCP_HTTP_HOST` makes startup exit:

```bash
MCP_TRANSPORT=http MCP_HTTP_HOST=127.0.0.1 MCP_ALLOW_INSECURE_DEV=1 npm run start:http
```

## License

Apache-2.0
