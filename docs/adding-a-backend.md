# Adding a backend for `fetch`

Any host this Compute service calls with `fetch(url, { backend })` must be
declared as a **backend** first. There is no default egress — an undeclared
backend name throws at runtime.

A backend must be registered in **two** places:

1. **`fastly.toml`** → used by `fastly compute serve` (local dev only).
2. **The Fastly service** → used in production.

Both are required. Adding one without the other means it works locally but 404s
in prod, or vice versa.

---

## 1. Local: `fastly.toml`

Add an entry under `[local_server.backends]`. The table key is the backend
**name** you pass to `fetch`.

```toml
[local_server]

  [local_server.backends]

    [local_server.backends.github_pages]
      url = "https://istiakbinmahmod.github.io"
```

- `url` includes the scheme. `https://` implies TLS on port 443; no extra
  config needed locally.
- Restart `fastly compute serve` after editing.

## 2. Production: the Fastly service

Create the backend on the active service version. The active version is locked,
so `--autoclone` copies it into an editable version.

```bash
fastly backend create \
  --name github_pages \
  --address istiakbinmahmod.github.io \
  --port 443 \
  --service-id 4xcJEpXWuWl4SffL0eAYIo \
  --version active --autoclone \
  --use-ssl \
  --ssl-sni-hostname istiakbinmahmod.github.io \
  --ssl-cert-hostname istiakbinmahmod.github.io
```

This prints the **new version number** it cloned into (e.g. `version 8`).
Activate it:

```bash
fastly service-version activate --service-id 4xcJEpXWuWl4SffL0eAYIo --version <new#>
```

### TLS flags — required for port 443

`backend create` does **not** enable TLS by default. For an HTTPS origin you
must pass:

| Flag | Value | Why |
|---|---|---|
| `--use-ssl` | (none) | Turns on TLS to the origin |
| `--ssl-sni-hostname` | the hostname | SNI sent in the TLS handshake |
| `--ssl-cert-hostname` | the hostname | Hostname the origin cert is validated against |

Omit all three only for plain HTTP origins on port 80.

## 3. Use it in code

The `backend` name in `fetch` must match the name from both steps above.

```js
// src/index.js
if (url.pathname === "/selectors") {
  const upstream = await fetch("https://istiakbinmahmod.github.io/selectors.html", {
    backend: "github_pages",
  });
  return upstream;
}
```

## 4. Deploy

Local `serve` picks up code changes on rebuild. Production needs a publish:

```bash
fastly compute publish --service-id 4xcJEpXWuWl4SffL0eAYIo
```

---

## Verify

```bash
# Production backends on the active version
fastly backend list --service-id 4xcJEpXWuWl4SffL0eAYIo --version active

# Local
fastly compute serve   # then hit http://127.0.0.1:7676/<route>
```

## Notes

- The CLI prints `DEPRECATED: Use the 'service backend create' command instead.`
  — harmless. `fastly service backend create` takes the same flags.
- Backend names are per-service and case-sensitive.
- `originless` (127.0.0.1:80) is the starter-kit placeholder; leave it.
