# Datadog logging

This service ships structured logs to Datadog from Compute code via the
`fastly:logger` API. Setup has three parts: write logs in code, create the
Datadog endpoint on the service, deploy.

## 1. Code (already wired)

[`src/index.js`](../src/index.js) logs one JSON line per request:

```js
import { Logger } from "fastly:logger";

new Logger("datadog").log(JSON.stringify({
  ddsource: "fastly",          // -> Datadog "Source" facet
  service: "fastly-edge-demo", // -> Datadog "Service" facet
  ddtags: `env:production,version:${env("FASTLY_SERVICE_VERSION") || "local"}`,
  date: new Date().toISOString(),
  method: req.method,
  url: req.url,
}));
```

- The Logger **name** (`"datadog"`) MUST match the endpoint `--name` below.
- `ddsource`, `service`, `ddtags` are Datadog **reserved attributes** — they
  drive the Source/Service facets and tag filtering. Change `service` to rename
  how it appears in Datadog.
- For **Compute**, only what you pass to `Logger.log()` is sent. The endpoint's
  stored "Format" template does not apply (that's for VCL services).

## 2. Create the Datadog endpoint

### Get an API key
Datadog → **Organization Settings → API Keys** → New Key (an **API** key, not an
Application key). The key belongs to a specific Datadog org, and **that org's
region is what you configure below** — not the site in your browser URL.

### Region — the #1 gotcha
Fastly accepts only: **`US`, `US3`, `US5`, `EU`**.

| Datadog org site | Fastly `--region` |
|---|---|
| `datadoghq.com` (US1) | `US` |
| `us3.datadoghq.com` | `US3` |
| `us5.datadoghq.com` | `US5` |
| `datadoghq.eu` | `EU` |

An invalid value like `US1` is **accepted silently but drops all logs**. This
service uses **`US3`** (the org the API key belongs to).

### Command
```bash
export DD_API_KEY="<your-datadog-api-key>"

fastly logging datadog create \
  --service-id 4xcJEpXWuWl4SffL0eAYIo \
  --version active --autoclone \
  --name datadog \
  --region US3 \
  --auth-token "$DD_API_KEY"
# -> prints a new version number

fastly service-version activate --service-id 4xcJEpXWuWl4SffL0eAYIo --version <new#>
```

To change the region on an existing endpoint, use `update` instead of `create`:
```bash
fastly logging datadog update --service-id 4xcJEpXWuWl4SffL0eAYIo \
  --version active --autoclone --name datadog --region US3
fastly service-version activate --service-id 4xcJEpXWuWl4SffL0eAYIo --version <new#>
```

## 3. Deploy the code

```bash
make deploy   # fastly compute publish
```

The endpoint alone does nothing if the running package predates the `Logger`
line — always redeploy after touching the logging code.

## 4. Verify

Logs only fire on the **live** service (not `fastly compute serve`), and
delivery is batched (~1–2 min).

```bash
# Generate traffic
curl -s https://<service-domain>/ >/dev/null   # domain: `fastly domain list ... --version active`

# Then in Datadog (US3 site):
#   https://opti-exp.datadoghq.com/logs?query=service:fastly-edge-demo
```

Confirm the endpoint config any time:
```bash
fastly logging datadog describe --service-id 4xcJEpXWuWl4SffL0eAYIo --version active --name datadog
```

### If nothing arrives
1. **Wrong region** — must be `US3` here, not `US1`. Silent drop otherwise.
2. **Code not deployed** — redeploy (`make deploy`).
3. **Bad API key** — fails silently on Fastly's side; regenerate.
4. **Name mismatch** — endpoint `--name` must equal `new Logger("...")`.
5. **Too soon** — wait ~2 min.

Quick sanity check: `make logs` (live tail) while curling — if the request's
`console.log` line appears, your deployed code ran, so the `Logger` call did too.
