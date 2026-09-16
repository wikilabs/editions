"use strict";

/*
Pins the parts of LSP and MCP - (Example) a test reaches: the hover of step 5,
linked to the browser port .tw-mcp/connect names and still answering without it
(step 8), and the completion of step 4 once the new tiddler is in the wiki. Needs
no docs tiddlers.

Pinned elsewhere: the link found and gone, the hello with its label and the
status notification (steps 1, 2, 8), get_wiki_info (step 3) and the forwarded
save (step 6) in lsp-primary.test.js; a file written by the dev server becoming a
tiddler (step 4) in lsp-watch.test.js. Manual only: the status bar and tooltip,
npm start and its console, the browser, and the preview panel (step 7).

To replicate by hand, boot the test edition (cwd editions/tw-mcp-tests), write a
.tw-mcp/connect naming this process, listen true and port 8888, point
$tw.boot.wikiPath at its folder, and run:

  const helper = require("./test/lsp/example-helper");
  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const example = helper.readExample(f, "LSP and MCP - (Example)");
  const at = helper.positionOf(example.text, '<<tag "LSP">>', {offset: 2});
  f.hover(example.uri, example.text, at, {[example.uri]: example.text}).contents.value;
  // -> "**macro** `tag`, defined in [$:/core/macros/tag](http://127.0.0.1:8888/#%24%3A%2Fcore%2Fmacros%2Ftag) ..."
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");
const helper = require("./example-helper");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const EXAMPLE = "LSP and MCP - (Example)";
const PROBE = "LSP Link Probe";

let $tw;
let features;
let example;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	example = helper.readExample(features, EXAMPLE);
});

// Test scaffolding: a running dev server's .tw-mcp/connect, in a throwaway wiki folder.
function withConnectFile(data, fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-example-connect-")),
		savedWikiPath = $tw.boot.wikiPath;
	fs.mkdirSync(path.join(dir, ".tw-mcp"));
	fs.writeFileSync(path.join(dir, ".tw-mcp", "connect"), JSON.stringify(Object.assign({ pid: process.pid, pipe: "\\\\.\\pipe\\tw-lsp-example", token: "t" }, data)));
	$tw.boot.wikiPath = dir;
	try {
		fn();
	} finally {
		$tw.boot.wikiPath = savedWikiPath;
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

function hoverTag() {
	const at = helper.positionOf(example.text, '<<tag "LSP">>', { offset: 2 });
	return features.hover(example.uri, example.text, at, { [example.uri]: example.text }).contents.value;
}

function linkTitles() {
	const typed = helper.typeAtEnd(example.text, "[[LSP Li");
	return features.completions(example.uri, typed.text, typed.position).items.map((item) => item.label);
}

test("step 5: hovering tag says it is defined in $:/core/macros/tag, linked to the browser on port 8888", () => {
	withConnectFile({ listen: true, port: 8888 }, () => {
		assert.ok(hoverTag().includes("defined in [$:/core/macros/tag](http://127.0.0.1:8888/#%24%3A%2Fcore%2Fmacros%2Ftag)"), hoverTag());
	});
});

test("step 8: with the MCP server stopped, the hover keeps answering, without a browser link", () => {
	const value = hoverTag();
	assert.ok(value.includes("defined in `$:/core/macros/tag`"), value);
	assert.ok(!value.includes("http://"), value);
});

test("step 4: [[LSP Li offers LSP Link Probe once that tiddler is in the wiki", () => {
	assert.ok(!linkTitles().includes(PROBE));
	$tw.wiki.addTiddler({ title: PROBE, text: "" });
	try {
		assert.ok(linkTitles().includes(PROBE), linkTitles().join(", "));
	} finally {
		$tw.wiki.deleteTiddler(PROBE);
	}
});
