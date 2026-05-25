# Markdown links + images + code spans — custom-markup v1.0.0-beta-41 → beta-43

**Date:** 2026-05-25
**Status:** COMPLETED
**Bead(s):** none
**Epic:** none
**Chain:** `standalone-977747ae` seq `3`
**Parent:** `HANDOFF_standalone-977747ae_fountain-print_2026-05-25.md`
**Prior chain:** `HANDOFF_standalone-977747ae_fountain-perf_2026-05-25.md` > `HANDOFF_standalone-977747ae_fountain-print_2026-05-25.md` > this

---

## Since Last Handoff

Parent's "Where We're Going" listed 5 options: (1) push, (2) reveal.js status, (3) deferred fountain spec gaps, (4) test industry layout, (5) move industry layout into plugin. User picked: 1=no, 2=keep disabled, 3=no, 4=no, 5=yes-queued. Then pivoted to a totally different direction — "I would like to optimise the markdown vocab now. IFF necessary." Session work content is unrelated to fountain-print but inherits the chain (continuation via paste-prompt).

- Push (option 1) **still deferred** — both repos remain ahead of origin even after 3 new commits this session.
- Other deferred fountain spec gaps (Notes, mid-dialogue parentheticals, scene numbers, escape sequences) still untouched.
- The markdown-vocab work expanded WAY beyond the initial "optimise IFF necessary" scope into a major engine expansion (new marker kind, ~5 new marker fields, two engine bugfixes) — driven by sequential user requests.
- Risks materialized: ~6+ iterations chasing wrong root causes on the "canonical URI doesn't render" bug (XXE theory, SVG complexity, URL choice, browser network) before the actual cause emerged — body text in the image tiddler taking priority over `_canonical_uri`. Same pattern as the parent session's reveal.js print-CSS misdiagnosis.

## The Goal

Three intertwined deliverables, all driven by sequential user prompts:

1. **beta-41 — markdown vocab cleanup**: three small optimizations the user asked me to investigate "IFF necessary" — engine consistency fix for the table marker, hot-path tweak for newline, init-boilerplate dedupe across 8 wikirules.
2. **beta-42 — linked-pair marker kind + open-variable field**: a new marker kind for `[body](link)`-shaped syntax (markdown links + images) plus a new marker field for variable-length delimiter runs (markdown code spans `` ` `` / `` `` `` / `` ``` ``). All driven through marker-tiddler fields, no DSL-specific JS — any vocab can repurpose. Full TW-markdown-plugin syntax compat (`#` prefix for internal targets, `<...>` angle-bracket wrap, trailing `"tooltip"` parameter). Plus two engine bug fixes that surfaced during testing (italic vs item-star collision; variable-length code span paragraph scoping).
3. **beta-43 — attr-X-from priority flip + CommonMark alt/tooltip mapping**: changed `attr-X-from` from "always override user" to "fill-in fallback when user didn't supply", with a smart accessibility exception for `alt`. IMAGE marker's `body-attribute` flipped from `tooltip` to `alt` so `![alt](src "tooltip")` maps CommonMark-cleanly.

End state: 3 plugin betas + 3 editions commits shipped, all behind one (still-unpushed) origin gap. Full marker-tiddler-driven implementation; no hardcoded JS per markdown construct.

## Where We Are

