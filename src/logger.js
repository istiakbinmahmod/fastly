/// <reference types="@fastly/js-compute" />
// Structured logging to Datadog. Every line is JSON with Datadog reserved
// attributes (ddsource/service/ddtags) so it lands under service:fastly-edge-demo.
import { Logger } from "fastly:logger";
import { env } from "fastly:env";

const ENDPOINT = "datadog"; // must match `fastly logging datadog create --name`
const SERVICE = "fastly-edge-demo";

const sink = new Logger(ENDPOINT);
const version = env("FASTLY_SERVICE_VERSION") || "local";

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
  console.log(line); // -> stdout, for `fastly log-tail`
}

export const log = {
  info: (message, fields) => emit("info", message, fields),
  warn: (message, fields) => emit("warn", message, fields),
  error: (message, fields) => emit("error", message, fields),
};
