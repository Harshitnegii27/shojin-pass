// Turns a preset name plus options into the sets the verdict engine uses.
// Options can only ADD restrictions. A tag that is forbidden is never also in `ask`.

export class ProfileError extends Error {
  constructor(message) { super(message); this.code = 'INVALID_REQUEST'; }
}

export function resolveProfile({ preset, options = [] }, rb) {
  const d = rb.diets[preset];
  if (!d) throw new ProfileError(`Unknown diet preset "${preset}"`);
  if (!Array.isArray(options)) throw new ProfileError('options must be a list');
  const forbid = new Set(d.forbid);
  const ask = new Set(d.ask);
  let askSharedLine = false;
  const used = [];
  for (const name of [...new Set(options)]) {
    const o = rb.options[name];
    if (!o) throw new ProfileError(`Unknown option "${name}"`);
    used.push(name);
    for (const t of o.forbid || []) forbid.add(t);
    for (const t of o.ask || []) ask.add(t);
    if (o.askSharedLine) askSharedLine = true;
  }
  for (const t of forbid) ask.delete(t);
  return {
    preset, options: used.sort(), label: d.label, chefIdentity: d.chefIdentity,
    forbid, ask, askSharedLine,
    relevant: new Set([...forbid, ...ask]),
  };
}
