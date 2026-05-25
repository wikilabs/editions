# Fountain page break + print stylesheet + transition right-edge fix — custom-markup v1.0.0-beta-40

**Date:** 2026-05-25
**Status:** COMPLETED
**Bead(s):** none
**Epic:** none
**Chain:** `standalone-977747ae` seq `2`
**Parent:** `HANDOFF_standalone-977747ae_fountain-perf_2026-05-25.md`
**Prior chain:** `HANDOFF_standalone-977747ae_fountain-perf_2026-05-25.md` > this

---

## Since Last Handoff

Parent ended with "Where We're Going" options: (1) push, (2) shrink commit messages, (3) investigate non-parser slowness, (4) deferred fountain spec gaps (Notes, parentheticals, page break, scene numbers, escape sequences), (5) sections visible vs spec-hidden divergence.

- User picked option 4 — specifically `===` page break — then expanded scope to also include print CSS for fountain tiddlers and a real bug fix for transition right-edge alignment that they noticed during screen rendering.
- Push (option 1) **still deferred** — both repos remain unpushed even after this session.
- Other deferred spec gaps (Notes, mid-dialogue parentheticals, scene numbers, escape sequences) still untouched.
- Risk that materialized: a "stylesheet ordering / wikitext rendering" rabbit hole that was a complete misdiagnosis — actual root cause was the `sukima/reveal-js` plugin's `@media print` overriding everything. ~6+ iterations on the industry layout stylesheet before the user identified it. Memory saved so it doesn't happen again ([reveal-js-print-override](../../../../../.claude/projects/-home-mario-git-tiddly-wikilabs-editions/memory/project_reveal_js_print_override.md)).
- Open question from parent ("is push to origin desired?") still unanswered.

## The Goal

Three intertwined deliverables for plugin `v1.0.0-beta-40` against `wikilabs/custom-markup`:

1. **Fountain page-break spec compliance.** `===` on its own line (3+ `=`, blank-before, blank-after) emits a page break per https://fountain.io/syntax. The previous handoff listed this as deferred / cheap-to-add.
2. **Print stylesheet for fountain tiddlers.** Both a minimal default (hide TW chrome, honor page breaks) and an opt-in industry layout (A4 page, Courier 10pt, scene/character/dialogue at standard cm positions, transitions right-aligned).
3. **Fix transition right-edge bug.** User observed in screen rendering: `... TO:` text right-aligned, but its right edge sat ~20ch short of scene-heading / long-action right edges. The `.wltc-fountain-transition` `max-width: 60ch` was anchored to the LEFT of an 80ch `.wltc-fountain` parent, so the right side never reached the body's right edge.

End state: plugin at `v1.0.0-beta-40` shipped + an editions-side industry print stylesheet that actually works (after `sukima/reveal-js` was disabled in the editions wiki — its bundled `@media print` was silently overriding every per-vocab print rule).

## Where We Are

- Plugin repo on `master`: **4 commits ahead** of `origin/master` (beta-37, 38, 39, 40). Not pushed.
- Editions repo on `master`: **3 commits ahead** of `origin/master` (the prior session-record commit `296033f`, this session's main commit `190bbbf`, plus the user's docs adjustment `6edb86e`). Not pushed.
- Plugin version: `1.0.0-beta-40` (was `1.0.0-beta-39` at session start).
- Plugin head: `41d80e2 cm: v1.0.0-beta-40 — fountain page break + transition right-edge fix`
- Editions head: `6edb86e doc adjustments` (the user committed docs themselves after the main commit)
- Working tree clean except: `commit-msg.md` at each repo root (deliberately uncommitted per user's standing workflow — they review them in VSCode), and unstaged "Session Closed" footer on the parent handoff file (carried over from prior session, not this session's work).
- Print preview verified working by the user after they disabled `$:/plugins/sukima/reveal-js`. The industry layout produces A4 / 15cm column / Courier 10pt / scene at left / character at 5cm / dialogue at 2.5cm (9cm wide) / transitions right-aligned (incl. FADE IN:).
- New plugin file: `tiddlers/wikirules/fountain-flavour/fountain-page-break.js` — emits `<div class="wltc-fountain-page-break">` when `===` matches with blank-before / blank-after, gated on `page-break: yes` on an active vocab. Mirrors `fountain-transition.js` structure exactly.
- Plugin styles tiddler `$:/vocab/fountain/styles` modified: transition right-edge fix (`margin-left: auto`), HTML comments `<!-- -->` in place of block `/* */` comments throughout (TW idiom), font sizes converted from `em` to `pt`.
- Editions: 3 new tiddlers + 2 modified. New: `Fountain Print - Industry Layout.tid` (opt-in print stylesheet, untagged with `$:/tags/Stylesheet` by default — actually it IS tagged in the editions wiki because the user activated it), `Example - Fountain page break.tid`, `$__config_Plugins_Disabled_$__plugins_sukima_reveal-js.tid`. Modified: `vocab_fountain.tid` (`page-break: yes`), `Example - Fountain screenplay.tid` (`===` between Act One / Act Two to demo the new feature).
- Editions docs (committed by user as `6edb86e`): `Vocabulary - Fountain.tid` got a page-break row in the marker map + bullet in "What works" + Related link to industry layout. `Shipped Vocabularies.tid` got "lyrics, page breaks" added to vocab/fountain feature list.
- Three new memory entries persisted: `feedback_no_css_important`, `feedback_tw_stylesheet_comments`, `project_reveal_js_print_override`.

