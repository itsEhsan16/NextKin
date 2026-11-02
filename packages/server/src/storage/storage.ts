import { randomUUID } from 'node:crypto';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * The storage port and its S3 adapter (ImBackendImplementationPlan P7-01; spec §9.4.3, G6).
 *
 * - **Uploads are presigned POSTs**, not PUTs: only a POST policy can enforce a maximum size
 *   (`content-length-range`), the exact declared content type, and the key. The stand-in's
 *   enforcement is proved by `s3PresignedPost.int.test.ts` (P1-04).
 * - **Keys are built here and bound to the user**: `users/<user_id>/uploads/<uuid>`. A client
 *   never chooses a key, and the policy refuses one outside the prefix.
 * - **Reads are presigned GETs of at most 15 minutes.**
 * - Infected objects move under `quarantine/`, which no application path ever presigns.
 */

export const MAX_PRESIGN_GET_SECONDS = 15 * 60;
const UPLOAD_POLICY_SECONDS = 10 * 60;

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
  expiresAt: string;
}

export interface StoragePort {
  presignPost(input: { bucket: string; key: string; contentType: string; maxBytes: number }): Promise<PresignedPost>;
  head(bucket: string, key: string): Promise<{ size: number; contentType: string | null } | null>;
  /** Reads a whole object, refusing one larger than `maxBytes`. */
  read(bucket: string, key: string, maxBytes: number): Promise<Uint8Array>;
  write(bucket: string, key: string, body: Uint8Array, contentType: string): Promise<void>;
  copy(from: { bucket: string; key: string }, to: { bucket: string; key: string }): Promise<void>;
  remove(bucket: string, key: string): Promise<void>;
  presignGet(bucket: string, key: string, options?: { seconds?: number; downloadName?: string }): Promise<string>;
}

export const userUploadKey = (userId: string) => `users/${userId}/uploads/${randomUUID()}`;
export const anonymousKey = () => `anonymous/${randomUUID()}`;
export const quarantineKey = (key: string) => `quarantine/${key}`;

/**
 * `publicEndpoint`: where a browser reaches storage, when that isn't where this process does. In Docker
 * the server talks to `seaweedfs:8333`, a name only containers resolve, so links handed to a browser
 * are signed for the laptop's address instead. Unset, both are the same.
 */
export function createS3Storage(options: { region: string; endpoint?: string; publicEndpoint?: string; forcePathStyle?: boolean }): StoragePort {
  const s3 = new S3Client({ region: options.region, endpoint: options.endpoint, forcePathStyle: options.forcePathStyle });
  const signer = options.publicEndpoint ? new S3Client({ region: options.region, endpoint: options.publicEndpoint, forcePathStyle: options.forcePathStyle }) : s3;
  return {
    async presignPost({ bucket, key, contentType, maxBytes }) {
      const { url, fields } = await createPresignedPost(signer, {
        Bucket: bucket,
        Key: key,
        Conditions: [
          ['content-length-range', 1, maxBytes],
          ['eq', '$Content-Type', contentType],
          ['eq', '$key', key],
        ],
        Fields: { 'Content-Type': contentType },
        Expires: UPLOAD_POLICY_SECONDS,
      });
      return { url, fields, expiresAt: new Date(Date.now() + UPLOAD_POLICY_SECONDS * 1000).toISOString() };
    },

    async head(bucket, key) {
      try {
        const result = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { size: Number(result.ContentLength ?? 0), contentType: result.ContentType ?? null };
      } catch {
        return null;
      }
    },

    async read(bucket, key, maxBytes) {
      const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (Number(result.ContentLength ?? 0) > maxBytes) throw new Error('object larger than allowed');
      const bytes = await result.Body!.transformToByteArray();
      if (bytes.length > maxBytes) throw new Error('object larger than allowed');
      return bytes;
    },

    async write(bucket, key, body, contentType) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },

    async copy(from, to) {
      await s3.send(new CopyObjectCommand({ Bucket: to.bucket, Key: to.key, CopySource: `${from.bucket}/${encodeURIComponent(from.key).replace(/%2F/g, '/')}` }));
    },

    async remove(bucket, key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    async presignGet(bucket, key, opts = {}) {
      if (key.startsWith('quarantine/')) throw new Error('quarantined objects are never presigned');
      const seconds = Math.min(opts.seconds ?? MAX_PRESIGN_GET_SECONDS, MAX_PRESIGN_GET_SECONDS);
      const disposition = opts.downloadName ? `attachment; filename="${opts.downloadName.replace(/["\\\r\n]/g, '')}"` : undefined;
      return getSignedUrl(signer, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: disposition }), { expiresIn: seconds });
    },
  };
}
