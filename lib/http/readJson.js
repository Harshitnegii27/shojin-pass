// Reads an optional JSON body: empty -> {}, invalid -> AppError INVALID_REQUEST.

import { AppError } from './errors.js';

export async function readOptionalJson(req) {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('INVALID_REQUEST', { detail: 'Body must be JSON.' });
  }
}
