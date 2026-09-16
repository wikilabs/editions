"use strict";

/*
Pins LSP Workspace Symbols - (Example): each query of its table, with the Example
open in the editor, finds what the row says. The docs wiki's tiddlers are loaded
(test scaffolding), since LSP Work finds titles.

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests) and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  helper.loadDocs($tw);
  const example = helper.readExample(f, "LSP Workspace Symbols - (Example)");
  f.workspaceSymbols("lsp.ws.", {[example.uri]: example.text}).map((s) => s.name);
  // -> ["lsp.ws.beta", "lsp.ws.alpha"]
*/

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP Workspace Symbols - (Example)";
const FILE = 1;
const PINNED = ["lsp.ws.", "list-li", "LSP Work", "lwsa"];

let features;
let example;
let unloadDocs;

before(async () => {
	const $tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	unloadDocs = helper.loadDocs($tw);
	example = helper.readExample(features, EXAMPLE);
});

after(() => unloadDocs());

// What Ctrl+T lists for query, with the Example open.
function search(query) {
	return features.workspaceSymbols(query, { [example.uri]: example.text });
}

function byName(a, b) {
	return a.name < b.name ? -1 : 1;
}

test("every row of the table is pinned here", () => {
	const queries = example.text.split("\n").filter((line) => line.startsWith("|`")).map((line) => /^\|`([^`]*)` \|/.exec(line)[1]);
	assert.deepEqual(queries, PINNED);
});

test("lsp.ws. finds lsp.ws.alpha and lsp.ws.beta, from this tiddler", () => {
	const found = search("lsp.ws.").map((s) => ({ name: s.name, uri: s.location.uri, start: s.location.range.start })).sort(byName);
	assert.deepEqual(found, ["alpha", "beta"].map((name) => ({
		name: "lsp.ws." + name,
		uri: example.uri,
		start: helper.positionOf(example.text, "\\procedure lsp.ws." + name, { offset: "\\procedure ".length })
	})));
});

test("list-li finds list-links, which opens $:/core/macros/list read-only", () => {
	const links = search("list-li").find((s) => s.name === "list-links");
	assert.ok(links, "expected list-links");
	assert.equal(links.location.uri, features.virtualUri("$:/core/macros/list"));
	assert.ok(features.isVirtualUri(links.location.uri));
});

test("LSP Work finds this tiddler and LSP Workspace Symbols, by title", () => {
	const found = search("LSP Work").map((s) => ({ name: s.name, kind: s.kind })).sort(byName);
	assert.deepEqual(found, [{ name: "LSP Workspace Symbols", kind: FILE }, { name: EXAMPLE, kind: FILE }]);
	assert.equal(search("LSP Work").find((s) => s.name === EXAMPLE).location.uri, example.uri);
});

test("lwsa finds lsp.ws.alpha, its letters in order", () => {
	assert.ok(search("lwsa").some((s) => s.name === "lsp.ws.alpha" && s.location.uri === example.uri));
});