## What We Tried (Chronological)

This section is large because the print CSS work went through ~10 iterations before the real root cause was found.

1. **Onboarding** — narrated reading of prior handoff, verified git state, confirmed beta-39 in plugin.info, read `startup/pt-dedupe.js`, `fountain-character.js`, `fountain-transition.js`, key registry.js sections. Noted the parent's stated "8 plugin + 5 editions commits ahead" was outdated — actually 3 plugin + 1 editions when this session began (user had pushed in the interim).

2. **Initial scope from user** — "page break, CSS rules to print fountain tiddlers, right align ... TO: elements". Three asks, asked clarifying questions about print scope (minimal vs industry) and what "right align" meant (since `.wltc-fountain-transition { text-align: right }` already existed). User answers: "Both — minimal default + opt-in full layout" and "It is right aligned, but not at the right border of the other text". The latter clarified the real bug: visible right-edge mismatch between transitions (60ch box) and scene-headings (no max-width → full 80ch body).

3. **Page-break wikirule** — created `wikirules/fountain-flavour/fountain-page-break.js`. Regex `(?<=^|\n\n)([ \t]*)={3,}[ \t]*\n(?=\n|(?![\s\S]))` mirrors fountain-transition's auto pattern. Gated on `hasVocabFlag("page-break")`. Verified non-collision with front-matter parser (front-matter only fires at `pos === 0` and consumes its own `===` terminator).

4. **Vocab opt-in via MCP** — `edit_tiddler` on `vocab/fountain` to add `page-break: yes` field. MCP listen verified via `.tw-mcp/connect`.

5. **Transition right-edge fix** — one-line CSS change in `$:/vocab/fountain/styles`: `margin: 1em 0` → `margin: 1em 0 1em auto`. Anchors the 60ch box to the RIGHT of the 80ch parent so right-aligned text ends at the body's right edge.

6. **Minimal default print rules in `$:/vocab/fountain/styles`** — added `@media print` block hiding `.tc-sidebar-scrollable`, `.tc-page-controls`, etc., resetting `.tc-story-river` / `.tc-tiddler-frame` / `.tc-tiddler-body`, and a screen affordance for `.wltc-fountain-page-break` (subtle dashed rule with "page break" label via `::before`). Used `!important` throughout — would later have to scrub all of it after user feedback.

7. **Industry layout tiddler (attempt 1: `text/css`)** — created `Fountain Print - Industry Layout.tid` (later renamed `.css` then back to `.tid`) typed as `text/css` thinking TW would inline the raw CSS into `<style>`. **Wrong.** TW's `text/css` parser wraps the body in `<pre><code>` inside the page stylesheet, which is invalid CSS, breaks the parser. Discovered via `render_text` of the full page stylesheet.

8. **First screenshot from user** — print preview showed huge TW tiddler title in Courier, breadcrumbs, tags wrapper visible. Diagnosis: chrome wasn't hidden because my industry CSS wasn't actually loading.

