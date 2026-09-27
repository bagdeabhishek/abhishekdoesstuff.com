# Live API and Coolify

Read this reference when a page consumes changing data, uses server-sent events, introduces a runtime environment variable, or requires deployment troubleshooting.

## Public proxy boundary

Treat `server.js` as the security boundary between public visitors and private upstream services.

- Keep the upstream URL server-side and configurable through an environment variable with a safe site-specific default.
- Accept only `http:` or `https:` upstream URLs and disable redirects.
- Set an abort timeout and response byte limit.
- Require the expected content type before parsing.
- Validate the top-level shape, collection length, field types, ranges, timestamps, and string lengths.
- Build a fresh response containing only explicitly public fields. Do not spread or forward the upstream object.
- Return a small generic `502` or `504` response and log only an error code, never upstream payloads or sensitive URLs.
- Send live responses with `cache-control: no-store`.

The project must not expose LAN IPs, usernames, mounts, process names, kernel arguments, container IDs, service lists, internal ports, microphone/source identifiers, clip paths, audio paths, or other private infrastructure details.

## Server-sent events

For an SSE proxy:

- Validate `text/event-stream` before opening the downstream response.
- Parse bounded events and emit only recognized event types with reconstructed public payloads.
- Ignore malformed upstream events without echoing their contents.
- Send an initial `ready` event, periodic comment heartbeats, `no-store`, and `x-accel-buffering: no`.
- Abort the upstream fetch when the browser disconnects.
- Bound the buffered event size so an unterminated event cannot consume unbounded memory.
- For `HEAD`, return without holding a stream open.

Verify the initial connection with a bounded streaming request, for example:

```bash
curl -N --max-time 10 http://127.0.0.1:3000/api/example/stream
```

## Runtime environment variables

Adding a variable in the Coolify interface is insufficient when this app is deployed through `docker-compose.yaml`; the service must explicitly receive it.

Wire the same variable through all applicable layers:

1. Read it in `server.js`, with a deliberate default only if one is appropriate.
2. Add it to `docker-compose.yaml` under `services.web.environment`, normally as `${NAME:-default}` so Coolify can override it.
3. Add a Dockerfile `ENV` default only when direct image runs should share that default.
4. Document it in `README.md` without exposing credentials.

Never put secrets in client JavaScript, HTML, the repository, or public error bodies.

## Diagnose from the serving network

When the public API is empty or returns an upstream error:

1. Request the upstream directly from the deployment host or container network, not only from a laptop on the LAN.
2. Confirm address, port, path, content type, and representative schema.
3. Confirm the configured environment value reached the running container.
4. Request the same-origin public endpoint and compare only the expected public fields.
5. Check application logs for the proxy's structured error code.

An upstream that works from another device may still be unreachable from Docker because routing and firewall paths differ.

## Understand the Coolify webhook

Pushing the tracked branch triggers GitHub's Coolify hook at `/_coolify/github-hook`. HTTP 200 means Coolify accepted the hook, not that the new image is serving. When inspecting delivery details, use the response payload's deployment UUID to find the actual deployment log.

The first failing command in that log is usually the useful one. In particular:

```text
fatal: unable to access 'https://github.com/...': Could not resolve host: github.com
```

means the Coolify helper container could not resolve DNS on the deployment host. It is not a repository, branch, or webhook configuration error. Fix Docker/host DNS or connectivity, then redeploy the queued commit.

Do not change Coolify settings or host networking without explicit authorization.

## Production verification

After the deployment reports success:

- Confirm Coolify built the intended Git commit.
- Request the canonical production page and look for a unique marker from the change.
- Request its stylesheet, script, media, and public API routes.
- Confirm the no-slash redirect and security/cache headers.
- Exercise the live stream long enough to receive `ready` or a sanitized failure event.
- If a CDN may be serving an old page, compare response headers and use a cache-busting query. Bypass DNS with `curl --resolve` only when the origin address is already explicitly in scope.

If production still serves old content, report whether the push, webhook, build, container start, origin response, or CDN layer is the last confirmed success. Do not describe the site as deployed until the production marker is visible.
