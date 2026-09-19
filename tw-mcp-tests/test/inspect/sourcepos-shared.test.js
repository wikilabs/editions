"use strict";

/*
One source-position module for two plugins (bead tw-mcp-server-5tl): tw-mcp-core
holds the file and devtools includes it through tiddlywiki.files. This edition
loads both. By hand, in the browser console of a wiki with both plugins:
	const t = "$:/plugins/wikilabs/shared/sourcepos.js";
	$tw.wiki.getPluginInfo("$:/plugins/wikilabs/devtools").tiddlers[t].text ===
		$tw.wiki.getPluginInfo("$:/plugins/wikilabs/tw-mcp-core").tiddlers[t].text   // true
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw } = require("../setup");

const TITLE = "$:/plugins/wikilabs/shared/sourcepos.js";

let tw;

before(async () => {
	tw = await bootTw();
});

function shipped(plugin) {
	const info = tw.wiki.getPluginInfo("$:/plugins/wikilabs/" + plugin);
	return info && info.tiddlers[TITLE];
}

test("devtools and tw-mcp-core ship the same source-position module", () => {
	assert.ok(shipped("tw-mcp-core"), "tw-mcp-core ships it");
	assert.ok(shipped("devtools"), "devtools ships it");
	assert.equal(shipped("devtools").text, shipped("tw-mcp-core").text);
});

test("both ship it as a library module", () => {
	for(const plugin of ["tw-mcp-core", "devtools"]) {
		assert.equal(shipped(plugin).type, "application/javascript", plugin);
		assert.equal(shipped(plugin)["module-type"], "library", plugin);
	}
});

// A wiki with an older copy of either plugin runs whichever copy wins, so these names must stay.
test("the module offers what devtools and the inspect tools call", () => {
	const api = tw.modules.execute(TITLE);
	for(const name of ["acquire", "lineRange", "getSourceInfo", "buildCallerChain", "getLineOffsets", "charToLine", "getTidHeaderLines", "findBodyOffset"]) {
		assert.equal(typeof api[name], "function", name);
	}
});