- Plugin repo on `master`: HEAD is `d1367fa` (beta-43). 7 commits ahead of `origin/master` (beta-37..43 all unpushed).
- Editions repo on `master`: HEAD is `7f57b62`. 5 commits ahead of `origin/master` (since `0449562` session-record + this session's 3).
- Plugin version: `1.0.0-beta-43`.
- Plugin HEAD subject: `cm: v1.0.0-beta-43 — attr-X-from is now a fallback; smart-alt rule`.
- Editions HEAD subject: `cm markdown: IMAGE alt-vs-tooltip mapping aligned with CommonMark`.
- Working tree clean except: `custom-markup-server/plans/handoffs/HANDOFF_standalone-977747ae_fountain-print_2026-05-25.md` modified ("Session Closed" footer carryover from prior session, intentionally untouched per parent handoff's standing note).
- All work verified renderable in the browser after server restart by the user. The canonical-URI image (the last bug) was confirmed working at the end.
- 8 new tiddlers shipped in editions: `vocab/markdown/LINK`, `vocab/markdown/IMAGE` (CODE was deleted then restored with new fields), 7 example tiddlers, 1 index tiddler, 1 test fixture.
- 1 file shipped binary in editions: `Motovun Jack.jpg` + `Motovun Jack.jpg.meta` (TW shadow materialized to disk so the base64-data example is self-contained).
- Marker Kinds doc has linked-pair as the 6th kind. Marker Fields doc has every new field documented with worked examples.
- ~4 small "almost-bug" patterns documented as commit/example-tiddler notes (image tiddlers with body text breaking `_canonical_uri`; tiddler titles with `(` `)` breaking markdown URL parsing; etc.).

## What We Tried (Chronological)

This section is long because the session had many iterations and a few false starts. Five rough phases:

| Phase | Span | Theme | Commit |
|---|---|---|---|
| A | items 1-8 | Onboarding + beta-41 markdown vocab cleanup | plugin `2cec6ff` + editions `2d8a919` |
| B | items 9-19 | linked-pair design + initial LINK/IMAGE + widget routing | (in-flight; commit at end of D) |
| C | items 20-35 | auto-external + heading collision + attr-X-from + TW-md-plugin compat | (in-flight) |
| D | items 36-50 | docs split + italic-vs-item-star engine fix + open-variable engine extension | plugin `c226e24` + editions `eac3f2b` |
| E | items 51-65 | consolidation + beta-43 alt/tooltip mapping + canonical-uri body-text bug | plugin `d1367fa` + editions `7f57b62` |


### Phase A — beta-41 vocab cleanup

1. **Onboarding** — read parent handoff, summarized state, verified git state (both repos at their session-start HEADs, all prior pushed per user), checked memory files (3 new from prior session), read key files (`fountain-page-break.js`, `$:/vocab/fountain/styles` transition fix, `Fountain Print - Industry Layout.tid`).
2. **Found discrepancy in parent commit**: parent's commit message claimed em→pt font conversion and HTML-comments-in-CSS for `$:/vocab/fountain/styles`, but `git show 41d80e2` for that file shows only a 1-line transition margin fix. Either user reverted those changes pre-commit but the message wasn't updated, or they never landed. Flagged to user — they didn't follow up; left as-is.
3. **User picked direction**: "I would like to optimise the markdown vocab now. IFF necessary" — explicit conditional, don't refactor for refactor's sake.
4. **Investigated markdown vocab** — 3 plugin wikirules (`markdown-newline.js`, `markdown-table.js`, `markdown-flavour/front-matter.js`), 1 vocab meta, 1 styles tiddler, 18 marker tiddlers.
5. **Found 3 optimization opportunities**:
   - `markdown-table.js` gated on `isActiveVocab("vocab/markdown")` (hardcoded vocab name) instead of `hasVocabFlag("tables")` — engine inconsistency vs every other vocab-gated rule.
   - `markdown-newline.js` constructed a new RegExp per `findNextMatch` call (hot path — `\n` is the most common inline-match position). `indexOf("\n")` does the same job zero-alloc.
   - 8 wikirules (3 markdown-flavour + 3 fountain-flavour + 2 marker-block/inline) all inlined the same ~7-line `parser.cmRegistry` init boilerplate.
6. **User: "Fix all 3"** — implemented:
   - Added `CmRegistry.ensureRegistry(parser)` static helper in `registry.js`. 8 wikirules refactored to use it.
   - `markdown-table.js`: `hasVocabFlag("tables")` + docstring update; added `tables: yes` field to `vocab/markdown` meta.
   - `markdown-newline.js`: `indexOf("\n")` + lookbehind for `\r` (so `\r?\n` semantics preserve match length).
7. **Smoke-tested `indexOf` against the old regex** in node — 11 edge cases (single `\n`, `\r\n`, startPos at `\r`, startPos mid-pair, EOF, etc.). All match.
8. **Committed**: plugin `2cec6ff` (11 files, +59/-82) + editions `2d8a919` (1 file: `tables: yes` on vocab meta).

### Phase B — beta-42 linked-pair design + initial LINK/IMAGE

9. **User: "Which plain text elements that are important for markdown are still missing?"** — listed 13: links, images, fenced code blocks, indented code, horizontal rules, autolinks, escape sequences, task lists, ref-style links, hard line break, setext headings, footnotes, definition lists. User picked #1 + #2 (links + images) "in one commit" with "as flexible as possible" for DSL authoring.
10. **Designed `kind: linked-pair`** — back-to-back-brackets matching: `open BODY close link-open LINK link-close`. Marker tiddler drives all four bracket literals + `link-attribute` (where the captured LINK goes) + optional `body-attribute` (where the body goes — children, or a plain-string attr like alt). Engine has zero markdown-specific code; markdown markers are configuration.
11. **Implemented in `registry.js`**: new fields parsed in `parseMarkerTiddler` (linkOpen, linkClose, linkAttribute, bodyAttribute); `buildLinkedPairArm` builds `(?:open[^close]*?close link-open[^link-close]*?link-close)` arm; `buildInlineArm` dispatches to it when `m.kind === "linked-pair"`; `rebuildRegexes` collects linked-pair markers into the inline regex.
12. **Implemented in `marker-inline.js`**: `parseLinkedPair(parser, marker, match)` — sets `parser.pos`, captures body (raw or inline-parsed depending on `body-attribute`), captures linkText, builds attrs, emits node. `identifyInlinePairMarker` updated to include linked-pair markers.
13. **Smoke-tested 22 regex cases in node** — basic, multi-per-line, parens-in-URL, parens-in-body, empty body, empty URL, nested brackets, etc.
14. **Created LINK + IMAGE markers** in editions — initial config: LINK `element: a`/`link-attribute: href`; IMAGE `element: img`/`link-attribute: src`/`body-attribute: alt`. Single comprehensive example tiddler `Example - Markdown links and images` showing both.
15. **User: "We also need examples that show them"** — created comprehensive example.
16. **User: "url link is able to open TW internal tiddlers without switching to an other site"** — clarified intent. Switched LINK to `element: $link`/`link-attribute: to` (TW widget for story-river navigation). Switched IMAGE to `element: $image`/`link-attribute: source`/`body-attribute: tooltip` (TW image widget routes URL or tiddler title natively).
17. **Engine update** — `parseLinkedPair` learned to emit widget-shaped nodes when `element` starts with `$`. Mirror of `buildNode`'s existing `$`-prefix handling for inline-pair markers. Parse tree shape: `{type: "image", tag: "$image", attributes: {...}}` (type is widget name without `$` prefix; tag retains the `$` for documentation).
18. **User: "we have an tw mcp server, so push examples to the story river"** — used MCP `edit_tiddler` on `$:/StoryList.list`. (`$:/config/SaverFilter` excludes StoryList from disk persistence — that's correct, story river is transient view state.)
19. **User: "The story river is the $:/StoryList list-field"** — already aligned. Confirmed.

### Phase C — auto-external + heading collision + attr-X-from + TW-md-plugin compat

20. **User: "internal links work. external don't"** — diagnosed: `<$link to="https://...">` treats `to` as tiddler title; URL ends up as a broken tiddler-title navigation. TW core's own prettylink rule splits internal-vs-external at parse time via `$tw.utils.isLinkExternal`.
21. **Added `auto-external: yes` field** — `marker-inline.js`'s parseLinkedPair, when `auto-external && isExternalLink(linkText)`, swaps the configured `$link` for a plain `<a href target="_blank" rel="noopener noreferrer">`. `isExternalLink` uses `$tw.utils.isLinkExternal` if available (regex: `^(file|http|https|mailto|ftp|irc|news|data):` or `^//`); falls back to a same-shape inline regex.
22. **User noted IMAGE rendering as a link** (not as an image) for `![alt](#X)` patterns at line start — diagnosed: TW core `heading` rule pattern is `(!{1,6})` (NO whitespace required after `!`), so `!` at line start gets eaten as `<h1>` before the inline IMAGE marker can see `![`.
23. **Fix**: added `heading` to `vocab/markdown`'s `disable-core-rules` field. The vocab now disables: `strikethrough codeinline list underscore table heading`.
24. **User: "alt-text and tooltip from source tiddler"** — wanted `Motovun Jack.jpg` shadow tiddler's `alt-text` field to populate the rendered `<img alt>` and `<img title>` attributes.
25. **Added `attr-<name>-from: <field>` mechanism** — registry's `parseAttrFromFields(fields)` helper scans for `^attr-(.+)-from$` field-name pattern, builds `attrFromFields: {<name>: <field>, ...}` map. `parseLinkedPair`, when source tiddler has the named field, emits an `indirect` attribute (`{type: "indirect", textReference: "<linkText>!!<field>"}`) on the rendered element — stays reactive across field changes.
26. **IMAGE marker got `attr-alt-from: alt-text` + `attr-tooltip-from: alt-text`** — both DOM alt and tooltip read from the source tiddler's `alt-text` field.
27. **Initial attr-X-from semantics: source field always wins.** This caused a bug: `![Motovun Jack](Motovun Jack.jpg)` rendered with the rendered title attribute showing "Motovun Jack" (the user's body) — not the source field. User reported this. Diagnosed: my body-attribute write was BEFORE attrFromFields, but the attrFromFields LOOP correctly overrode... wait no, the original order had attrFromFields FIRST then body-attribute, so body OVERRODE attrFromFields. Flipped order: body-attribute first, then attrFromFields override with parse-time check that source tiddler has the field.
28. **User: "TW md plugin uses `[x](#TiddlerTitle "tooltip")` syntax"** — quoted four variants: `#`-prefix, `%20` encoded, `<#X Y>` angle-bracket, escape `\<` `\>` inside angle-bracket. Plus reference-style links.
29. **Added three more marker fields** for TW-md-plugin compat:
    - `link-hash-prefix: yes` — recognize leading `#` on captured target; strip it; set `isInternal` flag (used to skip auto-external).
    - `link-tooltip-attribute: <attr>` — peel trailing `"..."` parameter and emit on the named attribute.
    - `link-angle-brackets: yes` — accept `<...>` wrap around target with `\<` / `\>` escapes inside.
30. **`parseLinkSyntax(raw, marker)` helper** in marker-inline.js — post-match decoding. Peels in fixed order: tooltip strip, angle-bracket unwrap, hash-prefix strip. Returns `{target, tooltip, isInternal}`.
31. **User: "can we handle this too? Reference Style Links"** — DEFERRED. Outlined what it'd need (new block wikirule for `[ref]: target` definitions, per-parser ref store, inline marker variant for `[text][ref]` — collision with LINK's `open: [` would need engine to support multi-marker per open). Left for a future beta.
32. **User: "Remove skype from isExternalLink"** — done (only comment had it; regex was already without).
33. **User: "`![alt text](#Motovun%20Jack.jpg)` does not work"** — diagnosed: `#`-strip leaves `Motovun%20Jack.jpg`; `wiki.getTiddler` looks up that literal (not "Motovun Jack.jpg"). Added `decodeURIComponent` after `#`-strip in parseLinkSyntax (try/catch — malformed escapes leave value as-is).
34. **User: "TW core has utility functions to render urls components. look at encodeuri and encodeuricomponent filter operators. see tag: String Operators"** — updated example tiddler limits note to point at these TW operators instead of generic "%29" advice.
35. **User: "We only support the TW-md-plugin syntax for consistency. But the backend should be as flexible as possible. So we do not remove any functionality from there. Except it is absolutely necessary"** — clarified: markers can be strict (frontend) while the engine stays permissive (backend). Extended `link-hash-prefix` to accept TWO values: `yes` (optional `#` recognition, legacy fall-through preserved) or `required` (`#` mandatory for internal; bare targets fall through to external `<a href>`). Markdown LINK ships with `required`; IMAGE ships with `yes` (image widget already routes URL vs tiddler natively).

### Phase D — docs split + 2 engine fixes (italic, multi-backtick)

36. **User: "describe the whole thing in detail. 1 tiddler PER possible configuration"** — split docs.
37. **Created 7 per-pattern example tiddlers** (3 LINK + 4 IMAGE variants): `Example - Markdown link (internal tiddler)`, `... (external URL)`, `... with inline formatting`, `Example - Markdown image (base64 data)`, `... (canonical URI)`, `... (external URL)`, `... with body override`. Plus a TW-md-plugin syntax tiddler each for LINK and IMAGE.
38. **User pointed at existing `Marker Fields` doc tiddler** — updated the canonical reference instead of creating a new one. Added rows for every new field. Added worked examples for `vocab/markdown/LINK` and `vocab/markdown/IMAGE` markers.
39. **Updated `Marker Kinds` tiddler** — added `linked-pair` as the 6th kind (after the existing 5: glyph, glyph-level, word, inline-pair, list-item).
40. **Renamed example tiddlers** — original titles had `(...)` in them (e.g. `Example - Markdown link (internal tiddler)`). Since markdown LINK URL parser cuts off at first `)`, cross-references like `[X](#Example - Markdown link (internal tiddler))` would have rendered broken. Renamed all 7 (and the index) to use ` - ` separator: `Example - Markdown link - internal tiddler`, etc.
41. **User: "use markdown syntax according to vocab=Markdown"** — converted all example tiddlers from TW wikitext (`!!` headings, `''bold''`, `[[X]]` prettylinks, `*` bullets) to markdown syntax (`##`, `**bold**`, `[X](#X)`, `-` bullets). The Marker Kinds + Marker Fields tiddlers stayed in TW wikitext (their type is plain `text/vnd.tiddlywiki`).
42. **User: "italic doesn't render in link body"** (Pattern 3 of inline-formatting example showed bold + code but NOT italic). Diagnosed:
    - `vocab/markdown/ITALIC` has `kind: inline-pair, open: *`.
    - `vocab/markdown/ITEM-STAR` has `kind: list-item, open: *`.
    - Both get loaded into `registry.markers["*"]` — same key. The second one to load wins.
    - In iteration order (alphabetical filter), ITALIC loads first, ITEM-STAR overwrites.
    - `rebuildRegexes` filters by kind for inline-only markers — finds ITEM-STAR (list-item), rejects it. No `*` arm in inline regex. Italic silently dropped.
43. **Engine fix — parallel `inlineMarkers` dict**:
    - `CmRegistry` constructor: `this.inlineMarkers = Object.create(null)` alongside `this.markers`.
    - `addFromFilter` + `activate`: dual-write inline-kind configs (inline-pair OR linked-pair) into `inlineMarkers`. `isInlineKind(kind)` helper.
    - `rebuildRegexes`: iterates `this.inlineMarkers` for inline arms (instead of filtering `this.list`).
    - `identifyInlinePairMarker` in marker-inline.js: iterates `registry.inlineMarkers`.
    - Result: ITALIC lives in `inlineMarkers["*"]`, ITEM-STAR lives in `markers["*"]`. Both work. (No symmetric `blockMarkers` dict — no current vocab has block-vs-block-same-open collisions.)
44. **User: "`` `code` `` doesn't work, renders as link"** (when source was `` `` [**bold** *italic* `code`](#target) `` ``). Diagnosed: CODE marker open=close=`` ` `` (single). Engine doesn't support multi-backtick CommonMark code spans. The 2-backtick opener matched as 1-backtick + 1-backtick = empty code span between, then LINK arm matched the rest as `[bold...](target)`.
45. **First fix attempt**: added `markdown-code-span.js` wikirule with full CommonMark code-span logic (variable backtick-run length, flanking constraints, single-space stripping). Vocab-gated via new `code-span: yes` flag.
46. **User pushback**: "Why did you remove the vocab/markdown/CODE IMO this reduces the capability of the DSL framework. Or do I see that wrong. What did you do instead?" — correct critique. Wikirule is JS-only; DSL authors can't get the same feature for their own delimiter just by authoring a marker.
47. **Reverted**: deleted the wikirule. Replaced with new marker field `open-variable: yes`:
    - In `parseMarkerTiddler`: `openVariable: f["open-variable"] === "yes"` (inline-pair only).
    - In `buildInlineArm`: when `m.openVariable`, return `(?<!{open}){open}+(?!{open})` — match a maximal flanked run.
    - In `marker-inline.js`: new `parseVariableInlinePair` function dispatched when `marker.openVariable`. Walks forward from match end looking for a same-length close run with the same non-open-flanking; emits body verbatim with CommonMark single-leading/trailing-space stripping.
    - CODE marker restored with `open-variable: yes` added to its fields. `code-span` vocab flag removed (no longer needed).
48. **Bug in first version of parseVariableInlinePair**: when no matching close existed within the paragraph, my code searched the whole `parser.source` forward and would find a later same-length run in a different paragraph (e.g. inside a fenced code-display block) → swallowed entire paragraphs as one giant code span.
49. **User reported via screenshot**: Pattern 6 ("no matching close, backtick stays literal") was instead consuming the next paragraph. Fixed: parseVariableInlinePair caps close-search at the next blank line (`/\n[ \t]*\n/`). Outside the current paragraph, no match — falls through to literal.
50. **Created `Example - Markdown code span` tiddler** — 5 patterns (single, double-with-inner-backtick, triple-with-inner-double, leading/trailing space stripping, no-matching-close) + "How the matching works" + "DSL flexibility" section with three illustrative-only marker configs (`<kbd>`, inline math `<span class=math>`, `<samp>`).

### Phase E — consolidation, beta-42 commit, beta-43 (alt-vs-tooltip priority + canonical-uri bug)

51. **User: "TW-md-plugin syntax tiddlers should be consolidated with the other tiddlers"** — merged the 5-pattern TW-md-plugin syntax tiddlers into the existing per-pattern tiddlers (the basic "internal tiddler" example absorbed all 5 LINK patterns; the "base64 data" example absorbed the 4 IMAGE patterns). Deleted the two consolidated-source tiddlers.
52. **User: "Example - Markdown links and images IMO should be Markdown links and images"** — renamed the index tiddler (dropped `Example - ` prefix). 9 child tiddlers updated to reference the new parent tag (via sed).
53. **User: "history should be much simpler"** — simplified the beta-42 history.tid entry from 8 dense bullets to 2 short lines per the existing `feedback_history_concise` memory.
54. **User: "make this commit-msg.md simpler"** — both repos' commit-msg files trimmed.
55. **Committed beta-42**: plugin `c226e24` (4 files: plugin.info + history.tid + marker-inline.js + registry.js; +471/-11 lines) + editions `eac3f2b` (18 files: 12 new + 4 modified marker/vocab + 2 binary Motovun Jack; +653/-13).
56. **User: "image alt-text and tooltip — user data overwrites vocab. If no body, use field. Smart-alt rule: short user-alt + rich source-alt → use source"** — major priority refactor. The behavior contract changed.
57. **beta-43 engine changes**:
    - `attr-X-from` semantics flipped from "always override user" to "fill-in fallback when user value absent". `if(!userAttr) attrs[attrName] = indirect`.
    - Added smart-alt rule: when `attrName === "alt"` AND user value is a `{type: "string"}` AND user words ≤ 2 AND source-field words ≥ 3 → use source via indirect anyway. New `countWords()` helper.
    - IMAGE marker: `body-attribute: alt` (was `tooltip`). Now CommonMark-clean: `![alt](src "tooltip")` → body→alt, `"..."`→tooltip.
58. **Updated 4 image example tiddlers** to reflect new alt-vs-tooltip mapping (the body-override example became the canonical "priority walkthrough" with 5 patterns).
59. **Pushed examples to story river** via MCP.
60. **User: "canonical uri does not render"** — bug report on the canonical-URI example.
61. **Misdiagnosis chain (~6 iterations)**:
    - First theory: Wikipedia logo SVG has DOCTYPE/`<!ENTITY>` declarations — browsers refuse to render SVGs with external entities via `<img>` for XXE security. Verified by `curl` of SVG content showing DOCTYPE+entities. Switched `_canonical_uri` to Wikimedia PNG thumbnail URL of the same logo.
    - Still broken. Switched test fixture to Motovun_Jack.svg (simple SVG, no DOCTYPE, 2.6KB single path). Verified URL responds 200 with `image/svg+xml` Content-Type.
    - Still broken. Switched `_canonical_uri` to `https://tiddlywiki.com/favicon.ico` (known-working URL in the external-URL example).
    - Still broken. Asked user to test direct widget: `<$image source="Motovun Jack.svg"/>` (bypass markdown vocab entirely).
    - User screenshot: bypass also broken — broken-image icon. Confirmed: bug is at the widget / wiki level, NOT in parseLinkedPair output.
62. **Actual root cause** found via reading TW image widget source:
    ```js
    if(text) {                                       // ← MY BODY TEXT MATCHED HERE
        src = "data:image/svg+xml," + encodeURIComponent(text);
    } else if(_canonical_uri) {                       // ← never reached
        src = _canonical_uri;
    }
    ```
    My `Motovun Jack.svg` tiddler had a `text` field (the documentation prose I added to its body explaining what the test fixture was for). TW's image widget interpreted the prose as the SVG content via a `data:` URL. Browser parsed prose as SVG → invalid XML → broken image fallback shows alt-text inline. ALL the URL theories were wrong; `_canonical_uri` was never reached.
63. **Fix**: removed body text from `Motovun Jack.svg.tid` (metadata fields only — `_canonical_uri`, `alt-text`, `source`, `type`, `tags`, `title`). Restored the original Wikimedia URL for the SVG (no longer needed the PNG thumbnail workaround). Deleted the diagnostic bypass tiddler.
64. **User: "Now it works. prepare commit"** → wrote commit-msg files. User: "commit" → committed beta-43.
65. **Beta-43 commit**: plugin `d1367fa` (3 files: plugin.info + history.tid + marker-inline.js; +35/-8) + editions `7f57b62` (8 files including `Wikipedia Logo.svg.tid` deleted, `Motovun Jack.svg.tid` created; +87/-66).

## Key Decisions

- **Linked-pair as a marker KIND, not a wikirule.** Same DSL-flexibility argument as page-break (parent session): vocab-agnostic engine extension; any vocab can declare `kind: linked-pair` markers with their own bracket literals and target attribute. Markdown's LINK and IMAGE are just two such configurations.

- **`$`-prefix on `element` field emits a TW widget node.** Lets the LINK marker emit `<$link>` (TW's tiddler-navigation widget) and IMAGE emit `<$image>` (TW's image widget). Mirrors the existing `inline-pair` `buildNode` behavior — same shape, same convention.

- **`auto-external` is opt-in, not always-on.** A DSL might want different routing semantics; the engine doesn't impose. Markdown LINK sets it; IMAGE doesn't (its widget already routes URL-vs-tiddler natively).

- **`parseLinkSyntax` does post-match decoding, not regex-based matching.** Keeps the regex simple (`(?:open[^close]*?close link-open[^link-close]*?link-close)`). Post-processing handles tooltip strip, angle-bracket unwrap, `#`-strip + decode. Easier to reason about; easier to extend.

- **`link-hash-prefix` is value-based (yes vs required), not boolean.** `yes` = recognise `#` as optional internal hint (legacy fall-through preserved for bare titles); `required` = `#` mandatory, bare targets route external. Markdown LINK uses `required` (strict TW-md-plugin semantics); IMAGE uses `yes`. Any DSL can pick. **Backend stays flexible, frontend is strict.** This explicit user-requested layering is important.

- **`attr-X-from` semantics CHANGED THREE TIMES** during the session — non-obvious decision history:
  1. First (beta-42 intermediate): source field always overrides body. User initially wanted this.
  2. Then (still beta-42): source field overrides only when parse-time check confirms tiddler exists AND field has value.
  3. Finally (beta-43): user-supplied value WINS; source field FILLS IN when user value is absent. Plus the smart-alt rule (1-2 word user-alt + 3+ word source-alt → source wins for accessibility).
  The final semantic is the one the user said they wanted; the earlier ones were my approximations.

- **Smart-alt rule is HARDCODED for `attr === "alt"`** — not generic across attributes. The reasoning is accessibility-specific (screen readers benefit from richer alt). For other attributes (tooltip, title, etc.), short user-supplied values are usually intentional and shouldn't be overridden by a richer source field.

- **`open-variable` is a marker field, not a wikirule.** Pushback from the user explicitly rejected the wikirule approach: "this reduces the capability of the DSL framework". Field-based design lets any inline-pair marker (CODE, KBD, MATH, etc.) opt into variable-length delimiter runs.

- **Parallel `inlineMarkers` dict instead of restructuring `this.markers`.** Minimal-blast-radius fix for the inline/block kind collision (italic vs item-star). `this.markers` shape is unchanged; all existing consumers (findByOpen, mergeSymbolsFrom, etc.) keep working. The new dict is consumed only by inline-regex-related code paths.

- **No symmetric `blockMarkers` dict** — no current vocab has block-vs-block-same-open collisions. Added the inline dict because the bug needed fixing now; deferred the symmetric block dict as YAGNI until a real collision appears.

- **IMAGE `body-attribute: alt` (was `tooltip`)** — aligns with CommonMark `![alt](src "title")` mapping. Initially set to `tooltip` because earlier user feedback wanted body to fill in tooltip on hover. Re-aligned in beta-43 when user clarified the priority model.

- **Image tiddlers must have empty body text** — discovered via the canonical-uri misdiagnosis chain. Documented in beta-43 commit-msg. NOT documented in user-facing docs (Marker Fields, vocab/markdown/IMAGE description) — should be, as a follow-up. The TW widget's `if(text) { base64 } else if(_canonical_uri)` branch order is a footgun for anyone wanting to add docs to an image tiddler.

- **Tiddler titles with parens are problematic** — discovered during example-tiddler creation. Markdown LINK regex stops URL capture at first `)`, so `[X](#Example - Markdown link (internal tiddler))` doesn't work. Renamed all examples to use ` - ` separator instead.

- **Examples use markdown syntax inside `vocab=Markdown` tiddlers** — explicit user feedback. `[X](#Y)` for internal links, `##` for headings, `-` for bullets, `**bold**` for emphasis. The reference docs (Marker Kinds, Marker Fields) are plain `text/vnd.tiddlywiki` and use TW wikitext.

- **History.tid concise (1-2 lines per version), commit-msg.md also concise** — explicit user feedback this session reinforced the existing `feedback_history_concise` memory. Per-version bullets describe what's new for the USER, not implementation details. Commit-msg gives factual dev summary with key engine identifiers but no diff narration.

## Evidence & Data

### Plugin commits this session

| Hash | Version | Files | Lines | Subject |
|---|---|---|---|---|
| `2cec6ff` | beta-41 | 11 | +59/-82 | markdown vocab cleanup + hot-path tweak + init dedupe |
| `c226e24` | beta-42 | 4 | +471/-11 | linked-pair marker kind + open-variable field |
| `d1367fa` | beta-43 | 3 | +35/-8 | attr-X-from is now a fallback; smart-alt rule |

### Editions commits this session

| Hash | Files | Lines | Subject |
|---|---|---|---|
| `2d8a919` | 1 | +1 | opt vocab into `tables` flag |
| `eac3f2b` | 18 | +653/-13 | links, images, code spans (TW-md-plugin syntax) |
| `7f57b62` | 8 | +87/-66 | IMAGE alt-vs-tooltip mapping aligned with CommonMark |

### Marker fields added across beta-42 / beta-43 (inline-pair / linked-pair)

| Field | Kind scope | Default | Purpose |
|---|---|---|---|
| `link-open` | linked-pair | `(` | Opening literal for the LINK capture portion of `open BODY close link-open LINK link-close`. |
| `link-close` | linked-pair | `)` | Closing literal for LINK capture. |
| `link-attribute` | linked-pair | `href` | Attribute name on the rendered element where the LINK capture text is emitted. (`to` for $link, `source` for $image.) |
| `body-attribute` | linked-pair | (unset) | When set, body becomes a plain-text attribute of this name on the element (no inline parsing, skipped when body is empty). |
| `auto-external` | linked-pair | `no` | When `yes`, URL-shaped LINK targets emit `<a href target="_blank" rel="noopener noreferrer">` instead of the configured element. |
| `attr-<name>-from` | linked-pair | (unset) | Wire `<name>` attribute to a field on the source tiddler. Fallback when user didn't supply (beta-43 semantics). Smart-alt rule for `attr === "alt"`. |
| `link-hash-prefix` | linked-pair | (unset) | `yes` = optional `#` recognition + decodeURIComponent. `required` = `#` mandatory; bare targets route external. |
| `link-tooltip-attribute` | linked-pair | (unset) | When set, trailing `"..."` parameter peeled off and emitted on this attribute. |
| `link-angle-brackets` | linked-pair | `no` | When `yes`, accepts `<...>` wrap around target (with `\<` / `\>` escapes inside). |
| `open-variable` | inline-pair | `no` | When `yes`, open is treated as single char that can repeat 1..N times; close must match same N with non-open flanking. Body verbatim. CommonMark single-space stripping. |

### Markdown LINK marker (final state)

```
title: vocab/markdown/LINK
kind: linked-pair
open: [
close: ]
link-open: (
link-close: )
element: $link
link-attribute: to
auto-external: yes
link-hash-prefix: required
link-angle-brackets: yes
link-tooltip-attribute: tooltip
classes: .wltc-md-link
```

### Markdown IMAGE marker (final state, beta-43)

```
title: vocab/markdown/IMAGE
kind: linked-pair
open: ![
close: ]
link-open: (
link-close: )
element: $image
link-attribute: source
body-attribute: alt
attr-alt-from: alt-text
attr-tooltip-from: alt-text
link-hash-prefix: yes
link-angle-brackets: yes
link-tooltip-attribute: tooltip
classes: .wltc-md-image
```

### Markdown CODE marker (final state, beta-42)

```
title: vocab/markdown/CODE
kind: inline-pair
open: `
close: `
allow-symbol: no
element: code
body-raw: yes
open-variable: yes
classes: .wltc-md-code
```

### attr-X-from priority resolution (final beta-43 semantics)

For each `attr-<name>-from: <field>` declaration:

| User-supplied value | Source tiddler has field? | Result |
|---|---|---|
| Empty / absent | Yes (any length) | Source field via indirect attribute (reactive at render time). |
| Empty / absent | No | Attribute not emitted. |
| Non-empty, ≥3 words (or attr ≠ "alt") | Yes | User value wins. |
| Non-empty, 1-2 words, attr == "alt" | Source field is ≥3 words | Source wins (accessibility — richer alt-text for screen readers). |
| Non-empty, 1-2 words, attr == "alt" | Source field is ≤2 words | User value wins. |
| Non-empty | URL target (no tiddler lookup) | User value wins. |

### Code-span matching algorithm (parseVariableInlinePair, beta-42)

1. Find a maximal run of `open` chars flanked by non-`open` on both sides — that's the opener. Its length is N.
2. Walk forward looking for the FIRST same-length run with the same flanking property. Runs of length ≠ N are content (skipped).
3. Search is capped at the next blank line (`\n[ \t]*\n`). Beyond that, no match.
4. If no close found in-paragraph, emit the opener as plain text and continue.
5. If found, body = source[bodyStart : closeStart]. Apply CommonMark single-space stripping (when body has both leading and trailing space AND any non-whitespace).
6. Emit element node (configurable via `element` field).

### TW-md-plugin syntax variants supported

| Pattern | LINK (strict) | IMAGE (lenient) |
|---|---|---|
| `[X](#Y)` — # prefix, no spaces | ✓ | ✓ |
| `[X](#Y%20Z)` — URL-encoded spaces | ✓ (decoded) | ✓ (decoded) |
| `[X](<#Y Z>)` — angle-bracket wrap | ✓ | ✓ |
| `[X](<#How to use \<$list\>>)` — escapes inside `<...>` | ✓ | ✓ |
| `[X](#Y "tooltip")` — tooltip parameter | ✓ | ✓ |
| `[X](<#Y> "tooltip")` — combined | ✓ | ✓ |
| `[](<#Y>)` — empty body | ✓ | ✓ |
| `[X](Y)` — bare title, no `#` | Routes external (`required` mode) | Stays internal (widget handles both) |
| `[X](https://...)` — URL | Routes external via auto-external | Widget handles URL natively |

### Engine fix: italic vs item-star collision

**Before fix:**
- `vocab/markdown/ITALIC` (kind=inline-pair, open=`*`) loads → `markers["*"] = ITALIC config`.
- `vocab/markdown/ITEM-STAR` (kind=list-item, open=`*`) loads next → `markers["*"] = ITEM-STAR config` (overwrites).
- `rebuildRegexes` for inline: filters `this.list` by kind, finds ITEM-STAR (list-item), rejects it. NO `*` arm in inline regex.
- `*italic*` doesn't fire ANYWHERE inline (not just inside link bodies — globally).

**After fix:**
- `this.inlineMarkers["*"] = ITALIC config` (dual-write at load time).
- `this.markers["*"] = ITEM-STAR config` (last wins in flat dict, unchanged behavior).
- `rebuildRegexes` for inline iterates `this.inlineMarkers` → includes ITALIC's `*` arm.
- `rebuildRegexes` for block iterates `this.markers` (filtered by block kinds) → includes ITEM-STAR.
- Both work.

### Canonical-uri misdiagnosis chain

Long chain of wrong theories before the real bug emerged. Documented as a cautionary tale:

| Theory | Action | Result |
|---|---|---|
| Wikipedia SVG has XXE entities | Switched to Wikimedia PNG thumbnail | Still broken |
| SVG too complex for `<img>` rendering | Switched to Motovun_Jack.svg (simple 2.6KB single-path SVG) | Still broken |
| Wikimedia URL blocked by user's environment | Switched to `https://tiddlywiki.com/favicon.ico` (known-working in another example) | Still broken |
| TW server has stale JS | Asked user to confirm restart | User: "restarted several times" |
| Issue is in widget / wiki, not engine | Asked user to test bypass: `<$image source="Motovun Jack.svg"/>` | User confirmed: bypass also broken — narrowed to widget/wiki level |
| **Actual cause**: tiddler had body text; widget's branch order prefers `text` field over `_canonical_uri` | Removed body from `Motovun Jack.svg.tid` | Works |

### Engine identifier inventory (final state, beta-43)

| File | Function / dict | Added beta |
|---|---|---|
| `registry.js` | `CmRegistry.ensureRegistry(parser)` static helper | 41 |
| `registry.js` | `this.inlineMarkers` dict | 42 |
| `registry.js` | `isInlineKind(kind)` helper | 42 |
| `registry.js` | `parseAttrFromFields(fields)` helper | 42 |
| `registry.js` | `buildLinkedPairArm(m)` | 42 |
| `marker-inline.js` | `parseLinkedPair(parser, marker, match)` | 42 |
| `marker-inline.js` | `parseLinkSyntax(raw, marker)` | 42 |
| `marker-inline.js` | `parseVariableInlinePair(parser, marker, match)` | 42 |
| `marker-inline.js` | `identifyInlinePairMarker(matchText, registry)` — now uses inlineMarkers | 42 |
| `marker-inline.js` | `isExternalLink(value)` | 42 |
| `marker-inline.js` | `countWords(value)` | 43 |

### Test fixture rename trail (canonical-URI debugging)

The canonical-URI bug took 5 iterations before the actual cause emerged. The test fixture went through these states:

| Iteration | Tiddler title | `_canonical_uri` | type | Body | Result |
|---|---|---|---|---|---|
| 1 | `Wikipedia Logo.svg` | `https://upload.wikimedia.org/wikipedia/commons/8/80/Wikipedia-logo-v2.svg` | `image/svg+xml` | Body text (docs prose) | Broken — assumed XXE issue with DOCTYPE entities |
| 2 | `Wikipedia Logo.svg` | `.../thumb/8/80/Wikipedia-logo-v2.svg/120px-...-v2.svg.png` | `image/png` | Body text | Broken — assumed PNG also blocked |
| 3 | `Motovun Jack.svg` (renamed) | `https://upload.wikimedia.org/wikipedia/commons/a/a4/Motovun_Jack.svg` | `image/svg+xml` | Body text | Broken — assumed Wikimedia network issue |
| 4 | `Motovun Jack.svg` | `https://tiddlywiki.com/favicon.ico` (known-working) | `image/svg+xml` | Body text | Broken — confirmed not URL-specific |
| 5 (FINAL) | `Motovun Jack.svg` | `https://upload.wikimedia.org/wikipedia/commons/a/a4/Motovun_Jack.svg` | `image/svg+xml` | **Empty** | Works |

The actual fix was removing the body text — TW image widget's `if(text) { base64 } else if(_canonical_uri) { url }` branch order meant the body prose was being encoded as `data:image/svg+xml,...` and the browser silently rejected the malformed SVG. The 5 URL/type swaps were all looking in the wrong place.

### Smoke-test cases (linked-pair regex, run in node during Phase B)

22 input cases tested against the combined LINK + IMAGE inline regex:

| Input | Expected match | Notes |
|---|---|---|
| `[Google](https://google.com)` | Full | Basic external link |
| `![Logo](logo.png)` | Full | Basic image |
| `Hello [link](url) world` | `[link](url)` only | Mid-text |
| `pre [a](b) mid ![c](d) end` | Both | Multiple per line |
| `plain [ not a link` | None | Bare `[` falls through |
| `[no close` | None | Unclosed body |
| `[link]no-paren` | None | Missing URL portion |
| `[](empty-body)` | Full | Empty body allowed |
| `mix [**bold** link](url) ok` | `[**bold** link](url)` | Emphasis inside body |
| `[link with *em*](u)` | Full | Italic inside body |
| `multi\nline [link\nbody](url)` | None | Newline in body forbidden |
| `![](empty-alt)` | Full | Empty alt allowed |
| `before [a](one) [b](two) after` | Both | Multiple matches |
| `nested [outer [inner](u1)](u2)` | `[outer [inner](u1)` | Lazy match stops at first `]` |
| `esc \[notlink](url)` | `[notlink](url)` | Backslash not honored (no escape sequences yet) |
| `[hello (world)](url)` | Full | Parens inside body OK |
| `[link](url with (paren))` | `[link](url with (paren)` | Parens-inside-URL: first `)` cuts off — known limit |
| `[link](https://a.com/path?q=1&r=2)` | Full | Querystring chars OK |
| `![alt with (paren)](img.png)` | Full | Parens inside alt OK |
| `[has "quotes"](url)` | Full | Quotes inside body OK |
| `[](url)` | Full | Empty body |
| `[link]()` | Full | Empty URL |

### Smoke-test cases (indexOf newline, run in node during Phase A)

11 input cases comparing OLD regex (`/\r?\n/g`) vs NEW (`indexOf("\n")` + `\r` check):

| Input | startPos | Old match | New match | Result |
|---|---|---|---|---|
| `ab\ncd` | 0 | `[2,3]` | `[2,3]` | MATCH |
| `ab\r\ncd` | 0 | `[2,4]` | `[2,4]` | MATCH |
| `ab\r\ncd` | 2 | `[2,4]` | `[2,4]` | MATCH |
| `ab\r\ncd` | 3 | `[3,4]` | `[3,4]` | MATCH |
| `ab\ncd\r\nef` | 0 | `[2,3]` | `[2,3]` | MATCH |
| `ab\ncd\r\nef` | 3 | `[5,7]` | `[5,7]` | MATCH |
| `ab\ncd\r\nef` | 4 | `[5,7]` | `[5,7]` | MATCH |
| `abcd` | 0 | null | null | MATCH |
| `\n` | 0 | `[0,1]` | `[0,1]` | MATCH |
| `\r\n` | 0 | `[0,2]` | `[0,2]` | MATCH |
| `\r\n` | 1 | `[1,2]` | `[1,2]` | MATCH |

All 11 match — the indexOf optimization is behaviorally identical to the regex.

### Parse-tree shape examples

For `[link text](#vocab/markdown/LINK)` (LINK marker, strict mode, `#` prefix):

```js
{
    type: "link",
    tag: "$link",
    attributes: {
        class: {type: "string", value: "wltc-md-link wltc"},
        to: {type: "string", value: "vocab/markdown/LINK"}
    },
    children: [{type: "text", text: "link text"}]
}
```

For `[TiddlyWiki](https://tiddlywiki.com "Opens in new tab")` (LINK marker, auto-external + tooltip):

```js
{
    type: "element",
    tag: "a",
    attributes: {
        class: {type: "string", value: "wltc-md-link wltc"},
        tooltip: {type: "string", value: "Opens in new tab"},
        href: {type: "string", value: "https://tiddlywiki.com"},
        target: {type: "string", value: "_blank"},
        rel: {type: "string", value: "noopener noreferrer"}
    },
    children: [{type: "text", text: "TiddlyWiki"}]
}
```

For `![](#Motovun Jack.jpg)` (IMAGE marker, empty body, source has alt-text field):

```js
{
    type: "image",
    tag: "$image",
    attributes: {
        class: {type: "string", value: "wltc-md-image wltc"},
        alt: {type: "indirect", textReference: "Motovun Jack.jpg!!alt-text"},
        tooltip: {type: "indirect", textReference: "Motovun Jack.jpg!!alt-text"},
        source: {type: "string", value: "Motovun Jack.jpg"}
    }
}
```

For `![Pic](#Motovun Jack.jpg)` (IMAGE marker, short user alt, smart-alt rule triggers):

```js
{
    type: "image",
    tag: "$image",
    attributes: {
        class: {type: "string", value: "wltc-md-image wltc"},
        alt: {type: "indirect", textReference: "Motovun Jack.jpg!!alt-text"},   // smart-alt: "Pic" (1 word) lost
        tooltip: {type: "indirect", textReference: "Motovun Jack.jpg!!alt-text"}, // no user tooltip → source
        source: {type: "string", value: "Motovun Jack.jpg"}
    }
}
```

For `` ``contains ` tick`` `` (CODE marker, open-variable, 2-backtick delimiter):

```js
{
    type: "element",
    tag: "code",
    attributes: {
        class: {type: "string", value: "wltc-md-code wltc"}
    },
    children: [{type: "text", text: "contains ` tick"}]
}
```

### Repos ahead-of-origin state

| Repo | Commits ahead | Branch | Notes |
|---|---|---|---|
| `wikilabs/plugins` | 7 | master | beta-37..43 all unpushed |
| `wikilabs/editions` | 5 | master | Prior session's `0449562` + this session's 3 + `6edb86e` docs all unpushed |

### Working tree (current, both repos)

- Plugin: clean.
- Editions: clean except `custom-markup-server/plans/handoffs/HANDOFF_standalone-977747ae_fountain-print_2026-05-25.md` (unstaged "Session Closed" footer from prior session — carried forward intentionally per parent's standing note).

## Code Analysis

- **`parseLinkSyntax` peel order matters.** `tooltip → angle-bracket → hash` is the correct order because: tooltip is at the END of the captured target (after a possible `<...>` wrap); angle-bracket is at both ENDS; `#` is at the START (which is INSIDE the angle-bracket wrap, so unwrap-then-strip works). Reversing any pair would break valid inputs.

- **`parseVariableInlinePair`'s flanking check** uses `(?<!{open}){open}+(?!{open})`. JavaScript regex lookbehind support is ES2018+. The engine relies on this. Was tested in node directly. Older browsers without lookbehind support would break the regex entirely.

- **`isInlineKind(kind)` is defined in `registry.js`, not exported.** Both `addFromFilter` and `activate` use it via closure. If we ever need block-side parallel dict logic, the helper should be exported and used symmetrically.

- **`<$image>` widget's branch order** (`if(text) { base64 } else if(_canonical_uri) { url } else { lazy load }`) means an image tiddler with body text **always** loses its `_canonical_uri` because text is interpreted as the inline image data (utf8-encoded into a `data:` URL). This is a TW core behavior, not a custom-markup bug; image-tiddler authors must keep body empty if they want canonical_uri rendering.

- **`isExternalLink` regex** matches `(file|http|https|mailto|ftp|irc|news|data):` schemes plus protocol-relative `//`. `skype:` removed per user feedback (not used). Uses `$tw.utils.isLinkExternal` when available (TW core's canonical regex).

- **`parseAttrFromFields`** scans for the `^attr-(.+)-from$` regex pattern on ALL marker tiddler fields. Each match becomes one entry in `config.attrFromFields`. Multiple `attr-X-from` declarations per marker are supported.

- **`countWords`** trims leading/trailing whitespace then splits on `\s+`. Empty string returns 0. Non-string input returns 0. Used only by the smart-alt rule (1-2 word user-alt + 3+ word source-alt).

- **`$:/StoryList.list` editing via MCP** persists ONLY in-memory ("excluded by `$:/config/SaverFilter`"). This is the correct TW behavior — story-river view state should NOT round-trip to disk. The user-confirmed pattern: MCP `edit_tiddler` on `$:/StoryList` works as a runtime push.

- **Engine vs vocab vs example layering** — engine (registry.js + marker-inline.js + marker-block.js) is vocab-agnostic. Vocab tiddlers (vocab_markdown_*, vocab_fountain_*) configure markers. Example tiddlers (Example - Markdown ...) demonstrate usage and have type `text/vnd.tiddlywiki;vocab=Markdown`. Reference docs (Marker Kinds, Marker Fields) use plain `text/vnd.tiddlywiki` (TW wikitext, no vocab).

## Files Changed

### Plugin engine (3 betas: 41, 42, 43)

- `wikilabs/custom-markup/plugin.info` — version bumps (beta-41 → beta-42 → beta-43).
- `wikilabs/custom-markup/tiddlers/meta/history.tid` — 3 short bullet sets.
- `wikilabs/custom-markup/tiddlers/wikirules/registry.js` — major engine extension: `ensureRegistry` static helper (41), linked-pair kind + new fields (linkOpen/Close/Attribute, bodyAttribute, autoExternal, attrFromFields, linkHashPrefix, linkTooltipAttribute, linkAngleBrackets, openVariable) + `buildLinkedPairArm` + `parseAttrFromFields` + parallel `inlineMarkers` dict + `isInlineKind` helper (42). No new code in 43 (handled in marker-inline.js).
- `wikilabs/custom-markup/tiddlers/wikirules/marker-inline.js` — major engine extension: `ensureRegistry` refactor (41), `parseLinkedPair`, `parseLinkSyntax`, `parseVariableInlinePair`, `isExternalLink`, updated `identifyInlinePairMarker` to use `inlineMarkers` dict, dispatch in `parse()` (42). `countWords` helper + attr-X-from fallback semantics + smart-alt rule (43).
- `wikilabs/custom-markup/tiddlers/wikirules/markdown-flavour/markdown-table.js` — `hasVocabFlag("tables")` instead of hardcoded `isActiveVocab` (41).
- `wikilabs/custom-markup/tiddlers/wikirules/markdown-flavour/markdown-newline.js` — `indexOf("\n")` instead of `new RegExp(...).exec()` (41).
- `wikilabs/custom-markup/tiddlers/wikirules/markdown-flavour/front-matter.js` — `ensureRegistry` refactor (41).
- `wikilabs/custom-markup/tiddlers/wikirules/fountain-flavour/fountain-character.js` — `ensureRegistry` refactor (41).
- `wikilabs/custom-markup/tiddlers/wikirules/fountain-flavour/fountain-transition.js` — `ensureRegistry` refactor (41).
- `wikilabs/custom-markup/tiddlers/wikirules/fountain-flavour/fountain-page-break.js` — `ensureRegistry` refactor (41).
- `wikilabs/custom-markup/tiddlers/wikirules/marker-block.js` — `ensureRegistry` refactor (41).
- (`wikilabs/custom-markup/tiddlers/wikirules/markdown-flavour/markdown-code-span.js` — briefly added in 42 iteration, then deleted before commit.)

### Editions — vocab metas + markers

- `custom-markup/tiddlers/vocab_markdown.tid` — `tables: yes` field added (41); description updated; `disable-core-rules` extended with `heading` (42).
- `custom-markup/tiddlers/vocab_markdown_LINK.tid` — NEW (42); linked-pair config with $link widget, auto-external, hash-required, angle-brackets, tooltip-attribute.
- `custom-markup/tiddlers/vocab_markdown_IMAGE.tid` — NEW (42); linked-pair config with $image widget, attr-X-from for alt/tooltip, hash-yes. `body-attribute` changed from `tooltip` to `alt` (43).
- `custom-markup/tiddlers/vocab_markdown_CODE.tid` — DELETED in 42 iteration (when wikirule was briefly tried), then RECREATED in 42 with `open-variable: yes` field.

### Editions — example tiddlers (markdown vocab)

- `custom-markup/tiddlers/Markdown links and images.tid` — NEW (42); index tiddler (renamed from `Example - Markdown links and images` per user feedback).
- `custom-markup/tiddlers/Example - Markdown link - internal tiddler.tid` — NEW (42); 5 patterns: `#` prefix, URL-encoded, angle-bracket, tooltip, empty body.
- `custom-markup/tiddlers/Example - Markdown link - external URL.tid` — NEW (42); auto-external routing demo. Tooltip variant added (43).
- `custom-markup/tiddlers/Example - Markdown link - inline formatting.tid` — NEW (42); emphasis inside link body.
- `custom-markup/tiddlers/Example - Markdown image - base64 data.tid` — NEW (42); 4 patterns. Rewritten for alt-vs-tooltip mapping (43).
- `custom-markup/tiddlers/Example - Markdown image - canonical URI.tid` — NEW (42); `_canonical_uri` rendering path.
- `custom-markup/tiddlers/Example - Markdown image - external URL.tid` — NEW (42); URL source. Accessibility note rewritten (43).
- `custom-markup/tiddlers/Example - Markdown image - body override.tid` — NEW (42); body-vs-source-field priority. Rewritten in 43 as the canonical "5-pattern priority walkthrough" with the smart-alt rule demo.
- `custom-markup/tiddlers/Example - Markdown code span.tid` — NEW (42); 5 patterns + "How the matching works" + "DSL flexibility" section with KBD/math/samp illustrative configs.

### Editions — reference docs

- `custom-markup/tiddlers/Marker Kinds.tid` — `linked-pair` added as 6th kind, `open-variable` mentioned as notable inline-pair field.
- `custom-markup/tiddlers/Marker Fields.tid` — every new field added to the field tables (organized by Identity / Output / Parsing clusters). Worked examples for LINK and IMAGE markers added/updated.

### Editions — test fixtures

- `custom-markup/tiddlers/Motovun Jack.jpg` + `.meta` — TW shadow tiddler materialized to disk so the base64-data example is self-contained (42).
- `custom-markup/tiddlers/Wikipedia Logo.svg.tid` — NEW (42), then DELETED (43) when canonical-uri diagnosis renamed.
- `custom-markup/tiddlers/Motovun Jack.svg.tid` — NEW (43); metadata-only test fixture for the `_canonical_uri` rendering path. **Body MUST stay empty** — TW image widget's branch order prefers `text` over `_canonical_uri`.

### Memory files (none added this session)

The session reused existing memories:
- `feedback_history_concise` — 1-2 short bullets per version. Honoured.
- `feedback_no_claude_attribution` — no Co-Authored-By or AI-attribution. Honoured.
- `feedback_commit_workflow` — "commit" = create commit-msg + bump history, not run git commit. Honoured.
- `feedback_commit_review` — wait for user review. Honoured.
- `feedback_mcp_tools_for_tiddlers` — used MCP tools throughout.
- `feedback_tiddler_persistence` — listen=false at session start; used file Edit for disk-persistent tiddlers, MCP only for transient state (`$:/StoryList`).

## User Feedback & Preferences

Heavy session for user direction — many iterations and corrections. Standing items reinforced:

- **"IFF necessary"** — initial scope guard on the markdown vocab work. User doesn't want refactor-for-its-own-sake; investigate first, then commit only to changes with real value.
- **"as flexible as possible. We want to be able to create DSLs"** — STANDING THEME across the whole session. Every engine extension this session was held to this bar. Wikirule-vs-marker-field debate (Phase D, item 46) is the cleanest example: user rejected the wikirule approach explicitly because it reduced DSL surface.
- **"We only support the TW-md-plugin syntax for consistency. But the backend should be as flexible as possible. So we do not remove any functionality from there. Except it is absolutely necessary"** — explicit backend/frontend layering. Markdown markers are strict; engine remains permissive. Resulted in `link-hash-prefix: yes` vs `required` two-value design.
- **"go with [option from my list]"** — user picks ONE option from offered choices. Don't expand into adjacent work unless asked.
- **"Do NOT show examples that do not make sense"** — Pattern 2 of the code-span example (double backtick with no inner backtick) was redundant with Pattern 1; user removed it.
- **"history should be much simpler"** + **"make this commit-msg.md simpler"** — reinforces `feedback_history_concise`. Multiple iterations of trimming bullets; user prefers 1-2 short lines per version, ~5 short bullets per commit-msg.
- **"we have an tw mcp server, so push examples to the story river"** — when the user provides a tool, USE IT. Don't ask them to do manual steps that MCP can automate.
- **"see tag: String Operators"** / **"TW core has utility functions"** — when pointing me at TW docs, the user expects me to find the right operator/filter and reference it correctly (e.g. `encodeuricomponent[]` not "%29").
- **"Do we have a detailed documentation for this behaviour?"** — after engine work, expects docs to follow. Generally prefers docs in EXISTING canonical tiddlers (Marker Fields, Marker Kinds) over new ones, except for usage patterns which should be per-pattern example tiddlers.
- **"IMO instead of 1 tiddler with every possibility, there should be 1 tiddler PER possible configuration and usage pattern"** — split docs into focused per-pattern tiddlers. Then later: "tiddlers should be consolidated... NOT duplicated" — when later examples absorbed the per-pattern content fully, the original consolidated tiddler became redundant and was deleted. Both moves are pro-clarity.
- **"image alt-text and tooltip are used from the link. So user data overwrites vocab. If no body, use field. Smart-alt rule"** — explicit priority spec for beta-43. User-supplied wins; source field fallback; smart override only for alt accessibility.
- **"Now it works. prepare commit"** / **"commit"** — TWO-STEP commit workflow. "Prepare" writes commit-msg.md; "commit" runs git commit. Memory `feedback_commit_workflow` codifies this.
- **"does not work either"** — terse but informative bug report. User is patient through misdiagnoses but expects me to widen the search.
- **"<$image source='Motovun Jack.svg'/> does not work"** — when I asked for the bypass test, user actually ran it and reported. Good debugging cooperation.
- **"I did restart the server several times"** — preemptively answered my "have you restarted?" question. User is anticipating my diagnostic flow.
- **"why did you remove the vocab/markdown/CODE IMO this reduces the capability of the DSL framework"** — pushback on architectural regression. Important to absorb: when user critiques an architectural choice, REVERT and REDESIGN, don't try to defend the prior choice.

### Direct quotes worth preserving

The user's actual phrasing for several key direction-setting moments:

> "make 1 and 2 together in one commit. But make sure we want to be able to create DSLs so it should be as flexible as possible."

> "It also is important that the url link is able to open TW internal tiddlers without switching to an other site"

> "we have an tw mcp server, so push examples to the story river"

> "We only support the TW-md-plugin syntax for consistency. But the backend should be as flexible as possible. So we do not remove any functionality from there. Except it is absolutely necessary"

> "IMO instead of 1 tiddler with every possibility, there should be 1 tiddler PER possible configuration and usage pattern"

> "Why did you remove the vocab/markdown/CODE IMO this reduces the capability of the DSL framework. Or do I see that wrong. What did you do instead?"

> "If alt-text is only 1 or 2 words, and alt-text from vocab/ is >= 3 words use the vocab/ alt-text, because it is more detailed."

> "Do NOT show examples that do not make sense"

> "history should be much simpler"

> "make this commit-msg.md simpler."

> "I did restart the server several times" (preempting my "have you restarted?" diagnostic)

> "Now it works. prepare commit"

These are the calibration phrases that should shape the NEXT session's defaults: terse direction, DSL flexibility as a STANDING bar, doc/commit conciseness, fix-don't-defend on architectural pushback, preempt diagnostic friction.

## Where We're Going

The user did not explicitly state next direction at session close.

1. **Push the 7 plugin commits + 5 editions commits to origin/master.** Parent handoff also flagged this; still unpushed. Standing rule: don't push without explicit user instruction.
2. **Reference-style links** (`[x][ref]` + `[ref]: target`). Deferred this session. Needs:
   - New block wikirule for `[ref]: TARGET` definitions (with same hash/angle/tooltip support as inline LINK).
   - Per-parser reference store on `parser.cmRegistry.linkRefs = {ref: {target, tooltip, isInternal}}`.
   - Inline LINK_REF marker variant with `link-open: [` / `link-close: ]` — collides with existing LINK's `open: [`, so engine would need to support two markers sharing an `open`, or one marker with multiple link-bracket shapes. The italic-vs-item-star fix (parallel inlineMarkers dict) gives the framework for this — would need similar bucketing for "same open, different role".
3. **Other markdown spec gaps** (from the original list): fenced code blocks (` ``` `), indented code blocks, horizontal rules (`---`/`***`/`___`), autolinks (`<https://...>`), escape sequences (`\*`, `\_`, `` \` ``), task list items (`- [x]`).
4. **Decide if smart-alt rule should be opt-in via marker field** (currently hardcoded `attrName === "alt"`). For non-image use cases with similar "accessibility data on the source" patterns, a generic `attr-X-prefer-source-when-short: yes` field could work.
5. **Document "image tiddlers must have empty body text"** in a marker-tiddler-best-practices section (Marker Fields tiddler? Or a new "Best Practices" tiddler?). Currently only mentioned in the beta-43 commit-msg.
6. **Other deferred fountain spec gaps from parent**: Notes (`[[text]]` — collides with TW prettylinks), mid-dialogue parentheticals, scene numbers (`#1#`, `#1A#`), escape sequences (`\*`, `\_`).
7. **Decide if engine should bucket markers by `open` for multi-role same-open support** (preparation for ref-style links and other future features). Current parallel inlineMarkers dict is a half-measure.

## Risks & Blockers

- **JS changes need server restart.** `reload_tiddlers` only handles `.tid` files. After ANY edit to `registry.js`, `marker-inline.js`, `marker-block.js`, or the wikirule JS files, user must `Ctrl-C` and re-launch the TW Node server. This was the source of one ~30-minute misdiagnosis in the canonical-uri chain.
- **Image tiddlers with `_canonical_uri` MUST have empty body text** — TW core widget behavior. Documented only in commit-msg, not in user-facing docs yet. Future image-tiddler authors WILL hit this.
- **Tiddler titles with `(` `)` break markdown LINK URL parsing** — known limit. Workaround: rename to use ` - ` separator. Could be relaxed by URL-bracket-counting in the regex, but that's a CommonMark extension we haven't implemented.
- **The smart-alt word-count rule is hardcoded** — if a DSL author wants similar behavior for another attribute, they can't opt in without code change. Low-impact for now since alt is the canonical accessibility case.
- **The 3-times-changed `attr-X-from` semantics** could confuse readers who don't know the design history. Marker Fields doc has the final semantic; commit-msg has the rationale.
- **Lookbehind regex** in `parseVariableInlinePair` and `buildLinkedPairArm` requires ES2018+. Older browsers / Node versions would break the engine. TW core is ES5-compatible elsewhere; this is a new tightness.
- **`$:/StoryList` MCP writes** rely on the SaverFilter exclusion staying in place. If a user changes their SaverFilter config, MCP-driven story-river updates could start round-tripping to disk.

## Open Questions

- **Push timing?** Parent asked same question; still unanswered. 7 + 5 commits ahead of origin.
- **Reference-style links** — should this be the next beta (beta-44)? Or are other markdown gaps (fenced code blocks especially) higher priority?
- **Should the IMAGE marker also use `link-hash-prefix: required`** like LINK does? Currently it's `yes` because `<$image>` widget handles both URL and tiddler natively. But for CONSISTENCY with LINK's strict-mode TW-md-plugin alignment, `required` might be preferable. User hasn't flagged this either way.
- **Move the canonical-uri body-text gotcha into reference docs?** It's a TW core behavior, not custom-markup-specific. Could fit in Marker Fields under `attr-X-from`, or in a new "Image marker best practices" section. Currently only in beta-43 commit-msg.

## Quick Start for Next Session

```bash
# Reference docs (none — no project bible exists for this repo)

# Verify current state
cd /home/mario/git/tiddly/wikilabs/plugins && git log --oneline -5
cd /home/mario/git/tiddly/wikilabs/editions && git log --oneline -5

# Confirm plugin version
grep version /home/mario/git/tiddly/wikilabs/plugins/wikilabs/custom-markup/plugin.info
# expect: "1.0.0-beta-43"

# Confirm new marker tiddlers exist
ls /home/mario/git/tiddly/wikilabs/editions/custom-markup/tiddlers/vocab_markdown_{LINK,IMAGE,CODE}.tid
ls /home/mario/git/tiddly/wikilabs/editions/custom-markup/tiddlers/Motovun\ Jack.svg.tid

# Confirm Markdown links and images index + per-pattern children
ls /home/mario/git/tiddly/wikilabs/editions/custom-markup/tiddlers/Markdown\ links\ and\ images.tid
ls /home/mario/git/tiddly/wikilabs/editions/custom-markup/tiddlers/Example\ -\ Markdown\ link*.tid
ls /home/mario/git/tiddly/wikilabs/editions/custom-markup/tiddlers/Example\ -\ Markdown\ image*.tid
ls /home/mario/git/tiddly/wikilabs/editions/custom-markup/tiddlers/Example\ -\ Markdown\ code\ span.tid

# Key engine files (read if returning to linked-pair / open-variable work)
cd /home/mario/git/tiddly/wikilabs/plugins/wikilabs/custom-markup/tiddlers/wikirules
grep -n "linked-pair\|linkOpen\|openVariable\|attrFromFields\|inlineMarkers" registry.js | head -30
grep -n "parseLinkedPair\|parseLinkSyntax\|parseVariableInlinePair\|countWords" marker-inline.js | head -10

# Reference docs in editions (read if returning to docs work)
cd /home/mario/git/tiddly/wikilabs/editions/custom-markup/tiddlers
ls Marker\ {Kinds,Fields}.tid

# Memory entries to recall
cat /home/mario/.claude/projects/-home-mario-git-tiddly-wikilabs-editions/memory/feedback_commit_workflow.md
cat /home/mario/.claude/projects/-home-mario-git-tiddly-wikilabs-editions/memory/feedback_history_concise.md
cat /home/mario/.claude/projects/-home-mario-git-tiddly-wikilabs-editions/memory/feedback_no_claude_attribution.md

# Verify the engine is loadable
# (requires TW server restart after any JS edit — `reload_tiddlers` only handles .tid)

# Next action
# Confirm with user whether to push or work on the next markdown gap. Likely candidates:
# - Reference-style links (significant — needs engine work for multi-role same-open markers)
# - Fenced code blocks (smaller — new wikirule or new marker kind?)
# - Other markdown spec gaps from the original "missing" list
# Standing rule: do not push without explicit user instruction.
```

## Session Closed
**Closed at:** 2026-05-25 19:49
**Commit:** (filled in below)
**Session status:** Handed off to next session
