"use strict";

/*
Pins workspace symbols (Ctrl+T): every definition in every document the editor
can open, and every tiddler by its title, matching the typed query.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.workspaceSymbols("list-lin", {});
  // -> [{name: "list-links", kind: 12, location: {uri: "tiddlywiki:/...list.tid", ...}}, ...]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const URI = "file:///wiki/tiddlers/lsp_ws_probe.tid";
const FUNCTION = 12;
const FILE = 1;

let $tw;
let features;
let lib;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

function open(body) {
	return { [URI]: "title: lsp_ws_probe\n\n" + body };
}

// The text a single-line range covers.
function covered(text, range) {
	return text.split("\n")[range.start.line].slice(range.start.character, range.end.character);
}

test("a definition in an open buffer is found by the start of its name", () => {
	const documents = open("\\procedure lsp.ws.alpha() x");
	const found = features.workspaceSymbols("lsp.ws.al", documents).find((s) => s.name === "lsp.ws.alpha");
	assert.ok(found, "expected the definition");
	assert.equal(found.kind, FUNCTION);
	assert.equal(found.containerName, "lsp_ws_probe");
	assert.equal(found.location.uri, URI);
	assert.equal(covered(documents[URI], found.location.range), "lsp.ws.alpha");
});

test("a name starting with the query ranks before one holding its letters in order", () => {
	const names = features.workspaceSymbols("lwa", open("\\procedure lsp.ws.alpha() x\n\\procedure lwa.first() y")).map((s) => s.name);
	assert.ok(names.includes("lsp.ws.alpha"), "the letters in order must match: " + names);
	assert.ok(names.indexOf("lwa.first") < names.indexOf("lsp.ws.alpha"), names.join(", "));
});

test("a definition in one of the wiki's .tid files is read from disk", () => {
	const title = "lsp_ws_file";
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-ws-"));
	const filepath = path.join(dir, title + ".tid");
	fs.writeFileSync(filepath, "title: " + title + "\n\n\\procedure lsp.ws.ondisk() x\n");
	$tw.boot.files[title] = { filepath: filepath, type: "application/x-tiddler", hasMetaFile: false };
	try {
		const found = features.workspaceSymbols("lsp.ws.ondisk", {}).find((s) => s.name === "lsp.ws.ondisk");
		assert.ok(found, "expected the file's definition");
		assert.equal(found.location.uri, features.pathToUri(filepath));
	} finally {
		delete $tw.boot.files[title];
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("a shadow's definition is found in its read-only view", () => {
	const found = features.workspaceSymbols("list-lin", {}).find((s) => s.name === "list-links");
	assert.ok(found, "expected list-links from its shadow");
	assert.equal(found.location.uri, features.virtualUri("$:/core/macros/list"));
	assert.equal(covered(features.virtualText("$:/core/macros/list"), found.location.range), "list-links");
});

test("a tiddler is found by its title", () => {
	const found = features.workspaceSymbols("lsp_link_tar", {}).find((s) => s.name === "lsp_link_target");
	assert.ok(found, "expected the fixture tiddler");
	assert.equal(found.kind, FILE);
	assert.ok(found.location.uri.startsWith("file:///"), found.location.uri);
});

test("an answer is capped, and a query nothing matches finds nothing", () => {
	assert.equal(features.workspaceSymbols("", {}).length, 200);
	assert.deepEqual(features.workspaceSymbols("lsp-no-such-name-at-all-qqq", {}), []);
});

test("the server advertises workspace symbols and answers the request", () => {
	const sent = [];
	const session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
	session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
	assert.equal(sent[0].result.capabilities.workspaceSymbolProvider, true);
	session.dispatch({ jsonrpc: "2.0", id: 2, method: "workspace/symbol", params: { query: "list-lin" } });
	const reply = sent.find((message) => message.id === 2);
	assert.ok(reply.result.some((s) => s.name === "list-links"), JSON.stringify(reply.result).slice(0, 200));
});
