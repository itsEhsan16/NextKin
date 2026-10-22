/**
 * Hands a rendered document to the browser's print dialog, where "Save as PDF" writes the file:
 * the web half of mobile's `@/lib/exportFile`. The repo returns render inputs rather than bytes
 * (V2 §7.12 has the real API render on the worker tier and hand back a presigned URL), so until
 * that lands the browser does the rendering.
 *
 * A hidden frame rather than a new window, so no pop-up blocker gets a say; it goes once the
 * dialog closes. The dialog proposes the document's title as the file name, so the title is set
 * to §7.12's `FirstName_LastName_JobTitle`.
 */
export function printDocument(html: string, fileName: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.className = 'pointer-events-none fixed left-0 top-0 size-0 border-0 opacity-0';
  frame.addEventListener(
    'load',
    () => {
      const win = frame.contentWindow;
      if (!win) {
        frame.remove();
        return;
      }
      win.document.title = fileName.replace(/\.[^.]+$/, '');
      win.addEventListener('afterprint', () => frame.remove(), { once: true });
      win.focus();
      win.print();
    },
    { once: true },
  );
  frame.srcdoc = html;
  document.body.append(frame);
}
