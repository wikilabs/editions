"use strict";

/*
Pins hovering a filter expression: the server runs it against the live wiki and
reports what it currently resolves to.

This is the feature a parser reading the folder could not provide, so the thing
worth guarding is honesty. A filter under a cursor is usually HALF TYPED, and an
unfinished filter must not be reported as one that legitimately matches nothing.
Those two outcomes share a shape (no titles) and must not share a message.

To replicate by hand, boot the test edition and call the module:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.hover("file:///x.tid", "title: X\n\n{{{ [tag[lsp]] }}}", {line: 2, character: 10});
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const URI = "file:///wiki/tiddlers/probe.tid";
const TAG = "lsp_hover_tag";

let $tw;
let features;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

function tid(body) {
	return "title: probe\n\n" + body;
}

// Hover the given body line at the given column.
function hoverAt(body, character) {
	const result = features.hover(URI, tid(body), { line: 2, character: character });
	return result === null ? null : result.contents.value;
}

// Two tiddlers carrying the probe tag, cleaned up by the caller.
function withTagged(fn) {
	$tw.wiki.addTiddler({ title: "lsp_hover_one", text: "a", tags: [TAG] });
	$tw.wiki.addTiddler({ title: "lsp_hover_two", text: "b", tags: [TAG] });
	try {
		fn();
	} finally {
		$tw.wiki.deleteTiddler("lsp_hover_one");
		$tw.wiki.deleteTiddler("lsp_hover_two");
	}
}

// --- Where a filter is recognised ---

test("a filtered transclusion is a filter", () => {
	const found = features.filterContext("{{{ [tag[Done]] }}}", 8);
	assert.equal(found.text, " [tag[Done]] ");
});

test("a filter attribute value is a filter, in every quoting style", () => {
	assert.equal(features.filterContext('<$list filter="[tag[A]]">', 18).text, "[tag[A]]");
	assert.equal(features.filterContext("<<list-links filter:'[tag[A]]'>>", 24).text, "[tag[A]]");
	assert.equal(features.filterContext("<$list filter=`[tag[A]]`>", 18).text, "[tag[A]]");
});

test("a cursor outside any filter hovers nothing", () => {
	assert.equal(features.filterContext("just prose here", 5), null);
	assert.equal(hoverAt("just prose here", 5), null);
});

test("a link is not a filter", () => {
	// [[Title]] shares its brackets with filter syntax but is not one.
	assert.equal(features.filterContext("See [[Some Title]]", 10), null);
});

// --- What the hover says ---

test("a filter that matches reports the count and the titles", () => {
	withTagged(() => {
		const text = hoverAt("{{{ [tag[" + TAG + "]] }}}", 10);
		assert.ok(text.includes("2 tiddlers"), text);
		assert.ok(text.includes("lsp_hover_one"), text);
		assert.ok(text.includes("lsp_hover_two"), text);
	});
});

test("one match is reported in the singular", () => {
	const text = hoverAt("{{{ [[lsp_link_target]] }}}", 10);
	assert.ok(text.includes("1 tiddler**"), text);
});

test("a filter that matches nothing says so", () => {
	const text = hoverAt("{{{ [tag[lsp_no_such_tag_at_all]] }}}", 10);
	assert.ok(text.includes("Matches nothing"), text);
});

test("an unfinished filter is not reported as matching nothing", () => {
	// The cursor sits in a filter the user is still typing. Reporting "matches
	// nothing" here would be a confident lie: it has not been run.
	const text = hoverAt("{{{ [tag[lsp_hov", 12);
	assert.ok(text.includes("Unfinished"), text);
	assert.ok(!text.includes("Matches nothing"), "an unfinished filter must not claim an empty result");
});

test("a malformed filter reports the error rather than an empty result", () => {
	// Balanced brackets, but not a filter TiddlyWiki can parse.
	const text = hoverAt("{{{ [tag[a]xyz] }}}", 10);
	assert.ok(text.includes("Filter error"), text);
	assert.ok(!text.includes("Matches nothing"), "a broken filter must not look like an empty one");
});

test("an empty filter says so rather than running", () => {
	assert.ok(hoverAt("{{{  }}}", 4).includes("Empty filter"), "expected the empty-filter message");
});

test("the hover ranges over the filter, so the editor highlights it", () => {
	const line = "{{{ [tag[A]] }}}";
	const result = features.hover(URI, tid(line), { line: 2, character: 6 });
	assert.equal(result.range.start.line, 2);
	assert.equal(result.range.end.line, 2);
	// Stated as the text it covers rather than as two numbers, so the intent
	// survives a change of delimiter: everything between the braces.
	assert.equal(
		line.slice(result.range.start.character, result.range.end.character),
		" [tag[A]] "
	);
});

test("a filter in the field header of a .tid is not hovered", () => {
	// The header is not wikitext, so nothing in it is a filter to run.
	const text = "title: probe\nlist: {{{ [tag[A]] }}}\n\nBody\n";
	assert.equal(features.hover(URI, text, { line: 1, character: 15 }), null);
});

// --- Filters the parser finds that a line scanner could not ---

test("a filter in a widget attribute is hovered", () => {
	withTagged(() => {
		const text = hoverAt('<$list filter="[tag[' + TAG + ']]">x</$list>', 20);
		assert.ok(text.includes("2 tiddlers"), text);
	});
});

test("a \\function body is a filter and is hovered", () => {
	// A \function body IS a filter, where a \procedure body is wikitext. Both
	// parse to the same node type, so the two must be told apart.
	withTagged(() => {
		const text = hoverAt("\\function lsp.tagged() [tag[" + TAG + "]]", 30);
		assert.ok(text.includes("2 tiddlers"), text);
	});
});

test("a filter spanning two lines is hovered on its second line", () => {
	// A line scanner cannot see this at all; the parser reports one node.
	withTagged(() => {
		const body = '<$list filter="[tag[' + TAG + ']]\n[[lsp_link_target]]">x</$list>';
		const result = features.hover(URI, tid(body), { line: 3, character: 5 });
		assert.ok(result, "expected a hover on the continuation line");
		assert.ok(result.contents.value.includes("3 tiddlers"), result.contents.value);
	});
});

// --- A bare filter, with no wikitext saying it is one ---

test("a line that is nothing but a filter is hovered", () => {
	// Inside a documentation code block the text is deliberately inert, so
	// neither the parser nor the attribute scanner can see it.
	withTagged(() => {
		const text = hoverAt("[tag[" + TAG + "]]", 5);
		assert.ok(text.includes("2 tiddlers"), text);
	});
});

test("several runs on one line are one filter", () => {
	withTagged(() => {
		const text = hoverAt("[tag[" + TAG + "]] [[lsp_link_target]]", 5);
		assert.ok(text.includes("3 tiddlers"), text);
	});
});

test("an indented bare filter is hovered, and ranges over the filter only", () => {
	withTagged(() => {
		const line = "\t[tag[" + TAG + "]]";
		const result = features.hover(URI, tid(line), { line: 2, character: 4 });
		assert.ok(result, "expected a hover");
		assert.equal(line.slice(result.range.start.character, result.range.end.character), line.trim());
	});
});

test("prose that merely contains brackets is not a filter", () => {
	// It never parses, and reporting a filter error over ordinary prose would
	// make the whole feature noise.
	assert.equal(hoverAt("See note [1] for the details.", 10), null);
});

test("an unfinished bare run stays silent rather than claiming to be a filter", () => {
	// Inside {{{ }}} an unfinished filter is announced, because the syntax says
	// a filter was intended. Here nothing does, so silence is the honest answer.
	assert.equal(hoverAt("[tag[lsp_hov", 6), null);
});

test("a bare run TiddlyWiki cannot parse stays silent", () => {
	assert.equal(hoverAt("[tag[a]xyz]", 5), null);
});

// --- Titles the reader can open ---

test("a matched title is a markdown link to its own file", () => {
	const text = hoverAt("{{{ [[lsp_link_target]] }}}", 10);
	const uri = features.uriOfTitle("lsp_link_target");
	assert.ok(uri, "the fixture must have a file");
	assert.ok(text.includes("[lsp_link_target](" + uri + ")"), text);
});

test("a title with no file stays plain text rather than a dead link", () => {
	// A shadow is supplied by a plugin, so there is no file to open. A link
	// that goes nowhere is worse than no link.
	const shadow = "$:/core/ui/PageTemplate";
	assert.equal(features.uriOfTitle(shadow), null, "fixture assumption");
	const text = hoverAt("{{{ [[" + shadow + "]] }}}", 10);
	assert.ok(text.includes(shadow), text);
	assert.ok(!text.includes("](file://"), "a fileless title must not be linked: " + text);
});

test("a parenthesis in the path is escaped, or it would end the link early", () => {
	// A filename with parentheses is ordinary and encodeURI leaves them alone,
	// so the ")" would close the markdown link mid-path.
	const link = features.markdownLink("Note", "file:///wiki/Note%20(draft).tid");
	assert.equal(link, "[Note](file:///wiki/Note%20%28draft%29.tid)");
	assert.ok(!link.slice(0, -1).includes(")"), "no bare ) may remain inside the link");
});

test("brackets in the link text are escaped, or they would end it early", () => {
	assert.equal(
		features.markdownLink("odd [x] title", "file:///wiki/x.tid"),
		"[odd \\[x\\] title](file:///wiki/x.tid)"
	);
});

// --- The completeness check the honesty rests on ---

test("brackets are balanced only when every one is closed", () => {
	assert.equal(features.bracketsBalanced("[tag[Done]]"), true);
	assert.equal(features.bracketsBalanced("[tag[Done"), false);
	assert.equal(features.bracketsBalanced("[[A]] [[B]]"), true);
	assert.equal(features.bracketsBalanced("plain titles"), true);
	assert.equal(features.bracketsBalanced("]["), false);
});
