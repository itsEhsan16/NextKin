import { createConnection, isIP, type AddressInfo, type Socket } from 'node:net';
import { createServer, request, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { PUBLIC_WEB, type LinkPolicy } from './address';
import { guardedLookup } from './fetchPage';

/**
 * The browser's only way out (toreview §144.3). Chromium runs with this as its proxy, so every
 * request a page makes, down to the last image, passes the same address check as the first fetch.
 * It resolves a name once, here, so a page cannot pass the check and then rebind its name to a
 * private address. Only the web's ports go through. It listens on loopback, for the browser alone.
 */

export interface GuardProxy {
  port: number;
  close(): Promise<void>;
}

function refuse(socket: Socket): void {
  socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
}

export function startGuardProxy(policy: LinkPolicy = PUBLIC_WEB): Promise<GuardProxy> {
  const lookup = guardedLookup(policy.allowAddress);
  // A socket given an address never calls `lookup`, so a literal is checked here.
  const hostAllowed = (host: string): boolean => {
    const bare = host.replace(/^\[|\]$/g, '');
    return bare !== '' && (isIP(bare) === 0 || policy.allowAddress(bare));
  };

  const plain = (req: IncomingMessage, res: ServerResponse): void => {
    let target: URL;
    try {
      target = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (target.protocol !== 'http:' || !hostAllowed(target.hostname) || !policy.allowPort(Number(target.port || 80))) {
      res.writeHead(403).end();
      return;
    }
    const outbound = request(target, { method: req.method, headers: req.headers, agent: false, lookup: lookup as never }, (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    });
    outbound.on('error', () => {
      if (!res.headersSent) res.writeHead(403);
      res.end();
    });
    req.pipe(outbound);
  };

  const server: Server = createServer(plain);

  server.on('connect', (req, client: Socket, head: Buffer) => {
    const separator = req.url?.lastIndexOf(':') ?? -1;
    const host = req.url?.slice(0, separator).replace(/^\[|\]$/g, '') ?? '';
    const port = Number(req.url?.slice(separator + 1));
    client.on('error', () => client.destroy());
    if (!hostAllowed(host) || !policy.allowPort(port)) return refuse(client);
    const upstream = createConnection({ host, port, lookup: lookup as never });
    upstream.once('connect', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on('error', () => refuse(client));
    client.on('close', () => upstream.destroy());
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: (server.address() as AddressInfo).port,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}
