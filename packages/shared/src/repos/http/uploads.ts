import type { JdFile } from '../../models/jd';
import { presignResponseSchema, resumeParseSchema, uploadSchema, type ResumeParse, type Upload, type UploadPurpose } from '../../schemas/uploads';
import { ApiError, type HttpClient } from './client';

/**
 * Uploading from either app (ImBackendImplementationPlan P7-02): presign → POST straight to storage
 * → confirm, then wait for the scan or the parse. The POST to storage is the one step that differs
 * by platform, so each app supplies it:
 * - web: `fetch(file.uri)` on the `blob:` URL, then a FormData POST;
 * - mobile: expo-file-system's `File.upload` with `UploadType.MULTIPART` from the `file://` URI.
 * Phone-safe: no platform module is imported here.
 */

/** POSTs `file` to a presigned target: every field first, the file last as `file`. Throws on non-2xx. */
export type FileUploader = (target: { url: string; fields: Record<string, string> }, file: JdFile) => Promise<void>;

const UNREADABLE = 'We couldn’t read this file. Upload a PDF, Word (DOCX) or plain-text resume.';

/** The browser's uploader: the `blob:` URL is read back into a Blob and POSTed. */
export const browserUploader: FileUploader = async (target, file) => {
  const blob = await (await fetch(file.uri)).blob();
  const form = new FormData();
  for (const [name, value] of Object.entries(target.fields)) form.append(name, value);
  form.append('file', blob, file.name);
  const res = await fetch(target.url, { method: 'POST', body: form });
  if (!res.ok) throw new ApiError('VALIDATION_FAILED', 'The upload was refused. Check the file’s size and type.', res.status);
};

const guessType = (file: JdFile): string => {
  if (file.mimeType) return file.mimeType;
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'pdf' ? 'application/pdf' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'text/plain';
};

export async function uploadFile(http: HttpClient, uploader: FileUploader, purpose: UploadPurpose, file: JdFile): Promise<Upload> {
  let presigned;
  try {
    presigned = presignResponseSchema.parse(
      await http.request('/uploads/presign', { body: { purpose, fileName: file.name.slice(0, 255) || 'upload', contentType: guessType(file), size: file.size ?? 1 } }),
    );
  } catch (error) {
    // A type the purpose does not take is, to the reader, a file we cannot read.
    if (purpose !== 'avatar' && error instanceof ApiError && error.code === 'VALIDATION_FAILED') throw new ApiError('UNREADABLE_FILE', UNREADABLE, 422);
    throw error;
  }
  await uploader({ url: presigned.url, fields: presigned.fields }, file);
  return uploadSchema.parse(await http.request(`/uploads/${presigned.upload.id}/confirm`, { method: 'POST' }));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls until `done`, every `everyMs`, for at most `timeoutMs`. */
export async function poll<T>(read: () => Promise<T>, done: (value: T) => boolean, options: { everyMs?: number; timeoutMs?: number } = {}): Promise<T> {
  const deadline = Date.now() + (options.timeoutMs ?? 120_000);
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) throw new ApiError('UNAVAILABLE', 'This is taking longer than it should. Try again in a moment.', 503);
    await sleep(options.everyMs ?? 1000);
  }
}

export async function waitForScan(http: HttpClient, uploadId: string, options?: { everyMs?: number; timeoutMs?: number }): Promise<Upload> {
  const upload = await poll(async () => uploadSchema.parse(await http.request(`/uploads/${uploadId}`)), (u) => u.status !== 'scanning' && u.status !== 'pending', options);
  if (upload.status !== 'clean') throw new ApiError(upload.status === 'infected' ? 'VALIDATION_FAILED' : 'UNREADABLE_FILE', upload.error ?? UNREADABLE, 422);
  return upload;
}

/** Starts a parse and waits for its draft; an unreadable document becomes UNREADABLE_FILE. */
export async function parseResume(http: HttpClient, uploadId: string, options?: { everyMs?: number; timeoutMs?: number }): Promise<ResumeParse> {
  const started = resumeParseSchema.parse(await http.request('/resume-parse', { body: { uploadId } }));
  const done = await poll(async () => resumeParseSchema.parse(await http.request(`/resume-parse/${started.id}`)), (p) => p.status === 'ready' || p.status === 'failed', options);
  if (done.status === 'failed') throw new ApiError(done.errorCode === 'provider' ? 'UNAVAILABLE' : 'UNREADABLE_FILE', done.error ?? UNREADABLE, 422);
  return done;
}
