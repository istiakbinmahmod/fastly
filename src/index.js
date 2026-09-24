//! Default Compute template program.

/// <reference types="@fastly/js-compute" />
// import { CacheOverride } from "fastly:cache-override";
import { Logger } from "fastly:logger";
import { HTMLRewritingStream } from "fastly:html-rewriter";
import { env } from "fastly:env";
import { includeBytes } from "fastly:experimental";

// Load a static file as a Uint8Array at compile time.
// File path is relative to root of project, not to this file
const welcomePage = includeBytes("./src/welcome-to-compute.html");

// The entry point for your application.
//
// Use this fetch event listener to define your main request handling logic. It could be
// used to route based on the request properties (such as method or path), send
// the request to a backend, make completely new requests, and/or generate
// synthetic responses.

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  // Log service version
  console.log("FASTLY_SERVICE_VERSION:", env('FASTLY_SERVICE_VERSION') || 'local');
  
  // Get the client request.
  const req = event.request;

  // Send a structured line to the Datadog logging endpoint (name must match `fastly logging datadog create --name`).
  // `ddsource`/`service` are Datadog reserved attributes — they drive the source and service facets,
  // so these logs show up under service:my-edge-demo like other services do.
  new Logger("datadog").log(JSON.stringify({
    ddsource: "fastly",
    service: "fastly-edge-demo",
    ddtags: `env:production,version:${env("FASTLY_SERVICE_VERSION") || "local"}`,
    date: new Date().toISOString(),
    method: req.method,
    url: req.url,
  }));

  // Filter requests that have unexpected methods.
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return new Response("This method is not allowed", {
      status: 405,
    });
  }

  const url = new URL(req.url);

  // Proxy /example to example.com.
  if (url.pathname === "/example") {
    return fetch("https://example.com/", { backend: "example" });
  }

  // Fetch selectors.html and rewrite it on the fly with HTMLRewritingStream.
  if (url.pathname === "/selectors") {
    const upstream = await fetch("https://istiakbinmahmod.github.io/selectors.html", {
      backend: "github_pages",
    });
    const rewriter = new HTMLRewritingStream()
      .onElement("title", (e) => e.replaceChildren("Rewritten via Fastly Compute"))
      .onElement("body", (e) =>
        e.prepend(
          '<div style="background:#27ae60;color:#fff;padding:12px;font-family:monospace;text-align:center">Modified at the edge by Fastly Compute</div>'
        )
      );
    return new Response(upstream.body.pipeThrough(rewriter), {
      status: upstream.status,
      headers: new Headers({ "Content-Type": "text/html; charset=utf-8" }),
    });
  }

  // If request is to the `/` path...
  if (url.pathname === "/") {
    // Below are some common patterns for Compute services using JavaScript.
    // Head to https://developer.fastly.com/learning/compute/javascript/ to discover more.

    // Create a new request.
    // const bereq = new Request("http://example.com");

    // Add request headers.
    // req.headers.set("X-Custom-Header", "Welcome to Compute!");
    // req.headers.set(
    //   "X-Another-Custom-Header",
    //   "Recommended reading: https://developer.fastly.com/learning/compute"
    // );

    // Create a cache override.
    // To use this, uncomment the import statement at the top of this file for CacheOverride.
    // const cacheOverride = new CacheOverride({ ttl: 60 });

    // Forward the request to a backend.
    // const beresp = await fetch(req, {
    //   backend: "backend_name",
    //   cacheOverride,
    // });

    // Remove response headers.
    // beresp.headers.delete("X-Another-Custom-Header");

    // Log to a Fastly endpoint.
    // To use this, uncomment the import statement at the top of this file for Logger.
    // const logger = new Logger("my_endpoint");
    // logger.log("Hello from the edge!");

    // Send a default synthetic response.
    return new Response(welcomePage, {
      status: 200,
      headers: new Headers({ "Content-Type": "text/html; charset=utf-8" }),
    });
  }

  // Catch all other requests and return a 404.
  return new Response("The page you requested could not be found", {
    status: 404,
  });
}
