// One JSON line per problem (spec 17.3). Never pass label text, profiles or keys in `extra`.

export function logInfo(op, extra = {}) {
  console.log(JSON.stringify({ level: 'info', op, ...extra }));
}

export function logError(op, err, extra = {}) {
  const message = String(err?.message || err || 'unknown error').slice(0, 300);
  console.error(JSON.stringify({ level: 'error', op, message, ...extra }));
}
