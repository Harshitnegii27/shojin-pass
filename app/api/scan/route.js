// POST /api/scan — label photo -> verdict (spec 13.4).
// multipart/form-data: image (required), preset, options (repeatable), lang.
// A session is optional, as for text scans: without one (or if Supabase is down) the verdict is
// still returned, just not saved. OCR problems come back as `retake` with status 200, and so does
// "busy" when too many photo scans arrive at once for the Azure free tier. Rate limit: 429.

import { getUser } from '@/lib/auth/getUser';
import { ok, fail, handleError } from '@/lib/http/respond';
import { limitRequest } from '@/lib/http/limitRequest';
import { reserveOcrScan } from '@/lib/http/rateLimit';
import { MAX_IMAGE_BYTES } from '@/lib/image/prepareImage';
import { ScanFieldsSchema } from '@/lib/validation/schemas';
import { runScan } from '@/lib/scan/scanService';

export const runtime = 'nodejs';
export const maxDuration = 15;
const FORM_OVERHEAD = 64 * 1024;

export async function POST(req) {
  try {
    // Before the photo is read, so a flood never costs OCR quota or memory.
    const user = await getUser();
    const limited = await limitRequest('scan', req, user);
    if (limited) return limited;

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
    const result = await runScan({ input: { kind: 'photo', buffer }, user, ...fields.data }, { reserveOcr: () => reserveOcrScan() });
    return ok(result, { rulebookVersion: result.rulebookVersion });
  } catch (err) {
    return handleError(err);
  }
}
