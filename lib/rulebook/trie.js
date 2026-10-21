// A character trie over normalised aliases. Each terminal node stores the entry it belongs to.

export function buildTrie(pairs) {
  // pairs: [{ alias, id }] with alias already normalised and unique
  const root = { c: new Map(), id: null, alias: null };
  for (const { alias, id } of pairs) {
    let node = root;
    for (const ch of alias) {
      let next = node.c.get(ch);
      if (!next) { next = { c: new Map(), id: null, alias: null }; node.c.set(ch, next); }
      node = next;
    }
    node.id = id;
    node.alias = alias;
  }
  return root;
}

// Every alias that starts at `pos`, longest first: [{ length, id, alias }]
export function matchesAt(trie, text, pos) {
  const found = [];
  let node = trie;
  for (let i = pos; i < text.length; i++) {
    node = node.c.get(text[i]);
    if (!node) break;
    if (node.id !== null) found.push({ length: i - pos + 1, id: node.id, alias: node.alias });
  }
  return found.reverse();
}

export function longestMatch(trie, text, pos) {
  const all = matchesAt(trie, text, pos);
  return all.length ? all[0] : null;
}