9. **Convert to `text/vnd.tiddlywiki` with `\rules only ... html`** — switched type, kept comments as `/* */`, kept literal `<pre>` / `<style>` / `<N>` in CSS comments. **Still wrong.** The `html` rule parsed the literal angle brackets as real HTML tags, producing stray `</div></N></p></p>` in the rendered output. Wikitext paragraph wrapping also fragmented the @media print block.

10. **User feedback: "In my CSS !important WILL NEVER HAPPEN. Make it more specific if you want to hide something"** — saved as memory `feedback_no_css_important`. Rewrote both default and industry stylesheets to use ancestor specificity (`html body .tc-titlebar`, `.wltc-fountain .wltc-fountain-character`). No `!important` anywhere.

11. **User feedback: "NONE of the fountain rules should be hidden!!!"** — removed all `display: none` rules for `.wltc-fountain-synopsis` / `.wltc-fountain-section` / `.wltc-fountain-boneyard` from industry layout. All fountain content stays visible in print.

12. **User feedback: "If you use text/vnd.tiddlywiki type for stylesheets, you need to use HTML comments instead of CSS comments. `<!-- comment -->` is needed"** — saved as memory `feedback_tw_stylesheet_comments`. Converted block-level `/* */` comments in industry layout to `<!-- -->`. Kept inline within-rule `/* */` comments (HTML comments inside a CSS declaration block break parsing).

13. **User correction: "avoid `>` in selectors / in the global rule is nonsense"** — narrowed the memory's scope. `>` IS valid CSS; the issue is TW HTML-escapes it to `&gt;` inside stylesheet bodies. Edited memory to clarify it's a TW gotcha, not a general CSS rule.

14. **User screenshot showing the same broken output** — chrome still visible, narrow column, dialogue centered (screen styles). Diagnosis attempt: parent containers constraining width, font scope wrong, link styling not stripped. Added all of those fixes. Still broken.

15. **Theory: `<p>` wrapping breaks `@media print`** — observed via `render_text` that PageStylesheet wraps each transcluded stylesheet's content in `<p>...</p>`. Hypothesized CSS parser consumes `<p>@media print {...}` as one failed qualified rule, discarding the whole block.

16. **Decoy rule trick** — added `body{}` before `@media print` to absorb the leading `<p>` garbage. The CSS parser would consume `<p>...body{}` as the failed qualified rule, then encounter `@media print` at a clean top-level position. Verified the rendered output structure was now correct in tokenization terms.

17. **User screenshot: "still no luck. nothing works. except page 1" / "Nothing works. dig deeper!" / "does not work"** — escalating frustration after multiple "this should work now" claims. The CSS theories were each plausible but cumulatively wrong.

18. **User instruction: "in this tiddler CSS comments need to be replaced by HTML comments"** — converted ALL block-level `/* */` to `<!-- -->` in `$:/vocab/fountain/styles` (plugin file). User then added `commentinline commentblock` to the pragma themselves (improving the rules list explicitly rather than relying on `html` rule for HTML-comment parsing).

19. **User instruction: "use pt instead of em for font sizes"** — converted all `font-size: Nem` in plugin styles to `pt` at standard 1em ≈ 12pt mapping (1em→12pt, 1.4em→16pt, 0.85em→10pt, 0.95em→11pt, 1.2em→14pt, 1.05em→13pt, 0.7em→8pt). Kept margin/padding/line-height as em.

20. **User instruction: "use cm instead of in"** — converted all inch units in industry layout to cm at clean rounded values (1in→2.5cm, 1.5in→4cm, 2in→5cm, 3.5in→9cm, 4in→10cm, 6in→15cm). Page is now A4 / 4cm binding / 2.5cm other margins / 15cm text column.

21. **THE ACTUAL ROOT CAUSE** — user message: *"It works now. The problem was the reveal.js plugin, which did overwrite all the printer settings"*. The `sukima/reveal-js` plugin ships a bundled `@media print` block (visible around line 3052 of the rendered page stylesheet — long minified blob). It overrides per-vocab print rules in the cascade. User disabled it via a new `$__config_Plugins_Disabled_$__plugins_sukima_reveal-js.tid` config tiddler. All the industry print rules then worked as written. The CSS rendering theories were complete misdiagnoses.

22. **Saved root-cause memory** — `project_reveal_js_print_override.md`. Future sessions should check reveal.js first before suspecting wikitext-rendering quirks.

