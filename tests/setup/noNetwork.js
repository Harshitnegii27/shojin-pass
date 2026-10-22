// Tests never touch the network: no Azure quota, no Supabase, no surprises.
// Code under test that needs HTTP gets a mock through its deps (fetchFn); anything that reaches the
// real global fetch fails loudly here instead.

globalThis.fetch = async (input) => {
  throw new Error(`Network is blocked in tests (tried ${String(input?.url || input)}). Inject a mock fetchFn.`);
};
