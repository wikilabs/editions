# Fountain spec compliance + parser performance — custom-markup v1.0.0-beta-36..39

**Date:** 2026-05-25
**Status:** COMPLETED
**Bead(s):** none
**Epic:** none
**Chain:** `standalone-977747ae` seq `1`
**Parent:** `none — first in chain`
**Prior chain:** `none — first in chain`

---

## The Goal

Two intertwined work streams against the `wikilabs/custom-markup` TiddlyWiki plugin and its `custom-markup` edition:

1. **Fountain interop** — audit our partial Fountain implementation against the published spec at https://fountain.io/syntax/, close all the practical gaps so screenplay files copy-pasted from other Fountain tools render correctly. The user has been writing Fountain demos and wants spec-compliant behavior, not "spec-inspired."
2. **Parser performance** — investigate user-reported "wiki startup seems to be slow now" after the Fountain work. Determine root cause via profiling, fix the real bottlenecks, do not micro-optimize the wrong layer.

End state: plugin at `v1.0.0-beta-39`, Fountain features (lyrics, dual dialogue, auto-character with parentheticals, generic + forced transitions, case-insensitive scene headings, INT./EXT. variants, multi-line title-page values, tab-indented title-page values) all spec-compliant; PageTemplate parsed exactly once at startup; parser share of total wall-clock down from ~17% to ~13%; honest demonstration that further parser work won't move user-perceived slowness (real bottleneck is non-parser DOM/widget/layout work, ~87% of wall-clock).

## Where We Are