23. **History.tid trim** — wrote initial beta-40 history entry with 3 bullets. User edited it down to 2 bullets (dropped the print-baseline bullet). Plugin's `$__vocab_fountain_styles.tid` showed clean against HEAD after the user's editing — so the transition right-edge fix needed to be re-applied (1 line) for code to match history.

24. **Commits** — plugin `41d80e2` (4 files, 72 insertions). Editions `190bbbf` (5 files, 118 insertions). User then committed docs updates themselves as `6edb86e`. Per user's standing rule, commit-msg files at repo root for VSCode visibility.

25. **Docs update** — added page-break row to `Vocabulary - Fountain.tid` marker map, "What works" bullet, Related link to industry layout. Updated `Shipped Vocabularies.tid` vocab/fountain entry to mention lyrics + page breaks + industry layout link. User committed these as `6edb86e`.

## Key Decisions

- **Page break as a wikirule, not a marker.** Markers expect content after the open literal; `===` is content-less. Wikirule in `fountain-flavour/` matches the existing pattern (`fountain-character.js`, `fountain-transition.js`). Gated on a vocab flag (`page-break: yes`) so the engine remains vocab-agnostic.

- **Industry layout shipped as a separate, untagged-by-default tiddler in editions.** User picked "Both — minimal default + opt-in full layout" from the print scope question. Default minimal lives in the plugin's `$:/vocab/fountain/styles`. Industry-spec layout is opt-in via `$:/tags/Stylesheet` on the editions-side tiddler. Users who don't want industry layout never see it.

- **All fountain content visible in print** (synopses, sections, boneyards). User: "NONE of the fountain rules should be hidden!!!". Industry spec says these are author-only, but user wants them all visible. Decision overrides spec.

- **Right-align ALL transitions in industry layout, including FADE IN:.** Industry spec says openers (FADE IN:) stay left, mid-script transitions right. User wants them all right. Industry CSS now combines `.wltc-fountain-transition, .wltc-fountain-fade-in` into one right-aligned rule.

- **No `!important` anywhere.** User: "In my CSS !important WILL NEVER HAPPEN". Cascades win via ancestor specificity (`html body .foo` instead of `.foo !important`, `.wltc-fountain .wltc-fountain-character` instead of `.wltc-fountain-character !important`). Saved as feedback memory.

- **HTML comments `<!-- -->` in TW stylesheets, not CSS `/* */`.** User instruction. Avoids wikitext paragraph-wrapping fragmenting comment blocks. Block-level only — inline within-rule comments stay as `/* */` (HTML comments inside a CSS declaration block break parsing). Saved as feedback memory.

- **`>` selectors avoided in TW stylesheet tiddlers, but it's a TW gotcha not a general rule.** User pushback on overgeneralized memory. Within TW wikitext stylesheets, `>` becomes `&gt;` in output and breaks CSS. In real CSS, use `>` freely. Memory scoped to text/vnd.tiddlywiki stylesheets only.

- **cm + pt units, not inches + em.** User preference for European typography units. Plugin styles font-size in pt; industry layout dimensions in cm at clean rounded values (no decimals).

- **Disable reveal.js in editions, not the plugin.** Editions ships a config tiddler to disable it. The plugin still exists in the wiki and could be re-enabled if needed. Decision: surgical disable, not removal.

- **Commit-msg files at repo root, not /tmp.** User: "commit-msg.md have to be in the repository root. So I can see it". They review in VSCode before committing.

- **Don't update history.tid bullets when user has edited them.** User trimmed my beta-40 entry from 3 bullets to 2 (dropped the print-baseline bullet, since the print baseline ended up being delivered via the editions-side industry layout + the trivial cm/pt changes in the plugin styles tiddler). Respected the trim. Re-applied the one-line transition fix to make code match the kept "transition right edge" bullet.

- **User-committed docs separately.** User said "I did commit the docs update" — meaning they want to handle docs commits themselves sometimes. Don't bundle docs into the main feature commit if user is going to do it independently.

## Evidence & Data

### Plugin commits this session

| Hash | Version | Subject |
|---|---|---|
| `41d80e2` | **beta-40** | cm: v1.0.0-beta-40 — fountain page break + transition right-edge fix |

### Editions commits this session

