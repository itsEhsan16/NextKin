/**
 * exportFile requires expo-file-system and expo-print lazily and caches the result at module
 * scope, so every case resets the registry, re-mocks the two modules and re-requires the module
 * under test. The fake File records what was called on which uri, which is how the ordering
 * assertions (delete before create) and the best-effort rename are pinned.
 */

type ExportFile = typeof import('@/lib/exportFile');

type SetupOptions = {
  /** Cache uris the fake filesystem should report as already on disk. */
  existing?: string[];
  printed?: string;
  moveFails?: boolean;
  printFails?: boolean;
  downloadFails?: boolean;
  noFileSystem?: boolean;
  noPrint?: boolean;
};

type Harness = {
  ops: string[];
  printToFileAsync: jest.Mock;
  mod: ExportFile;
};

const CACHE = 'file:///cache';
const PRINTED = `${CACHE}/print-9f2c.pdf`;

function setup(options: SetupOptions = {}): Harness {
  const ops: string[] = [];
  const existing = new Set(options.existing ?? []);

  class FakeFile {
    static downloadFileAsync = jest.fn(async (url: string, destination: FakeFile) => {
      if (options.downloadFails) throw new Error('network down');
      ops.push(`download ${url} -> ${destination.uri}`);
      return destination;
    });

    readonly uri: string;

    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }

    get exists() {
      return existing.has(this.uri);
    }

    create = jest.fn(() => {
      ops.push(`create ${this.uri}`);
    });

    write = jest.fn((text: string) => {
      ops.push(`write ${this.uri} ${text}`);
    });

    delete = jest.fn(() => {
      existing.delete(this.uri);
      ops.push(`delete ${this.uri}`);
    });

    move = jest.fn(async (destination: FakeFile) => {
      if (options.moveFails) throw new Error('destination not writable');
      ops.push(`move ${this.uri} -> ${destination.uri}`);
    });
  }

  const printToFileAsync = jest.fn(async () => {
    if (options.printFails) throw new Error('print cancelled');
    return { uri: options.printed ?? PRINTED, numberOfPages: 1 };
  });

  jest.resetModules();
  jest.doMock('expo-file-system', () => {
    if (options.noFileSystem) throw new Error('expo-file-system unavailable');
    return { File: FakeFile, Paths: { cache: CACHE } };
  });
  jest.doMock('expo-print', () => {
    if (options.noPrint) throw new Error('expo-print unavailable');
    return { printToFileAsync };
  });

  // The module caches its own requires at module scope, so each case needs a fresh copy.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- re-required on purpose.
  const mod = require('@/lib/exportFile') as ExportFile;
  return { ops, printToFileAsync, mod };
}

afterEach(() => {
  jest.resetModules();
});

describe('writeTextFile', () => {
  it('creates the file in the cache directory and writes the text', async () => {
    const { ops, mod } = setup();

    const written = await mod.writeTextFile('resume.txt', 'Ada Lovelace');

    expect(written).toEqual({ uri: `${CACHE}/resume.txt`, name: 'resume.txt' });
    expect(ops).toEqual([`create ${CACHE}/resume.txt`, `write ${CACHE}/resume.txt Ada Lovelace`]);
  });

  it('deletes an existing file before rewriting it', async () => {
    const { ops, mod } = setup({ existing: [`${CACHE}/resume.txt`] });

    await mod.writeTextFile('resume.txt', 'second export');

    expect(ops).toEqual([
      `delete ${CACHE}/resume.txt`,
      `create ${CACHE}/resume.txt`,
      `write ${CACHE}/resume.txt second export`,
    ]);
  });
});

describe('renderPdf', () => {
  it('prints the html and returns the file renamed to the export name', async () => {
    const { ops, printToFileAsync, mod } = setup();

    const rendered = await mod.renderPdf('<html>ATS score</html>', 'resume.pdf');

    expect(printToFileAsync).toHaveBeenCalledWith({ html: '<html>ATS score</html>' });
    expect(rendered).toEqual({ uri: `${CACHE}/resume.pdf`, name: 'resume.pdf' });
    expect(ops).toEqual([`move ${PRINTED} -> ${CACHE}/resume.pdf`]);
  });

  it('keeps the printed uri when the rename fails', async () => {
    const { mod } = setup({ moveFails: true });

    const rendered = await mod.renderPdf('<html>ATS score</html>', 'resume.pdf');

    expect(rendered).toEqual({ uri: PRINTED, name: 'resume.pdf' });
  });

  it('keeps the printed uri when expo-file-system is unavailable', async () => {
    const { mod } = setup({ noFileSystem: true });

    const rendered = await mod.renderPdf('<html>ATS score</html>', 'resume.pdf');

    expect(rendered).toEqual({ uri: PRINTED, name: 'resume.pdf' });
  });

  it('returns null when printing itself fails', async () => {
    const { mod } = setup({ printFails: true });

    await expect(mod.renderPdf('<html>ATS score</html>', 'resume.pdf')).resolves.toBeNull();
  });
});

describe('without the native modules', () => {
  it('returns null from both functions instead of throwing', async () => {
    const { mod } = setup({ noFileSystem: true, noPrint: true });

    await expect(mod.writeTextFile('resume.txt', 'Ada Lovelace')).resolves.toBeNull();
    await expect(mod.renderPdf('<html>ATS score</html>', 'resume.pdf')).resolves.toBeNull();
  });
});

describe('downloadFile', () => {
  const URL = 'https://exports.example/users/u/exports/v/e.pdf?X-Amz-Expires=900';

  it('downloads the presigned export into the cache under its own name, clearing an earlier copy', async () => {
    const target = `${CACHE}/Jane_Muller_Engineer.pdf`;
    const { ops, mod } = setup({ existing: [target] });

    const written = await mod.downloadFile(URL, 'Jane_Muller_Engineer.pdf');

    expect(written).toEqual({ uri: target, name: 'Jane_Muller_Engineer.pdf' });
    expect(ops).toEqual([`delete ${target}`, `download ${URL} -> ${target}`]);
  });

  it('returns null when the download fails or the module is missing', async () => {
    await expect(setup({ downloadFails: true }).mod.downloadFile(URL, 'a.pdf')).resolves.toBeNull();
    await expect(setup({ noFileSystem: true }).mod.downloadFile(URL, 'a.pdf')).resolves.toBeNull();
  });
});
