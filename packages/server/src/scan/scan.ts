import { connect } from 'node:net';

/**
 * The scan port (ImBackendImplementationPlan P7-03). Every upload is scanned before anything parses
 * or serves it; only `clean` releases it. Locally the adapter is ClamAV's `clamd` (the compose
 * `scan` profile), spoken to over its INSTREAM protocol so bytes never touch the worker's disk.
 * GuardDuty Malware Protection replaces it at X-05 and feeds the same handler.
 *
 * There is no "always clean" adapter outside unit tests: with clamd unreachable the verdict is
 * `failed`, the upload stays unreadable, and the user is told to try again.
 */

export type ScanVerdict = { verdict: 'clean' } | { verdict: 'infected'; signature: string } | { verdict: 'failed'; reason: string };

export interface ScanPort {
  scan(bytes: Uint8Array): Promise<ScanVerdict>;
  /** For health checks and the startup log. */
  ping(): Promise<boolean>;
}

const CHUNK = 64 * 1024;

export function createClamavScanner(options: { host: string; port: number; timeoutMs?: number }): ScanPort {
  const timeoutMs = options.timeoutMs ?? 30_000;

  function exchange(write: (socket: ReturnType<typeof connect>) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: options.host, port: options.port });
      let reply = '';
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('clamd timed out'));
      }, timeoutMs);
      socket.on('connect', () => write(socket));
      socket.on('data', (data) => (reply += data.toString('utf8')));
      socket.on('end', () => {
        clearTimeout(timer);
        resolve(reply.replace(/\0/g, '').trim());
      });
      socket.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  return {
    async scan(bytes) {
      try {
        const reply = await exchange((socket) => {
          socket.write('zINSTREAM\0');
          for (let offset = 0; offset < bytes.length; offset += CHUNK) {
            const part = bytes.subarray(offset, offset + CHUNK);
            const size = Buffer.alloc(4);
            size.writeUInt32BE(part.length);
            socket.write(size);
            socket.write(part);
          }
          socket.end(Buffer.alloc(4)); // a zero-length chunk ends the stream
        });
        // "stream: OK" | "stream: Eicar-Test-Signature FOUND" | "INSTREAM size limit exceeded. ERROR"
        if (/:\s*OK$/.test(reply)) return { verdict: 'clean' };
        const found = /:\s*(.+)\s+FOUND$/.exec(reply);
        if (found) return { verdict: 'infected', signature: found[1]!.trim().slice(0, 120) };
        return { verdict: 'failed', reason: reply.slice(0, 200) || 'empty reply' };
      } catch (error) {
        return { verdict: 'failed', reason: error instanceof Error ? error.message : 'unreachable' };
      }
    },
    async ping() {
      try {
        return (await exchange((socket) => socket.end('zPING\0'))) === 'PONG';
      } catch {
        return false;
      }
    },
  };
}

/** Unit tests only: a scanner that answers from a function. Never wired from configuration. */
export function createTestScanner(answer: (bytes: Uint8Array) => ScanVerdict): ScanPort {
  return { scan: async (bytes) => answer(bytes), ping: async () => true };
}