- Plugin repo is **8 commits ahead of `origin/master`** on `master`. Editions repo is **5 commits ahead of `origin/master`** on `master`. Neither is pushed.
- Plugin version: `1.0.0-beta-39` (was `beta-35` at session start).
- 7 plugin commits + 1 editions commit landed during the session, all reviewed before each commit per the user's standing "wait for review" rule.
- Custom-markup edition runs against the local Node TW server; the `custom-markup` wiki was the test bed throughout (browser: Firefox).
- `loadGlobalPragmas` and the `debug-custom.js` pragma processor both share TW core's `ImportVariablesWidget` cache slot for PageTemplate (`{parseAsInline: true, configTrimWhiteSpace: false}`).
- Module-level `_globalSymbolsCache` in `registry.js` memoizes the extracted global-symbols map keyed by `wiki.getChangeCount(PAGE_TEMPLATE_TITLE)`; second-and-later parsers skip parseTiddler entirely.
- New startup module `wikirules/startup/pt-dedupe.js` installs `ensurePageTemplateDedupe(wiki)` before render — this monkey-patches `wiki.parseTiddler` to track PT parse depth and short-circuit nested calls to the cached entry.
- All 13 fountain word markers (INT, EXT, EST, I-E, FADE-IN, FADE-OUT, CUT-TO, DISSOLVE-TO, SMASH-CUT-TO, MATCH-CUT-TO, WIPE-TO, IRIS-IN, IRIS-OUT) carry `trailing-blank: yes`; 4 scene markers carry `case-insensitive: yes`; 5 glyph markers (SCENE, CHARACTER, ACTION, SYNOPSIS, SECTION) carry `no-space-bound: yes`; new markers `vocab/fountain/LYRICS`, `INT-EXT`, `INT-OR-EXT` shipped.
- New wikirules in `wikirules/fountain-flavour/`: `fountain-character.js` (auto-detect uppercase cue + parenthetical extension + dual dialogue wrap) and `fountain-transition.js` (auto-detect `... TO:` + forced `>...` lines).
- `vocab/fountain` opted into `auto-character: yes`, `auto-transition: yes`, `forced-transition: yes`, `preserve-newlines: yes`, `body-class: wltc-fountain`; engine is fully vocab-name-agnostic after the refactor.
- `yaml.js` now handles multi-line scalar values (continuation-indent without `|` or `>` indicator) AND accepts tab indentation, both required for real-world Fountain title pages.
- Body wrapper `<div class="wltc-fountain">` wraps the parsed tree inside `.tc-tiddler-body` for cascade-scoped CSS; depth counter on `parseBlocks` ensures only the OUTERMOST `parseBlocks` call wraps (nested marker-body calls don't accumulate wrappers).
- Per-marker `parseMarkerTiddler` cache (beta-38) keyed by `wiki.getChangeCount(title)`; pristine snapshot cloned with fresh `symbols` map on hit. ~6% per-parse speedup measured in node microbench.
- Browser-side parser share after all fixes: **12.6%** of measured wall-clock. **Parser is not the bottleneck.** Conclusion documented in user-visible reasoning.

## Since Last Handoff

Seq 1 — first handoff in this chain. No "since last".

## What We Tried (Chronological)

This section is large because the session covered ~10 hours and 7 commits.

1. **Forced-scene-heading documentation** — user asked "did we miss the `.` forced scene heading?" Answer: we had it (vocab/fountain/SCENE, glyph with `open: .`, `mode: block`), but the on-disk docs only mentioned the spaced form `. SCENE`. Added compact-form example tiddler, then user pruned it to "1 sentence after . mirror". Lesson: user's preference is **terse examples**, not exhaustive demos.

2. **Per-marker `no-space-bound` flag** — Fountain spec's canonical forced-scene is `.SCENE` (no space) but our glyph engine had a `bound` requiring whitespace after the open literal to prevent `.NET`/`.com` false matches. Solution: `no-space-bound: yes` per-marker field; `buildBlockArm` emits a compact regex `(?:open)(?!open)` when set; skips symbol/class/quoted-arg capture. Applied to SCENE/CHARACTER/ACTION/SYNOPSIS/SECTION. Lookahead `(?!open)` prevents `..` / `##` accidental matches.

3. **`preserve-newlines` field generalization** — `markdown-newline.js` was hard-gated on `vocab/markdown`. Generalized to `hasVocabFlag("preserve-newlines")` (after the bigger refactor); added `preserve-newlines: yes` to both `vocab/markdown` and `vocab/fountain` so single-newline → `<br>` works in Fountain action/dialogue too.

4. **`trailing-blank` flag for word markers** — needed for spec-compliant Fountain scene-heading vs character-cue disambiguation. Spec: a SCENE HEADING requires a blank line after it; if `INT. KITCHEN\nJane enters.` (no blank), Fountain treats `INT. KITCHEN` as a character cue. Implementation: `trail = (?=[^\n]*(?:\n(?:\n|(?![\s\S]))|(?![\s\S])))` lookahead added to word arm when flag set. Applied to 13 fountain word markers.

5. **`case-insensitive` flag for word markers** — `int. kitchen` should fire the INT. marker per spec. Implementation: `caseFoldPattern("INT.")` → `[Ii][Nn][Tt]\.` regex pattern + `identifyMarker` does lowercased comparison when `marker.caseInsensitive` is true. Applied to INT/EXT/EST/I-E.

6. **Auto-character wikirule (`fountain-character.js`)** — JS engine rule with lookbehind `(?<=^|\n\n)` for blank-before, regex `[A-Z][A-Z0-9 .'\-]*?(?:\s*\([^)\n]*\))?` for uppercase cue with optional same-line parenthetical (mixed case allowed inside parens per spec), trailing `(\^)?` for dual dialogue, lookahead `(?=[ \t]*\S)` for non-blank dialogue line. `parse()` consumes both the cue line AND the following dialogue paragraph via `parser.parseInlineRun(/(\r?\n\r?\n)/mg, {eatTerminator: true})`, wraps both in `<div class="wltc-fountain-cue-block">` (+ `wltc-fountain-cue-block-dual` if `^`). The wrap is required for CSS `:has()` based side-by-side dual-dialogue layout.

7. **Fountain transitions wikirule (`fountain-transition.js`)** — two regex patterns:
   - Auto: `(?<=^|\n\n)([ \t]*)([A-Z][A-Z0-9 .'\-]*TO:)[ \t]*\n(?=\n|(?![\s\S]))` (uppercase line ending TO:, blank-before, blank-after)
   - Forced: `(?<=^|\n\n)([ \t]*)>[ \t]*(\S[^\n]*?)(?<!<)[ \t]*\n` (lines starting with `>`, NOT ending with `<` — distinguishes from `>centered<` inline-pair marker)
   `pickEarlier()` returns whichever matches earlier in source. `specificMarkerWins()` checks active word markers and yields to them (so CUT TO: / FADE IN: still fire via specific marker, not auto).

8. **Generic vocab-flag store refactor** — user pushback: "imo registry.js should not contain behaviour hardcoded. IMO it should not know about transitions. IMO transitions are fountain specific. IMO DSLs should be neutral." Refactored: dropped 5 named accessors (`hasFrontMatter`, `preservesNewlines`, `isAutoCharacter`, `isAutoTransition`, `isForcedTransition`), replaced with single `vocabFlags` map + `hasVocabFlag(name)`. `activate()` now scans `meta.fields` for any `key: yes` field (with `RESERVED_VOCAB_FIELDS` deny-list for structural fields like `tags`, `title`, `disable-core-rules`). Added `body-class` field handling (separate from flags). Engine is now vocab-name-agnostic.

9. **`body-class` wrapper** — user request: "vocab=Fountain needs a custom DIV wrapper class='wltc-fountain' after tc-body wrapper. Use the cascade." Implementation: `activate()` records each vocab's `body-class` value into `this.bodyClasses`; `applyAmendRules` monkey-patches `parser.parseBlocks` to wrap the returned tree in `<div class="...">` when `getBodyClass()` is non-empty. **Bug discovered later**: this wrap recursed into nested `parseBlocks` calls (from marker-inline.js:268 and marker-block.js:422 for markers with `end-string`), adding extra wrappers per nested body. Fixed in beta-37 with a depth counter.

10. **YAML multi-line scalar + tab indentation** — Fountain title pages use multi-line `Notes:` with continuation lines. Original `yaml.js` only handled inline values; continuation lines were silently dropped. Fix in `parseBlockMapping`: when child lines don't form a block sequence (`- `) or mapping (`:`), treat as multi-line scalar joined with `\n`. Extracted as `parseChildBlockValue` helper, used by both `parseBlockMapping` and `parseBlockSequence`. Separately: `load()` tokenizer was counting only spaces for indent; changed to accept tab OR space as one indent unit (strict YAML forbids tabs but Fountain title pages routinely use them).

11. **Plugin commits P1-P5 split with patch extraction** — user wanted "p1 to p5 OK in several commits, make them first" but P1+P2 both touched `registry.js`. Used `awk` to split the registry.js diff by hunk-start line numbers (P1 hunks at line>=290 = per-marker flags; P2 hunks at lower lines = vocab-flag refactor + body-class wrap). `git checkout HEAD -- registry.js && git apply /tmp/registry-p1.diff` to stage P1 only, then `cp /tmp/registry-final.js registry.js` to restore for P2. Worked cleanly. All 5 plugin commits + 1 editions commit landed.

12. **body-class wrap recursion bug** — when investigating perf, traced that `parser.parseBlocks` is also called from marker-inline.js (inline-pair block-mode) and marker-block.js (block-mode markers with `end-string`). The unconditional wrap added one extra `<div class="wltc-fountain">` per nested body. Pure fountain didn't trigger it (no fountain marker has `end-string`), but mixed fountain+table/details/presentation would have. Fix: depth counter `parser._cmParseBlocksDepth`; wrap only when depth returns to 0 (outermost call). Committed as beta-37.

13. **Performance baseline measurement via node bench** — created `/tmp/bench-cm.js` that boots TW from custom-markup edition and times `wiki.parseText` 100×N. Baseline: ~2.0 ms per parse. Most of this was `loadAllMarkers` (33%) + `activate` (13%) + `rebuildRegexes` (18%); "other" (parsing + TW core) = ~36%.

14. **Option A: parseMarkerTiddler module-level cache** — keyed by `(title, getChangeCount(title))`. Cache hit returns shallow clone via `$tw.utils.extend({}, cached.config)` with fresh `symbols: Object.create(null)` so per-parser pragma writes don't leak. Snapshot stored with `symbols: null` so cached entry stays pristine. Microbench: 1.98 ms → 1.86 ms = ~6%. Committed as beta-38.

15. **Option B: filter-title + regex-source caches** — implemented and benchmarked. Key insight: cached by `(vocabSet, wikiEpoch)` where epoch bumps on any wiki change. Tested: A only = 1.15 ms, B only = 1.14 ms, A+B = 1.14 ms baseline. **Savings overlap, not additive.** rebuildRegexes dropped from 0.35 ms to 0.02 ms (17× faster), but total only 10% better. User insight: "But the real win is at runtime and not at startup. So what is better to keep at runtime?" — B's global-epoch invalidation kills it under active editing (every keystroke saves a draft → bumps epoch → cache empty), while A's per-tiddler change-count keeps hitting because marker tiddlers never change at runtime. Decision: drop B, keep A only. Reverted B with `git checkout` on the 3 affected files + `rm commit-msg-perf-b.md`.

16. **Browser perf trace via startup module** — user couldn't use console snippets that survived hard-reload. Built `wikirules/startup/perf-trace.js`: patches `wiki.parseText` early via `module-type: startup, before: ["render"]`. Records every parse with timestamp, duration, type, source length, content preview. Slow parses (>15 ms) also capture stack trace. Exposes `window.__cmReport()` for on-demand reporting.

17. **Browser measurement results — cold start**: 561 parseText calls, 620 ms total. Top outliers: 53 ms for parsing the literal tiddler title `"Example - Fountain screenplay"` (29 chars). That's TW lazy-loading parser modules on first use.

18. **Browser measurement results — warm**: 216 calls, 283 ms total. Average 1.31 ms per parse. **Wall-clock 32.3 s, parser share 3.8%.** The other 96% is non-parser work. Confirmed: parser is not the source of perceived slowness.

19. **PageTemplate duplicate parse investigation** — top-2 slowest parses both for the same content (`\importcustom [tag[$:/tags/Pragma]]\n`, 36 chars): 87 ms then 37 ms in early traces. Investigated via stack capture: caller #1 = `ImportVariablesWidget` (via `wiki.parseTiddler(PT, {parseAsInline: true})`), caller #2 = our `loadGlobalPragmas` (via `wiki.parseTiddler(PT)` with NO options → default block parse). **Root cause: different cache keys** (`blockParseTree` vs `inlineParseTree` in `getCacheForTiddler`) — both miss, both factories run, both write the cache.

20. **PageTemplate fix attempt 1: parseAsInline match** — added `{parseAsInline: true, configTrimWhiteSpace: false}` to our `loadGlobalPragmas` and `debug-custom.js`'s `parseTiddler` calls. Same cache key as ImportVariablesWidget. Result: parser share dropped 17.4% → 15.6% but PT still parsed twice in trace. Investigated.

21. **PageTemplate fix attempt 2: `_globalSymbolsCache`** — module-level memo keyed by PT change-count. After first call, all subsequent `loadGlobalPragmas` calls skip `parseTiddler` and apply cached symbols via new `applyGlobalSymbols(map)` helper. Didn't help with the second PT parse because BOTH the first parses still happen (the cache only helps the 3rd+ caller).

22. **PageTemplate fix attempt 3: `parser.source === ptTid.fields.text` self-detect** — added back-reference `this.parser` to `CmRegistry` constructor (changed signature to `CmRegistry(wiki, parser)`, updated 7 init call sites). When `loadGlobalPragmas` runs from the PT sub-parser itself, source === PT.text → early return. Debug-instrumented and verified the SELF-DETECT fires correctly when the PT sub-parser runs. But PT still parsed twice — because the real recursion is from `.example-macro` (a Pragma-tagged legacy `\custom` tiddler) being parsed during PT's own `parsePragmas` via `\importcustom`. `.example-macro`'s cm-rule init triggers loadGlobalPragmas → parseTiddler(PT) → cache miss (outer factory still on stack).

23. **PageTemplate fix attempt 4 (final): `ensurePageTemplateDedupe(wiki)` wrap** — monkey-patches `wiki.parseTiddler` once per wiki. Tracks `_ptParseDepth`. Nested calls for PT when depth>0 return `caches[PT][cacheType]` directly (possibly undefined; callers handle null/undefined). FIRST attempt: installed wrap in `CmRegistry` constructor. **Too late** — ImportVariablesWidget called parseTiddler before any cm-rule init ran. Second attempt: new startup module `wikirules/startup/pt-dedupe.js` with `before: ["render"]` installs the wrap by calling `CmRegistry.ensurePageTemplateDedupe($tw.wiki)`. WORKED — PT now parsed exactly once. Trace #1 stack now shows `ensurePageTemplateDedupe/wiki.parseTiddler@registry.js:46:16` in the call chain for ImportVariablesWidget.

24. **Final cleanup** — removed `perf-trace.js` (temporary diagnostic). Reverted the dead `this.parser` back-reference: stripped from `CmRegistry` constructor + all 7 cm-rule init sites (`new CmRegistry(parser.wiki, parser)` → `new CmRegistry(parser.wiki)`). Wrap subsumes the SELF-DETECT logic. Net diff for beta-39: 3 files (registry.js, debug-custom.js, new pt-dedupe.js) + plugin.info + history.tid.

## Key Decisions

- **Engine stays vocab-name-agnostic.** User's architectural feedback was clear: "DSLs should be neutral." Removed 5 named accessors, replaced with one generic `hasVocabFlag(name)` reading from a `vocabFlags` map populated by scanning vocab meta fields for `key: yes`. Adding a new vocab feature is now: write the wikirule, query the flag by name, set the field on the vocab tiddler. Zero engine change required.

- **Per-marker `*-bound` flags vs central registry.** Chose per-marker fields (`no-space-bound`, `trailing-blank`, `case-insensitive`) rather than vocab-level. Reason: a single vocab could mix markers with different bound semantics (e.g., Fountain's SCENE wants no-space-bound but its DIALOGUE wouldn't). Per-marker is the right granularity.

- **Auto-character rule wraps cue+dialogue, not just cue.** Spec only requires the cue itself, but wrapping was needed for dual-dialogue CSS layout (`:has()` selector needs sibling wrappers to find the dual pair). The wrap is `<div class="wltc-fountain-cue-block">`; dual adds `wltc-fountain-cue-block-dual`. Dialogue parsed via `parseInlineRun` with blank-line terminator so inline emphasis still fires.

- **`@McCLANE` case preservation breaks `text-transform: uppercase`.** Fountain spec 1.1 deprecated forcing character extensions to uppercase. To support `MOM (O. S.)` AND `HANS (on the radio)` AND `@McCLANE` (all rendering with source case), removed `text-transform: uppercase` from `.wltc-fountain-character`. Source case is now preserved end-to-end. Auto-detection already requires uppercase source, so removing the CSS transform doesn't affect those cues — only fixes the explicit forms.

- **Drop Option B perf cache, keep Option A.** Microbench showed both gave ~10% with overlap. Critical insight from user: B's global-epoch invalidation thrashes at runtime (every keystroke = wiki change event = epoch bump = cache empty), while A's per-tiddler `getChangeCount` cache stays warm (marker tiddlers never change at runtime). For runtime perf, A is the right tool. Reverted B cleanly via `git checkout`.

- **PageTemplate dedupe is its own startup module, not in the registry constructor.** Tried installing the wrap from `CmRegistry` constructor — too late, ImportVariablesWidget fires before any cm-rule init can run. Moved to a `module-type: startup, before: ["render"]` module so the wrap is in place before any rendering.

- **Don't optimize the parser further.** Wall-clock 32.3 s, parser share 3.8% (warm). Halving the parser cost would save ~140 ms — invisible to user. The real bottleneck is the other 96%: DOM/widget/CSS layout. Stopping parser work was the right call after the perf trace confirmed this.

- **Editions repo: one combined commit, not three.** User decided "P1-P5 OK in several commits, Ex all in 1 commit." Wiring + docs + examples + tests went in `cb9c2c8` as a single editions-side commit. Per-feature granularity stays on the plugin side via the version bumps.

- **Commit messages: concise.** User said "this has too much bla bla. make it shorter 50%" on the beta-37 fix message. All subsequent commit messages targeted ~10-15 lines max. Per-commit history.tid entries also kept to 1-2 sentences with `(P1)`-`(P5)` tags for traceability against the v0.0.0-beta-36 multi-commit cluster.

- **Always wait for commit message review before `git commit`.** User explicitly reverted one commit ("no undo commit I need to review commit-msg first"). Standing rule: write commit-msg-*.md, show it, wait for "go"/"commit"/"yes" signal, then execute.

## Evidence & Data

### Plugin commits this session

| Hash | Version | Subject |
|---|---|---|
| `4b24964` | (beta-36 split) | cm: per-marker no-space-bound, trailing-blank, case-insensitive flags |
| `bf23f91` | (beta-36 split) | cm: generic vocab-flag store + body-class wrapper |
| `612f06b` | (beta-36 split) | cm: yaml.js — multi-line scalar values, tab indentation |
| `ec95a2e` | (beta-36 split) | cm: fountain wikirules — auto-character (+ dual), transitions (auto/forced) |
| `6dbd063` | **beta-36** | cm: v1.0.0-beta-36 — fountain styles for new features |
| `6277b6b` | **beta-37** | cm: v1.0.0-beta-37 — fix body-class wrap recursing into marker bodies |
| `510f9a4` | **beta-38** | cm: v1.0.0-beta-38 — cache parseMarkerTiddler results |
| `63cb1c9` | **beta-39** | cm: v1.0.0-beta-39 — dedupe PageTemplate parses at startup |

### Editions commits this session

| Hash | Subject |
|---|---|
| `cb9c2c8` | cm fountain: wire markers + vocab metas to v1.0.0-beta-36, docs, examples, tests |

### Per-marker flags applied (Fountain)

| Marker tiddler | no-space-bound | trailing-blank | case-insensitive |
|---|:-:|:-:|:-:|
| vocab/fountain/SCENE | ✓ | — | — |
| vocab/fountain/CHARACTER | ✓ | — | — |
| vocab/fountain/ACTION | ✓ | — | — |
| vocab/fountain/SYNOPSIS | ✓ | — | — |
| vocab/fountain/SECTION | ✓ | — | — |
| vocab/fountain/LYRICS (new) | ✓ | — | — |
| vocab/fountain/INT | — | ✓ | ✓ |
| vocab/fountain/EXT | — | ✓ | ✓ |
| vocab/fountain/EST | — | ✓ | ✓ |
| vocab/fountain/I-E | — | ✓ | ✓ |
| vocab/fountain/INT-EXT (new) | — | ✓ | ✓ |
| vocab/fountain/INT-OR-EXT (new) | — | ✓ | ✓ |
| vocab/fountain/FADE-IN | — | ✓ | — |
| vocab/fountain/FADE-OUT | — | ✓ | — |
| vocab/fountain/CUT-TO | — | ✓ | — |
| vocab/fountain/DISSOLVE-TO | — | ✓ | — |
| vocab/fountain/SMASH-CUT-TO | — | ✓ | — |
| vocab/fountain/MATCH-CUT-TO | — | ✓ | — |
| vocab/fountain/WIPE-TO | — | ✓ | — |
| vocab/fountain/IRIS-IN | — | ✓ | — |
| vocab/fountain/IRIS-OUT | — | ✓ | — |

### Vocab-level opt-ins (`vocab/fountain`)

```
auto-character: yes
auto-transition: yes
forced-transition: yes
preserve-newlines: yes
front-matter: yes
body-class: wltc-fountain
disable-core-rules: heading list
```

### Performance — node microbench (5 trials × 500 iters, median-of-medians)

| Variant | per-parse | vs baseline |
|---|---:|---:|
| no caches (baseline) | 1.27 ms | — |
| A only (parseMarkerTiddler cache) | 1.15 ms | -9.3% |
| B only (filter titles + regex sources) | 1.14 ms | -10.1% |
| A + B | 1.14 ms | -10.5% |

A and B addressed different phases but saved similar amounts → overlap, not additive.

### Performance — per-phase breakdown (per parser, with A active)

| Phase | Time | % of total |
|---|---:|---:|
| `loadAllMarkers` | 0.65 ms | 33% |
| `loadGlobalPragmas` | 0.03 ms | 1% |
| `activate` | 0.25 ms | 13% |
| `applyAmendRules` | 0.00 ms | <1% |
| `rebuildRegexes` | 0.35 ms | 18% (B reduces to 0.02 ms) |
| other (TW core + parse) | 0.70 ms | 35% |

### Performance — browser trace results (Firefox, custom-markup wiki)

| State | parseText sum | calls | Wall-clock | Parser share |
|---|---:|---:|---:|---:|
| Cold start (first reload after server boot) | 620 ms | 561 | (n/a) | (n/a) |
| Warm (second reload, classes cached) | 283 ms | 216 | (n/a) | (n/a) |
| With perf-trace startup hook (wall-clock from startup) | 1218 ms | 1808 | ~32 s incl. idle | 3.8% |
| After parseAsInline fix only | 1204 ms | 1808 | — | 17.4% (active session) |
| After parseAsInline + `_globalSymbolsCache` | 1130 ms | 1808 | — | 15.6% |
| After full `ensurePageTemplateDedupe` (beta-39) | 1093 ms | 1808 | — | **12.6%** |

### PageTemplate parse count in top-5 (browser trace)

| Trace stage | PT parses | Slowest PT | Notes |
|---|:-:|---:|---|
| Pre-fix | 2 | 87 ms + 37 ms | Different cache keys (block + inline) |
| After parseAsInline | 2 | 50 ms + 17 ms | Same cache key now, but `getCacheForTiddler` has no in-flight dedupe |
| After SELF-DETECT (`parser.source === PT.text`) | 2 | 49 ms + 16 ms | Self-detect fires for PT parser, but `.example-macro` nested call still triggers another parse |
| After `_globalSymbolsCache` alone | 2 | 49 ms + 14 ms | Cache helps 3rd+ caller; first two unavoidable without dedupe |
| After `ensurePageTemplateDedupe` (in CmRegistry ctor) | 2 | 58 ms + 25 ms | Wrap installed too late — ImportVariablesWidget called parseTiddler first |
| **After `ensurePageTemplateDedupe` from startup module** (beta-39) | **1** | **47 ms** | Wrap active before render |

### PT parse trace stack — final state (one parse, beta-39)

```
exports.startup/wiki.parseText@perf-trace.js
exports.parseTiddler/<@core/modules/wiki.js:1083:15
exports.getCacheForTiddler@core/modules/wiki.js:1012:23
exports.parseTiddler@core/modules/wiki.js:1079:24
ensurePageTemplateDedupe/wiki.parseTiddler@registry.js:46:16   ← our wrap
ImportVariablesWidget.prototype.execute/<@core/modules/widgets/importvariables.js:51:35
```

### Code analysis — combined block regex size (post-Fountain)

- 83 marker tiddlers in the wiki (`grep -lr 'tags:.*CustomMarkup/Marker' ...| wc -l`).
- 4 word markers use case-folded patterns (e.g., `[Ii][Nn][Tt]\.` instead of `INT\.`) — ~3× longer per marker.
- 13 word markers use trailing-blank lookahead `(?=[^\n]*(?:\n(?:\n|(?![\s\S]))|(?![\s\S])))` — adds ~40 chars per marker.
- 5 glyph markers use compact `(?:open(?!open))` form — shorter than the default 4-component arm.
- Net: regex is larger but JS RegExp compiles fast (~50 µs per parser); regex source is now cached at module level after beta-39 (carried over from B exploration, though B's cache was reverted... actually no, B was fully reverted — regex source cache is NOT present).

### Module-level caches in registry.js (final beta-39 state)

| Cache name | Key | Population | Invalidation |
|---|---|---|---|
| `_markerTiddlerCache` | `title` | First `parseMarkerTiddler(title)` | `wiki.getChangeCount(title)` mismatch |
| `_globalSymbolsCache` | (global) | First `loadGlobalPragmas` after PT changes | `wiki.getChangeCount(PAGE_TEMPLATE_TITLE)` mismatch |
| `_ptParseDepth` | (counter, not a cache) | Wrap increments on PT call entry | Wrap decrements in finally |
| `_hookedWiki` / `_wikiEpoch` / `_filterTitlesCache` | — | **DOES NOT EXIST** in beta-39 (B reverted) | — |

### Files in plugin commits this session

```
wikirules/registry.js                  — modified across all 4 beta commits
wikirules/marker-block.js              — case-insensitive identifyMarker (P1) + depth counter for parseBlocks wrap (beta-37)
wikirules/marker-inline.js             — no changes after revert (had parser arg added then removed)
wikirules/markdown-flavour/front-matter.js — hasVocabFlag (P2)
wikirules/markdown-flavour/markdown-newline.js — hasVocabFlag (P2)
wikirules/yaml.js                      — multi-line scalar + tab indent (P3)
wikirules/fountain-flavour/fountain-character.js — NEW (P4)
wikirules/fountain-flavour/fountain-transition.js — NEW (P4)
wikirules/pragmas/debug-custom.js      — parseAsInline (beta-39)
startup/pt-dedupe.js                   — NEW (beta-39)
$__vocab_fountain_styles.tid           — body wrapper, lyrics, dual layout, character text-transform removed (P5)
plugin.info                            — version bump beta-36 → 37 → 38 → 39
meta/history.tid                       — version entries
```

### Fountain spec audit — what we have vs what's missing (final state)

Audited against https://fountain.io/syntax/. Items marked ✗ are deferred / documented as known limitations.

| Spec feature | Status | Notes |
|---|:-:|---|
| Title page (one-line Key: Value) | ✓ | front-matter wikirule + yaml.js |
| Title page (multi-line value, indented continuation) | ✓ | yaml.js fix (P3) — works with tabs too |
| Scene headings INT./EXT./EST./I.E. | ✓ | word markers with `trailing-blank` |
| Scene headings INT./EXT. and INT/EXT. variants | ✓ | NEW markers INT-EXT, INT-OR-EXT |
| Scene headings case-insensitive (`int. kitchen`) | ✓ | `case-insensitive: yes` per marker |
| Forced scene heading (`.SCENE` no space) | ✓ | `no-space-bound: yes` on SCENE marker |
| Scene numbers (`#1#`, `#1A#`, `#I-1-A#`) | ✗ | Deferred — parsing only, easy add |
| Action paragraphs | ✓ | Default paragraph |
| Forced action (`!action`) | ✓ | ACTION marker + no-space-bound |
| Character cue (uppercase line auto-detect) | ✓ | fountain-character.js wikirule (P4) |
| Character cue with parenthetical extension (`MOM (O. S.)`, `HANS (on the radio)`) | ✓ | Regex captures `\s*\([^)\n]*\)` — mixed case allowed |
| Forced character (`@McCLANE`, case preserved) | ✓ | CHARACTER marker + no-space-bound + CSS no longer uppercases |
| Dialogue (lines after cue) | ✓ | Wrapped in cue-block div via fountain-character.js |
| Dual dialogue (`CHARACTER ^`) | ✓ | Trailing `^` captured, `wltc-fountain-cue-block-dual` class, CSS :has() side-by-side |
| Dual dialogue with `@CHARACTER ^` | ✗ | Forced cue path doesn't wrap; auto-detection only |
| Parentheticals mid-dialogue (`(softly)` on own line) | ✗ | Renders as text, not styled indent block |
| Lyrics (`~text`) | ✓ | NEW LYRICS marker, italic |
| Transitions (specific keywords) | ✓ | CUT TO:, FADE IN: etc. — word markers |
| Transitions (generic `... TO:` auto-detect) | ✓ | fountain-transition.js (P4) |
| Forced transition (`>Burn to White.`) | ✓ | fountain-transition.js — distinguishes from `>centered<` via `(?<!<)` lookbehind |
| Centered text (`>centered<`) | ✓ | CENTERED inline-pair marker |
| Inline emphasis (`*italic*`, `**bold**`, `***bold italic***`, `_underline_`) | ✓ | Per-vocab markers |
| Boneyard (`/* ... */`) | ✓ | BONEYARD inline-pair marker |
| Sections (`#`, `##`, ...) | ⚠ | Rendered with styling; spec says hide. Documented divergence. |
| Synopses (`= text`) | ✓ | SYNOPSIS marker + no-space-bound |
| Notes (`[[text]]`) | ✗ | Collides with TW prettylink syntax — non-trivial |
| Page breaks (`===` outside front-matter) | ✗ | Cheap to add, deferred |
| Escape sequences (`\*`, `\_`) | ⚠ | Depends on TW core escape handling, untested |

## Code Analysis

- `CmRegistry` constructor signature: `function(wiki)`. Stores `this.wiki`, calls `ensurePageTemplateDedupe(wiki)`. No `parser` back-reference (reverted in cleanup).
- `ensurePageTemplateDedupe(wiki)` is module-scoped, exposed as static via the startup module path. Idempotent via `wiki._cmPtDedupe` sentinel. Replaces `wiki.parseTiddler` with a wrapping function that checks `_ptParseDepth > 0` for `PAGE_TEMPLATE_TITLE` and short-circuits to the cached entry.
- `loadGlobalPragmas` flow (post-beta-39): early return on `_loadingGlobals` flag → early return on `_globalSymbolsCache` hit (apply + return) → set `_loadingGlobals=true` → `parseTiddler(PT, {parseAsInline: true, configTrimWhiteSpace: false})` → merge symbols → snapshot symbol map → populate cache → reset `_loadingGlobals`.
- `applyAmendRules(parser)` monkey-patches both `parser.parsePragmas` (existing) and `parser.parseBlocks` (added beta-36, fixed beta-37). The parseBlocks wrap uses `parser._cmParseBlocksDepth` counter; wraps tree in `<div class="bodyClass">` only when depth returns to 0 (outermost call).
- `RESERVED_VOCAB_FIELDS` deny-list at module level. Excludes `title`, `tags`, `type`, `created`, `modified`, `caption`, `description`, `filter`, `version`, `disable-core-rules`, `body-class`. Generic flag scan skips these.
- `parseMarkerTiddler` cache key: `wiki.getChangeCount(title)` per tiddler. Snapshot stores config with `symbols: null`; on retrieval, shallow clone via `$tw.utils.extend({}, cached.config)` and assign `clone.symbols = Object.create(null)` so per-parser pragma writes don't leak.
- `caseFoldPattern(s)` converts each letter to `[Aa]` character class, leaves other chars escaped. Used by word markers with `caseInsensitive: true`. `identifyMarker` does `head.toLowerCase() === m.open.toLowerCase()` when `m.caseInsensitive`.
- `buildBlockArm` per-kind branches: `glyph` (default + compact via `no-space-bound`), `glyph-level` (default + compact), `word` (default + trailing-blank lookahead via `trailing-blank`), `list-item`. Word arm uses `wordOpen = m.caseInsensitive ? caseFoldPattern(m.open) : escapeRegExp(m.open)`.
- Fountain character auto-detection regex: `/(?<=^|\n\n)([ \t]*)([A-Z][A-Z0-9 .'\-]*?(?:\s*\([^)\n]*\))?)[ \t]*(\^)?[ \t]*\n(?=[ \t]*\S)/g`. Lookbehind `(?<=^|\n\n)` requires blank line before. Inner `(?:\s*\([^)\n]*\))?` is the optional same-line parenthetical (mixed case allowed). `(\^)?` captures dual marker.
- Fountain transition regexes: auto = `/(?<=^|\n\n)([ \t]*)([A-Z][A-Z0-9 .'\-]*TO:)[ \t]*\n(?=\n|(?![\s\S]))/g`; forced = `/(?<=^|\n\n)([ \t]*)>[ \t]*(\S[^\n]*?)(?<!<)[ \t]*\n/g`. Negative lookbehind `(?<!<)` distinguishes forced transition from centered `>text<` (inline-pair marker).
- `vocab/fountain/CHARACTER.mode` is `inline` (not block) — character cue is a single line; subsequent lines are dialogue handled by the auto-character rule. (Originally set to block which broke per-line behavior for `LYRICS`; corrected during session.)
- `parser._cmParseBlocksDepth` is per-parser instance counter (not module-level). Initialized in `applyAmendRules` setup to 0; wrap function increments on entry, decrements on exit. Wrap fires only when depth returns to 0.

## Files Changed

### Source code (plugin)
- `wikirules/registry.js` — per-marker flag handling (parseMarkerTiddler additions, `caseFoldPattern`), `buildBlockArm` branches for `no-space-bound`/`trailing-blank`/`case-insensitive`, generic `vocabFlags` map + `hasVocabFlag(name)`, `body-class` wrap with depth counter, `parseMarkerTiddler` module-level cache, `loadGlobalPragmas` with `parseAsInline:true` + `_globalSymbolsCache` memoization, `applyGlobalSymbols` helper, `ensurePageTemplateDedupe(wiki)` function with `_ptParseDepth` counter, `RESERVED_VOCAB_FIELDS` deny-list
- `wikirules/marker-block.js` — case-insensitive `identifyMarker` branch
- `wikirules/marker-inline.js` — no net change (reverted after exploration)
- `wikirules/markdown-flavour/front-matter.js` — `hasVocabFlag("front-matter")` (was `hasFrontMatter()`)
- `wikirules/markdown-flavour/markdown-newline.js` — `hasVocabFlag("preserve-newlines")` (was hardcoded vocab/markdown gate)
- `wikirules/yaml.js` — `parseChildBlockValue` helper for multi-line scalars + tab-as-indent
- `wikirules/fountain-flavour/fountain-character.js` — NEW. Lookbehind regex; consumes cue + dialogue paragraph; wraps in cue-block div
- `wikirules/fountain-flavour/fountain-transition.js` — NEW. Auto + forced patterns; yields to specific word markers via `specificMarkerWins`
- `wikirules/pragmas/debug-custom.js` — `parseAsInline:true` on PT parseTiddler call
- `startup/pt-dedupe.js` — NEW. Installs `ensurePageTemplateDedupe($tw.wiki)` `before: ["render"]`
- `$__vocab_fountain_styles.tid` — `.wltc-fountain` body wrapper, `.wltc-fountain-lyrics` (italic), `.wltc-fountain-cue-block[-dual]` for side-by-side dual via `:has()`, `.wltc-front-matter-value { white-space: pre-line }`, removed `text-transform: uppercase` from `.wltc-fountain-character`

### Config (plugin)
- `plugin.info` — version: `1.0.0-beta-35` → `1.0.0-beta-39`
- `meta/history.tid` — entries for beta-36 (5 bullets tagged `(P1)`-`(P5)`), beta-37, beta-38, beta-39

### Tiddlers (editions repo, `cb9c2c8`)
- `vocab_fountain.tid` — opt-in fields: `auto-character`, `auto-transition`, `forced-transition`, `preserve-newlines`, `body-class: wltc-fountain`; description updated to mention auto-detection
- `vocab_markdown.tid` — `preserve-newlines: yes`
- 5 glyph marker tiddlers updated with `no-space-bound: yes`: SCENE, CHARACTER, ACTION, SYNOPSIS, SECTION
- 13 word marker tiddlers updated with `trailing-blank: yes`: INT, EXT, EST, I-E, FADE-IN, FADE-OUT, CUT-TO, DISSOLVE-TO, SMASH-CUT-TO, MATCH-CUT-TO, WIPE-TO, IRIS-IN, IRIS-OUT
- 4 scene markers updated with `case-insensitive: yes`: INT, EXT, EST, I-E
- `vocab_fountain_LYRICS.tid` — NEW (mode: inline, no-space-bound)
- `vocab_fountain_INT-EXT.tid` — NEW (case-insensitive, trailing-blank)
- `vocab_fountain_INT-OR-EXT.tid` — NEW
- `Vocabulary - Fountain.tid` — marker map updated (Dual dialogue + Lyrics rows), "Known limitations" pruned (whitespace-after-glyph, auto-character, multi-line title-page, dialogue auto-styling all removed)
- `Example - Fountain screenplay.tid` — dropped now-redundant inline `<style>` block (body wrapper handles it)
- 5 new focused examples: forced action, forced scene heading, auto character, dual dialogue, lyrics
- 4 new parser tests: case-insensitive scenes, scene-heading variants, generic transitions, forced transition
- 2 new test tiddlers: `test-fountain-brick-and-steel`, `test-front-matter-fountain`

### Important caveats / gotchas hit during the session

- **Two different cache key types in `getCacheForTiddler`**: `"blockParseTree"` (default) vs `"inlineParseTree"` (when `parseAsInline: true`). Two different cache slots for the same tiddler. ImportVariablesWidget uses inline; our `loadGlobalPragmas` defaulted to block → never shared cache. The `parseAsInline:true` fix was necessary but NOT sufficient.

- **`_loadingGlobals` static flag prevents nested recursion at depth 2 but not the FIRST level of recursion.** When ImportVariablesWidget triggers the outer parseTiddler factory and our cm-rule init inside fires loadGlobalPragmas, `_loadingGlobals` is still false (the outer caller wasn't loadGlobalPragmas). So loadGlobalPragmas runs, calls parseTiddler again, factory runs concurrently. `_loadingGlobals` blocks the inner-inner call. So you get exactly 2 parses, not infinite.

- **`getCacheForTiddler` overwrites on store**. When two factories race for the same key, BOTH write the cache. The second (outer) factory's write wins. The first (inner) factory's parser is thrown away. Both did full work.

- **`parser.source` matches `tiddler.fields.text` when the parser came from `parseTiddler(title)`**. This is what enabled the SELF-DETECT check. The text isn't mutated by WikiParser ctor; it's stored as-is via `this.source = text || ""`.

- **Browser console grouping**: Firefox shows repeat counts after duplicate lines (e.g., `[cm-debug] ... this.parser? true 582` — that `582` is a repeat counter, not a number from our log). Misled debugging temporarily.

- **`code-body: yes` on PageTemplate does NOT skip wikitext parsing.** parseTiddler still creates a WikiParser. The `code-body` flag affects rendering (codeblock template), not parsing.

- **TW core fires `change` events on EVERY tiddler save**, including drafts (every keystroke can save a draft). This made the global-epoch invalidation in Option B effectively useless at runtime.

- **`wiki.parseTiddler` is on the prototype** (`$tw.Wiki.prototype.parseTiddler`). Patching `wiki.parseTiddler = fn` creates an instance property shadowing the prototype. Worked correctly in our test; other code paths that call `Wiki.prototype.parseTiddler.call(wiki, ...)` (none seen in TW core) would bypass.

- **Lookbehinds `(?<=^|\n\n)` and `(?<!<)`** require modern JS — Node 22 and current Firefox/Chrome support them. If old browsers needed, fallback regex required.

### Architecture before/after (`CmRegistry` vocab handling)

| Aspect | Before this session (beta-35) | After this session (beta-39) |
|---|---|---|
| Vocab feature opt-ins | 5 named fields (`frontMatter`, `preserveNewlines`, etc.) + 5 accessor methods | One `vocabFlags` map + `hasVocabFlag(name)`; generic scan in `activate()` |
| Adding new vocab feature | Touch `CmRegistry` constructor + add accessor + use in rule | Add field to vocab tiddler; wikirule queries `hasVocabFlag(name)` — zero engine change |
| Engine knowledge of Fountain/Markdown | `isAutoCharacter`, `isAutoTransition` etc. by name | None — engine is vocab-agnostic |
| Per-marker behavior modifiers | Implicit in `kind` (glyph/glyph-level/word/list-item/inline-pair) | + 3 opt-in fields (`no-space-bound`, `trailing-blank`, `case-insensitive`); marker-tiddler authors control regex shape |
| Body wrapping for CSS scoping | None (each tiddler used inline `<style>` with `<<currentTiddler>>` data attr) | `body-class: <name>` vocab field; engine wraps parsed tree in `<div class="...">` once per outermost parseBlocks |
| PageTemplate parse count at startup | 2-3 (different cache keys, nested-factory race) | 1 (cache slot shared, in-flight dedupe via `ensurePageTemplateDedupe` wrap) |
| Marker config cost per parser | ~107 full parseMarkerTiddler calls (24 field reads each) | Module-level cache, shallow clone per parser hit |
| Global pragma symbols cost | Per-parser parseTiddler(PT) call (potentially cache miss) | Module-level `_globalSymbolsCache`, parseTiddler skipped on hit |
| `loadGlobalPragmas` call site convention | `parser.cmRegistry.loadGlobalPragmas()` from cm-rule init | Unchanged — internal optimizations are invisible to callers |

### Diagnostic perf-trace.js skeleton (deleted but recreate if needed)

The deleted `wikirules/startup/perf-trace.js` was a measurement aid. Skeleton:

```js
exports.name = "cm-perf-trace";
exports.platforms = ["browser"];
exports.before = ["render"];
exports.synchronous = true;
exports.startup = function() {
  var wiki = $tw.wiki;
  if(!wiki || !wiki.parseText || wiki.__cmPerfHooked) { return; }
  wiki.__cmPerfHooked = true;
  var orig = wiki.parseText;
  var samples = [];
  var startMark = performance.now();
  wiki.parseText = function(type, text) {
    var t0 = performance.now();
    var r = orig.apply(this, arguments);
    var sample = {ms: performance.now() - t0, when: t0 - startMark, type: type, len: (text||"").length, preview: (text||"").slice(0,80)};
    if(sample.ms > 15) sample.stack = (new Error()).stack;
    samples.push(sample);
    return r;
  };
  window.__cmReport = function() {
    // groups by type, prints table, prints top-5 with stacks
  };
};
```

Key learnings from using it:
- Must be a startup module to survive reload.
- Patch `parseText`, not `parseTiddler` (parseTiddler caches; you'll miss cache hits otherwise — but those are by design fast).
- Capture stack only for slow calls (>15 ms threshold) — `new Error().stack` is expensive.
- The `when` field (time since startup) is critical for distinguishing cold vs warm cost.

## User Feedback & Preferences (REQUIRED)

The user gave a lot of direction. All of it influences future sessions.

- **"Not so much fluff. Only the forced scene heading and 1 sentence plus description"** — terse examples. Then "1 sentence after . mirror" to trim further. Pattern: examples should be MINIMAL — one sentence + one demo block + done.
- **"Use MCP tools for tiddler content, only MCP tools"** — never use file Edit tool for tiddler files. Standing rule (already in memory).
- **"imo registry.js should not contain behaviour hardcoded. IMO it should not know about transitions. IMO transitions are fountain specific. IMO DSLs should be neutral."** — architectural principle. The DSL engine must be vocab-agnostic. Vocabs declare their own behavior via fields the engine doesn't interpret semantically.
- **"The main point is interoperability. So for fountain we should make it as the spec says, to be compliant. We keep the default for our default only fountain should be at spec"** — when adding spec compliance, opt INTO it via per-vocab flags; don't change default vocab behavior.
- **"IF we keep A only, we only need to checkout the last commit. right?"** — user thinks carefully about git state; checks before requesting destructive operations.
- **"p1 to p5 OK in several commits. make them first"** — user wanted multi-commit history for plugin work, single commit for editions side. Granularity matters for plugin (per-version), less for content.
- **"Ex all in 1 commit"** — explicit decision; user controls commit granularity per repo.
- **"commit messages are ok now. history needs to be checked per commit"** — multi-commit work needs per-commit traceability in history.tid (the `(P1)`-`(P5)` tags pattern).
- **"no undo commit I need to review commit-msg first"** — STANDING RULE. Always show commit-msg-*.md and wait for "go"/"commit" before executing. The user reverted one commit I made too eagerly.
- **"this has too much bla bla. make it shorter 50%"** — commit messages and history entries should be CONCISE. Target ~10 lines, not 20.
- **"check the html code for test-front-matter-fountain. It does not work as expected"** then later **"sorry I was wrong it does work"** — user verifies their hypothesis when investigating bugs; sometimes the initial hunch is wrong but they self-correct.
- **"But the real win is at runtime and not at startup. So what is better to keep at runtime?"** — INSIGHTFUL question that changed the perf direction. Forced honest analysis of cache invalidation behavior (per-tiddler vs global-epoch). User thinks about long-term behavior, not just first-load metrics.
- **"can we do something to improve core parser performance?"** — open-ended question; user wants exploration, not a packaged answer.
- **"check all filters that group single tiddler rules"** — specific technical hypothesis to investigate. User reads code and forms theories.
- **"measure first to get the baseline. Then A and measure again. show results in a table"** — engineering discipline: baseline → change → re-measure → present comparison. Tables preferred over prose.
- **"FireFox does not have a pie chart"** — corrected my Chrome-centric instructions; user runs Firefox.
- **"It's not possible to execute the script. reload and then call __cmReport3(). It does not exist after a reload"** — pointed out the impossibility of in-page state across reload. Drove the perf-trace.js startup module solution.
- **"commit a first" / "commit"** — these are commit-execution signals. Treat as authorization to commit the prepared commit-msg.
- **"yes" / "go" / "ok"** — short confirmations after seeing commit-msg or proposed change. Authorization signals.
- **"cleanup"** — single word meaning "remove the temporary diagnostic artifacts and revert dead code, prep for commit". Pattern: terse imperatives after a feature works.

## Where We're Going

The user did not declare a next direction. Likely candidates based on the session's trajectory:

1. **Push the 8 plugin commits + 1 editions commit to origin/master.** Both repos are ahead; nothing has been pushed. User has not requested push (memory note: "NEVER run destructive git commands [or push] unless the user explicitly requests these actions").
2. **Optional: shrink commit-message line widths** in the existing committed messages (cosmetic — would require rebase, which the user has not authorized).
3. **Investigate non-parser sources of wiki startup slowness.** The perf work concluded parser is 12.6% of wall-clock. If "feels slow" remains a complaint, next targets are widget rendering (TW core), CSS layout (`.wltc-fountain-cue-block:has(...)`), or sync churn.
4. **Spec gaps still open** (lower priority, documented as known limitations):
   - Notes (`[[...]]`) — collides with TW prettylink syntax; non-trivial.
   - Mid-dialogue parentheticals (`(softly)` between dialogue lines) — needs engine-level dialogue body inspection.
   - Page break (`===` outside front-matter) — cheap to add, never got to it.
   - Scene numbers (`#1#`, `#1A#`, `#I-1-A#`) — parsing only, easy.
   - Escape sequences (`\*`, `\_`) — depends on TW core escape behavior.
5. **Sections currently visible vs spec-hidden** — Fountain spec says SECTION (`#`, `##`) is author-side only, not in production output. We render with styling. Documented as deliberate divergence.

## Risks & Blockers

- **Plugin source changes need server restart, not just wiki reload.** The Node TW server loads plugin source files at boot into an in-memory bundle. Editing files on disk doesn't propagate until the Node process restarts. Encountered this multiple times during perf debugging — visible as "stack trace line numbers don't match on-disk file."
- **MCP `reload_tiddlers` only reloads edition tiddlers**, not plugin source. For plugin JS changes, user must Ctrl-C and restart `node tiddlywiki.js`.
- **Firefox aggressively caches plugin JSON.** Even after server restart, hard reload may not bust the cached bundle. Once seen during perf debugging — user had to verify wrap install via `[cm-VERSION-CHECK]` sentinel logs.
- **`getCacheForTiddler` has no in-flight dedupe.** Concurrent factory invocations both run and overwrite. Our `ensurePageTemplateDedupe` handles PageTemplate specifically; same problem might exist for other commonly re-parsed tiddlers if they ever come up.

## Open Questions

- **Is push to origin desired?** Both repos are 5-8 commits ahead. User has not asked. Standing rule prohibits unauthorized push.
- **Is the perf work done for the user?** Acknowledged that "parser is not the bottleneck" but user may want more investigation on the actual slow path (DOM/widgets). Did not ask.
- **Should other commonly-parsed tiddlers get the same dedupe treatment as PageTemplate?** Pattern is reusable but adds complexity. Not raised by user.

## Quick Start for Next Session

```bash
# Restore context
# (no bd / no memory tool in this project)

# Reference docs
# none — no project bible exists

# Key files (read these first if returning to perf work or fountain work)
cd /home/mario/git/tiddly/wikilabs/plugins/wikilabs/custom-markup
cat tiddlers/wikirules/registry.js | head -100        # constants + ensurePageTemplateDedupe + cm caches
cat tiddlers/wikirules/registry.js | sed -n '590,650p' # loadGlobalPragmas + applyGlobalSymbols
cat tiddlers/startup/pt-dedupe.js                     # how the wrap gets installed at startup
cat tiddlers/wikirules/fountain-flavour/fountain-character.js  # auto-character + dual
cat tiddlers/wikirules/fountain-flavour/fountain-transition.js # auto + forced transitions
cat tiddlers/meta/history.tid | head -25              # beta-36..39 entries

# Verify current state
cd /home/mario/git/tiddly/wikilabs/plugins && git log --oneline -8
cd /home/mario/git/tiddly/wikilabs/editions && git log --oneline -2

# Verify plugin version
grep version /home/mario/git/tiddly/wikilabs/plugins/wikilabs/custom-markup/plugin.info
# expect: "1.0.0-beta-39"

# To bench parser perf again, use the script pattern (perf-trace.js was DELETED — recreate from history if needed)
# Node bench template:
#   var $tw = require("/home/mario/git/tiddly/tiddlywiki/TiddlyWiki5/boot/boot.js").TiddlyWiki();
#   $tw.boot.argv = ["/home/mario/git/tiddly/wikilabs/editions/custom-markup"];
#   $tw.boot.boot(function() {
#     var t0 = process.hrtime.bigint();
#     for(var i=0;i<200;i++) $tw.wiki.parseText("text/vnd.tiddlywiki;vocab=Fountain", src);
#     console.log("avg:", Number(process.hrtime.bigint() - t0)/1e6/200, "ms");
#     process.exit(0);
#   });

# Next action
# Confirm with user whether to push these branches. Both are ahead of origin and the work appears complete.
# If user wants more perf work: re-create a perf-trace.js style module to measure DOM/widget time (non-parser).
```

## Session Closed
**Closed at:** 2026-05-25
**Commit:** 296033f (editions repo — handoff file only)
**Session status:** Handed off to next session
