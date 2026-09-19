"use strict";

/*
reload_mcp_modules must leave a module holding the CURRENT exports of a module it
requires at load time, also one sorting after it (bead tw-mcp-server-6i2).
inspect_pos.js requires $:/plugins/wikilabs/shared/sourcepos.js at load time and
sorts before it.
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const ADMIN = "$:/core/modules/commands/inspect/handlers/admin.js";
const INSPECT_POS = "$:/core/modules/commands/inspect/handlers/inspect/inspect_pos.js";
const SHARED = "$:/plugins/wikilabs/shared/sourcepos.js";

let tw;

before(async () => {
	tw = await bootTw();
});

test("reload_mcp_modules: a module sees the new exports of a later-sorting module it requires", () => {
	assert.ok(INSPECT_POS < SHARED, "the pair must sort dependent first");
	const result = loadHandler(tw, ADMIN).reload_mcp_modules({ skip_disk_reload: true });
	assert.equal(result.isError, undefined, result.content[0].text);
	// Test scaffolding: a spy on the registry's current exports stands in for an edited module.
	const current = tw.modules.titles[SHARED].exports;
	const lineRange = current.lineRange;
	let calls = 0;
	current.lineRange = function() {
		calls++;
		return lineRange.apply(this, arguments);
	};
	try {
		loadHandler(tw, INSPECT_POS).inspect_pos({ text: "[[Target]]" });
	} finally {
		current.lineRange = lineRange;
	}
	assert.ok(calls > 0, "inspect_pos still calls the exports the reload replaced");
});

// Guards the two-pass reload: a dependent must not half-execute a broken module it requires.
test("reload_mcp_modules: a module with a syntax error keeps its old exports and is named", () => {
	const previous = tw.modules.titles[SHARED].exports;
	tw.wiki.addTiddler({ title: SHARED, type: "application/javascript", "module-type": "library", text: "exports.broken = (;" });
	let result;
	try {
		result = loadHandler(tw, ADMIN).reload_mcp_modules({ skip_disk_reload: true });
	} finally {
		tw.wiki.deleteTiddler(SHARED);
	}
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /\$:\/plugins\/wikilabs\/shared\/sourcepos\.js: SyntaxError/);
	assert.doesNotMatch(result.content[0].text, /inspect_pos\.js: /, "the dependent is not blamed");
	assert.equal(tw.modules.titles[SHARED].exports, previous);
	const text = loadHandler(tw, INSPECT_POS).inspect_pos({ text: "[[Target]]" }).content[0].text;
	assert.match(text, /<a [^>]*p="0:1"/);
});
