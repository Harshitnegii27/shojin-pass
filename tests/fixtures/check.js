// Shared checker for edge-case fixtures (used by the test suite and scripts/evalText.js).
export function checkCase(c, result) {
  const problems = [];
  const e = c.expect;
  if (e.verdict && result.verdict !== e.verdict) problems.push(`verdict ${result.verdict}, expected ${e.verdict}`);
  for (const r of e.reasons || []) if (!result.reasons.includes(r)) problems.push(`missing reason ${r}`);
  for (const r of e.notReasons || []) if (result.reasons.includes(r)) problems.push(`unexpected reason ${r}`);
  for (const spec of e.items || []) {
    const [txt, colour] = spec.split(':');
    const hit = result.items.find((i) => (i.original === txt || i.text === txt) && i.colour === colour);
    if (!hit) problems.push(`no item ${spec} (items: ${result.items.map((i) => i.original + ':' + i.colour).join(' ')})`);
  }
  for (const h of e.hidden || []) if (!result.hidden.some((x) => x.text === h)) problems.push(`missing hidden ${h}`);
  if (e.notes != null && result.notes.length !== e.notes) problems.push(`notes ${result.notes.length}, expected ${e.notes}`);
  return problems;
}