| Hash | Subject |
|---|---|
| `190bbbf` | cm fountain: opt vocab into page-break; ship industry-print stylesheet + page-break example; disable reveal.js (print CSS conflict) |
| `6edb86e` | doc adjustments (committed by user — Vocabulary - Fountain + Shipped Vocabularies updates) |

### Files changed (plugin commit `41d80e2`)

| File | Change |
|---|---|
| `wikilabs/custom-markup/plugin.info` | version `1.0.0-beta-39` → `1.0.0-beta-40` |
| `wikilabs/custom-markup/tiddlers/meta/history.tid` | beta-40 entry (2 bullets: page-break wikirule + transition right-edge fix) |
| `wikilabs/custom-markup/tiddlers/wikirules/fountain-flavour/fountain-page-break.js` | NEW — page-break wikirule |
| `wikilabs/custom-markup/tiddlers/$__vocab_fountain_styles.tid` | transition `margin-left: auto` fix; HTML comments throughout; font-size em → pt; pragma now includes `commentinline commentblock` |

### Files changed (editions commit `190bbbf`)

| File | Change |
|---|---|
| `custom-markup/tiddlers/vocab_fountain.tid` | `page-break: yes` field |
| `custom-markup/tiddlers/Example - Fountain screenplay.tid` | inserted `===` between Act One / Act Two |
| `custom-markup/tiddlers/Fountain Print - Industry Layout.tid` | NEW — opt-in industry print stylesheet (text/vnd.tiddlywiki + `\rules only` pragma) |
| `custom-markup/tiddlers/Example - Fountain page break.tid` | NEW — minimal `===` demo |
| `custom-markup/tiddlers/$__config_Plugins_Disabled_$__plugins_sukima_reveal-js.tid` | NEW — disables reveal.js to stop its print CSS overrides |

### Files changed (user's docs commit `6edb86e`)

| File | Change |
|---|---|
| `custom-markup/tiddlers/Vocabulary - Fountain.tid` | page-break row in marker map, "What works" bullet, Related link to industry layout |
| `custom-markup/tiddlers/Shipped Vocabularies.tid` | vocab/fountain entry mentions lyrics + page breaks + links to industry layout |

### Industry-layout iteration history

| Attempt | Type | Comment style | Result | Why broken (or worked) |
|---|---|---|---|---|
| 1 | `text/css` | `/* */` | broken | TW's CSS parser wraps body in `<pre><code>` inside `<style>` |
| 2 | `text/vnd.tiddlywiki` + `\rules only ... html` | `/* */` | broken | literal `<pre>` / `<style>` in comments parsed as HTML tags → stray closing tags |
| 3 | `text/vnd.tiddlywiki` + no `html` rule | `/* */` (no literal tags) | broken | wikitext paragraph wrapping on blank lines fragmented `@media print` block |
| 4 | `text/vnd.tiddlywiki` + `\rules only ... html` | `<!-- -->` (HTML comments) | broken | "decoy rule" needed; blank lines inside @media still problematic in theory |
| 5 | added `body{}` decoy before `@media print` | `<!-- -->` | broken | none of the above were the actual cause |
| 6 | (no change) — user disabled `sukima/reveal-js` | `<!-- -->` | **works** | reveal.js's bundled `@media print` had been overriding everything from the start |

### Industry layout final dimensions (cm)

| Element | Dimension |
|---|---|
| Page size | A4 |
| Top / bottom / right margin | 2.5cm |
| Left binding margin | 4cm |
| Text column width (`.wltc-fountain` max-width) | 15cm |
| Character cue indent (`.wltc-fountain-character` margin-left) | 5cm |
| Dialogue indent (character + p) | 2.5cm |
| Dialogue width (character + p max-width) | 9cm |
| Title page top margin (`.wltc-front-matter` margin-top) | 10cm |
| Font (`.wltc-fountain`) | Courier 10pt |

### Plugin styles font-size conversions (em → pt)

| Selector context | em | pt |
|---|---|---|
| Typography baseline (top-of-file) | 1em | 12pt |
| `.wltc-front-matter-row:first-child` | 1.4em | 16pt |
| `.wltc-front-matter-row[data-key="Copyright"]` | 0.85em | 10pt |
| `.wltc-fountain-synopsis` | 0.95em | 11pt |
| `.wltc-fountain-section.wltc-l1` | 1.2em | 14pt |
| `.wltc-fountain-section.wltc-l2` | 1.05em | 13pt |
| `.wltc-fountain-section.wltc-l3` | 1em | 12pt |
| `.wltc-fountain-section.wltc-l4` | 0.95em | 11pt |

