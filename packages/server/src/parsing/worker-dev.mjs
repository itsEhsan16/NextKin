// Development and test entry for the parser thread (pool.ts): registers tsx's loader in this
// thread, then loads the TypeScript worker. The bundled image uses parse-worker.mjs instead.
import { register } from 'tsx/esm/api';

register();
await import('./worker.ts');
