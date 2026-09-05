/** File picking for resume upload and document attachment (plan §Phase 9A). */

export type DocumentKind = 'pdf' | 'docx' | 'txt';
export type PickedDocument = { name: string; uri: string; mimeType?: string; size?: number };

const DOCUMENT_MIME: Record<DocumentKind, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

/** The slice of expo-document-picker's SDK 57 surface this wrapper uses. */
type DocumentAsset = { uri: string; name: string; size?: number; mimeType?: string };
type DocumentResult =
  { canceled: true; assets: null } | { canceled: false; assets: DocumentAsset[] };
type DocumentPickerModule = {
  getDocumentAsync(options: {
    type: string[];
    copyToCacheDirectory: boolean;
    multiple: boolean;
  }): Promise<DocumentResult>;
};

let cached: DocumentPickerModule | null | undefined;

/**
 * expo-document-picker is required lazily, never imported statically: this file is re-exported
 * from the @/lib barrel that every screen imports, so a static import of a native module would
 * take down every route (and every Jest suite) the moment that module is unavailable. The shape
 * above is declared structurally for the same reason — the barrel keeps zero import-time coupling
 * to the expo package.
 */
function documentPickerModule(): DocumentPickerModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    cached = require('expo-document-picker') as DocumentPickerModule;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Opens the system file browser filtered to `kinds`. Every failure path — cancel, an empty
 * result, a missing module, a throw from the native side — degrades to null so a caller only
 * ever has to branch on "did the user give me a file".
 */
export async function pickDocument(kinds: readonly DocumentKind[]): Promise<PickedDocument | null> {
  const module = documentPickerModule();
  if (!module) return null;
  try {
    const result = await module.getDocumentAsync({
      type: kinds.map((kind) => DOCUMENT_MIME[kind]),
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    return { name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size };
  } catch {
    return null;
  }
}
