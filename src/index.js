/// <reference types="@fastly/js-compute" />
import "./optimizely-shims.js"; // must stay first: polyfills fetch/HTMLRewriter for the library
import { applyExperiments } from "@optimizely/edge-delivery";
import { Logger } from "fastly:logger";
import { env } from "fastly:env";

// Optimizely Web Experimentation project snippet.
const SNIPPET_ID = "5905767218282496";

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const version = env("FASTLY_SERVICE_VERSION") || "local";

  // Send a structured line to the Datadog logging endpoint (name must match `fastly logging datadog create --name`).
  // `ddsource`/`service` are Datadog reserved attributes — they drive the source and service facets,
  // so these logs show up under service:my-edge-demo like other services do.
  new Logger("datadog").log(JSON.stringify({
    ddsource: "fastly",
    service: "fastly-edge-demo",
    ddtags: `env:production,version:${version}`,
    date: new Date().toISOString(),
    method: event.request.method,
    url: event.request.url,
  }));

  // Compute sets no client-IP header; the library reads the visitor IP (IP targeting,
  // tracking) from X-Forwarded-For, so set it from the real connection.
  const request = new Request(event.request);
  request.headers.set("X-Forwarded-For", event.client.address);

  // The FetchEvent is a valid "context": the library only needs waitUntil() (tracking events).
  return applyExperiments(request, event, {
    snippetId: SNIPPET_ID,
    environment: "prod",
    logLevel: "info",
  });
}
