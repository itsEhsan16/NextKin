import { parentPort } from 'node:worker_threads';
import { analyze } from './analyzer';
import { UnreadableError, type FileKind } from './types';

/**
 * The parser thread (ImBackendImplementationPlan P7-05). It holds one file, analyses it, posts the
 * result and exits; `pool.ts` gives it a heap ceiling and a wall-clock limit, so a hostile file can
 * crash or hang this thread and nothing else.
 */
parentPort?.once('message', async (message: { bytes: Uint8Array; allowed?: FileKind[] }) => {
  try {
    const result = await analyze(message.bytes, { allowed: message.allowed });
    parentPort!.postMessage({ ok: true, result }, result.images.map((img) => img.data.buffer as ArrayBuffer));
  } catch (error) {
    const code = error instanceof UnreadableError ? error.code : 'corrupt';
    const text = error instanceof UnreadableError ? error.message : 'The file could not be read.';
    parentPort!.postMessage({ ok: false, code, message: text });
  }
});
