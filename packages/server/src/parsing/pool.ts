import { Worker } from 'node:worker_threads';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { UnreadableError, type Analysis, type FileKind } from './types';

/**
 * Parser isolation (ImBackendImplementationPlan P7-05). Every file is analysed in a fresh
 * `worker_threads` thread with a heap ceiling (`resourceLimits`) and a wall-clock timeout. Running
 * out of memory, crashing or hanging fails that file — with a message the user can act on — and
 * never the worker process or the next file.
 *
 * Under tsx and Vitest the thread loads the TypeScript source through tsx; the bundled image
 * (build.mjs) ships it as `parse-worker.mjs` beside the entrypoints.
 */

export interface IsolationLimits {
  timeoutMs: number;
  heapMb: number;
}

export const DEFAULT_LIMITS: IsolationLimits = { timeoutMs: 20_000, heapMb: 256 };

const PARSE_WORKER = 'parse-worker.mjs';

function workerTarget(): { url: URL; execArgv: string[] } {
  const here = import.meta.url;
  // Workers do not inherit a loader from execArgv, so in development a .mjs bootstrap registers tsx.
  if (here.endsWith('.ts')) return { url: new URL('./worker-dev.mjs', here), execArgv: [] };
  // Built from a path, not `new URL('./parse-worker.mjs', import.meta.url)`: Next's bundler resolves
  // that literal form at build time, and the file exists only beside the worker bundle. Uploads in
  // the web process never reach here (they enqueue), but the module is in its import graph.
  return { url: pathToFileURL(join(dirname(fileURLToPath(here)), PARSE_WORKER)), execArgv: [] };
}

export function analyzeIsolated(bytes: Uint8Array, options: { allowed?: readonly FileKind[]; limits?: Partial<IsolationLimits> } = {}): Promise<Analysis> {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const { url, execArgv } = workerTarget();
  return new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(url), {
      execArgv,
      resourceLimits: { maxOldGenerationSizeMb: limits.heapMb, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new UnreadableError('timeout', 'The file took too long to read. Try saving it again, or as a different format.'))), limits.timeoutMs);
    worker.once('message', (message: { ok: true; result: Analysis } | { ok: false; code: UnreadableError['code']; message: string }) =>
      finish(() => (message.ok ? resolve(message.result) : reject(new UnreadableError(message.code, message.message)))),
    );
    worker.once('error', (error) =>
      finish(() => reject(new UnreadableError((error as { code?: string }).code === 'ERR_WORKER_OUT_OF_MEMORY' ? 'too_large' : 'corrupt', 'The file could not be read.'))),
    );
    worker.once('exit', (code) => finish(() => reject(new UnreadableError(code === 0 ? 'corrupt' : 'too_large', 'The file could not be read.'))));
    const copy = bytes.slice();
    worker.postMessage({ bytes: copy, allowed: options.allowed ? [...options.allowed] : undefined }, [copy.buffer as ArrayBuffer]);
  });
}
