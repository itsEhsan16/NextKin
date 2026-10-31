// Bundles the server's process entrypoints into self-contained files for the container image
// (ImBackendImplementationPlan P1-07). The web entry is not built here: Next compiles the API into
// its standalone output. playwright-core, pdfjs-dist and tesseract.js stay external because they load
// files at runtime (a browser, a PDF worker script, WASM and language data); the image installs them
// next to the bundle at pinned versions.
//
// `node build.mjs` bundles every entry; `node build.mjs latex-service latex-relay latex-warmup`
// bundles only the named ones (the `latex` image needs none of the worker's dependencies).
import { build } from 'esbuild';

const all = {
  worker: 'src/entrypoints/worker.ts',
  migrate: 'src/entrypoints/migrate.ts',
  // Ships in the migrate image so the AWS demo can seed itself (toreview §133).
  seed: 'src/entrypoints/seed.ts',
  'dlq-replay': 'src/entrypoints/dlq.ts',
  'render-check': 'src/entrypoints/render-check.ts',
  // The isolated parser thread (P7-05); pool.ts loads it from beside the worker bundle.
  'parse-worker': 'src/parsing/worker.ts',
  // The sealed LaTeX compile service, its TCP relay and the image's cache warm-up (toreview §111).
  'latex-service': 'src/entrypoints/latex-service.ts',
  'latex-relay': 'src/entrypoints/latex-relay.ts',
  'latex-warmup': 'src/entrypoints/latex-warmup.ts',
};
const names = process.argv.slice(2);
const unknown = names.filter((n) => !(n in all));
if (unknown.length) throw new Error(`unknown entry: ${unknown.join(', ')}`);

await build({
  entryPoints: names.length ? Object.fromEntries(names.map((n) => [n, all[n]])) : all,
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // @node-rs/argon2 (the local identity provider's hashing, reached by `seed`) is a native addon;
  // the migrate image installs it beside the bundle.
  external: ['playwright-core', 'pdfjs-dist', 'tesseract.js', '@node-rs/argon2'],
  // Bundled CommonJS dependencies (pg, the AWS SDK) still call require(); give ESM one.
  banner: {
    js: "import { createRequire as __nkCreateRequire } from 'node:module'; const require = __nkCreateRequire(import.meta.url);",
  },
  logLevel: 'info',
});
