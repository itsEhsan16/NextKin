import { createHash } from 'node:crypto';
import type { Config } from '../config';
import type { Database } from '../db/database';
import type { UploadRouteDeps } from '../http/routes/uploads';
import { createS3Storage, type StoragePort } from './storage';

/**
 * Storage and the upload limits for a process, from configuration (P7). The web process uses it
 * for presign, confirm, the avatar and the teaser; the worker adds the scanner and OCR.
 */
export function buildStorage(config: Config): StoragePort {
  return createS3Storage({ region: config.AWS_REGION, endpoint: config.S3_ENDPOINT, forcePathStyle: config.S3_FORCE_PATH_STYLE });
}

/** The teaser keeps only a salted hash of the IP; the salt derives from a secret every environment has. */
export const teaserSalt = (config: Config) => createHash('sha256').update(`teaser-ip:${config.CURSOR_SECRET}`).digest('hex');

export function buildFileDeps(config: Config, db: Database, storage: StoragePort = buildStorage(config)): Omit<UploadRouteDeps, 'db' | 'signAvatar'> {
  const limits = { documentBytes: config.UPLOAD_MAX_BYTES, avatarBytes: config.AVATAR_MAX_BYTES };
  return {
    uploads: { db, storage, bucket: config.S3_BUCKET_UPLOADS, limits },
    teaser: {
      db,
      storage,
      anonymousBucket: config.S3_BUCKET_ANONYMOUS,
      uploadsBucket: config.S3_BUCKET_UPLOADS,
      maxBytes: config.UPLOAD_MAX_BYTES,
      perIpPerHour: config.TEASER_PER_IP_PER_HOUR,
      ipSalt: teaserSalt(config),
    },
  };
}
