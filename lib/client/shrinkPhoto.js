// Browser only (spec 9.1): longest side 1600 px, JPEG quality 0.8. Re-drawing also applies the
// EXIF rotation and drops metadata before upload; the server does both again regardless.
// If the browser cannot decode the file (e.g. HEIC in Chrome), the original is sent as it is.

export const SHRINK_LONG_SIDE = 1600;

export async function shrinkPhoto(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, SHRINK_LONG_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return blob ? { blob, filename: 'label.jpg', shrunk: true } : { blob: file, filename: file.name, shrunk: false };
  } catch {
    return { blob: file, filename: file.name || 'label', shrunk: false };
  }
}
