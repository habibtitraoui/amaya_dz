import 'server-only';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AppError } from '@/lib/errors';

/**
 * Neon Object Storage — S3-compatible bucket living in the same Neon project
 * as Postgres (5 GB free). Images are stored as plain HTTPS URLs, so the
 * schema never changes: `ProductImage.url`, `Category.image` and
 * `ProductVariant.image` just hold the returned string.
 */

const EXT_BY_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
};

/** Vercel caps request bodies around 4.5 MB — stay safely under it. */
const MAX_BYTES = 4 * 1024 * 1024;

type StorageConfig = {
  s3: S3Client;
  bucket: string;
  endpoint: string;
};

function config(): StorageConfig {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/+$/, '');
  const bucket = process.env.NEON_STORAGE_BUCKET;
  if (!endpoint || !bucket) {
    throw new AppError(
      'INTERNAL',
      'Object Storage is not configured — set AWS_ENDPOINT_URL_S3 and NEON_STORAGE_BUCKET',
      500,
    );
  }
  const s3 = new S3Client({
    region: process.env.AWS_REGION || 'eu-central-1',
    endpoint,
    // Neon's branch storage endpoint requires path-style addressing.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });
  return { s3, bucket, endpoint };
}

/**
 * Upload one image file and return its public HTTPS URL.
 * The bucket must be created with `access: 'public_read'` (storefront
 * visitors load these URLs without credentials).
 */
export async function uploadImage(file: File): Promise<string> {
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    throw new AppError(
      'VALIDATION',
      'Unsupported image type — use WebP, JPEG, PNG or AVIF',
      422,
    );
  }
  if (file.size > MAX_BYTES) {
    throw new AppError('VALIDATION', 'Image too large — maximum 4 MB', 422);
  }
  if (file.size === 0) {
    throw new AppError('VALIDATION', 'Empty file', 422);
  }

  const { s3, bucket, endpoint } = config();
  const key = `media/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
      // Bucket-level `public_read` makes the object anonymous-readable;
      // no object ACL is needed (and Neon ignores canned ACLs).
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return `${endpoint}/${bucket}/${key}`;
}
