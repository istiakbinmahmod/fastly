// Makes @optimizely/edge-delivery (written for Cloudflare Workers) run on Fastly Compute.
// Import this before calling applyExperiments. Once the library ships its own
// Fastly entry point (`@optimizely/edge-delivery/fastly`), this file goes away.

/// <reference types="@fastly/js-compute" />
import { HTMLRewritingStream } from "fastly:html-rewriter";

// Hostname -> Fastly backend name. Any other host (i.e. this service's own
// hostname, used by the library for the "control" fetch) goes to the origin.
// Every backend here must exist in fastly.toml (local) and on the service (prod).
export const ORIGIN_BACKEND = "github_pages";
const BACKENDS = {
  "cdn.optimizely.com": "optimizely_cdn", // datafile
  "logx.optimizely.com": "optimizely_logx", // tracking events
};

// 1. fetch(): Fastly has no default egress, so route every library fetch to a
// named backend. Origin responses are forced to gzip and decompressed so the
// HTML rewriter sees plain HTML (Fastly can only auto-decompress gzip).
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const req = new Request(input, init);
  const backend = BACKENDS[new URL(req.url).hostname] ?? ORIGIN_BACKEND;
  if (backend === ORIGIN_BACKEND) req.headers.set("Accept-Encoding", "gzip");
  return realFetch(req, { backend, fastly: { decompressGzip: true } });
};

// 2. Headers.getAll is Cloudflare-only; the library uses it for Set-Cookie.
if (!Headers.prototype.getAll) {
  Headers.prototype.getAll = function (name) {
    if (name.toLowerCase() === "set-cookie") return this.getSetCookie();
    const value = this.get(name);
    return value === null ? [] : [value];
  };
}

// 3. HTMLRewriter: Cloudflare's API (on(selector, {element}) + transform(response))
// on top of Fastly's HTMLRewritingStream (same lol-html engine, different shape).
// Cloudflare escapes content unless {html: true}; Fastly inserts raw HTML unless {escapeHTML: true}.
const toFastlyOpts = (opts) => (opts?.html ? {} : { escapeHTML: true });

const wrapElement = (el) => ({
  get tagName() {
    return el.tag;
  },
  getAttribute: (name) => el.getAttribute(name),
  setAttribute: (name, value) => el.setAttribute(name, value),
  removeAttribute: (name) => el.removeAttribute(name),
  before: (content, opts) => el.before(content, toFastlyOpts(opts)),
  after: (content, opts) => el.after(content, toFastlyOpts(opts)),
  prepend: (content, opts) => el.prepend(content, toFastlyOpts(opts)),
  append: (content, opts) => el.append(content, toFastlyOpts(opts)),
  replace: (content, opts) => el.replaceWith(content, toFastlyOpts(opts)),
  setInnerContent: (content, opts) => el.replaceChildren(content, toFastlyOpts(opts)),
  remove: () => el.replaceWith(""),
});

class FastlyHTMLRewriter {
  #handlers = [];

  on(selector, handler) {
    this.#handlers.push([selector, handler]);
    return this;
  }

  transform(response) {
    const stream = new HTMLRewritingStream();
    for (const [selector, handler] of this.#handlers) {
      // ponytail: the library can't detect Fastly (runtime "unknown"), so it doesn't filter out
      // selectors lol-html rejects (~, +, ::). They're skipped here instead of deferred to the
      // browser; goes away once the library gets a Fastly runtime branch.
      try {
        stream.onElement(selector, (el) => handler.element?.(wrapElement(el)));
      } catch (e) {
        console.log(`[edge-delivery] skipping unsupported selector "${selector}": ${e.message}`);
      }
    }
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(response.body.pipeThrough(stream), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

globalThis.HTMLRewriter = FastlyHTMLRewriter;
