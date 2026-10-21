// Outside services must never hold a reply hostage: race a promise against a timer.

export class TimeoutError extends Error {
  constructor(op, ms) { super(`${op} timed out after ${ms} ms`); this.name = 'TimeoutError'; }
}

export function withTimeout(promise, ms, op = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new TimeoutError(op, ms)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// A fetch for the Supabase clients that gives up after `ms`, so a down project cannot stall a request.
export function timedFetch(ms) {
  return (input, init = {}) => {
    const limit = AbortSignal.timeout(ms);
    const signal = init.signal ? AbortSignal.any([init.signal, limit]) : limit;
    return fetch(input, { ...init, signal });
  };
}
