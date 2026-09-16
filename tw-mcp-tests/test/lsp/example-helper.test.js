"use strict";

/*
Pins the helper the Example tests share (example-helper.js, test scaffolding):
an Example read as the editor opens it, a position found by its text, an entry
typed on a new last line, and the docs wiki's tiddlers loaded and put back.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const example = helper.readExample(f, "LSP Completion - (Example)");
  const typed = helper.typeAtEnd(example.text, "<<lsp.cp");
  f.completions(example.uri, typed.text, typed.position).items[0].label;
  // -> "lsp.cp.pair"
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const COMPLETION = "LSP Completion - (Example)";
const TEXT = "title: x\n\n<<a>> <<b>>\n<<a>>\n";

let $tw;
let features;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

test("an Example is read from the docs wiki's file, with that file's URI and LF line ends", () => {
	const example = helper.readExample(features, COMPLETION);
	assert.equal(example.path, path.join(helper.EXAMPLES_PATH, COMPLETION + ".tid"));
	assert.ok(fs.existsSync(example.path), example.path);
	assert.equal(example.uri, features.pathToUri(example.path));
	assert.ok(example.text.includes("title: " + COMPLETION + "\n"));
	assert.ok(!example.text.includes("\r"));
});

test("a position is found by its snippet, the snippet's nth occurrence and an offset into it", () => {
	assert.deepEqual(helper.positionOf(TEXT, "<<a>>"), { line: 2, character: 0 });
	assert.deepEqual(helper.positionOf(TEXT, "<<a>>", { nth: 2 }), { line: 3, character: 0 });
	assert.deepEqual(helper.positionOf(TEXT, "<<b>>", { offset: 2 }), { line: 2, character: 8 });
});

test("a snippet the text does not hold fails loudly, so a changed Example cannot pass by accident", () => {
	assert.throws(() => helper.positionOf(TEXT, "<<c>>"), /<<c>>/);
	assert.throws(() => helper.positionOf(TEXT, "<<b>>", { nth: 2 }), /Found 1 of "<<b>>", wanted occurrence 2/);
});

test("an entry is typed on a new last line, and the cursor ends after it", () => {
	const expected = { text: "a\nb\n<<x", position: { line: 2, character: 3 } };
	assert.deepEqual(helper.typeAtEnd("a\nb\n", "<<x"), expected);
	assert.deepEqual(helper.typeAtEnd("a\nb", "<<x"), expected, "a text without a final newline gets one");
});

test("the docs wiki's tiddlers are loaded and filed, and unloading puts back what they replaced", () => {
	const storyList = $tw.wiki.getTiddler("$:/StoryList"),
		storyListFile = $tw.boot.files["$:/StoryList"];
	assert.equal($tw.wiki.tiddlerExists("LSP Server"), false);
	assert.equal($tw.wiki.tiddlerExists("$:/SiteTitle"), false, "a shadow in the test wiki");
	const unload = helper.loadDocs($tw);
	try {
		assert.equal($tw.boot.files["LSP Server"].filepath, path.join(helper.DOCS_PATH, "LSP", "LSP Server.tid"));
		assert.ok($tw.wiki.getTiddlersWithTag("LSP").includes("LSP Configuration"));
		assert.equal($tw.wiki.tiddlerExists("$:/SiteTitle"), true);
		assert.equal(features.uriOfTitle(COMPLETION), helper.readExample(features, COMPLETION).uri, "the Example's URI is its filed file's");
	} finally {
		unload();
	}
	assert.equal($tw.wiki.tiddlerExists("LSP Server"), false);
	assert.equal($tw.boot.files["LSP Server"], undefined);
	assert.strictEqual($tw.wiki.getTiddler("$:/StoryList"), storyList);
	assert.strictEqual($tw.boot.files["$:/StoryList"], storyListFile);
	assert.equal($tw.wiki.tiddlerExists("$:/SiteTitle"), false, "the shadow shows through again");
});
