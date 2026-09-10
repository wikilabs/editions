"use strict";

/*
Pins reloading a saved .tid: on textDocument/didSave the server reads the file
into the running wiki, which does not watch its folder, so hovers and globals
answer from the saved text.

Every title here is under $:/temp/, which the wiki does not sync to disk.

To replicate by hand, boot the test edition, edit a .tid the wiki loaded, and send:

  const lib = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-lib.js");
  // an initialized session, then:
  session.dispatch({jsonrpc: "2.0", method: "textDocument/didSave", params: {textDocument: {uri}}});
  // -> $tw.wiki holds the file's new text
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const CALLS_TITLE = "$:/core/modules/commands/inspect/calls.js";
const TITLE = "$:/temp/tw-mcp-tests/reload/lsp_rl";
const RENAMED = "$:/temp/tw-mcp-tests/reload/lsp_rl_renamed";

let $tw;
let features;
let lib;
let calls;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
	calls = loadHandler($tw, CALLS_TITLE);
});

// An initialized session and a way to tell it a document was saved.
function session() {
	const sent = [];
	const s = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
	s.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
	return {
		capabilities: sent[0].result.capabilities,
		save: (uri) => s.dispatch({ jsonrpc: "2.0", method: "textDocument/didSave", params: { textDocument: { uri: uri } } })
	};
}

// Test scaffolding: a .tid in a throwaway folder, filed in $tw.boot.files for
// TITLE when filed is true, and TITLE in the wiki as it was before the save.
function withFile(filed, fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-reload-"));
	const filepath = path.join(dir, "lsp_rl.tid");
	fs.writeFileSync(filepath, "title: " + TITLE + "\ntags: $:/tags/Global\n\n\\procedure lsp.rl.g() old\n");
	if(filed) {
		$tw.boot.files[TITLE] = { filepath: filepath, type: "application/x-tiddler", hasMetaFile: false };
		$tw.wiki.addTiddler({ title: TITLE, tags: "$:/tags/Global", text: "\\procedure lsp.rl.g() old" });
	}
	try {
		fn(filepath, features.pathToUri(filepath));
	} finally {
		[TITLE, RENAMED].forEach((title) => {
			delete $tw.boot.files[title];
			$tw.wiki.deleteTiddler(title);
		});
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

test("the server asks to be told of saves, without their text", () => {
	assert.deepEqual(session().capabilities.textDocumentSync.save, { includeText: false });
});

test("a saved .tid replaces the wiki's copy, so globals see it", () => {
	withFile(true, (filepath, uri) => {
		fs.writeFileSync(filepath, "title: " + TITLE + "\ntags: $:/tags/Global\n\n\\procedure lsp.rl.g(a) new\n");
		session().save(uri);
		assert.equal($tw.wiki.getTiddlerText(TITLE).trim(), "\\procedure lsp.rl.g(a) new");
		assert.deepEqual(calls.globalDefinition("lsp.rl.g").definition.params.map((p) => p.name), ["a"]);
		assert.equal($tw.boot.files[TITLE].filepath, filepath);
	});
});

test("an unchanged save leaves the tiddler as it was", () => {
	withFile(true, (filepath, uri) => {
		$tw.wiki.addTiddler({ title: TITLE, tags: "$:/tags/Global", text: "\\procedure lsp.rl.g() old\n" });
		const before = $tw.wiki.getTiddler(TITLE);
		session().save(uri);
		assert.strictEqual($tw.wiki.getTiddler(TITLE), before);
	});
});

test("a title the file no longer holds leaves the wiki, unfiled, and the new one takes the file", () => {
	withFile(true, (filepath, uri) => {
		fs.writeFileSync(filepath, "title: " + RENAMED + "\n\ntext\n");
		session().save(uri);
		assert.equal($tw.wiki.getTiddler(TITLE), undefined);
		assert.equal($tw.boot.files[TITLE], undefined);
		assert.equal($tw.boot.files[RENAMED].filepath, filepath);
		assert.equal($tw.wiki.getTiddlerText(RENAMED).trim(), "text");
		assert.ok(fs.existsSync(filepath), "the saved file must survive");
	});
});

test("a file the wiki does not own is left alone", () => {
	withFile(false, (filepath, uri) => {
		session().save(uri);
		assert.equal($tw.wiki.getTiddler(TITLE), undefined);
		assert.equal(features.reloadSaved(uri), null);
	});
});

test("a new .tid in the wiki's tiddlers folder is loaded and filed; other file types are not", () => {
	// Test scaffolding: the wiki's tiddlers folder is pointed at a throwaway one.
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-reload-folder-")),
		saved = $tw.boot.wikiTiddlersPath,
		filepath = path.join(dir, "lsp_rl.tid"),
		json = path.join(dir, "lsp_rl.json");
	fs.writeFileSync(filepath, "title: " + TITLE + "\n\nnew\n");
	fs.writeFileSync(json, JSON.stringify([{ title: RENAMED, text: "j" }]));
	$tw.boot.wikiTiddlersPath = dir;
	try {
		session().save(features.pathToUri(filepath));
		assert.equal($tw.wiki.getTiddlerText(TITLE).trim(), "new");
		assert.equal(path.resolve($tw.boot.files[TITLE].filepath), path.resolve(filepath));
		assert.equal(features.reloadSaved(features.pathToUri(json)), null);
		assert.equal($tw.wiki.getTiddler(RENAMED), undefined);
	} finally {
		$tw.boot.wikiTiddlersPath = saved;
		[TITLE, RENAMED].forEach((title) => {
			delete $tw.boot.files[title];
			$tw.wiki.deleteTiddler(title);
		});
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("a read-only view or a file that is not a .tid is never reloaded", () => {
	assert.equal(features.reloadSaved(features.virtualUri("$:/core/macros/list")), null);
	assert.equal(features.reloadSaved("file:///wiki/tiddlers/x.json"), null);
});
