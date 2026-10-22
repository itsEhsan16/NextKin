import { loadLatexServiceConfig } from '../config/latexService';
import { runCompile } from '../export/latex/service/run';
import { createLatexService } from '../export/latex/service/server';

/**
 * The sealed LaTeX compile service (docker/Dockerfile target `latex`, compose profile `latex`,
 * toreview §111). Runs in a container with no outbound network, a read-only root and only /tmp
 * writable; Tectonic reads its TeX files from the cache the image build filled.
 */

const config = loadLatexServiceConfig();
const log = (event: Record<string, unknown>) => console.log(JSON.stringify({ time: new Date().toISOString(), service: 'latex', ...event }));

const childEnv: Record<string, string> = {
  PATH: '/usr/local/bin:/usr/bin:/bin',
  LANG: 'C.UTF-8',
  ...(config.TECTONIC_CACHE_DIR ? { TECTONIC_CACHE_DIR: config.TECTONIC_CACHE_DIR } : {}),
  ...(config.FONTCONFIG_FILE ? { FONTCONFIG_FILE: config.FONTCONFIG_FILE } : {}),
};

const server = createLatexService({
  token: config.token,
  maxBytes: config.LATEX_MAX_BYTES,
  concurrency: config.LATEX_CONCURRENCY,
  queue: config.LATEX_QUEUE,
  log,
  compile: (tex) =>
    runCompile(tex, {
      tectonic: config.TECTONIC_BIN,
      pdfinfo: config.PDFINFO_BIN,
      pdftoppm: config.PDFTOPPM_BIN,
      timeoutMs: config.LATEX_TIMEOUT_MS,
      dpi: config.LATEX_DPI,
      maxPages: config.LATEX_MAX_PAGES,
      // The token file is the one secret in the container: a source can never \input it.
      hide: [config.LATEX_TOKEN_FILE],
      env: childEnv,
    }),
});

server.listen(config.LATEX_PORT, config.LATEX_HOST, () => log({ msg: 'listening', port: config.LATEX_PORT }));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    log({ msg: 'stopping', signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 20_000).unref();
  });
}
