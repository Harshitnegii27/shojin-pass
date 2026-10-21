// Every Zod schema for request input (spec 16.1: strict, unknown fields rejected).
// Presets are checked against the rulebook by resolveProfile(), which rejects unknown ones (400).

import { z } from 'zod';
import { LANGS } from '../text/templates.js';

export const TextScanSchema = z.object({
  text: z.string().min(1).max(4000),
  preset: z.string().min(1).max(40).optional(),
  lang: z.enum(LANGS).optional(),
}).strict();