### Memory files persisted this session

| File | Type | Purpose |
|---|---|---|
| `feedback_no_css_important.md` | feedback | Never use `!important` in CSS; win via specificity (ancestor chains). |
| `feedback_tw_stylesheet_comments.md` | feedback | In `text/vnd.tiddlywiki` stylesheet tiddlers: HTML `<!-- -->` not CSS `/* */`. Also notes `>` selector gotcha (TW HTML-escapes), scoped to TW only. |
| `project_reveal_js_print_override.md` | project | `sukima/reveal-js` plugin's `@media print` overrides per-vocab print rules; rule it out before suspecting wikitext quirks. |

### Repos ahead-of-origin state

| Repo | Commits ahead | Branch | Notes |
|---|---|---|---|
| `wikilabs/plugins` | 4 | master | beta-37, 38, 39, 40 all unpushed |
| `wikilabs/editions` | 3 | master | session-record (parent), main (190bbbf), docs (6edb86e) all unpushed |

### Working tree (current, both repos)

- Plugin: clean except `commit-msg.md` (untracked, deliberate).
- Editions: clean except `commit-msg.md` (untracked, deliberate) and unstaged "Session Closed" footer on the parent handoff file (carried over from prior session).

## Code Analysis

- **`fountain-page-break.js`** structure mirrors `fountain-transition.js`: regex with `(?<=^|\n\n)` lookbehind for blank-before, `[ \t]*={3,}[ \t]*\n` for the separator line, `(?=\n|(?![\s\S]))` lookahead for blank-after-or-EOF. Stores match in `this.match`. `findNextMatch` early-returns `undefined` if `hasVocabFlag("page-break")` is false. `parse()` advances `this.parser.pos` past the matched chars and emits `{type: "element", tag: "div", attributes: {class: "wltc-fountain-page-break"}}` (no children, empty div).

- **Front-matter / page-break non-collision** — `front-matter.js` fires only when `parser.pos === 0` AND its own `SEPARATOR_RE` (`/^={3,}[ \t]*$/`) is matched as the title-page terminator. The page-break wikirule won't see `===` inside the title page because front-matter has already consumed it.

- **Industry-layout selector specificity ladder** — `html body .tc-titlebar` (3 levels deep) beats screen rules at `.tc-titlebar` (1 class). `.wltc-fountain .wltc-fountain-character` (2 classes) beats screen `.wltc-fountain-character` (1 class). `.wltc-fountain a.tc-tiddlylink` (class + element + class) beats default link styling. No `!important` needed.

- **Industry layout pragma** — `\rules only filteredtranscludeinline transcludeinline macrodef macrocallinline html commentinline commentblock`. The `html` rule lets the wikitext parser recognize literal HTML tags but produces interpretation hazards if comments contain `<pre>` / `<style>` / `<N>` text. `commentinline` and `commentblock` are explicit so HTML comments are recognized cleanly.

- **`$:/vocab/fountain/styles` pragma update** — user added `commentinline commentblock` to its `\rules only` line as well, so the converted HTML comments parse correctly there too.

- **Transition right-edge fix mechanics** — `.wltc-fountain-transition` has `max-width: 60ch` inside an 80ch `.wltc-fountain` parent. Default `margin: 1em 0` anchors the 60ch box to the LEFT of the 80ch parent → right edge sits at column 60 of 80. Changed to `margin: 1em 0 1em auto` (top=1em / right=0 / bottom=1em / left=auto) → margin-left absorbs the leftover 20ch space → box anchored to RIGHT of the 80ch parent → right-aligned text within ends at column 80, matching the body's right edge.

- **reveal.js print bundle location** — visible in the rendered `{{$:/core/ui/PageStylesheet}}` text output around line 3052, long minified CSS string containing reveal.js's full `@media print` plus an extensive screen stylesheet. The print rules inside that bundle reset many fountain-relevant selectors at higher specificity than per-vocab stylesheets achieve.

