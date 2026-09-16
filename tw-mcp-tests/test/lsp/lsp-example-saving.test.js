"use strict";

/*
Pins LSP Saving - (Example), steps 1 to 4, on a copy of the Example in a throwaway
tiddlers folder (test scaffolding): a save reaches the running wiki, a changed
title renames the tiddler without unfiling the file from the new title, and the
old title comes back. The MCP half of step 2 (the MCP server reloads, the browser
updates) is pinned by lsp-primary.test.js. The steps build on each other.

To replicate by hand, boot the test edition, point $tw.boot.wikiTiddlersPath at a
folder holding a copy of the Example, edit the copy, and run:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.reloadSaved(f.pathToUri(copy));
  // -> ["LSP Saving - (Example)"]
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const TITLE = "LSP Saving - (Example)";
const RENAMED = TITLE + " renamed";

let $tw;
let features;
let original;
let dir;
let copy;
let savedTiddlersPath;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	original = helper.readExample(features, TITLE).text;
	// Test scaffolding: the wiki's tiddlers folder holds a copy of the Example, loaded and filed as at boot.
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-example-saving-"));
	copy = path.join(dir, TITLE + ".tid");
	fs.writeFileSync(copy, original);
	savedTiddlersPath = $tw.boot.wikiTiddlersPath;
	$tw.boot.wikiTiddlersPath = dir;
	$tw.loadTiddlersFromFile(copy).tiddlers.forEach((fields) => {
		$tw.boot.files[fields.title] = { filepath: copy, type: "application/x-tiddler", hasMetaFile: false };
		$tw.wiki.addTiddler(fields);
	});
});

after(() => {
	$tw.boot.wikiTiddlersPath = savedTiddlersPath;
	[TITLE, RENAMED].forEach((title) => {
		delete $tw.boot.files[title];
		$tw.wiki.deleteTiddler(title);
	});
	fs.rmSync(dir, { recursive: true, force: true });
});

// Writes text over the copy, as the editor saves it, and tells the server.
function save(text) {
	fs.writeFileSync(copy, text);
	return features.reloadSaved(features.pathToUri(copy));
}

test("steps 1 and 2: a changed last word, saved, reaches the running wiki", () => {
	assert.deepEqual(save(original.replace("this line: before", "this line: after")), [TITLE]);
	assert.ok($tw.wiki.getTiddlerText(TITLE).includes("this line: after"));
});

test("step 3: a changed title, saved, leaves the renamed tiddler and not this one, and the file with the new title", () => {
	const renamed = original.replace("this line: before", "this line: after").replace("title: " + TITLE + "\n", "title: " + RENAMED + "\n");
	assert.deepEqual(save(renamed), [RENAMED]);
	assert.equal($tw.wiki.tiddlerExists(TITLE), false);
	assert.ok($tw.wiki.getTiddlerText(RENAMED).includes("this line: after"));
	assert.equal($tw.boot.files[RENAMED].filepath, copy);
	assert.equal($tw.boot.files[TITLE], undefined, "unfiled first, so a syncer's delete finds no file to remove");
});

test("step 4: the title changed back, saved, restores this tiddler", () => {
	assert.deepEqual(save(original), [TITLE]);
	assert.equal($tw.wiki.tiddlerExists(RENAMED), false);
	assert.ok($tw.wiki.getTiddlerText(TITLE).includes("this line: before"));
	assert.equal($tw.boot.files[TITLE].filepath, copy);
});
