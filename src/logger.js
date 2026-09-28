/// <reference types="@fastly/js-compute" />
// Structured logging to Datadog. Every line is JSON with Datadog reserved
// attributes (ddsource/service/ddtags) so it lands under service:fastly-edge-demo.
import { Logger } from "fastly:logger";
import { env } from "fastly:env";

const ENDPOINT = "datadog"; // must match `fastly logging datadog create --name`
const SERVICE = "fastly-edge-demo";

const sink = new Logger(ENDPOINT);
const version = env("FASTLY_SERVICE_VERSION") || "local";
// Captured before the console hook below so emit() doesn't feed back into itself.
const stdout = console.log.bind(console);

function emit(level, message, fields) {
  const line = JSON.stringify({
    ddsource: "fastly",
    service: SERVICE,
    ddtags: `env:production,version:${version}`,
    date: new Date().toISOString(),
    level,
    message,
    ...fields,
  });
  sink.log(line); // -> Datadog
  stdout(line); // -> stdout, for `fastly log-tail`
}

export const log = {
  info: (message, fields) => emit("info", message, fields),
  warn: (message, fields) => emit("warn", message, fields),
  error: (message, fields) => emit("error", message, fields),
};

// The edge-delivery library has no log hook; it only writes
// "[OPTIMIZELY] - LEVEL <iso-time> message" lines to console.*. Forward those
// to Datadog as structured lines; anything else goes to the console unchanged.
const LIB_LINE = /^\[OPTIMIZELY\] - (\w+) \S+ ([\s\S]*)$/;
for (const method of ["debug", "info", "warn", "error", "log"]) {
  const original = console[method].bind(console);
  console[method] = (...args) => {
    const match = typeof args[0] === "string" && args[0].match(LIB_LINE);
    if (!match) return original(...args);
    emit(match[1].toLowerCase(), match[2], { logger: "edge-delivery" });
  };
}
