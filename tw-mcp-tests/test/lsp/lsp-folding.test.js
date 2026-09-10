"use strict";

/*
Pins folding ranges: the .tid header, multi-line definitions with \end left
visible, each <%if%> clause on its own, multi-line widgets, elements, comments
and code fences, one fold per start line.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.foldingRanges("file:///x.tid", "title: x\ntags: y\n\n\\procedure p()\nz\n\\end");
  // -> [{startLine: 0, endLine: 1, kind: "region"}, {startLine: 3, endLine: 4}]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const URI = "file:///wiki/tiddlers/lsp_fold.tid";

const TEXT = [
	"title: lsp_fold",
	"tags: x",
	"",
	"<!--",
	"top comment",
	"-->",
	"\\procedure lsp.fold()",
	"<%if [[a]] %>",
	"	A",
	"<%elseif [[b]] %>",
	"	B",
	"<%else%>",
	"	C",
	"<%endif%>",
	"<!-- inner",
	"comment -->",
	"```js",
	"code",
	"```",
	"\\end",
	"\\procedure lsp.one() x",
	"<$let a=<<lsp.one>>",
	"	b=\"2\"",
	">",
	"	<div>",
	"		x",
	"	</div>",
	"</$let>",
	"<!-- one line -->",
	"<$let x=\"1\"><$let y=\"2\">",
	"	x",
	"</$let>",
	"</$let>"
].join("\n");

let $tw;
let features;
let lib;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

// Each range as "start-end" plus its kind, if any.
function folds(uri, text) {
	return features.foldingRanges(uri, text).map((r) => r.startLine + "-" + r.endLine + (r.kind ? " " + r.kind : ""));
}

test("every multi-line construct folds, closing lines left visible", () => {
	assert.deepEqual(folds(URI, TEXT), [
		"0-1 region",
		"3-5 comment",
		"6-18",
		"7-8",
		"9-10",
		"11-12",
		"14-15 comment",
		"16-17",
		"21-26",
		"23-26",
		"24-25",
		"29-31"
	]);
});

test("a tiddler that is not wikitext offers no folds", () => {
	assert.deepEqual(folds("file:///wiki/tiddlers/lsp_fold_js.tid", "title: lsp_fold_js\ntype: application/javascript\n\n<div>\nx\n</div>"), []);
});

test("the server advertises folding and answers the request", () => {
	const sent = [];
	const session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
	session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
	assert.equal(sent[0].result.capabilities.foldingRangeProvider, true);
	session.dispatch({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: URI, text: TEXT, version: 1 } } });
	session.dispatch({ jsonrpc: "2.0", id: 2, method: "textDocument/foldingRange", params: { textDocument: { uri: URI } } });
	const reply = sent.find((message) => message.id === 2);
	assert.equal(reply.result.length, 12, JSON.stringify(reply));
});
