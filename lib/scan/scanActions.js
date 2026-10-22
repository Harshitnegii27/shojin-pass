// What the explain and feedback routes do, outside the route files (spec 4, rule 7).
// Ownership is checked by loading the scan with the USER's client: row security returns nothing
// for someone else's scan, and that is answered exactly like a missing scan (404).

import 'server-only';
import { serverRulebook } from '../config/rulebook.js';
import { getOwnScan, saveFeedback } from '../db/scans.js';
import { AppError } from '../http/errors.js';
import { explainScan } from '../llm/explain.js';

async function ownScan(user, scanId, deps) {
  const scan = await (deps.getOwnScan || getOwnScan)(user.client, scanId);
  if (!scan) throw new AppError('NOT_FOUND');
  return scan;
}

export async function explainOwnScan({ user, scanId, lang }, deps = {}) {
  const scan = await ownScan(user, scanId, deps);
  const usedLang = lang || scan.language || 'en';
  const r = await explainScan({ scan, user, lang: usedLang, rulebook: deps.rulebook || serverRulebook() }, deps);
  return { scanId, lang: usedLang, ...r };
}

// Control characters removed; empty notes become null.
const cleanNote = (s) => {
  const t = (s || '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim();
  return t || null;
};

export async function recordFeedback({ user, scanId, kind, note }, deps = {}) {
  const scan = await ownScan(user, scanId, deps);
  const priority = kind === 'wrong_verdict' && scan.verdict === 'green'; // possible false safe: reviewed first
  await (deps.saveFeedback || saveFeedback)({ scanId, userId: user.id, kind, note: cleanNote(note), priority });
  return { scanId, kind, saved: true, priority };
}
