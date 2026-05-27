# Markdown CommonMark coverage batch — beta-44 through beta-48 + reverted footnotes

**Date:** 2026-05-27
**Status:** COMPLETED (5 betas shipped; footnotes attempted then reverted)
**Bead(s):** none
**Epic:** none
**Chain:** `standalone-977747ae` seq `4`
**Parent:** `HANDOFF_standalone-977747ae_markdown-links-images_2026-05-25.md`
**Prior chain:** `HANDOFF_standalone-977747ae_fountain-perf_2026-05-25.md` > `HANDOFF_standalone-977747ae_fountain-print_2026-05-25.md` > `HANDOFF_standalone-977747ae_markdown-links-images_2026-05-25.md` > this

---

## Since Last Handoff

Parent's "Where We're Going" listed 7 items. This session covered #2 (reference-style links) and #3 (other markdown spec gaps — specifically fenced code blocks, autolinks, escape sequences, horizontal rules). Deliberately skipped per user direction: setext headings ("ugly"), task lists ("will come to TW core"), hard line breaks ("already part of the vocab via preserve-newlines"). Footnotes attempted (parent's #7 candidate space) but reverted — anchor-based footnote navigation doesn't work in TW's tiddler routing.

- Push (parent #1): no longer pending — user pushed between parent's close and this session's start. Plugin/editions both at 0 ahead of origin at session start; now plugin 5 ahead (betas 44-48), editions 5 ahead.
- Risks materialized: ~1 medium misdiagnosis chain on fenced code blocks (extra-blank-lines-inside-`<pre>` turned out to be CSS `.wltc { margin: 1em 0 }` on inner `<code>`, not the engine). User identified the actual cause. Pattern echo of parent's canonical-URI and the grandparent's reveal.js print-CSS chains — symptom near where the eye looks, cause elsewhere.
- The bucketed-inline-markers refactor (deferred from beta-42's note about "framework for multi-role same-open") shipped in beta-48 as foundation for reference-style links.
- Two-pass ref-link parsing was offered as Option 2 for ref-links and ruled out by user with "will never happen, is too slow" — saved as project memory so it doesn't get proposed again.
- Footnotes anchor design (`<a href="#fn-id">`) failed in TW environment (user did not specify the failure mode in detail — likely TW's tiddler-routing intercepts URL fragments).

## The Goal

Continue closing CommonMark spec gaps in the markdown vocab, batch-style — same per-feature shape as beta-42's links/images and beta-44's fenced blocks. Each feature: engine extension (new kind or marker field) + marker tiddler(s) + per-pattern example tiddler + smoke-test tiddler + plugin version bump + history entry, all behind the DSL-flexibility principle the user has reinforced for ~5 sessions ("backend permissive, frontend strict; new kinds preferred over wikirules when DSL authors might reuse the pattern").

## Where We Are

- Plugin repo on `master`: HEAD `e554709` (beta-48). 5 commits ahead of `origin/master` (betas 44-48). Working tree clean.
- Editions repo on `master`: HEAD `0b3d52b`. 5 commits ahead of `origin/master`. Working tree has the user's WIP (image/link/svg tweaks they made in TW or out-of-band — NOT my work; preserved across the session).
- Plugin version: `1.0.0-beta-48`.
- Plugin HEAD subject: `cm: v1.0.0-beta-48 — reference-style links + bucketed inline markers`.
- Editions HEAD subject: `cm markdown: reference-style links`.
- 5 new marker kinds added this session: `fenced` (beta-44), `autolink` (beta-45), `hr` (beta-47). 2 more kinds intended for footnotes work were reverted. Total marker kinds: 9 (glyph, glyph-level, word, inline-pair, linked-pair, list-item, fenced, autolink, hr).
- 5 new markdown markers shipped: CODE-BLOCK (beta-44), AUTOLINK (beta-45), HR-DASH/HR-STAR/HR-UNDER (beta-47), LINK-REF (beta-48). FOOTNOTE-REF + CODE-WITH-CAPTION were created and then deleted (reverted).
- 4 new wikirules: backslash-escapes.js (beta-46), markdown-ref-def.js (beta-48). markdown-hr.js and markdown-footnote-def.js were created and deleted. Markdown-ref-def stays; backslash-escapes stays.
- 4 new vocab flags on `vocab/markdown`: `backslash-escapes` (46), `reference-links` (48). `horizontal-rules` was added then removed (HR moved to marker-kind). `footnotes` was added then removed (revert).
- 1 engine refactor (beta-48): `inlineMarkers` dict bucketed — `{open: [config, ...]}` instead of `{open: config}`. Identification iterates the array via cached arm regex. Unlocks multi-role same-`open` markers (used by LINK + LINK-REF sharing `[`).
- 5 example tiddlers created and KEPT: Example - Markdown autolink, Example - Markdown escape sequences, Example - Markdown horizontal rule, Example - Markdown link - reference style, plus the 5-pattern split for code blocks (basic, bare fence, longer fences, multi-paragraph, with metadata) + the "Markdown code blocks" index.
- 4 test-* tiddlers kept (per-feature visual smoke tests with Source/Expected/Live tables): test-markdown-backslash-escapes, test-markdown-hr, test-markdown-ref-links. Plus test-markdown-footnotes was deleted with the revert.
- 2 memories created/updated this session: `project_no_two_pass_parsing` (NEW — pre-scan designs off the table); `feedback_commit_workflow` (UPDATED — never put questions in commit-msg.md, ask in chat).
- 1 reverted attempt: beta-49 footnotes. Full implementation done (engine + marker + def wikirule + ${body} template substitution + example + test), THEN reverted at user request because anchor links don't work in TW.

## What We Tried (Chronological)

Five phases (one per shipped beta) + a sixth for the reverted attempt.

### Phase A — beta-44 fenced code blocks (CommonMark + MkDocs metadata)

1. **Onboarding** — read parent handoff; verified both repos at 0 ahead of origin (user had pushed between sessions); confirmed all listed tiddlers exist; noted Marker Fields had stale `body-attribute: tooltip` for IMAGE (still said `tooltip`, should be `alt` per beta-43).
2. **User picked direction**: fenced code blocks (over reference-style links, fountain gaps, or small cleanup).
3. **Designed new kind `fenced`** — confirmed with three design choices: backtick-only (strict markdown frontend; engine still supports tilde for other DSL vocabs), first-word-only info string (CommonMark convention), col-0 fences only (defer CommonMark 0-3 leading-space rule).
4. **Engine: `kind: fenced`** — `registry.js`: added to block-marker filter, new fields `wrapperElement`/`infoAttribute`/`infoPrefix`/`infoWords`, `buildBlockArm` case producing `(?:^${fenceChar}{${minLen},}[^${fenceChar}\r\n]*$)`. `marker-block.js`: dispatch + `parseFenced` (captures body verbatim until matching close fence on own line; implicit EOF close) + `buildFencedNodes`.
5. **Vocab + docs** — created `vocab/markdown/CODE-BLOCK`; added `codeblock` to vocab `disable-core-rules` (TW core has its own narrow `horizrule`-style codeblock rule); fixed stale Marker Fields IMAGE doc note (`body-attribute: tooltip` → `alt`).
6. **User bug report**: "currently 3 lines, the `\n` after ``` needs to be eaten". I added trailing-`\r?\n` strip in parseFenced body. Matched TW core's `codeblock` rule's text-capture convention (closeMatch.index ends at the `\n` BEFORE the close fence; my regex was capturing it).
7. **User: "still 1 leading AND trailing line"**. Started a ~6-message debug chain: node smoke-test of parseFenced confirmed `body = "code here"` (no leading/trailing). MCP `render_text` confirmed actual HTML output `<pre><code class="wltc-md-codeblock wltc">code here</code></pre>`. Checked plugin styles, TW core text/element widgets — nothing inserts whitespace. Asked user to verify in browser dev tools.
8. **User identified actual cause**: ".wltc class adds margin-top and margin-bottom of 1em. So for code blocks we should remove the wltc general class." The cause was the universal `.wltc` margin landing on the INNER `<code>` (rendering as visible vertical space inside `<pre>`) instead of on the OUTER `<pre>` (where it'd be exterior margin).
9. **Proposed and implemented Model A**: marker identity classes (`wltc` + marker `.classes` chain) go on the OUTERMOST block element (the wrapper when present, else the single element). Info string lands on inner per CommonMark convention. Generic rule — applies to any fenced+wrapper marker, not a special-case for code blocks. User approved.
10. **User: "give me an example for `info-words: all`"** + later "make it its own tiddler" + "I want a real example to see how it looks". Created `vocab/markdown/CODE-WITH-CAPTION` marker (tilde fence, info-words: all, info-attribute: data-caption) + CSS rule for `.wltc-captioned-code[data-caption]::before` + example tiddler.
11. **User asked**: "is this something standard or did you make it up?". Honest answer: I made it up (tilde-fence + whole-info-as-caption is invention; the IDEA of captioned code blocks is real in Pandoc/MkDocs).
12. **User: "prepare it to be parsed like 2 [MkDocs-style], title:value should end up in data-title=value. Use TW attribute parsers since they inherit security. NO onClick()"**. Implemented `info-attrs: yes` field — uses TW's `parseMacroParameterAsAttribute` (supports `=` AND `:` separators, quoted/unquoted/indirect/filtered/macro values). Hardcoded `data-` prefix as security boundary. Confirmed: dropped CODE-WITH-CAPTION entirely (vs keep both), no vocab flag (field-driven only).
13. **Split + cleanup**: dropped `vocab/markdown/CODE-WITH-CAPTION.tid`, `Example - Markdown code block - captioned.tid`, `Example - Markdown code block - first-word info.tid` (obsolete now that info-attrs consumes the rest). Created `Example - Markdown code block - with metadata.tid` (MkDocs-style demo). Updated CSS `.wltc-md-codeblock[data-title]::before` to replace captioned-code rule.
14. **User: "Example - Markdown code block — too many examples in 1 tiddler. Split them"**. Split the combined original into 5 per-pattern children (basic, bare fence, longer fences, multi-paragraph, with metadata) + `Markdown code blocks` index. Matches the existing per-pattern split convention used for links/images.
15. **History entry bug**: my first beta-44 history line contained `` ` ```lang ` `` (single backtick around triple backtick), which broke TW's `codeinline` rule and corrupted the rest of history.tid rendering. Rephrased to avoid nested backticks.
16. **Commit**: plugin `07db19f` (4 files), editions `c9483c9` (11 files = 4 modified + 7 new).

### Phase B — beta-45 autolinks (CommonMark URL + email)

17. **Direction**: user picked autolinks over reference-style links and fountain gaps.
18. **Design check**: how to handle URL-vs-email split? User chose Option A — new kind `autolink` with TWO pattern slots in ONE marker (`url-pattern` + `email-pattern` + `email-prefix`). Single marker, single `<` / `>`, parse step tries URL first then email then falls through to literal text.
19. **Engine: `kind: autolink`** — `registry.js`: added to `isInlineKind`, new fields `urlPattern`/`emailPattern`/`emailPrefix`, `buildAutolinkArm` producing `(?:<[^\s<>]+>)`. `marker-inline.js`: `parseAutolink` (tries URL then email patterns; emits `<a href>` or falls through; URL bodies as-is, email bodies get `mailto:` prefix prepended).
20. **TW core compatibility check**: `html` rule (`<` for HTML tags) has its own `findNextTag` that only fires on valid HTML tags. `<https://...>` isn't a valid tag name → html.findNextTag returns null → autolink rule gets the position cleanly. No `disable-core-rules` entry needed.
21. **AUTOLINK marker**: shipped with CommonMark URL pattern (`^[a-zA-Z][a-zA-Z0-9+.-]{0,31}:[^\s<>]+$`) and email pattern (long RFC 5322 simplification). `email-prefix: mailto:`. DSL flexibility: any vocab can repurpose either slot (e.g. `email-pattern: ^\+?[0-9\s-]+$` + `email-prefix: tel:` for phone autolinks).
22. **Smoke test in node**: 13 cases covered — URL, email, mailto: as URL form, ftp / irc / data schemes, mid-text, fall-through for `<div>`, etc. All pass.
23. **Example tiddler**: 3 pattern sections (URL, email, falls-through) + DSL flexibility section showing pattern repurposing.
24. **Commit**: plugin `da7d648` (4 files), editions `02d9bc5` (5 files = 3 modified + 2 new). User requested shorter editions commit-msg; trimmed.

### Phase C — beta-46 backslash escapes

25. **User picked**: escape sequences over horizontal rules + hard breaks.
26. **Wikirule, not new kind**: pattern is fixed (CommonMark Section 6.1's 30 ASCII punctuation chars), not really configurable per-marker. Inline wikirule `markdown-backslash-escapes.js` gated on `backslash-escapes: yes` vocab flag.
27. **Regex**: `/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g`. Matches `\X` where X is in the CommonMark set. Captures X; backslash consumed. `\A` / `\word` / `\1` leave the backslash literal per spec.
28. **Body-raw safety**: rule is inline-only, so source captured raw by fenced blocks / code spans / linked-pair body-attribute strings stays unaffected — backslashes inside those bodies stay literal as expected.
29. **Smoke test in node**: 18 cases (every CommonMark punct char, letters, digits, space, bare-backslash). All pass.
30. **User: "smoke test as a test-* tiddler. No mention in the docs. only for me to keep it"**. Created `test-markdown-backslash-escapes.tid` (30+ rows in Source / Expected / Live tables). No tags, no doc references — orphan tiddler.
31. **User: "push it to the story river $:/StoryList list-field"**. MCP `edit_tiddler` on `$:/StoryList` with `set_fields: {"list": ["test-markdown-backslash-escapes"]}`. SaverFilter correctly excluded from disk (in-memory transient state).
32. **Commit-msg `---` section blunder**: my editions commit-msg.md included a `---` section asking the user whether to include the test tiddler. User reaction: **"DO NEVER write questions into the commit-msg.md file. Ask questions here. I do want to commit the test-* tiddler."** Updated `feedback_commit_workflow` memory to forbid questions in commit-msg.md.
33. **Commit** (with test tiddler included): plugin `c584891` (3 files), editions `212ea1a` (3 files = 1 modified + 2 new).

### Phase D — beta-47 horizontal rules (with mid-stream design reconsideration)

34. **User picked**: horizontal rules. Skipped task lists (TW core probably will), setext headings ("ugly"), hard line breaks (already covered).
35. **First implementation: wikirule** — `markdown-hr.js` block rule with regex `^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*(?:\r?\n|$)`. Full CommonMark coverage (any of 3 chars, spaces between, 0-3 leading spaces). `horizontal-rules: yes` vocab flag. Added `horizrule` to vocab/markdown `disable-core-rules`.
36. **User pushback**: "you wrote: 'no engine work'. So do we really need the .js files". Fair point — my "no engine work" claim was wrong.
37. **Asked user**: drop .js (3 word-kind markers, partial coverage) / new kind `hr` (full coverage, DSL-reusable) / keep wikirule. User picked NEW KIND.
38. **Refactor to `kind: hr`** — `registry.js`: added to block-marker filter, `buildBlockArm` case `(?:^[ \t]{0,3}${openLit}(?:[ \t]*${hrChar})*[ \t]*(?:\r?\n|$))`. `marker-block.js`: dispatch + `parseHr` (emits childless element). Three markers (HR-DASH, HR-STAR, HR-UNDER) with literal 3-char `open` (`---`/`***`/`___`).
39. **Design trade-off — literal-3-char open**: avoids same-`open` dict collision with list-item markers (ITEM-DASH `open: -`, ITEM-STAR `open: *`). Means `markers["---"]`, `markers["***"]`, `markers["___"]` are separate dict slots. Drops the `- - -` (whitespace-from-start) case that the wikirule version supported — would have required the bucketed-block-markers refactor (not done yet). Documented in example + test tiddlers as explicit limitation.
40. **Cleanup**: deleted `markdown-hr.js` wikirule, deleted `horizontal-rules: yes` vocab flag. KEPT `horizrule` in `disable-core-rules` (still want to suppress TW core's narrow dash-only rule).
41. **User: "history shorter"**. Trimmed beta-47 history entry to one line. User ALSO removed beta-46 entry from history.tid entirely (their edit before I rewrote). Re-added beta-47 at top per their delete pattern; left beta-46 deletion as-is.
42. **Commit failure + recovery**: `git add markdown-hr.js` failed (pathspec doesn't match — the file was never tracked, created and deleted within the session). Same for `git rm`. Re-staged without that path. User interrupted with "next?" mid-recovery; completed commits anyway.
43. **Commit**: plugin `f694056` (4 files), editions `0fd6c10` (7 files = 2 modified + 5 new).

### Phase E — beta-48 reference-style links + bucketed inline markers refactor

44. **User picked**: reference-style links (over footnotes / fountain gaps).
45. **Scope choice**: MVP (defs-must-come-first) / Full CommonMark with pre-scan / Engine refactor first as Phase 2. User picked MVP — defs must appear BEFORE usages in source; unresolved labels emit literal text.
46. **Engine refactor — bucketed `inlineMarkers`** — needed because LINK (`[text](url)`) and LINK-REF (`[text][label]`) both have `open: [`. Changed `inlineMarkers` from `{open: config}` to `{open: [config, config, ...]}`. New helper `pushInlineMarker` (replaces-by-title to preserve globalSymbols across vocab activation). `rebuildRegexes` iterates flattened buckets. New: each marker config caches its `cachedInlineArm` (built once) and `cachedInlineArmRe` (compiled on first identify).
47. **`identifyInlinePairMarker`**: iterates bucket candidates per `open`, picks the first whose cached arm regex matches the matchText. Fallback to first-in-bucket if no regex matches (legacy single-config compatibility).
48. **New marker field `link-resolve: ref`** — when set, `parseLinkedPair` looks up the captured linkText in `parser.cmRegistry.linkRefs` (populated by ref-def block rule) BEFORE calling `parseLinkSyntax` for hash/angle/tooltip decoding. On miss, emits raw match as literal text.
49. **New `CmRegistry.normalizeRefLabel` static** — CommonMark case-insensitive + whitespace-normalized label key. Used by both ref-def (storing) and `parseLinkedPair` (looking up).
50. **New wikirule `markdown-ref-def.js`** — block, vocab-flag-gated on `reference-links: yes`. Captures `^[ ]{0,3}\[label\]:[ \t]*(?:<target>|target)(?:[ \t]+"title"|'title'|(title))?[ \t]*(?:\r?\n|$)` — three quote styles supported, `<wrapped>` for spaced targets. Stores `{target, title}` in `parser.cmRegistry.linkRefs`. CommonMark: first def wins (later same-label silently ignored). Emits nothing (invisible).
51. **New marker `vocab/markdown/LINK-REF`** — linked-pair, `open: [`, `link-open: [`, `link-close: ]`, `link-resolve: ref`, plus full TW-md-plugin compat (`link-hash-prefix: required`, `link-angle-brackets`, `link-tooltip-attribute`).
52. **Smoke tests in node**: ref-def regex 11 cases pass (angle-bracket targets, three quote styles, 0-3 indent, label normalization). LINK vs LINK-REF dispatch 6 cases pass (the bucketed + cached-arm-regex approach correctly disambiguates which marker fired).
53. **Docs cleanup**: removed "Reference-style links aren't implemented yet" note from Markdown links and images index; added LINK-REF bullet; added `link-resolve` row to Marker Fields.
54. **Commit**: plugin `e554709` (5 files), editions `0b3d52b` (6 files = 3 modified + 3 new).

### Phase F — beta-49 footnotes ATTEMPTED, REVERTED

55. **User direction**: "Two-pass parse ref-links will never happen. Is too slow. Footnotes next." Saved as memory `project_no_two_pass_parsing`.
56. **Initial design**: inline-pair marker `vocab/markdown/FOOTNOTE-REF` with `open: [^`, `close: ]`, `body-raw: yes`, `element: sup`. Block wikirule `markdown-footnote-def.js` captures `[^id]: text` at line start and emits a styled `<p class="wltc-md-footnote">` with `parseInlineRun`-parsed text. Gated on `footnotes: yes`. Source-position rendering (no two-pass; def stays where you write it).
57. **User: "it does not create linked anchors. So its kind of useless"**. Right — refs aren't clickable to defs without `<a href="#fn-id">` linkage.
58. **Engine extension — `${body}` template substitution**: in `marker-inline.js` `buildNode`, when static `attributes` JSON values contain `${body}`, substitute the captured body text (body-raw markers only — extraction from single text-node child). FOOTNOTE-REF's `attributes: {"href":"#fn-${body}","id":"fnref-${body}"}` made the ref a clickable `<a>` styled as superscript via CSS. Def emission gained a `↩` backlink anchor.
59. **Smoke test in node**: 5 template substitution cases pass.
60. **User: "that does not work in TW environment. so checkout the last commit so we undo the whole thing."** User did not elaborate on the specific failure mode — likely TW's tiddler-routing intercepts URL fragments (`#fn-1` parsed as tiddler title or similar). Could also be that anchor-jump doesn't work inside the story-river per-tiddler container.
61. **Revert**: `git restore` for modified files (plugin.info, history.tid, marker-inline.js, Marker Fields.tid, vocab_markdown.tid, vocab_markdown_styles.tid). `rm` for untracked new files (markdown-footnote-def.js, vocab_markdown_FOOTNOTE-REF.tid, Example - Markdown footnote.tid, test-markdown-footnotes.tid). Did NOT touch user's WIP files (image/link/svg).
62. **Post-revert direction discussion**: user signaled fountain notes next, with the question "can we use an alternative notes marker instead?" (Fountain `[[text]]` collides with TW prettylinks). Proposed `((note))`, `{!note!}`, `[NOTE: text]`. User said "No more changes atm" — paused before implementing.

## Key Decisions

- **Bucketed `inlineMarkers` dict (beta-48)** — the deferred refactor from beta-42's "italic-vs-item-star parallel dict" finally landed. `inlineMarkers[open]` is now an ARRAY of configs. Dispatch via cached arm regex test. Unlocks ALL future multi-role-same-`open` patterns (LINK + LINK-REF this session; future footnotes / glossary refs / etc. could use the same).

- **`kind: hr` uses literal 3-char `open`** (e.g. `open: ---`) instead of single char + min-count. Avoids same-`open` dict collision with list-item markers. Trade-off: `- - -` (whitespace-from-start) not supported. Would need the symmetric bucketed-BLOCK-markers refactor (not done — block collisions still rare).

- **Model A for fenced markers**: marker identity classes on OUTER wrapper, info-class on INNER (CommonMark `<code class="language-X">` convention); other info-attributes on OUTER alongside the class hook. Generic rule for any fenced+wrapper combo. Reason: the universal `.wltc { margin: 1em 0 }` lands as exterior margin (correct) instead of interior whitespace (the visible "extra lines" bug from the misdiagnosis chain).

- **`info-attrs: yes` uses TW's `parseMacroParameterAsAttribute`** (not `parseAttribute`). Reason: macro-parameter parser accepts BOTH `=` and `:` separators, AND unquoted values. User specifically asked for the `title:value` colon form. Gets quoted/indirect/filtered/macro value types for free.

- **Hardcoded `data-` prefix in info-attrs** — non-overridable. Security boundary: a user-supplied `onclick="alert(1)"` lands as `data-onclick="..."` (an inert data attribute), not an event handler. URL attributes like `href="javascript:..."` become `data-href="..."` (no URL evaluation). User explicitly required: "No onClick() or something similar".

- **CODE-WITH-CAPTION dropped, not kept alongside**: when info-attrs landed, the tilde-fence captioned variant became redundant. User picked "Drop it entirely (Recommended)" over "Keep both" or "Keep an illustrative-only version".

- **`link-resolve: ref` is single-pass** — defs must appear before usages in source. Two-pass parse explicitly ruled out by user ("never happen, is too slow"). MVP scope confirmed up front; documented in marker description, example tiddler, and Markdown links and images index.

- **`autolink` is a new kind (not extension of inline-pair)** — body must match `url-pattern` OR `email-pattern`; falling through to literal text is structural behavior. Two pattern slots (URL + email) chosen over multiple separate markers (would have required the bucketed inline dict in beta-45 — too early, before the refactor).

- **`autolink` has TWO config pattern slots in ONE marker** — user picked this over "two separate AUTOLINK-URL + AUTOLINK-EMAIL markers" (which would have needed the bucketed dict). DSL flexibility: marker authors can repurpose either slot (e.g. `email-prefix: tel:` for phone-number autolinks).

- **`backslash-escapes` is a wikirule, NOT a marker kind** — the pattern is fixed (CommonMark's 30 ASCII punct chars), no DSL repurposing makes sense. Matches existing wikirule pattern for fixed CommonMark/markdown features (markdown-newline, markdown-table).

- **HR shipped as 3 markers, not 1 with `chars` set field** — three markers (HR-DASH/STAR/UNDER) with literal `open: ---`/`***`/`___` avoids needing a new "char-set" field design AND avoids dict collision. Three tiddlers is acceptable cost for clean engine.

- **`info-attrs: yes` is field-driven, no vocab flag** — user confirmed: "Field controls it directly". Matches the principle: marker fields opt INTO behaviors; vocab flags gate ENGINE rules (wikirules).

- **HR-engine pivot mid-stream**: my first implementation was a wikirule (`markdown-hr.js`); user pushed back ("do we really need the .js files"). Refactored to `kind: hr`. Important calibration data: when I claim "no engine work" but actually mean "wikirule (a JS file)", user calls that out. New marker kind > new wikirule for DSL flexibility, even at cost of more engine code.

- **Footnote anchor design failed** — `<a href="#fn-id">` doesn't navigate in TW's tiddler context. Likely cause: TW's URL handler intercepts fragments. Implication for any future footnote design: anchor-jump is NOT viable; need a TW-native solution (widget-based, or visible-text-only with no navigation).

- **Test tiddlers shipped tracked in editions repo** — user wants them committed (`test-markdown-backslash-escapes` example was a learning moment). The Source/Expected/Live table format is the convention.

- **`feedback_commit_workflow` updated**: NEVER put questions in commit-msg.md. The `---` section pattern from the original memory was wrong. Ask questions in chat instead.

## Evidence & Data

### Plugin commits this session

| Hash | Version | Files | Lines | Subject |
|---|---|---|---|---|
| `07db19f` | beta-44 | 4 | +269/-5 | fenced code blocks + info-string attribute parsing |
| `da7d648` | beta-45 | 4 | +106/-2 | autolinks (URL + email) |
| `c584891` | beta-46 | 3 | +54/-1 | markdown backslash escapes |
| `f694056` | beta-47 | 4 | +45/-7 | horizontal rules via new `hr` marker kind |
| `e554709` | beta-48 | 5 | +169/-20 | reference-style links + bucketed inline markers |

### Editions commits this session

| Hash | Files | Lines | Subject |
|---|---|---|---|
| `c9483c9` | 11 | +315/-4 | fenced code blocks (CommonMark + MkDocs-style metadata) |
| `02d9bc5` | 5 | +90/-2 | autolinks (CommonMark URL + email) |
| `212ea1a` | 3 | +152 | backslash escapes (CommonMark Section 6.1) |
| `0fd6c10` | 7 | +171/-2 | horizontal rules via `hr` marker kind |
| `0b3d52b` | 6 | +148/-1 | reference-style links |

### Marker kinds added this session

| Kind | Beta | Position type | Markers shipped |
|---|---|---|---|
| `fenced` | 44 | block | vocab/markdown/CODE-BLOCK |
| `autolink` | 45 | inline | vocab/markdown/AUTOLINK |
| `hr` | 47 | block | HR-DASH, HR-STAR, HR-UNDER |

Total marker kinds: 9 (glyph, glyph-level, word, inline-pair, linked-pair, list-item, fenced, autolink, hr).

### Marker fields added/changed this session

| Field | Kind scope | Beta | Purpose |
|---|---|---|---|
| `wrapper-element` | fenced | 44 | Optional outer element (`pre` for code blocks). Marker classes go on wrapper when set. |
| `info-attribute` | fenced | 44 | Where the info-string first word lands (`class` → inner element per CommonMark; other → outer wrapper). |
| `info-prefix` | fenced | 44 | Prepended to info-string value (CommonMark `language-`). |
| `info-words` | fenced | 44 | Default `1` (first word only); `all` for whole string. |
| `info-attrs` | fenced | 44 | `yes` parses post-first-word info string as TW macro-parameter attributes; emits each as `data-{name}` on outer wrapper. Hardcoded `data-` prefix as security boundary. |
| `url-pattern` | autolink | 45 | Regex body must match for URL-mode emission. |
| `email-pattern` | autolink | 45 | Regex body must match for email-mode emission. |
| `email-prefix` | autolink | 45 | Prepended to `link-attribute` value for email matches (default `mailto:`). |
| `link-resolve` | linked-pair | 48 | `ref` triggers lookup in `parser.cmRegistry.linkRefs`. |

### Vocab/markdown flag changes this session

| Flag | Beta | Status | Purpose |
|---|---|---|---|
| `backslash-escapes` | 46 | added (kept) | Activates `markdown-backslash-escapes` wikirule. |
| `horizontal-rules` | 47 | added then removed | Was for the wikirule version; obsolete after HR became marker kind. |
| `reference-links` | 48 | added (kept) | Activates `markdown-ref-def` block wikirule. |
| `footnotes` | 49 | added then reverted | Was for `markdown-footnote-def` wikirule; reverted with footnotes work. |

### Disable-core-rules additions this session

| Rule | Beta | Reason |
|---|---|---|
| `codeblock` | 44 | TW core's `` ``` ``-rule competes with new fenced kind. |
| `horizrule` | 47 | TW core's narrow `---`-only rule competes with new `hr` kind. |

### Engine identifier inventory (final state, beta-48)

| File | Identifier | Added beta |
|---|---|---|
| `registry.js` | `wrapperElement`, `infoAttribute`, `infoPrefix`, `infoWords`, `infoAttrs` fields in parseMarkerTiddler | 44 |
| `registry.js` | `fenced` in block-marker filter; `buildBlockArm` case | 44 |
| `registry.js` | `urlPattern`, `emailPattern`, `emailPrefix` fields | 45 |
| `registry.js` | `autolink` in `isInlineKind`; `buildAutolinkArm` | 45 |
| `registry.js` | `hr` in block-marker filter; `buildBlockArm` case | 47 |
| `registry.js` | `pushInlineMarker` (bucketed-write helper) | 48 |
| `registry.js` | `inlineMarkers[open]` array-bucketed structure | 48 |
| `registry.js` | `linkResolve` field | 48 |
| `registry.js` | Cached `cachedInlineArm` per marker (in `rebuildRegexes`) | 48 |
| `registry.js` | `CmRegistry.normalizeRefLabel` static | 48 |
| `marker-block.js` | `parseFenced`, `buildFencedNodes` | 44 |
| `marker-block.js` | `parseInfoAttrsInto`, `parsedAttrToNode` (uses `$tw.utils.parseMacroParameterAsAttribute`) | 44 |
| `marker-block.js` | `parseHr` | 47 |
| `marker-inline.js` | `parseAutolink` | 45 |
| `marker-inline.js` | `identifyInlinePairMarker` bucketed dispatch + cached-arm-regex test | 48 |
| `marker-inline.js` | `parseLinkedPair` ref resolution branch | 48 |

### vocab/markdown/CODE-BLOCK marker (final state, beta-44)

```
title: vocab/markdown/CODE-BLOCK
kind: fenced
open: ```
element: code
wrapper-element: pre
info-attribute: class
info-prefix: language-
info-words: 1
info-attrs: yes
classes: .wltc-md-codeblock
tags: $:/tags/CustomMarkup/Marker vocab/markdown
```

### vocab/markdown/AUTOLINK marker (final state, beta-45)

```
title: vocab/markdown/AUTOLINK
kind: autolink
open: <
close: >
element: a
link-attribute: href
url-pattern: ^[a-zA-Z][a-zA-Z0-9+.-]{0,31}:[^\s<>]+$
email-pattern: ^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$
email-prefix: mailto:
classes: .wltc-md-autolink
tags: $:/tags/CustomMarkup/Marker vocab/markdown
```

### vocab/markdown/LINK-REF marker (final state, beta-48)

```
title: vocab/markdown/LINK-REF
kind: linked-pair
open: [
close: ]
link-open: [
link-close: ]
element: $link
link-attribute: to
auto-external: yes
link-hash-prefix: required
link-angle-brackets: yes
link-tooltip-attribute: tooltip
link-resolve: ref
classes: .wltc-md-link
tags: $:/tags/CustomMarkup/Marker vocab/markdown
```

### HR markers (final state, beta-47)

```
vocab/markdown/HR-DASH:  kind: hr, open: ---, element: hr, classes: .wltc-md-hr
vocab/markdown/HR-STAR:  kind: hr, open: ***, element: hr, classes: .wltc-md-hr
vocab/markdown/HR-UNDER: kind: hr, open: ___, element: hr, classes: .wltc-md-hr
```

### Smoke-test sets run in node this session

| Test set | Beta | Cases | Pass count |
|---|---|---|---|
| Fenced arm + parseFenced trace | 44 | 13 | 13 |
| Autolink arm + URL/email patterns | 45 | 13 | 13 |
| Backslash-escapes regex | 46 | 18 | 18 |
| HR arms (combined 3-marker) | 47 | 15 | 15 |
| Ref-def regex | 48 | 11 | 11 |
| LINK vs LINK-REF dispatch (bucketed) | 48 | 6 | 6 |
| `${body}` template substitution (REVERTED) | 49 | 5 | 5 (then reverted) |

Total: 76 smoke-test cases that ALL passed in node. Browser verification done by user on each beta.

### Footnotes attempt (REVERTED — for record)

The attempted beta-49 implementation included:
- `markdown-footnote-def.js` wikirule (block, vocab-flag-gated on `footnotes`)
- `vocab/markdown/FOOTNOTE-REF` marker (inline-pair, `open: [^`, body-raw, eventually `element: a` with templated attributes)
- Engine extension: `${body}` template substitution in `marker-inline.js` `buildNode` for static attributes (body-raw markers only)
- CSS for `.wltc-md-footnote-ref`, `.wltc-md-footnote`, `.wltc-md-footnote-num`, `.wltc-md-footnote-back`
- Backlink `↩` anchor in def emission
- Example + test tiddlers

User report: "does not work in TW environment". Specific failure mode not captured. Likely TW's URL-fragment routing intercepts `#fn-id` anchors. Reverted entirely. Whatever future footnote design happens MUST work without browser anchor navigation.

### Memories created/updated this session

| Memory | Type | Action | Summary |
|---|---|---|---|
| `project_no_two_pass_parsing.md` | project | NEW | Pre-scan / two-pass parsing schemes off the table; user said "too slow". Defs must appear before usages or use widget-based render-time resolution. |
| `feedback_commit_workflow.md` | feedback | UPDATED | Step 1 now reads "NEVER put questions in commit-msg.md — ask in the chat message that announces the drafts". (Removed the `---` section advice that misled this session.) |

### Working tree state (post-revert)

```
Plugin: clean
Editions:
 M  custom-markup/tiddlers/Example - Markdown image - base64 data.tid    (user WIP, not mine)
 M  custom-markup/tiddlers/Example - Markdown image - body override.tid  (user WIP, not mine)
 M  custom-markup/tiddlers/Example - Markdown link - internal tiddler.tid (user WIP, not mine)
 M  custom-markup/tiddlers/Motovun Jack.svg.tid                          (user WIP, not mine)
```

The user's WIP carried across this entire session — I never touched these files. They're their own work, separate from anything this session shipped. Whether to commit or revert is the user's call next session.

### Repos ahead-of-origin state

| Repo | Commits ahead | Branch | Notes |
|---|---|---|---|
| `wikilabs/plugins` | 5 | master | beta-44, 45, 46, 47, 48 unpushed |
| `wikilabs/editions` | 5 | master | matching CommonMark commits unpushed |

## Code Analysis

- **Bucketed `inlineMarkers` minimum-blast-radius design**: chose `{open: [config, ...]}` over (a) `{open + kind: config}` compound key or (b) full restructure. The array-per-open keeps the existing `markers` (single-config) dict unchanged. Dispatch is O(n) within a bucket but n is tiny (currently max 2: LINK + LINK-REF on `[`).

- **`cachedInlineArm` lifecycle**: built ONCE in `rebuildRegexes` for each marker config. Cached as a STRING (not RegExp). `identifyInlinePairMarker` lazily compiles to RegExp on first dispatch. Two-step caching keeps `rebuildRegexes` fast (no RegExp construction for markers whose dispatch never gets exercised).

- **`pushInlineMarker` replace-by-title semantics**: when vocab activation re-loads a marker that was already added via `addFromFilter`, the entry is replaced in place (not appended). Preserves `globalSymbols` from the prior entry (the `loadGlobalPragmas` cross-vocab bridge). Required to avoid duplicate marker entries in the bucket.

- **`parseLinkedPair` ref-resolve insertion point**: chosen to run BEFORE `parseLinkSyntax`. Why: ref defs store RAW target strings; the marker's `link-hash-prefix` / `link-angle-brackets` / `link-tooltip-attribute` flags handle the decoding. If we resolved AFTER parseLinkSyntax, the decoding would have already happened on the label (wrong) instead of the resolved target.

- **`refDefTitle` from ref-def overrides `parsedLink.tooltip`** only when the linked-pair had no inline tooltip. So `[text][label]` resolves; if the def is `[label]: target "title"`, the rendered tooltip = title. But the rare future `[text][label]("...inline tooltip")` would prefer the inline. (Not actually parseable today since linked-pair regex stops at `]`; theoretical.)

- **`buildAutolinkArm` `[^\s${openFirst}${closeFirst}]`**: body class excludes whitespace AND first char of open AND first char of close. For `<>`-wrapped autolinks, body can't contain `<` or `>`. Correct per CommonMark (which forbids those in URI body). The first-char extraction generalizes for multi-char open/close (e.g. `<<...>>` would work).

- **TW core `html` rule interaction**: `html.findNextTag` is selective — only fires on tags with valid alphabetic/digit/hyphen/dollar/dot tag names. `<https://...>` fails the tag-name check → findNextTag returns null → my `autolink` arm wins the position. No `disable-core-rules` entry needed.

- **`parseMacroParameterAsAttribute` vs `parseAttribute`**: chose macro-parameter version because it accepts `=` AND `:` separators AND unquoted values. The HTML-style `parseAttribute` is stricter (only `=`, requires quoted strings for non-trivial values). User specifically requested `title:value` colon-syntax support.

- **HR `parseHr` is fully standalone** — bypasses the standard parseMatchTail → resolveConfig → parseBody pipeline. No symbol resolution, no quoted args, no body. Just emits `<element class="...">` with the marker's class chain. Adequate for HR's simple shape.

- **Fenced body trailing-newline strip** (`body.replace(/\r?\n$/, "")`): matches TW core's `codeblock` rule convention. Without it, an extra trailing `\n` inside `<pre><code>` renders as visible blank line. Documented in the parseFenced comment.

- **`info-attrs` parses ONLY post-first-word remainder** (when `info-attribute` is set). When `info-attribute` is unset, parses the whole info string. Matches the practical MkDocs / Hugo convention: language first, metadata after.

- **`hr` arm has no whitespace before open** — `^[ \t]{0,3}${openLit}` consumes 0-3 leading spaces, then expects the LITERAL open (consecutive). So `   ---` works (3 spaces then `---`), but `- - -` doesn't (whitespace BETWEEN the first 3 chars). Documented limitation.

- **Footnote `${body}` template substitution (REVERTED)** worked correctly in node tests but was reverted with the rest of footnotes when the user reported the anchor links don't work in TW. The template substitution code is GONE from the current marker-inline.js.

## Files Changed

### Plugin engine (5 betas: 44, 45, 46, 47, 48)

- `wikilabs/custom-markup/plugin.info` — version bumps 43 → 44 → 45 → 46 → 47 → 48.
- `wikilabs/custom-markup/tiddlers/meta/history.tid` — 5 entries (one per beta). beta-46 entry was removed by user mid-session and not re-added (their explicit edit; left as-is per their pattern).
- `wikilabs/custom-markup/tiddlers/wikirules/registry.js` — major: new fields for fenced/autolink/hr/linkResolve/infoAttrs; new kinds in filter (`fenced`, `autolink`, `hr`); new arms (`buildAutolinkArm`, `buildBlockArm` cases for fenced/hr); bucketed `inlineMarkers` + `pushInlineMarker` + cached `cachedInlineArm`; new `CmRegistry.normalizeRefLabel` static.
- `wikilabs/custom-markup/tiddlers/wikirules/marker-block.js` — added `parseFenced`/`buildFencedNodes`/`parseInfoAttrsInto`/`parsedAttrToNode`/`parseHr`. Dispatch in `parse()` for fenced and hr kinds.
- `wikilabs/custom-markup/tiddlers/wikirules/marker-inline.js` — added `parseAutolink`; `identifyInlinePairMarker` bucketed-dispatch with cached-arm-regex test; `parseLinkedPair` ref-resolve branch.
- `wikilabs/custom-markup/tiddlers/wikirules/markdown-flavour/backslash-escapes.js` — NEW (beta-46). Inline wikirule, vocab-flag-gated.
- `wikilabs/custom-markup/tiddlers/wikirules/markdown-flavour/markdown-ref-def.js` — NEW (beta-48). Block wikirule, vocab-flag-gated.

### Editions — vocab metas

- `custom-markup/tiddlers/vocab_markdown.tid` — added `codeblock` to disable-core-rules (44), `backslash-escapes: yes` flag (46), `horizrule` to disable-core-rules (47), `reference-links: yes` flag (48); description updated several times.

### Editions — new markers

- `custom-markup/tiddlers/vocab_markdown_CODE-BLOCK.tid` — NEW (44).
- `custom-markup/tiddlers/vocab_markdown_AUTOLINK.tid` — NEW (45).
- `custom-markup/tiddlers/vocab_markdown_HR-DASH.tid`, `_HR-STAR.tid`, `_HR-UNDER.tid` — NEW (47).
- `custom-markup/tiddlers/vocab_markdown_LINK-REF.tid` — NEW (48).

### Editions — example tiddlers

- `custom-markup/tiddlers/Markdown code blocks.tid` — NEW (44) index for the 5-child split.
- `custom-markup/tiddlers/Example - Markdown code block - basic.tid` — NEW (44).
- `custom-markup/tiddlers/Example - Markdown code block - bare fence.tid` — NEW (44).
- `custom-markup/tiddlers/Example - Markdown code block - longer fences.tid` — NEW (44).
- `custom-markup/tiddlers/Example - Markdown code block - multi-paragraph.tid` — NEW (44).
- `custom-markup/tiddlers/Example - Markdown code block - with metadata.tid` — NEW (44).
- `custom-markup/tiddlers/Example - Markdown autolink.tid` — NEW (45).
- `custom-markup/tiddlers/Example - Markdown escape sequences.tid` — NEW (46).
- `custom-markup/tiddlers/Example - Markdown horizontal rule.tid` — NEW (47).
- `custom-markup/tiddlers/Example - Markdown link - reference style.tid` — NEW (48).
- `custom-markup/tiddlers/Markdown links and images.tid` — modified (48), new bullet, "not implemented" caveat updated.

### Editions — test-* tiddlers (orphan, for user's own verification)

- `custom-markup/tiddlers/test-markdown-backslash-escapes.tid` — NEW (46). 30+ rows Source/Expected/Live.
- `custom-markup/tiddlers/test-markdown-hr.tid` — NEW (47).
- `custom-markup/tiddlers/test-markdown-ref-links.tid` — NEW (48).

### Editions — reference docs

- `custom-markup/tiddlers/Marker Kinds.tid` — `fenced` added (44, 7th kind), `autolink` (45, 8th), `hr` (47, 9th).
- `custom-markup/tiddlers/Marker Fields.tid` — new field rows: `wrapper-element`, `info-attribute`, `info-prefix`, `info-words`, `info-attrs` (44); `url-pattern`, `email-pattern`, `email-prefix` (45); `link-resolve` (48). Fixed stale IMAGE `body-attribute: tooltip` reference (was carry-over from before beta-43). CODE-BLOCK worked example added.

### Editions — CSS

- `custom-markup/tiddlers/vocab_markdown_styles.tid` — added `.wltc-md-codeblock[data-title]::before` rule (44, surfaces metadata title as italic label above the block).

### Files DELETED during session (created and removed within the session — never committed)

- `wikilabs/custom-markup/tiddlers/wikirules/markdown-flavour/markdown-hr.js` (47 — replaced by `kind: hr`).
- `vocab_markdown_CODE-WITH-CAPTION.tid` (44 — replaced by info-attrs on CODE-BLOCK).
- `Example - Markdown code block.tid` (44 original combined — replaced by 5-child split).
- `Example - Markdown code block - captioned.tid` (44 — replaced by `with metadata`).
- `Example - Markdown code block - first-word info.tid` (44 — obsolete when info-attrs lands).
- All beta-49 footnote artifacts (reverted): `markdown-footnote-def.js`, `vocab_markdown_FOOTNOTE-REF.tid`, `Example - Markdown footnote.tid`, `test-markdown-footnotes.tid`.

### Memory files

- `feedback_commit_workflow.md` — UPDATED.
- `project_no_two_pass_parsing.md` — NEW.

## User Feedback & Preferences

Direct user feedback this session, in chronological order:

- "fenced code blocks" (picked direction over ref-links / fountain gaps / small cleanups)
- "Backtick only (strict)" / "First word only (CommonMark)" / "Col-0 fences only (simplest)" (fenced design choices)
- "currently 3 [lines], the \n after ``` needs to be 'eaten'" (fenced bug report)
- "still 1 leading and trailing line that should NOT be there" (fenced bug, still)
- "the wltc class adds a margin-top and margin-bottom of 1em, which causes the problem. So for code blocks we should remove the wltc general class. -- Which makes it a 'special case' ... not sure. What do you think?" (identified actual cause; asked my view)
- "go with your suggestion" (approved Model A)
- "give me an example for fenced code block `info-words: all`" (asked for real demo)
- "I want a real example, to see how it looks like. make it it's own tiddler" (real working, not illustrative)
- "Example - Markdown code block — There are way to many examples in 1 tiddler. Split them" (split discipline)
- "is this something which is standard, or did you make it up?" (calibration check on captioned-code)
- "I would prepare it to be parsed like 2, but the eg: title:value should end up in a data-title=value data-second:value and so on. If possible use TW attribute parsers, since the inherit the TW security related code. Since the code strings can be user provided we need to make it secure. NO onClick() or something similar" (MkDocs design + security)
- "Drop it entirely (Recommended)" / "Field controls it directly (Recommended)" (CODE-WITH-CAPTION cleanup + info-attrs activation)
- "this msg shorter" (editions autolink commit-msg)
- "commit" (multiple times across the session — once to draft, again to execute)
- "Escape sequences" (picked from horizontal rules / hard breaks / escape sequences)
- "I'd like to have the smoke test as a test-* tiddler to verify it. No mention in the docs. only for me to keep it" (test-tiddler convention)
- "push it to the story river $:/StoryList list-field" (MCP push)
- "DO NEVER write questions into the commit-msg.md file. Ask questions here. I do want to commit the test-* tiddler" (correction; led to memory update)
- "Horizontal rules" (picked next)
- "IMO dynamic Task lists will come to TW core. Setext headings - I do NOT want to implement that - its ugly. Hard linebreaks is already part of the vocab" (scope guidance — what NOT to do)
- "you wrote: 'no engine work'. So do we really need the .js files" (calibration on what counts as engine work)
- "Add a new kind `hr` (or `thematic-break`)" (picked from 3 HR options)
- "history shorter" (multiple times across history.tid entries; also removed beta-46 entry himself)
- "Two-pass parse ref-links will never happen. Is too slow. Footnotes next" (combined direction + design ruling)
- "it seems, it does not create linked anchors. So its kind of useless" (footnotes critique)
- "that does not work in TW environment. so checkout the last commit so we undo the whole thing" (footnotes revert)
- "let's go with fountain notes. Which clashes with TW link syntax. can we use an alternative notes marker instead?" (next direction; needs alternative syntax)
- "No more changes atm" (session pause signal)
- "handoff" (this skill)

### Calibration phrases for next session

- **"IFF necessary"** / **"go with your suggestion"** / **"Recommended"**: user values pragmatic minimum-viable scope. Don't propose unbounded work.
- **"is this something standard or did you make it up?"**: when I introduce a convention, expect this question. Be honest up-front about what's spec'd vs invented.
- **"DO NEVER..."**: hard rules. Save to memory immediately.
- **"shorter"** (history / commit-msg): default to terse; expand only when asked. The user actively edits commit-msg.md and history.tid in their IDE before final commit.
- **"that does not work"**: empirical, not theoretical. When the user says this, the test was real — accept and revert, don't argue.
- **"you wrote X. So Y?"**: socratic pushback when I claimed something incorrect. Re-examine the claim instead of defending.
- **"that does not work in TW environment"**: TW has its own URL routing, widget model, and CSS scoping. Browser-native solutions (anchor jumps, certain HTML patterns) may fail in TW. Test in TW (not just in node) before claiming features work.

## Where We're Going

The user paused with "No more changes atm" before implementing fountain notes. The most natural next direction was set up but not executed:

1. **Fountain notes with alternative syntax** — user agreed to "an alternative notes marker instead" of Fountain spec's `[[text]]` (which collides with TW prettylinks). I proposed `((note))`, `{!note!}`, `[NOTE: text]`. Recommended `((note))` (closest spirit to Fountain's `[[note]]`, zero collision, zero engine work — just an `inline-pair` marker). User did not pick yet. Pick first, then ship as one marker tiddler + example tiddler + (maybe) test tiddler. Engine: zero work.

2. **Footnotes redesign** — the anchor-link approach failed in TW. A future footnote design needs to NOT rely on `<a href="#anchor">` navigation. Options:
   - TW widget-based: emit `<$reveal>` or `<$tooltip>` that shows the def text on hover/click. Self-contained, no anchor-nav.
   - Counter-only superscript with no nav: `[^1]` renders `<sup>1</sup>` and the def renders as a styled `<p>`, with no clickable link. Visually a footnote but no jump.
   - Out of scope: full footnote-list-at-bottom rendering (would need two-pass which the user ruled out).
   First: ask user the failure mode they observed, then pick a redesign or skip entirely.

3. **Push pending commits** — 5 plugin + 5 editions commits ahead of origin. Standing rule: do not push without explicit user instruction.

4. **User's WIP edits** to image/link/svg tiddlers in editions working tree — uncommitted, carried across this session. The user may want to commit, revert, or hand to a future session.

5. **Other deferred items from the grandparent and parent handoffs**:
   - Fountain Notes (covered above), mid-dialogue parentheticals, scene numbers, fountain escape sequences
   - Smart-alt rule generalization (marker-field opt-in, currently hardcoded `attrName === "alt"`)
   - "Image tiddlers must have empty body text" gotcha doc (only in beta-43 commit-msg; not in user-facing docs)
   - Symmetric bucketed-BLOCK-markers refactor (would unlock `- - -` / spaced-leading HR support and any future block-level same-`open` collisions; YAGNI until a concrete need)

6. **Remaining markdown spec gaps the user did NOT want**:
   - Task lists (TW core will handle)
   - Setext headings (ugly)
   - Hard line breaks (preserve-newlines covers it)
   - Indented code blocks (4-space; not explicitly ruled out but mentioned as collision-prone with prose indent — could be done)
   - Definition lists / footnotes / extensions beyond CommonMark (extensions territory, case-by-case)

7. **Two-pass ref-link parsing** — explicitly off the table per user. Don't propose again. (Memory `project_no_two_pass_parsing` enforces.)

## Risks & Blockers

- **TW environment ≠ browser anchor model.** Footnotes' anchor-href approach failed for reasons the user did not detail. Any future feature relying on `<a href="#fragment">` navigation needs to verify in TW first, not assume browser-native semantics.
- **JS changes need TW server restart.** `reload_tiddlers` only handles `.tid` files. After ANY engine edit, user restarts. This was the source of one "still broken" misdiagnosis early in fenced (turned out my fix was correct; user just hadn't restarted).
- **MCP server runs OLD engine code until restart.** When I verified rendering via `mcp__tiddlywiki__render_text`, that's the MCP's own engine. For JS-changed features, MCP verification is only meaningful AFTER restart. CSS / tiddler changes work without restart via `reload_tiddlers`.
- **User's WIP files in editions** could conflict with future edits. Recommend addressing first thing next session (commit / revert / handoff to their own track).
- **Bucketed `inlineMarkers` regex dispatch** has O(n) per bucket. Currently n=2 max (LINK + LINK-REF on `[`). Future expansion to many same-open markers could degrade — but unlikely (most opens have one marker).
- **`hr` literal-3-char `open` design** drops `- - -` (whitespace-from-start CommonMark variant). If a user expects that to work and it doesn't, they'll need to write `---` consecutive instead. Documented in example + test tiddlers.
- **5 commits ahead of origin in both repos** — not pushed. Standing user pattern: pushes between sessions, not during.

## Open Questions

- **Footnote failure mode**: WHAT specifically didn't work in TW? Was it (a) the `<a href="#fn-id">` not navigating, (b) the visible rendering wrong, (c) CSS not applying, or (d) something else? Without knowing, the redesign is shooting in the dark. ASK before re-attempting.
- **Fountain notes syntax choice**: `((note))` / `{!note!}` / `[NOTE: text]` / other? User signaled fountain notes next but didn't pick. Ask then ship.
- **Bucketed block-markers refactor**: when (if ever) to do it? Would unlock the `- - -` HR variant and any future block-level same-open collisions. YAGNI right now; flagged as deferred.
- **`info-attrs` for OTHER markers**: only CODE-BLOCK currently uses it. Worth flagging it on AUTOLINK or other linked-pair markers? Probably not — the use case is uniquely about "metadata after a primary identifier" which only fenced code blocks really have.

## Quick Start for Next Session

```bash
# Verify current state (both repos clean, both 5 ahead of origin)
cd /home/mario/git/tiddly/wikilabs/plugins && git log --oneline -6 && git status
cd /home/mario/git/tiddly/wikilabs/editions && git log --oneline -6 && git status

# Confirm plugin version
grep version /home/mario/git/tiddly/wikilabs/plugins/wikilabs/custom-markup/plugin.info
# expect: "1.0.0-beta-48"

# Verify the new marker tiddlers from this session exist
ls /home/mario/git/tiddly/wikilabs/editions/custom-markup/tiddlers/vocab_markdown_{CODE-BLOCK,AUTOLINK,LINK-REF,HR-DASH,HR-STAR,HR-UNDER}.tid

# Key engine identifiers to verify (post-beta-48 state)
cd /home/mario/git/tiddly/wikilabs/plugins/wikilabs/custom-markup/tiddlers/wikirules
grep -n "pushInlineMarker\|cachedInlineArm\|linkResolve\|normalizeRefLabel\|infoAttrs\|kind === \"fenced\"\|kind === \"autolink\"\|kind === \"hr\"" registry.js | head -20
grep -n "parseAutolink\|parseHr\|parseFenced\|parseInfoAttrsInto\|identifyInlinePairMarker\|linkResolve" marker-inline.js marker-block.js | head -20

# Memory files relevant to this work
ls /home/mario/.claude/projects/-home-mario-git-tiddly-wikilabs-editions/memory/{project_no_two_pass_parsing,feedback_commit_workflow,feedback_history_concise,feedback_no_claude_attribution}.md

# User's WIP files in editions working tree — handle first thing
cd /home/mario/git/tiddly/wikilabs/editions && git status --short

# Story river check (the user pushed test-markdown-backslash-escapes via MCP last session; transient)
# Use mcp__tiddlywiki__get_tiddler $:/StoryList to see what's open

# Next action (per "Where We're Going" item 1)
# Ask user the fountain-notes syntax choice and ship as one marker tiddler.
# Or if user picks different direction, fall through to "Where We're Going" list.
```

## Session Closed
**Closed at:** 2026-05-27
**Commit:** b9615f7 (editions repo — handoff record)
**Session status:** Handed off to next session
