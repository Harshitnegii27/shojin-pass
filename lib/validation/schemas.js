// Every Zod schema for request input (spec 16.1: strict, unknown fields rejected).
// Preset and option names are checked against the rulebook separately (resolveProfile / checkDiet).

import { z } from 'zod';
import { LANGS } from '../text/templates.js';

const preset = z.string().min(1).max(40);
const options = z.array(z.string().min(1).max(40)).max(10);
const lang = z.enum(LANGS);

// The app sends the diet it keeps in localStorage with every scan, so scans work without Supabase.
// preset and options go together: options are only read when preset is given.
export const TextScanSchema = z.object({
  text: z.string().min(1).max(4000),
  preset: preset.optional(),
  options: options.optional(),
  lang: lang.optional(),
}).strict();

// Form fields that come with a photo (multipart). `options` may repeat.
export const ScanFieldsSchema = z.object({
  preset: preset.optional(),
  options: options.optional(),
  lang: lang.optional(),
}).strict();

export const ProfilePutSchema = z.object({
  preset: preset.optional(),
  options: options.optional(),
  lang: lang.optional(),
}).strict();
