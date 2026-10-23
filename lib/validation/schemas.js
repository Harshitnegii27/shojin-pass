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

export const ScanIdSchema = z.string().uuid();

// POST /api/scan/{id}/explain — body optional; lang defaults to the scan's language.
export const ExplainBodySchema = z.object({ lang: lang.optional() }).strict();

// POST /api/scan/{id}/feedback. 'unclear' added in stage 4 (migration 002).
export const FEEDBACK_KINDS = ['wrong_verdict', 'unclear', 'unreadable', 'helpful'];
export const FeedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  note: z.string().max(500).optional(),
}).strict();

export const ProfilePutSchema = z.object({
  preset: preset.optional(),
  options: options.optional(),
  lang: lang.optional(),
}).strict();

// ── Stage 5 ────────────────────────────────────────────────────────────────

// POST /api/chef-card (spec 13.11): one diet, or { members } for everyone at the table.
// dishNameJa: at most 40 characters of Japanese text only.
export const DISH_NAME_JA = /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々・ 　]+$/u;
const member = z.object({ preset, options: options.optional() }).strict();
export const ChefCardSchema = z.object({
  preset: preset.optional(),
  options: options.optional(),
  members: z.array(member).min(1).max(8).optional(),
  dishNameJa: z.string().trim().min(1).max(40).regex(DISH_NAME_JA).optional(),
}).strict().refine((b) => (b.preset === undefined) !== (b.members === undefined), {
  message: 'Send either preset (and options) or members, not both.',
});

// Query strings arrive as text. options may repeat or be comma-separated (split before parsing).
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().startsWith(d));

// GET /api/routes (spec 13.9)
export const RoutesQuerySchema = z.object({ preset: preset.optional() }).strict();

// GET /api/routes/{slug} (spec 13.9)
export const RouteQuerySchema = z.object({
  preset: preset.optional(),
  options: options.optional(),
  date: isoDate.optional(),
}).strict();
export const SlugSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);

// GET /api/venues (spec 13.10)
export const VenuesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(20000).optional(),
  preset: preset.optional(),
}).strict();

// URLSearchParams -> plain object for the schemas above (repeated or comma-separated options).
export function queryObject(searchParams) {
  const out = {};
  for (const key of new Set(searchParams.keys())) {
    if (key === 'options') out.options = searchParams.getAll('options').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
    else out[key] = searchParams.get(key);
  }
  return out;
}
