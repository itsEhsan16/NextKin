/**
 * Writes an export to the app's cache directory and hands back a uri the share sheet can take
 * (plan §Phase 9C: "Export resume", "Share application"). Both native modules are required
 * lazily and every path degrades to null, so a runtime without them still renders the screen
 * that offers the export instead of crashing on import.
 */

/** A path accepted by the File constructor: a uri string, or a Directory/File (both carry `uri`). */
type PathLike = string | { readonly uri: string };

/** The slice of expo-file-system's SDK 57 class API this file uses. */
type ManagedFile = {
  readonly uri: string;
  readonly exists: boolean;
  create(): void;
  write(text: string): void;
  delete(): void;
  move(destination: ManagedFile): Promise<void>;
};

type FileSystemModule = {
  File: (new (...parts: PathLike[]) => ManagedFile) & {
    /** SDK 57: downloads `url` to `destination` and resolves to the written file. */
    downloadFileAsync(url: string, destination: ManagedFile): Promise<ManagedFile>;
  };
  Paths: { cache: PathLike };
};

type PrintModule = {
  printToFileAsync(options: { html: string }): Promise<{ uri: string }>;
};

let cachedFileSystem: FileSystemModule | null | undefined;
let cachedPrint: PrintModule | null | undefined;

/**
 * Neither module is imported statically. This file lives in the @/lib barrel, so a module the
 * runtime happens not to ship would take down every route that imports anything from lib — the
 * same trap expo-notifications set in pushPermission.ts. Missing here means "no export", not a
 * red screen.
 */
function fileSystemModule(): FileSystemModule | null {
  if (cachedFileSystem !== undefined) return cachedFileSystem;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    cachedFileSystem = require('expo-file-system') as FileSystemModule;
  } catch {
    cachedFileSystem = null;
  }
  return cachedFileSystem;
}

function printModule(): PrintModule | null {
  if (cachedPrint !== undefined) return cachedPrint;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    cachedPrint = require('expo-print') as PrintModule;
  } catch {
    cachedPrint = null;
  }
  return cachedPrint;
}

/** A file on disk plus the name it should carry into the share sheet. */
export type WrittenFile = { uri: string; name: string };

/**
 * Writes `text` to `name` in the cache directory. The SDK 57 class API is deliberate: the
 * function API moved to 'expo-file-system/legacy' and is deprecated.
 */
export async function writeTextFile(name: string, text: string): Promise<WrittenFile | null> {
  const mod = fileSystemModule();
  if (!mod) return null;
  try {
    const { File, Paths } = mod;
    const file = new File(Paths.cache, name);
    // `create()` throws when the path is taken, so exporting the same document twice in a
    // session has to clear the previous copy rather than append to it.
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    return { uri: file.uri, name };
  } catch {
    return null;
  }
}

/**
 * Downloads an export from its presigned URL (V2 §7.12, C-07) into the cache directory under
 * `name`, the file the backend rendered. A previous copy under the same name is cleared first, as
 * `writeTextFile` does. Null when the download or the filesystem fails; the caller says so.
 */
export async function downloadFile(url: string, name: string): Promise<WrittenFile | null> {
  const mod = fileSystemModule();
  if (!mod) return null;
  try {
    const { File, Paths } = mod;
    const target = new File(Paths.cache, name);
    if (target.exists) target.delete();
    const written = await File.downloadFileAsync(url, target);
    return { uri: written.uri, name };
  } catch {
    return null;
  }
}

/**
 * Renders `html` to a PDF in the cache directory under `name`. Returns null only when printing
 * itself failed — see `renameToCache` for why the name is not worth failing over.
 */
export async function renderPdf(html: string, name: string): Promise<WrittenFile | null> {
  const mod = printModule();
  if (!mod) return null;
  let printed: string;
  try {
    printed = (await mod.printToFileAsync({ html })).uri;
  } catch {
    return null;
  }
  return { uri: (await renameToCache(printed, name)) ?? printed, name };
}

/**
 * expo-print writes to a cache file with a random name, which is what the share sheet would
 * show. Renaming it is best-effort on purpose: a PDF under a machine-generated filename is far
 * more use than no PDF, so a failed move (or a missing expo-file-system) falls back to the
 * printed uri instead of failing the export.
 */
async function renameToCache(uri: string, name: string): Promise<string | null> {
  const mod = fileSystemModule();
  if (!mod) return null;
  try {
    const { File, Paths } = mod;
    const target = new File(Paths.cache, name);
    if (target.exists) target.delete();
    await new File(uri).move(target);
    return target.uri;
  } catch {
    return null;
  }
}
