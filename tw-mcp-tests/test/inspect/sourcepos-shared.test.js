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
const { bootTw, loadHandler } = require("../setup");

const TITLE = "$:/plugins/wikilabs/shared/sourcepos.js";
const INSPECT_POS = "$:/core/modules/commands/inspect/handlers/inspect/inspect_pos.js";

let tw;

before(async () => {
	tw = await bootTw();
});

function shipped(plugin) {
	const info = tw.wiki.getPluginInfo("$:/plugins/wikilabs/" + plugin);
	return info && info.tiddlers[TITLE];
}

function show(line) {
	return line === undefined ? "(no such line)" : JSON.stringify(line);
}

// Names the line the copies part on, so a drift does not print the whole module twice.
function firstDifference(left, right) {
	const a = left.split("\n"), b = right.split("\n");
	for(let i = 0; i < Math.max(a.length, b.length); i++) {
		if(a[i] !== b[i]) {
			return "line " + (i + 1) + ": devtools " + show(a[i]) + " vs tw-mcp-core " + show(b[i]);
		}
	}
	return null;
}

test("devtools and tw-mcp-core ship the same source-position module", () => {
	assert.ok(shipped("tw-mcp-core"), "tw-mcp-core ships it");
	assert.ok(shipped("devtools"), "devtools ships it");
	assert.equal(firstDifference(shipped("devtools").text, shipped("tw-mcp-core").text), null);
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

// devtools holds the patches for the page's life, so a reload must swap them (bead tw-mcp-server-mt1).
test("re-executing the module swaps the held patches for its own", () => {
	const holders = tw.wikilabsSourcePos.holders;
	assert.ok(holders > 0, "devtools holds the patches in this edition");
	// Test scaffolding: what reload_mcp_modules does to this module.
	tw.modules.titles[TITLE].exports = undefined;
	const fresh = tw.modules.execute(TITLE);
	const findBodyOffset = fresh.findBodyOffset;
	let calls = 0;
	fresh.findBodyOffset = function() {
		calls++;
		return findBodyOffset.apply(this, arguments);
	};
	try {
		// A global macro: the transclude patch measures where its body starts.
		loadHandler(tw, INSPECT_POS).inspect_pos({ text: "<<list-links filter:'[[A]]'>>" });
	} finally {
		fresh.findBodyOffset = findBodyOffset;
	}
	assert.ok(calls > 0, "the transclude patch still belongs to the copy the reload replaced");
	assert.equal(tw.wikilabsSourcePos.holders, holders);
});
