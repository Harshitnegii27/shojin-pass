// The rulebook as the server uses it: loaded once per instance from <project>/rulebook, with
// the unreviewed-entries switch taken from env.js (default false: every label is amber).
// The engine's own getRulebook() stays for scripts and tests.

import 'server-only';
import path from 'node:path';
import { buildRulebook, readRulebookFiles } from '../rulebook/loader.js';
import { env } from './env.js';

let cached = null;
export function serverRulebook() {
  if (!cached) {
    const dir = path.join(process.cwd(), 'rulebook');
    cached = buildRulebook(readRulebookFiles(dir), { allowUnreviewed: env.RULEBOOK_ALLOW_UNREVIEWED });
  }
  return cached;
}
