'use client';

/**
 * Client-side image upload: downscale + re-encode to WebP in the browser,
 * then POST to `/api/admin/uploads` (Neon Object Storage). Keeps payloads
 * around 100–200 KB so we stay well under Vercel's ~4.5 MB request cap.
 */

const MAX_DIMENSION = 1600;
const TARGET_QUALITY = 0.82;

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Re-encode an image to a reasonably sized WebP; falls back to the original file. */
async function optimize(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', TARGET_QUALITY),
    );
    if (!blob) return file;
    // Only swap when we actually shrink the payload.
    if (blob.size >= file.size && file.size < 500 * 1024) return file;
    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${name}.webp`, { type: 'image/webp' });
  } catch {
    return file;
  }
}

/**
 * Upload one image and return its public URL, or an error message.
 * `onProgress` is optional (kept simple: no XHR progress events).
 */
export async function uploadImageFile(file: File): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Fichier non image accepté' };
  }
  const optimized = await optimize(file);
  const data = new FormData();
  data.append('file', optimized);

  try {
    const response = await fetch('/api/admin/uploads', { method: 'POST', body: data });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; url?: string; error?: { message?: string } }
      | null;
    if (response.ok && payload?.ok && payload.url) {
      return { ok: true, url: payload.url };
    }
    return { ok: false, error: payload?.error?.message ?? `Upload failed (${response.status})` };
  } catch {
    return { ok: false, error: 'Network error during upload' };
  }
}
