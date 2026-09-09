"use strict";

/*
Pins go to definition: ctrl-clicking a link opens the file that holds the
tiddler.

The file comes from $tw.boot.files, the same map TiddlyWiki uses to save a
tiddler back to disk, so the answer is exact rather than searched for. The tests
below encode the three cases a "title:" regex would get wrong (a filename that
does not match the title, a shadow with no file, a title merely mentioned) plus
the URI escaping a Windows path needs.

To replicate by hand, boot the test edition and call the module:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.definition("file:///x.tid", "title: X\n\nSee [[lsp_link_target]]", {line: 2, character: 10});
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const URI = "file:///wiki/tiddlers/probe.tid";
const EXISTING_TITLE = "lsp_link_target";

let $tw;
let features;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

function tid(body) {
	return "title: probe\n\n" + body;
}

function defineAt(body, character) {
	return features.definition(URI, tid(body), { line: 2, character: character });
}

// --- Resolving to a file ---

test("a link resolves to the file that holds the tiddler", () => {
	const location = defineAt("See [[" + EXISTING_TITLE + "]].", 10);
	assert.ok(location, "expected a location");
	assert.ok(location.uri.startsWith("file:///"), "expected a file URI, got " + location.uri);
	assert.ok(
		location.uri.endsWith("/lsp/" + EXISTING_TITLE + ".tid"),
		"expected the fixture's own file, got " + location.uri
	);
	assert.deepEqual(location.range.start, { line: 0, character: 0 });
});

test("the file is the one TiddlyWiki itself would write back to", () => {
	// Not a guess from the title: the answer must equal boot.files, which is
	// what makes a subfolder or a renamed file irrelevant.
	const expected = $tw.boot.files[EXISTING_TITLE].filepath;
	const location = defineAt("See [[" + EXISTING_TITLE + "]].", 10);
	assert.equal(location.uri, features.pathToUri(expected));
	assert.ok(path.isAbsolute(expected), "boot.files must give an absolute path");
});

test("a captioned link resolves to its target, not its caption", () => {
	const location = defineAt("See [[Shown Caption|" + EXISTING_TITLE + "]].", 25);
	assert.ok(location, "expected a location");
	assert.ok(location.uri.endsWith(EXISTING_TITLE + ".tid"), location.uri);
});

test("a transclusion resolves too", () => {
	const location = defineAt("Here: {{" + EXISTING_TITLE + "}}.", 12);
	assert.ok(location, "expected a location");
	assert.ok(location.uri.endsWith(EXISTING_TITLE + ".tid"), location.uri);
});

test("a link written as a widget attribute resolves", () => {
	// No line scanner sees this one; it comes from the parse tree.
	const location = defineAt('<$link to="' + EXISTING_TITLE + '">x</$link>', 15);
	assert.ok(location, "expected a location");
	assert.ok(location.uri.endsWith(EXISTING_TITLE + ".tid"), location.uri);
});

test("a field suffix is stripped before the file is looked up", () => {
	const location = defineAt("Here: {{" + EXISTING_TITLE + "!!title}}.", 12);
	assert.ok(location, "expected a location");
	assert.ok(location.uri.endsWith(EXISTING_TITLE + ".tid"), location.uri);
});

// --- Where there is nothing to open ---

test("a cursor away from any link resolves to nothing", () => {
	assert.equal(defineAt("just prose here", 5), null);
});

test("a link to a tiddler that does not exist resolves to nothing", () => {
	assert.equal(defineAt("See [[lsp_no_such_tiddler]].", 10), null);
});

test("a shadow tiddler has no file, so it resolves to nothing", () => {
	// It is supplied by a plugin. Neither boot.files nor the plugin tiddler
	// records the folder it came from, so there is no honest answer but null.
	assert.ok($tw.wiki.isShadowTiddler("$:/core/ui/PageTemplate"), "fixture assumption");
	assert.equal(defineAt("See [[$:/core/ui/PageTemplate]].", 12), null);
});

test("a title merely mentioned in prose is not a link", () => {
	// The regex a reader would reach for matches this; a link does not exist.
	assert.equal(defineAt("The tiddler " + EXISTING_TITLE + " is mentioned.", 20), null);
});

test("a link in the field header of a .tid is not followed", () => {
	const text = "title: probe\nlist: [[" + EXISTING_TITLE + "]]\n\nBody\n";
	assert.equal(features.definition(URI, text, { line: 1, character: 12 }), null);
});

// --- The URI a Windows path has to become ---

test("a path becomes a file URI with forward slashes and a drive letter", () => {
	assert.equal(
		features.pathToUri("e:\\git\\wiki\\tiddlers\\Note.tid"),
		"file:///e:/git/wiki/tiddlers/Note.tid"
	);
});

test("a space in a filename is escaped, because a URI cannot hold one", () => {
	assert.equal(
		features.pathToUri("e:\\git\\wiki\\tiddlers\\LSP\\LSP Server.tid"),
		"file:///e:/git/wiki/tiddlers/LSP/LSP%20Server.tid"
	);
});

test("a hash or question mark in a filename is escaped, not read as URI syntax", () => {
	// encodeURI leaves both alone, and either would truncate the path.
	const uri = features.pathToUri("/wiki/tiddlers/What? #1.tid");
	assert.ok(!uri.includes("?"), uri);
	assert.ok(!uri.includes("#"), uri);
	assert.equal(uri, "file:///wiki/tiddlers/What%3F%20%231.tid");
});

test("a posix path keeps its single leading slash", () => {
	assert.equal(features.pathToUri("/home/mario/wiki/Note.tid"), "file:///home/mario/wiki/Note.tid");
});
