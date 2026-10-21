// The standard reply shapes (spec 13.1). Async because the request id comes from the request headers.

import { headers } from 'next/headers';
import { ProfileError } from '../diet/resolveProfile.js';
import { AppError, ERRORS } from './errors.js';

// Say UTF-8 explicitly: some clients (Windows PowerShell 5.1) otherwise misread Japanese and Hindi.
const JSON_TYPE = { 'content-type': 'application/json; charset=utf-8' };

async function requestId() {
  const h = await headers();
  return h.get('x-vercel-id') || crypto.randomUUID();
}

export async function ok(data, meta = {}) {
  return Response.json({ data, meta: { requestId: await requestId(), ...meta } }, { headers: JSON_TYPE });
}

// details: optional extra fields for the app, e.g. { retryAfterSec } or { detail }.
export async function fail(code, details) {
  const e = ERRORS[code] || ERRORS.INTERNAL_ERROR;
  const body = {
    error: { code: ERRORS[code] ? code : 'INTERNAL_ERROR', message: e.message, ...details },
    meta: { requestId: await requestId() },
  };
  const headers = { ...JSON_TYPE };
  if (details?.retryAfterSec) headers['Retry-After'] = String(details.retryAfterSec);
  return Response.json(body, { status: e.status, headers });
}

export async function handleError(err) {
  if (err instanceof AppError) return fail(err.code, err.details);
  if (err instanceof ProfileError) return fail('INVALID_REQUEST', { detail: err.message });
  const id = await requestId();
  // Never log label text, profiles or keys (spec 16.2): only the id and the stack.
  console.error(JSON.stringify({ requestId: id, level: 'error', stack: String(err?.stack || err) }));
  return fail('INTERNAL_ERROR');
}
