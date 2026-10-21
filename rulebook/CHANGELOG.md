# Rulebook changelog

## 1.1.0 — 2026-10-21 (draft, not yet reviewed)
- First full draft: 125 entries, about 1,800 spellings, written by Claude from the v2 spec.
- New tags: `onion_family_possible`, `root_vegetable_possible`, `dried_rhizome`, `jain_sometimes_avoided`.
- New files: `annotations.json` (words that describe the list), `markers.json` (label field names), `options.json`.
- New option `avoid_root_possible`.
- Composite entries (`"composite": true`) let a listed bracket of components replace the parent's own tags.
- **Every entry has `reviewedBy: []`.** Two teammates must review each entry before release; the release build refuses unreviewed entries.
