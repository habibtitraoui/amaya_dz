'use client';

/**
 * Client-side image pipeline: downscale + re-encode to WebP in the browser.
 *
 * Deferred-upload model: picking a file only *stages* it locally (optimized
 * File kept in memory + an object URL for preview) — nothing is sent to
 * Neon Object Storage until the user actually submits the form. The submit
 * handler uploads every staged file first, then saves with the returned URLs.
 */

const MAX_DIMENSION = 1600;
const TARGET_QUALITY = 0.82;

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/** A picked-but-not-yet-uploaded image: optimized locally, previewed via object URL. */
export type StagedImage = { file: File; previewUrl: string };

export type StageResult = { ok: true; image: StagedImage } | { ok: false; error: string };

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
 * Validate + optimize a picked file and build a local preview URL.
 * Nothing is sent to storage — call `uploadStagedImage` on submit.
 */
export async function stageImageFile(file: File): Promise<StageResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Fichier non image accepté' };
  }
  const optimized = await optimize(file);
  return { ok: true, image: { file: optimized, previewUrl: URL.createObjectURL(optimized) } };
}

/** Release a staged image's object URL. Safe to call with null/undefined. */
export function releaseStagedImage(image: StagedImage | null | undefined) {
  if (image?.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(image.previewUrl);
  }
}

/**
 * Upload a previously staged (already optimized) image and return its public
 * URL, or an error message. Does not revoke the preview URL — the caller
 * decides when the preview is no longer needed.
 */
export async function uploadStagedImage(image: StagedImage): Promise<UploadResult> {
  const data = new FormData();
  data.append('file', image.file);

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

/**
 * Upload one image in a single step (stage + upload + release preview).
 * Kept for callers that genuinely need an immediate upload; forms should
 * prefer staging on pick and uploading on submit instead.
 */
export async function uploadImageFile(file: File): Promise<UploadResult> {
  const staged = await stageImageFile(file);
  if (!staged.ok) return staged;
  const result = await uploadStagedImage(staged.image);
  releaseStagedImage(staged.image);
  return result;
}