- **`Fountain Print - Industry Layout.tid`** — text/vnd.tiddlywiki with `\rules only filteredtranscludeinline transcludeinline macrodef macrocallinline html commentinline commentblock`. Body opens with an HTML comment doc-header, then a single `@media print { ... }` block containing: @page rule, parent-width reset for `html body .tc-page-container[-wrapper]` / `.tc-story-river` / `.tc-tiddler-frame` / `.tc-tiddler-body`, chrome hide for `.tc-titlebar` / `.tc-subtitle` / `.tc-tags-wrapper` / `.wltc-trail`, font baseline scoped to `.wltc-fountain`, prettylink strip, generic action rule (`.wltc-fountain p`), per-element rules for scene heading / character / dialogue / transitions / front matter. Final state was rewritten enough times that earlier "decoy rule" and "no-blank-lines" workarounds are gone — they were never needed (reveal.js was the actual cause).

- **Commit-msg files** — `/home/mario/git/tiddly/wikilabs/plugins/commit-msg.md` and `/home/mario/git/tiddly/wikilabs/editions/commit-msg.md`. Both updated in-place during the session as scope changed. Not in `.gitignore`, deliberately untracked.

## User Feedback & Preferences

Heavy session for user feedback — many corrections and preferences expressed.

- **"Both — minimal default + opt-in full layout"** (answer to print-scope question) — shape of the print-CSS delivery. Default minimal in plugin, opt-in industry in editions.
- **"It is right aligned, but not at the right border of the other text"** — clarified the transition bug. User looks at the rendered output carefully and identifies layout misalignments at the pixel level.
- **"The default CSS does not even print properly at all"** — early frustration signal. Triggered the diagnostic chain.
- **"NONE of the fountain rules should be hidden!!!"** — emphatic. Even author-only material (synopses, sections, boneyards) stays visible in user's print. Industry spec disagrees; user wins.
- **"In my CSS !important WILL NEVER HAPPEN. Make it more specific if you want to hide something"** — STANDING RULE, saved as memory. Specificity-based cascades only.
- **"avoid `>` in selectors / in the global rule is nonsense"** — narrowed an over-broad memory I'd written. User reads my memory writes and corrects scope.
- **"If you use text/vnd.tiddlywiki type for stylesheets, you need to use HTML comments instead of CSS comments. `<!-- comment -->` is needed"** — STANDING RULE, saved as memory. TW-specific stylesheet convention.
- **"still no luck. nothing works. except page 1"** / **"Nothing works. dig deeper!"** / **"does not work"** — escalating frustration through the false diagnostic chain. User is patient but pointed.
- **"in this tiddler CSS comments need to be replaced by HTML comments"** — specific edit instruction, applied to `$:/vocab/fountain/styles`.
- **"use pt instead of em for font sizes"** — terse unit-preference instruction.
- **"use cm instead of in"** — same, mid-task. User issues unit changes as imperatives.
- **"It works now. The problem was the reveal.js plugin, which did overwrite all the printer settings"** — root-cause identification by user, not me. Future sessions: check reveal.js first.
- **"reduce history by 30%"** — terse style preference for history.tid entries.
- **"commit-msg.md have to be in the repository root. So I can see it"** — workflow preference. Files at repo root, not /tmp.
- **"commit, except commit-msg and handoff"** — commit authorization with explicit exclusion list. User trusts me to run `git commit` when they've reviewed via VSCode.
- **"I did commit the docs update"** — user committed docs themselves separately. Pattern: keep docs commits modular, sometimes the user wants to handle them.
- **"handoff"** (one word) — invocation signal for the handoff skill.

## Where We're Going

The user did not declare a clear next direction. Likely candidates:

1. **Push the 4 plugin commits + 3 editions commits to origin/master.** Both repos remain ahead even after this session. Parent handoff also flagged this as deferred. Standing rule: don't push without explicit user instruction.
2. **Decide reveal.js's permanent status in editions.** It's now disabled via a config tiddler. Permanent disable, or revisit if presentation demos break? May want to scope the disable to non-fountain tiddlers.
3. **Other deferred fountain spec gaps from parent handoff** still open: Notes (`[[text]]`) — collides with TW prettylinks; mid-dialogue parentheticals; scene numbers (`#1#`, `#1A#`); escape sequences (`\*`, `\_`); sections-visible-vs-spec-hidden divergence.
4. **Test industry layout in a wiki WITHOUT reveal.js installed.** Editions still ships reveal.js. Confirm the disable config + print stylesheet works for a fresh user who hasn't manually disabled it.
5. **Consider moving the industry layout into the plugin** instead of editions, so all installs get it as an opt-in. (Current: only editions ships it. Plugin-side would mean all custom-markup users have access.)

