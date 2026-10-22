/**
 * The PDFs handed to the share sheet since the app started, by document id → file name. COVER 04
 * shows the tailored resume as saved only when it really was in this session; otherwise that row
 * offers its own Save. In memory on purpose: "saved" means "this run of the app handed it off",
 * and nothing on the device can say where the share sheet put it.
 */
const exported = new Map<string, string>();

export function markExported(documentId: string, fileName: string): void {
  exported.set(documentId, fileName);
}

export function exportedFileName(documentId: string): string | undefined {
  return exported.get(documentId);
}

/** Tests start from an app that has exported nothing. */
export function resetSessionExports(): void {
  exported.clear();
}
