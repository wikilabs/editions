"use strict";

/*
Pins the context a filter is evaluated in.

A filter is not a closed expression: [all[current]] means whatever
currentTiddler means AT THAT POSITION. Run with no context it matches nothing,
which reads as an empty result rather than a missing context, and those two
must never look alike.

The subtle half is which widget supplies the context. Only a widget whose parse
tree node came from THIS document may be measured against a document offset: a
macro expansion's nodes carry ranges into the macro's own text, so an unrelated
node routinely appears to cover the cursor.

To replicate by hand, boot the test edition and call the module:

  const s = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-source.js");
  const body = '<$let currentTiddler="asdf">\n{{{ [all[current]] }}}\n</$let>';
  const ctx = s.renderContext("DocTitle", body, body.indexOf("[all[current]]"));
  $tw.wiki.filterTiddlers("[all[current]]", ctx);
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const SOURCE_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-source.js";
const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const URI = "file:///wiki/tiddlers/probe.tid";

let $tw;
let source;
let features;

before(async () => {
	$tw = await bootTw();
	source = loadHandler($tw, SOURCE_TITLE);
	features = loadHandler($tw, FEATURES_TITLE);
});

// Evaluate [all[current]] where the marker sits in the given body.
function currentAt(body, title) {
	const offset = body.indexOf("[all[current]]");
	assert.ok(offset >= 0, "the probe body must contain the filter");
	const context = source.renderContext(title || "DocTitle", body, offset);
	return $tw.wiki.filterTiddlers("[all[current]]", context);
}

// --- Which tiddler is "current" ---

test("with no enclosing widget, current is the document's own tiddler", () => {
	assert.deepEqual(currentAt("{{{ [all[current]] }}}\n"), ["DocTitle"]);
});

test("an enclosing let makes current what the let says", () => {
	assert.deepEqual(
		currentAt('<$let currentTiddler="asdf">\n{{{ [all[current]] }}}\n</$let>\n'),
		["asdf"]
	);
});

test("an unquoted attribute value counts just the same", () => {
	// TiddlyWiki parses both to the same string value, so the hover must not
	// treat one of them as absent.
	assert.deepEqual(
		currentAt("<$let currentTiddler=asdf>\n{{{ [all[current]] }}}\n</$let>\n"),
		["asdf"]
	);
});

test("an enclosing set counts too, not only let", () => {
	assert.deepEqual(
		currentAt('<$set name="currentTiddler" value="zzz">\n{{{ [all[current]] }}}\n</$set>\n'),
		["zzz"]
	);
});

test("past the closing tag, current is the document again", () => {
	assert.deepEqual(
		currentAt('<$let currentTiddler="asdf">\nx\n</$let>\n\n{{{ [all[current]] }}}\n'),
		["DocTitle"]
	);
});

test("a macro expansion cannot supply the context", () => {
	// The expansion's nodes carry ranges into the macro's own text, so one of
	// them will appear to cover a document offset. Measuring it would report a
	// list iteration's currentTiddler instead of the call site's.
	assert.deepEqual(
		currentAt('<$let currentTiddler="asdf">\n<<list-links filter:"[all[current]]">>\n</$let>\n'),
		["asdf"]
	);
});

// --- Through the hover ---

test("hovering a filter reports the current tiddler, not nothing", () => {
	const text = "title: lsp_link_target\n\n{{{ [all[current]] }}}\n";
	const result = features.hover(URI, text, { line: 2, character: 8 });
	assert.ok(result, "expected a hover");
	assert.ok(result.contents.value.includes("lsp_link_target"), result.contents.value);
	assert.ok(
		!result.contents.value.includes("Matches nothing"),
		"a missing context must not read as an empty result: " + result.contents.value
	);
});

test("the document's own title field wins over the file it came from", () => {
	// An unsaved rename is what the reader means by "this tiddler".
	const text = "title: lsp_renamed_in_buffer\n\n{{{ [all[current]] }}}\n";
	const result = features.hover(URI, text, { line: 2, character: 8 });
	assert.ok(result.contents.value.includes("lsp_renamed_in_buffer"), result.contents.value);
});