## Risks & Blockers

- **reveal.js disable is via a config tiddler in editions.** Anyone who re-enables it (or has an old wiki snapshot pre-this-session) will see broken print again. Memory `project_reveal_js_print_override` documents the cause for diagnosis next time.
- **Plugin JS changes need server restart** (the new `fountain-page-break.js`). User must Ctrl-C the Node TW server and restart for the wikirule to load. MCP `reload_tiddlers` only handles edition tiddlers.
- **Industry layout depends on TW chrome class names** (`.tc-titlebar`, `.tc-subtitle`, `.tc-tags-wrapper`). TW core refactors could break the hides. Low risk near-term.
- **`commit-msg.md` files at repo root** are intentionally untracked but visible in VSCode. Risk of accidentally `git add -A` would stage them. Stage by name, not `-A`.

## Open Questions

- **Push timing?** Parent asked same question; user hasn't said.
- **Should reveal.js be REMOVED from editions** entirely, not just disabled? Or kept available for users who want presentation demos?
- **Should the industry print layout move from editions to plugin** so it ships with the plugin itself?

## Quick Start for Next Session

```bash
# Reference docs (none — no project bible exists for this repo)

# Verify current state
cd /home/mario/git/tiddly/wikilabs/plugins && git log --oneline -5
cd /home/mario/git/tiddly/wikilabs/editions && git log --oneline -5

# Confirm plugin version
grep version /home/mario/git/tiddly/wikilabs/plugins/wikilabs/custom-markup/plugin.info
# expect: "1.0.0-beta-40"

# Confirm page-break wikirule shipped
ls /home/mario/git/tiddly/wikilabs/plugins/wikilabs/custom-markup/tiddlers/wikirules/fountain-flavour/
# expect: fountain-page-break.js + fountain-character.js + fountain-transition.js

# Confirm reveal.js disable config exists
ls /home/mario/git/tiddly/wikilabs/editions/custom-markup/tiddlers/'$__config_Plugins_Disabled_$__plugins_sukima_reveal-js.tid'

# Confirm industry layout tiddler exists + is tagged
grep -A 5 "^tags:" /home/mario/git/tiddly/wikilabs/editions/custom-markup/tiddlers/'Fountain Print - Industry Layout.tid'
# expect: tags: $:/tags/Stylesheet

# Key files to read if returning to print / fountain work
cd /home/mario/git/tiddly/wikilabs/plugins/wikilabs/custom-markup
cat tiddlers/wikirules/fountain-flavour/fountain-page-break.js     # new wikirule
sed -n '145,165p' tiddlers/'$__vocab_fountain_styles.tid'           # transition right-edge fix
cat tiddlers/meta/history.tid | head -10                            # beta-40 entry

cd /home/mario/git/tiddly/wikilabs/editions/custom-markup
cat tiddlers/'Fountain Print - Industry Layout.tid'                  # opt-in industry layout

# Memory entries to recall
cat /home/mario/.claude/projects/-home-mario-git-tiddly-wikilabs-editions/memory/feedback_no_css_important.md
cat /home/mario/.claude/projects/-home-mario-git-tiddly-wikilabs-editions/memory/feedback_tw_stylesheet_comments.md
cat /home/mario/.claude/projects/-home-mario-git-tiddly-wikilabs-editions/memory/project_reveal_js_print_override.md

# IF user asks for more fountain spec compliance, the deferred items from
# the parent handoff are still: Notes ([[text]]), mid-dialogue parentheticals,
# scene numbers (#1#), escape sequences (\*, \_), sections-spec-hidden.

# Next action
# Confirm with user whether to push these branches. Both are ahead and the
# work has been verified working (print preview confirmed after reveal.js
# was disabled). Standing rule: do not push without explicit instruction.
```

## Session Closed
**Closed at:** 2026-05-25 11:45
**Commit:** 0449562 (editions repo — handoff record)
**Session status:** Handed off to next session
