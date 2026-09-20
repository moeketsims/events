/**
 * Client-side image preparation, shared by the event banner and the lot photos.
 *
 * A photo straight off a phone is 4–8 MB and 4000 px wide. Resizing it in the
 * browser to 1600 px on its longest edge (BUILD-SPEC §10, §11b) keeps every
 * upload under the Server Action body limit and keeps the free tier's storage
 * for pixels a projector can actually show. Runs only in the browser: it uses
 * `createImageBitmap` and a canvas.
 */

export const MAX_IMAGE_EDGE = 1600;
export const JPEG_QUALITY = 0.85;

/** Files at or under this size and already within the edge limit are sent as they are. */
const PASS_THROUGH_BYTES = 1_500_000;

/** Longest edge to 1600 px, re-encoded as JPEG. Returns the original if it is already small. */
export async function resizeImage(
  file: File,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  const maxEdge = options.maxEdge ?? MAX_IMAGE_EDGE;
  const quality = options.quality ?? JPEG_QUALITY;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));

  if (scale === 1 && file.size <= PASS_THROUGH_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) throw new Error('encode failed');

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}
