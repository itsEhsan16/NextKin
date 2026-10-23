import { createConnection, createServer } from 'node:net';

import { loadLatexRelayConfig } from '../config/latexService';

/**
 * A plain TCP relay to the LaTeX compile service (compose service `latex-relay`, toreview §111).
 * On Docker Desktop a container on an `internal: true` network cannot publish a port, so a host
 * process (the worker in `pnpm worker`) cannot reach `latex` directly. This process sits on both
 * the internal network and a normal one and publishes only 127.0.0.1:8790; it parses nothing and
 * holds no secret (the bearer token passes through to the service, which checks it).
 */

const config = loadLatexRelayConfig();
const log = (event: Record<string, unknown>) => console.log(JSON.stringify({ time: new Date().toISOString(), service: 'latex-relay', ...event }));

const server = createServer((client) => {
  const upstream = createConnection({ host: config.LATEX_RELAY_TARGET_HOST, port: config.LATEX_RELAY_TARGET_PORT });
  const close = () => {
    client.destroy();
    upstream.destroy();
  };
  client.on('error', close);
  upstream.on('error', close);
  client.setTimeout(90_000, close);
  client.pipe(upstream).pipe(client);
});

server.listen(config.LATEX_RELAY_PORT, config.LATEX_RELAY_HOST, () => log({ msg: 'listening', port: config.LATEX_RELAY_PORT, target: `${config.LATEX_RELAY_TARGET_HOST}:${config.LATEX_RELAY_TARGET_PORT}` }));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
