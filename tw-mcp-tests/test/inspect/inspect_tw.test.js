"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/inspect/inspect_tw.js";

let inspectTw;

before(async () => {
	const $tw = await bootTw();
	inspectTw = loadHandler($tw, HANDLER_TITLE).inspect_tw;
});

test("inspect_tw: primitive path returns 'path=value'", () => {
	const result = inspectTw({ path: "version" });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /^\$tw\.version=\d+\.\d+/);
});

test("inspect_tw: empty path enumerates root $tw keys", () => {
	const result = inspectTw({});
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /^\$tw \d+keys/);
	assert.match(result.content[0].text, /\bversion\b/);
});

test("inspect_tw: blocked segment is rejected", () => {
	const result = inspectTw({ path: "__proto__" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /blocked for security/);
});

test("inspect_tw: blocked deeper segment is rejected", () => {
	const result = inspectTw({ path: "wiki.constructor" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /blocked for security/);
});

test("inspect_tw: path through primitive intermediate -> error", () => {
	const result = inspectTw({ path: "version.something" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /is string/);
});

test("inspect_tw: function without call returns signature + source", () => {
	const result = inspectTw({ path: "wiki.getTiddler" });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /^fn \$tw\.wiki\.getTiddler\([^)]*\)/);
});

test("inspect_tw: function with safe call returns result", () => {
	const result = inspectTw({ path: "wiki.tiddlerExists", call: ["$:/SiteTitle"] });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /=(true|false)/);
});

test("inspect_tw: function with unsafe call -> error", () => {
	const result = inspectTw({ path: "wiki.addTiddler", call: [{}] });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /only allowed on safe read-only/);
});

test("inspect_tw: auto-resolve object.method(...args)", () => {
	// path is 'wiki' (object) + call=["tiddlerExists","$:/SiteTitle"] -> rewritten to wiki.tiddlerExists("$:/SiteTitle")
	const result = inspectTw({ path: "wiki", call: ["tiddlerExists", "$:/SiteTitle"] });
	assert.equal(result.isError, undefined);
	assert.match(result.content[0].text, /=(true|false)/);
});

test("inspect_tw: auto-resolve with non-method first call arg -> error", () => {
	const result = inspectTw({ path: "wiki", call: ["nonExistentMethod"] });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /is not a function/);
});

test("inspect_tw: object enumeration with exclude drops keys", () => {
	const result = inspectTw({ path: "boot", exclude: ["files"] });
	assert.equal(result.isError, undefined);
	assert.doesNotMatch(result.content[0].text, /^files\b/m);
});
