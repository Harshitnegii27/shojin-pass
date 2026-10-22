// POST /api/scan — label photo -> verdict (spec 13.4).
// multipart/form-data: image (required), preset, options (repeatable), lang.
// A session is optional, as for text scans: without one (or if Supabase is down) the verdict is
// still returned, just not saved. OCR problems come back as `retake` with status 200.

import { getUser } from '@/lib/auth/getUser';
import { ok, fail, handleError } from '@/lib/http/respond';
import { MAX_IMAGE_BYTES } from '@/lib/image/prepareImage';
import { ScanFieldsSchema } from '@/lib/validation/schemas';
import { runScan } from '@/lib/scan/scanService';

export const runtime = 'nodejs';
export const maxDuration = 15;
const FORM_OVERHEAD = 64 * 1024;

export async function POST(req) {
  try {
    if (!(req.headers.get('content-type') || '').includes('multipart/form-data')) {
      return fail('INVALID_REQUEST', { detail: 'Send the photo as multipart/form-data with an "image" field.' });
    }
    if (Number(req.headers.get('content-length')) > MAX_IMAGE_BYTES + FORM_OVERHEAD) return fail('IMAGE_TOO_LARGE');

    let form;
    try {
      form = await req.formData();
    } catch {
      return fail('INVALID_REQUEST', { detail: 'Could not read the form.' });
    }
    const image = form.get('image');
    if (!image || typeof image === 'string') return fail('INVALID_REQUEST', { detail: 'Missing "image" file.' });
    if (image.size > MAX_IMAGE_BYTES) return fail('IMAGE_TOO_LARGE');

    const options = form.getAll('options').filter((o) => typeof o === 'string' && o);
    const fields = ScanFieldsSchema.safeParse({
      preset: form.get('preset') || undefined,
      options: options.length ? options : undefined,
      lang: form.get('lang') || undefined,
    });
    if (!fields.success) return fail('INVALID_REQUEST', { detail: 'Expected preset?, options?, lang?.' });

    const buffer = Buffer.from(await image.arrayBuffer());
    const user = await getUser();
    const result = await runScan({ input: { kind: 'photo', buffer }, user, ...fields.data });
    return ok(result, { rulebookVersion: result.rulebookVersion });
  } catch (err) {
    return handleError(err);
  }
}
