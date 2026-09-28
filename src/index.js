/// <reference types="@fastly/js-compute" />
import "./optimizely-shims.js"; // must stay first: polyfills fetch/HTMLRewriter for the library
import { applyExperiments } from "@optimizely/edge-delivery";
import { log } from "./logger.js";
import { env } from "fastly:env";

// Optimizely Web Experimentation project snippet.
const SNIPPET_ID = "5905767218282496";

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  log.info("request", { method: event.request.method, url: event.request.url });

  // Compute sets no client-IP header; the library reads the visitor IP (IP targeting,
  // tracking) from X-Forwarded-For, so set it from the real connection.
  const request = new Request(event.request);
  request.headers.set("X-Forwarded-For", event.client.address);

  // The FetchEvent is a valid "context": the library only needs waitUntil() (tracking events).
  const response = await applyExperiments(request, event, {
    snippetId: SNIPPET_ID,
    environment: "prod",
    logLevel: "info",
  });

  // Expose the id logged as request_id, so a request seen in the browser can be found in Datadog.
  const withId = new Response(response.body, response);
  withId.headers.set("x-request-id", env("FASTLY_TRACE_ID"));
  return withId;
}
