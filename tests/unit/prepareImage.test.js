// prepareImage: real file type, size limits, rotation, all metadata removed, resized for OCR.

import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { prepareImage, MAX_IMAGE_BYTES, MAX_LONG_SIDE } from '../../lib/image/prepareImage.js';

const solid = (width, height, background = '#808080', channels = 3) => sharp({ create: { width, height, channels, background } });
const code = async (p) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e.code;
  }
};

// A minimal HEIC header (ftyp box, brand "heic"): enough for the real-type check.
const HEIC_HEADER = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(4), Buffer.from('mif1heic')]);

describe('prepareImage', () => {
  it('applies EXIF rotation and removes all metadata, including GPS', async () => {
    const input = await solid(1200, 800).jpeg()
      .withExif({ IFD0: { Copyright: 'secret-owner-name', Make: 'TestCam' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '35/1 0/1 41/1' } })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const before = await sharp(input).metadata();
    expect(before.orientation).toBe(6);
    expect(before.exif).toBeDefined();
    expect(input.includes('secret-owner-name')).toBe(true);
    const gpsPointer = (exif) => exif.includes(Buffer.from([0x25, 0x88])) || exif.includes(Buffer.from([0x88, 0x25])); // tag 0x8825
    expect(gpsPointer(before.exif)).toBe(true);

    const out = await prepareImage(input);
    const after = await sharp(out.buffer).metadata();
    expect([after.width, after.height]).toEqual([800, 1200]); // rotated upright
    expect(after.format).toBe('jpeg');
    expect(after.exif).toBeUndefined();
    expect(after.orientation).toBeUndefined();
    expect(after.icc).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(out.buffer.includes('secret-owner-name')).toBe(false);
    expect(out.buffer.includes('Exif')).toBe(false); // no EXIF block at all, so no GPS block either
  });

  it('shrinks large photos to the OCR size and never enlarges small ones', async () => {
    const big = await prepareImage(await solid(4000, 3000).jpeg().toBuffer());
    expect([big.width, big.height]).toEqual([MAX_LONG_SIDE, 1536]);
    const mid = await prepareImage(await solid(1600, 1200).jpeg().toBuffer());
    expect([mid.width, mid.height]).toEqual([1600, 1200]);
  });

  it('accepts PNG (transparency becomes white) and WebP; output is always JPEG', async () => {
    const png = await prepareImage(await solid(900, 900, { r: 0, g: 0, b: 0, alpha: 0 }, 4).png().toBuffer());
    const { data } = await sharp(png.buffer).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]].every((v) => v > 240)).toBe(true);
    expect(png.sourceType).toBe('image/png');
    const webp = await prepareImage(await solid(900, 700).webp().toBuffer());
    expect(webp.sourceType).toBe('image/webp');
    expect((await sharp(webp.buffer).metadata()).format).toBe('jpeg');
  });

  it('HEIC is decoded by the HEIC decoder, then processed like any photo', async () => {
    const decodeHeic = vi.fn(async () => solid(1000, 1500));
    const out = await prepareImage(HEIC_HEADER, { decodeHeic });
    expect(decodeHeic).toHaveBeenCalledWith(HEIC_HEADER);
    expect(out).toMatchObject({ width: 1000, height: 1500, sourceType: 'image/heic' });
  });

  it('a HEIC file that cannot be decoded is unsupported, not a crash', async () => {
    expect(await code(prepareImage(HEIC_HEADER, { decodeHeic: async () => { throw new Error('bad heic'); } }))).toBe('UNSUPPORTED_IMAGE');
  });

  it('rejects types other than JPEG, PNG, WebP and HEIC by their real bytes', async () => {
    expect(await code(prepareImage(await solid(800, 800).gif().toBuffer()))).toBe('UNSUPPORTED_IMAGE');
    expect(await code(prepareImage(await solid(800, 800).avif().toBuffer()))).toBe('UNSUPPORTED_IMAGE');
    expect(await code(prepareImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')))).toBe('UNSUPPORTED_IMAGE');
    expect(await code(prepareImage(Buffer.from('原材料名：小麦粉')))).toBe('UNSUPPORTED_IMAGE');
    expect(await code(prepareImage(Buffer.alloc(0)))).toBe('UNSUPPORTED_IMAGE');
  });

  it('a corrupt (truncated) JPEG is unsupported', async () => {
    const jpeg = await solid(1200, 900).jpeg().toBuffer();
    expect(await code(prepareImage(jpeg.subarray(0, Math.floor(jpeg.length / 2))))).toBe('UNSUPPORTED_IMAGE');
  });

  it('files over 4 MB are too large; photos under 600 px are too small', async () => {
    expect(await code(prepareImage(Buffer.alloc(MAX_IMAGE_BYTES + 1, 0xff)))).toBe('IMAGE_TOO_LARGE');
    expect(await code(prepareImage(await solid(500, 400).jpeg().toBuffer()))).toBe('IMAGE_TOO_SMALL');
  });
});
