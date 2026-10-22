import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * One compile inside the sealed LaTeX service (toreview §111): a fresh temp dir, Tectonic with no
 * network and no insecure features, then Poppler for the page count and the PNG previews. One
 * wall-clock deadline covers all three processes; past it the running one is SIGKILLed.
 */

export interface RunOptions {
  tectonic: string;
  pdfinfo: string;
  pdftoppm: string;
  timeoutMs: number;
  dpi: number;
  maxPages: number;
  /** Paths Tectonic must treat as absent (the token file), on top of --untrusted. */
  hide: string[];
  /** The whole environment the children see. */
  env: Record<string, string>;
}

export interface RunOutput {
  pdf: Buffer;
  pages: number;
  pngs: Buffer[];
  ms: number;
}

export type RunResult =
  | { kind: 'ok'; output: RunOutput }
  | { kind: 'compile-error'; log: string[] }
  | { kind: 'too-many-pages'; pages: number }
  | { kind: 'timeout' };

/** The exact Tectonic 0.17 invocation: V2 CLI, no shell-escape or other unsafe features, cache only. */
export const tectonicArgs = (hide: string[]): string[] => ['-X', 'compile', 'main.tex', '--untrusted', '--only-cached', ...hide.flatMap((h) => ['--hide', h])];

interface Exit {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const KEEP = 64 * 1024;

function runProcess(cmd: string, args: string[], cwd: string, env: Record<string, string>, deadline: number): Promise<Exit> {
  return new Promise((resolve) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return resolve({ code: null, stdout: '', stderr: '', timedOut: true });
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d: Buffer) => (stdout = (stdout + d.toString('utf8')).slice(-KEEP)));
    child.stderr.on('data', (d: Buffer) => (stderr = (stderr + d.toString('utf8')).slice(-KEEP)));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, remaining);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}\n${err.message}`, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

/** Tectonic's last log lines, with no file system paths and none of the font-config noise. */
export function cleanLog(text: string, dir: string, lines = 20): string[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '' && !l.startsWith('Fontconfig') && !/^note: /.test(l) && !/^=+$/.test(l))
    .map((l) => l.split(dir).join('.').replace(/(?:\/[\w.@+-]+){2,}/g, '<path>'))
    .slice(-lines);
}

const pngIndex = (name: string): number | null => {
  const m = /^p-(\d+)\.png$/.exec(name);
  return m ? Number(m[1]) : null;
};

export async function runCompile(tex: string, opts: RunOptions): Promise<RunResult> {
  const started = Date.now();
  const deadline = started + opts.timeoutMs;
  const dir = await mkdtemp(join(tmpdir(), 'tex-'));
  const env = { ...opts.env, HOME: dir };
  try {
    await writeFile(join(dir, 'main.tex'), tex, 'utf8');
    const tec = await runProcess(opts.tectonic, tectonicArgs(opts.hide), dir, env, deadline);
    if (tec.timedOut) return { kind: 'timeout' };
    if (tec.code !== 0) return { kind: 'compile-error', log: cleanLog(`${tec.stdout}\n${tec.stderr}`, dir) };
    const pdf = await readFile(join(dir, 'main.pdf'));

    const info = await runProcess(opts.pdfinfo, ['main.pdf'], dir, env, deadline);
    if (info.timedOut) return { kind: 'timeout' };
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info.stdout)?.[1] ?? NaN);
    if (info.code !== 0 || !Number.isInteger(pages) || pages < 1) return { kind: 'compile-error', log: ['the PDF could not be read'] };
    if (pages > opts.maxPages) return { kind: 'too-many-pages', pages };

    const ppm = await runProcess(opts.pdftoppm, ['-r', String(opts.dpi), '-png', 'main.pdf', 'p'], dir, env, deadline);
    if (ppm.timedOut) return { kind: 'timeout' };
    if (ppm.code !== 0) return { kind: 'compile-error', log: ['the PDF could not be rendered to PNG'] };
    const names = (await readdir(dir))
      .map((n) => ({ n, i: pngIndex(n) }))
      .filter((x): x is { n: string; i: number } => x.i !== null)
      .sort((a, b) => a.i - b.i);
    const pngs = await Promise.all(names.map(({ n }) => readFile(join(dir, n))));
    if (pngs.length !== pages) return { kind: 'compile-error', log: [`rendered ${pngs.length} of ${pages} pages`] };
    return { kind: 'ok', output: { pdf, pages, pngs, ms: Date.now() - started } };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
