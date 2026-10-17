import { mgaBlob } from '@/mga/client';

/** MGA serves photos by id; the dialog uses this form, without the space the preview grid has. */
export const photoSrc = (imageId: string) => `/system/services/imagehandler.ashx?type=item&id=${imageId}`;

/** imagehandler.ashx says text/html for every photo, so the type comes from the file's first bytes. */
export function sniffImageType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

/** One of the user's own photos, read back from MGA so a relisted item can upload it again. */
export async function photoFromMga(imageId: string): Promise<File> {
  const blob = await mgaBlob(photoSrc(imageId));
  const type = sniffImageType(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
  if (!type) throw new Error('That photo could not be read');
  return new File([blob], `photo-${imageId}.${EXT[type]}`, { type });
}

export const MAX_SIDE = 2000;
const MAX_BYTES = 2 * 1024 * 1024;

/** Fits w by h inside max on its longer side, keeping the shape. */
export function scaledSize(w: number, h: number, max = MAX_SIDE) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/**
 * Phone photos are often 4000 px and several MB, and an upload of 1 MB already takes MGA about two
 * seconds. Large photos are scaled to 2000 px JPEG first; anything that cannot be decoded goes as is.
 */
export async function prepareUpload(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const { w, h } = scaledSize(bmp.width, bmp.height);
    if (w === bmp.width && file.size <= MAX_BYTES) {
      bmp.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
