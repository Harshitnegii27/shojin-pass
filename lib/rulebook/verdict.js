// THE verdict engine. Pure: no network, no clock, no randomness.
// Every rule can only move the colour towards caution; nothing turns amber or red into green.

export const RANK = { green: 0, amber: 1, red: 2 };

// Reason codes, most important first within each colour (used for ordering and messages).
export const REASONS = [
  'FORBIDDEN_INGREDIENT',
  'INCOMPLETE_LIST', 'NO_INGREDIENT_LIST', 'NO_INGREDIENTS_FOUND', 'STRUCTURE_UNCLEAR',
  'LOW_CONFIDENCE', 'UNKNOWN_TERM', 'HIDDEN_TERM', 'OUTSIDE_SECTION_TERM', 'SHARED_LINE', 'ASK_INGREDIENT',
];

export function colourForTags(tags, profile) {
  if (tags.some((t) => profile.forbid.has(t))) return 'red';
  if (tags.some((t) => profile.ask.has(t))) return 'amber';
  return 'green';
}

export function decideVerdict(input) {
  const {
    items = [], unknown = [], hidden = [], outside = [], lowConfidenceOther = [],
    completeness = 'complete', noList = false, headless = false, structureUnclear = false,
    sharedLine = false, realCount = 0, truncated = false, profile,
  } = input;
  if (!profile || !profile.forbid || !profile.ask) throw new Error('decideVerdict needs a resolved profile');

  const reasons = new Set();
  let worst = 'green';
  const bump = (c, reason) => {
    if (RANK[c] > RANK[worst]) worst = c;
    if (reason) reasons.add(reason);
  };

  const outItems = items.map((it) => {
    let colour = colourForTags(it.tags, profile);
    let reason = colour === 'red' ? 'FORBIDDEN_INGREDIENT' : colour === 'amber' ? 'ASK_INGREDIENT' : null;
    if (colour === 'green' && it.lowConfidence) { colour = 'amber'; reason = 'LOW_CONFIDENCE'; }
    bump(colour, reason);
    return { ...it, colour, reason };
  });

  for (const u of unknown) bump('amber', u.lowConfidence ? 'LOW_CONFIDENCE' : 'UNKNOWN_TERM');
  if (unknown.some((u) => !u.lowConfidence)) reasons.add('UNKNOWN_TERM');
  if (hidden.length) bump('amber', 'HIDDEN_TERM');
  if (outside.length) bump('amber', 'OUTSIDE_SECTION_TERM');
  if (lowConfidenceOther.length) bump('amber', 'LOW_CONFIDENCE');
  if (structureUnclear) bump('amber', 'STRUCTURE_UNCLEAR');
  if (noList || headless) bump('amber', 'NO_INGREDIENT_LIST');
  else if (completeness !== 'complete' || truncated) bump('amber', 'INCOMPLETE_LIST');
  if (!noList && realCount === 0) bump('amber', 'NO_INGREDIENTS_FOUND');
  if (sharedLine && profile.askSharedLine) bump('amber', 'SHARED_LINE');

  const ordered = REASONS.filter((r) => reasons.has(r));
  return { verdict: worst, reasons: ordered, items: outItems };
}
