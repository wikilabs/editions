"use strict";

/*
Pins the wiki-facing half of the LSP server: what counts as a link, which
links are worth diagnosing, and what a title completion offers.

Everything here is a pure function of a document's text plus the booted wiki,
so no transport and no session are involved. To replicate by hand, boot the
test edition and call the same module:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.diagnostics("file:///x.tid", "title: X\n\nSee [[Nope]]\n");
  f.completions("file:///x.tid", "title: X\n\nSee [[lsp", {line: 2, character: 10});
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const URI = "file:///wiki/tiddlers/probe.tid";
const SEVERITY_WARNING = 2;

// This fixture exists in tiddlers/lsp/, so a link to it must never warn.
const EXISTING_TITLE = "lsp_link_target";
const MISSING_TITLE = "lsp_no_such_tiddler";

let $tw;
let features;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

// A .tid document: fields, a blank line, then the body at line 2.
function tid(body) {
	return "title: probe\n\n" + body;
}

// --- Header handling ---

test("the body of a .tid starts after the blank line that ends the fields", () => {
	assert.equal(features.bodyStartLine(["title: X", "tags: Y", "", "Body"]), 3);
});

test("a document that never had a field header is body from line 0", () => {
	assert.equal(features.bodyStartLine(["Just prose", "and more"]), 0);
});

test("a link in a header field is not diagnosed", () => {
	// A tags field routinely names tiddlers that do not exist yet, and it is
	// not wikitext, so it must stay out of the scan.
	const text = "title: probe\ntags: [[" + MISSING_TITLE + "]]\n\nBody with no links.\n";
	assert.deepEqual(features.diagnostics(URI, text), []);
});

// --- Link scanning ---

test("a plain link, a captioned link and a transclusion are all found", () => {
	const lines = ["[[Alpha]] {{Beta}} [[shown|Gamma]]"];
	const found = features.scanLinks(lines, 0);
	assert.deepEqual(found.map((l) => l.target), ["Alpha", "Beta", "Gamma"]);
});

test("a captioned link ranges over the target, not the caption", () => {
	const found = features.scanLinks(["A [[Caption|Missing]] B"], 0);
	assert.equal(found.length, 1);
	assert.equal(found[0].target, "Missing");
	assert.equal(found[0].start, 12);
	assert.equal(found[0].end, 19);
});

test("a transclusion with a template names the target, not the template", () => {
	const found = features.scanLinks(["{{Target||SomeTemplate}}"], 0);
	assert.deepEqual(found.map((l) => l.target), ["Target"]);
});

test("a filtered transclusion is a filter, not a title", () => {
	assert.deepEqual(features.scanLinks(["{{{ [tag[Done]] }}}"], 0), []);
});

test("inline code and fenced blocks are skipped", () => {
	const lines = ["`[[NotALink]]` real: [[Alpha]]", "```", "[[AlsoNotALink]]", "```"];
	const found = features.scanLinks(lines, 0);
	assert.deepEqual(found.map((l) => l.target), ["Alpha"]);
});

test("a field or index suffix is not part of the title", () => {
	assert.equal(features.titleOfTarget("Some Tiddler!!caption"), "Some Tiddler");
	assert.equal(features.titleOfTarget("Some Tiddler##2"), "Some Tiddler");
});

// --- Diagnostics ---

test("a link to a missing tiddler warns, naming the title", () => {
	const found = features.diagnostics(URI, tid("See [[" + MISSING_TITLE + "]] here.\n"));
	assert.equal(found.length, 1);
	assert.equal(found[0].severity, SEVERITY_WARNING);
	assert.equal(found[0].source, "tiddlywiki");
	assert.ok(found[0].message.includes(MISSING_TITLE), "message must name the missing title");
	assert.equal(found[0].range.start.line, 2, "the range must be in body coordinates");
	assert.equal(found[0].range.start.character, 6);
});

test("a link to an existing tiddler does not warn", () => {
	assert.deepEqual(features.diagnostics(URI, tid("See [[" + EXISTING_TITLE + "]].\n")), []);
});

test("a link to a shadow tiddler does not warn", () => {
	// Shadows are real targets, and much of a wiki's linking is to them.
	assert.deepEqual(features.diagnostics(URI, tid("See [[$:/core/ui/PageTemplate]].\n")), []);
});

test("an external address is not a tiddler title", () => {
	const text = tid("See [[docs|https://tiddlywiki.com]] and [[mail|mailto:a@b.c]].\n");
	assert.deepEqual(features.diagnostics(URI, text), []);
});

test("a target assembled from a variable is not diagnosed", () => {
	// The title only exists at render time, so the server cannot know it.
	assert.deepEqual(features.diagnostics(URI, tid("See [[$(currentTiddler)$]].\n")), []);
});

test("a field suffix is stripped before the title is looked up", () => {
	assert.deepEqual(features.diagnostics(URI, tid("See {{" + EXISTING_TITLE + "!!title}}.\n")), []);
});

// --- Completion context ---

test("an open link gives the prefix typed so far", () => {
	assert.deepEqual(features.linkContext("See [[lsp_l", 11), { start: 6, prefix: "lsp_l" });
});

test("a closed link offers nothing", () => {
	assert.equal(features.linkContext("See [[Alpha]] and ", 18), null);
});

test("inside a captioned link the prefix starts after the pipe", () => {
	assert.deepEqual(features.linkContext("See [[shown|lsp", 15), { start: 12, prefix: "lsp" });
});

test("a filtered transclusion offers nothing", () => {
	assert.equal(features.linkContext("{{{ [tag[", 9), null);
});

test("a field name is not completed as a title", () => {
	assert.equal(features.linkContext("{{Alpha!!cap", 12), null);
});

// --- Completion results ---

test("an open link offers a matching title", () => {
	const text = tid("See [[lsp_link");
	const result = features.completions(URI, text, { line: 2, character: 14 });
	const labels = result.items.map((i) => i.label);
	assert.ok(labels.includes(EXISTING_TITLE), "expected " + EXISTING_TITLE + " in " + labels.join(", "));
});

test("every item claims the typed text, so the editor cannot filter the list again", () => {
	// The editor matches its own idea of the current word against filterText and
	// drops what does not match. Its word stops at a space, so "LSP " would
	// discard most of the LSP titles even though the server chose them all.
	// Several titles sharing a first word, which is the case that breaks: the
	// editor's word ends at the space and matches none of them.
	$tw.wiki.addTiddler({ title: "lsp probe alpha", text: "a" });
	$tw.wiki.addTiddler({ title: "lsp probe beta", text: "b" });
	try {
		const typed = "lsp ";
		const result = features.completions(URI, tid("See [[" + typed), { line: 2, character: 6 + typed.length });
		assert.ok(result.items.length > 1, "this prefix must match several titles");
		assert.ok(
			result.items.every((i) => i.filterText === typed),
			"every item must claim exactly the typed text: " +
				result.items.map((i) => i.filterText).join(" | ")
		);
	} finally {
		$tw.wiki.deleteTiddler("lsp probe alpha");
		$tw.wiki.deleteTiddler("lsp probe beta");
	}
});

test("sortText carries the server's ranking, since filterText no longer can", () => {
	const result = features.completions(URI, tid("See [[ls"), { line: 2, character: 8 });
	const sorts = result.items.map((i) => i.sortText);
	assert.deepEqual(sorts, sorts.slice().sort(), "sortText must already be in order");
	assert.equal(new Set(sorts).size, sorts.length, "each item needs its own sort key");
});

test("the edit replaces the typed prefix, so a title with spaces still lands", () => {
	// The client's own word matching splits on spaces, which would leave half a
	// title behind. Stating the range and the filter text keeps that out of it.
	const spaced = "lsp probe with spaces";
	$tw.wiki.addTiddler({ title: spaced, text: "probe" });
	try {
		const text = tid("See [[lsp pro");
		const result = features.completions(URI, text, { line: 2, character: 13 });
		const item = result.items.find((i) => i.label === spaced);
		assert.ok(item, "expected the spaced title to be offered");
		// filterText is the typed text, not the title: see the test above.
		assert.equal(item.filterText, "lsp pro");
		assert.deepEqual(item.textEdit.range, {
			start: { line: 2, character: 6 },
			end: { line: 2, character: 13 }
		});
		assert.equal(item.textEdit.newText, spaced);
	} finally {
		$tw.wiki.deleteTiddler(spaced);
	}
});

test("system titles stay out of the way until the prefix asks for them", () => {
	const plain = features.completions(URI, tid("See [[lsp"), { line: 2, character: 9 });
	assert.ok(
		plain.items.every((i) => !i.label.startsWith("$:/")),
		"a plain prefix must not offer system titles"
	);
	const system = features.completions(URI, tid("See [[$:/core/ui/Page"), { line: 2, character: 21 });
	assert.ok(
		system.items.some((i) => i.label.startsWith("$:/core/ui/Page")),
		"a $:/ prefix must reach shadows and system tiddlers"
	);
});

test("the separate words typed still reach a multi-word title", () => {
	// Typing "LS S" for "LSP Server" finds nothing by substring, because no
	// title contains "LS " literally. Words are what a reader remembers.
	const spaced = "lsp probe spaced title";
	$tw.wiki.addTiddler({ title: spaced, text: "probe" });
	try {
		const result = features.completions(URI, tid("See [[ls sp"), { line: 2, character: 11 });
		const labels = result.items.map((i) => i.label);
		assert.ok(labels.includes(spaced), "expected " + spaced + " in " + labels.join(", "));
	} finally {
		$tw.wiki.deleteTiddler(spaced);
	}
});

test("a trailing space does not empty the list", () => {
	// Typing "LS" and then a space begins the next word. It must not be read as
	// a literal "LS " that no title contains, which would make the list vanish
	// at the exact keystroke a multi-word title needs.
	const before = features.completions(URI, tid("See [[ls"), { line: 2, character: 8 });
	const after = features.completions(URI, tid("See [[ls "), { line: 2, character: 9 });
	assert.ok(before.items.length > 0, "the bare prefix must match the fixture");
	assert.ok(after.items.length > 0, "a trailing space must not empty the list");
});

test("one character offers nothing, two characters offer a list", () => {
	// A single letter matches too much of any real wiki to be a useful list.
	const one = features.completions(URI, tid("See [[l"), { line: 2, character: 7 });
	assert.deepEqual(one.items, []);
	assert.equal(one.isIncomplete, true, "the editor must keep asking as more is typed");
	const two = features.completions(URI, tid("See [[ls"), { line: 2, character: 8 });
	assert.ok(two.items.length > 0, "two characters must produce a list");
});

test("an empty prefix offers nothing rather than the whole wiki", () => {
	const result = features.completions(URI, tid("See [["), { line: 2, character: 6 });
	assert.deepEqual(result.items, []);
});

test("matching is by prefix, so the middle of a title does not match", () => {
	// "ink" sits inside lsp_link_target, but nobody looks for a title by its
	// middle, and substring matching fills the list with noise.
	const result = features.completions(URI, tid("See [[ink"), { line: 2, character: 9 });
	assert.ok(
		result.items.every((i) => i.label !== EXISTING_TITLE),
		"a mid-word match must not be offered"
	);
});

test("a word of the title may be matched from its start", () => {
	// lsp_link_target is several words to a reader, so "link" reaches it.
	const result = features.completions(URI, tid("See [[link"), { line: 2, character: 10 });
	const labels = result.items.map((i) => i.label);
	assert.ok(labels.includes(EXISTING_TITLE), "expected " + EXISTING_TITLE + " in " + labels.join(", "));
});

test("matching ignores case", () => {
	const lower = features.completions(URI, tid("See [[lsp_link"), { line: 2, character: 14 });
	const upper = features.completions(URI, tid("See [[LSP_LINK"), { line: 2, character: 14 });
	assert.deepEqual(
		upper.items.map((i) => i.label),
		lower.items.map((i) => i.label)
	);
});

test("a list of matches is always incomplete, so the editor keeps asking", () => {
	// A complete list is cached and filtered by the editor, and the editor's
	// filtering stops at the space in a title. Incomplete forces a fresh
	// request per keystroke, which is what makes spaced titles work at all.
	const result = features.completions(URI, tid("See [[lsp_link"), { line: 2, character: 14 });
	assert.ok(result.items.length > 0, "this prefix must match the fixture");
	assert.equal(result.isIncomplete, true);
});

test("a cursor outside any link offers nothing", () => {
	const result = features.completions(URI, tid("Just prose here."), { line: 2, character: 10 });
	assert.deepEqual(result, { isIncomplete: false, items: [] });
});
