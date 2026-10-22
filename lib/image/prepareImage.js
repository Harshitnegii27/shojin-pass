// Step 2 of a photo scan (spec 9.2): check the real file type and size, fix rotation, remove ALL
// metadata (EXIF, GPS, ICC, XMP), and produce a JPEG that the OCR reads well. Everything happens
// in memory; the photo is never written anywhere.

import 'server-only';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../http/errors.js';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;  // spec 13.2: "Photo must be under 4 MB."
export const MIN_LONG_SIDE = 600;                 // smaller photos are too small to read (422)
export const MAX_LONG_SIDE = 2048;                // plenty for label text; well inside Azure's limits
const MAX_INPUT_PIXELS = 50_000_000;              // refuse decompression bombs
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

// sharp's prebuilt binaries cannot decode iPhone HEIC (HEVC), so it is decoded in WebAssembly.
// libheif applies the HEIF rotation boxes while decoding.
async function decodeHeic(buffer) {
  const { default: decode } = await import('heic-decode');
  const { width, height, data } = await decode({ buffer });
  return sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels: 4 } });
}

// Returns { buffer (JPEG), width, height, sourceType }. Throws AppError with
// IMAGE_TOO_LARGE (413), UNSUPPORTED_IMAGE (415) or IMAGE_TOO_SMALL (422).
// deps.decodeHeic is for tests.
export async function prepareImage(input, deps = {}) {
  if (!input?.length) throw new AppError('UNSUPPORTED_IMAGE');
  if (input.length > MAX_IMAGE_BYTES) throw new AppError('IMAGE_TOO_LARGE');

  const type = await fileTypeFromBuffer(input); // from the bytes, never the file name or header
  if (!type || !ACCEPTED.has(type.mime)) throw new AppError('UNSUPPORTED_IMAGE');

  try {
    const heic = type.mime === 'image/heic' || type.mime === 'image/heif';
    const img = heic
      ? await (deps.decodeHeic || decodeHeic)(input)
      : sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate(); // EXIF orientation

    const { data, info } = await img
      .resize({ width: MAX_LONG_SIDE, height: MAX_LONG_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })      // transparent PNG -> white, not black
      .jpeg({ quality: 90, mozjpeg: true })     // no withMetadata(): every metadata block is dropped
      .toBuffer({ resolveWithObject: true });

    if (Math.max(info.width, info.height) < MIN_LONG_SIDE) throw new AppError('IMAGE_TOO_SMALL');
    return { buffer: data, width: info.width, height: info.height, sourceType: type.mime };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (/pixel limit/i.test(String(err?.message))) throw new AppError('IMAGE_TOO_LARGE');
    throw new AppError('UNSUPPORTED_IMAGE'); // corrupt or undecodable file
  }
}
