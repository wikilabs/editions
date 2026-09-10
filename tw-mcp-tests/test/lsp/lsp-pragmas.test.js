"use strict";

/*
Pins hovering a pragma line: the keyword explains itself, a definition's name
tells what it is, where it reaches and how often its name is called, and a
parameter tells its default and how often its own body names it.

To replicate by hand, boot the test edition and hover:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.hover("file:///x.tid", "title: x\n\n\\procedure p(a) <<a>>", {line: 2, character: 12});
  // -> **procedure** `p`, defined here, local to this tiddler ...
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const URI = "file:///wiki/tiddlers/probe.tid";

let $tw;
let features;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

// The nth occurrence of needle in text, into characters inside it.
function positionOf(text, needle, into, nth) {
	let at = -1;
	for(let i = 0; i <= (nth || 0); i++) {
		at = text.indexOf(needle, at + 1);
	}
	assert.ok(at >= 0, "fixture must contain " + needle);
	const lines = text.slice(0, at).split("\n");
	return { line: lines.length - 1, character: lines[lines.length - 1].length + into };
}

// The hover's markdown, or null, for a document titled title (probe by default).
function hoverOn(body, needle, into, nth, title) {
	const text = "title: " + (title || "probe") + "\n\n" + body;
	const result = features.hover(URI, text, positionOf(text, needle, into, nth));
	return result === null ? null : result.contents.value;
}

// --- Keywords ---

test("a pragma keyword explains itself", () => {
	assert.match(hoverOn("\\procedure lsp.p() x", "\\procedure", 3), /Defines a procedure/);
	assert.match(hoverOn("\\procedure lsp.p()\nx\n\\end", "\\end", 2), /Ends the multi-line definition/);
	assert.match(hoverOn("\\whitespace trim\n\ntext", "\\whitespace", 3), /`trim` drops/);
});

test("a definition keyword after the first content is called out as text", () => {
	assert.match(hoverOn("Some text first.\n\n\\procedure lsp.late() x", "\\procedure", 3), /Not a definition here/);
	assert.doesNotMatch(hoverOn("\\procedure lsp.early() x\n\ntext", "\\procedure", 3), /Not a definition here/);
});

test("a keyword nothing describes has no hover", () => {
	assert.equal(hoverOn("\\lsp_nokeyword x", "\\lsp_nokeyword", 3), null);
});

// --- A definition's name ---

test("a hover that names what it describes starts with that line, not a heading repeating it", () => {
	const body = "\\procedure lsp.head(a) <<a>>\n\n<<lsp.head>>";
	assert.ok(hoverOn(body, "lsp.head(", 2).startsWith("**procedure** `lsp.head`"));
	assert.ok(hoverOn(body, "(a)", 1).startsWith("**parameter** `a`"));
	assert.ok(hoverOn(body, "<<lsp.head>>", 3).startsWith("**procedure** `lsp.head`"));
});

test("a definition's name tells its kind, its parameters and the calls of its name", () => {
	const value = hoverOn('\\procedure lsp.named(a, b:"B") x\n\n<<lsp.named>>\n<<lsp.named>>', "lsp.named(", 3);
	assert.match(value, /\*\*procedure\*\* `lsp\.named`, defined here, local to this tiddler/);
	assert.ok(value.includes("| a |  |"), value);
	assert.ok(value.includes("| b | `B` |"), value);
	assert.match(value, /2 calls of this name: 2 here, 0 in other files, 0 in tiddlers without a file/);
});

test("a definition in a tiddler the wiki imports is global", () => {
	// A $:/temp/ title is never synced to disk.
	const title = "$:/temp/tw-mcp-tests/pragmas-global";
	$tw.wiki.addTiddler({ title: title, tags: ["$:/tags/Global"], text: "\\procedure lsp.imported() x" });
	try {
		assert.match(hoverOn("\\procedure lsp.imported() x", "lsp.imported", 3, 0, title), /defined here, global/);
	} finally {
		$tw.wiki.deleteTiddler(title);
	}
});

test("a nested definition is local to the definition holding it", () => {
	const value = hoverOn("\\procedure lsp.outer()\n\t\\procedure lsp.inner() x\n\t<<lsp.inner>>\n\\end", "lsp.inner()", 3);
	assert.match(value, /local to `lsp\.outer`/);
});

test("a definition that hides a global names it", () => {
	const value = hoverOn("\\procedure list-links(filter) x", "list-links", 3);
	assert.match(value, /`\$:\/core\/macros\/list` defines it globally too/);
});

// --- A parameter ---

test("a parameter tells its default and how often its own body names it", () => {
	const body = '\\procedure lsp.p(tag, sort:"x") <<tag>> <<tag>>';
	assert.match(hoverOn(body, "tag,", 1), /\*\*parameter\*\* `tag` of `lsp\.p`, no default[\s\S]*Named 2 times in its body/);
	assert.match(hoverOn(body, "sort:", 1), /default `x`[\s\S]*Named 0 times in its body/);
});

test("a nested definition's parameter of the same name is not counted", () => {
	const body = "\\procedure lsp.o(tag)\n\t\\procedure lsp.i(tag) <<tag>>\n\t<<tag>>\n\\end";
	assert.match(hoverOn(body, "tag)", 1), /Named 1 time in its body/);
});

test("a \\define parameter is counted by its $name$ placeholders", () => {
	assert.match(hoverOn("\\define lsp.m(x) [[$x$]] $x$", "x)", 0), /Named 2 times in its body/);
});

test("a default holding a parameter's name is not taken for that parameter", () => {
	const body = '\\procedure lsp.p(a:"b", b) x';
	assert.equal(hoverOn(body, '"b"', 1), null, "the default is no parameter");
	assert.match(hoverOn(body, "b)", 0), /\*\*parameter\*\* `b` of `lsp\.p`/);
});

test("a call on a definition's line still hovers as the call", () => {
	assert.match(hoverOn("\\function lsp.who() [[World]]\n\\procedure lsp.hello() Hello, <<lsp.who>>!", "<<lsp.who>>", 3), /\*\*function\*\* `lsp\.who`/);
});
