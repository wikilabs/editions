"use strict";

/*
Pins the find_definition MCP tool: where a name is defined, wikitext pragmas
and the running JavaScript alike, each line carrying the hashline anchor
edit_tiddler takes as `pos`.

Each test adds its own $:/temp/ tiddlers, which are never synced to disk, and
scopes the wikitext search to them.

To replicate by hand, call the tool from any MCP client against a running wiki:

  find_definition(name="list-links")
  find_definition(name="$list")
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/query/find_definition.js";
const HANDLERS_TITLE = "$:/core/modules/commands/inspect/mcp-handlers.js";
const HASHLINE_TITLE = "$:/core/modules/commands/inspect/hashline.js";
const PREFIX = "$:/temp/tw-mcp-tests/find_definition/";
const SCOPE = "[prefix[" + PREFIX + "]]";

let $tw;
let findDefinition;
let hashline;

before(async () => {
	$tw = await bootTw();
	findDefinition = loadHandler($tw, HANDLER_TITLE).find_definition;
	hashline = loadHandler($tw, HASHLINE_TITLE);
});

// Test scaffolding: each {name: {text, tags}} becomes $:/temp/tw-mcp-tests/find_definition/<name>.
function withTiddlers(specs, fn) {
	const names = Object.keys(specs);
	try {
		names.forEach((name) => $tw.wiki.addTiddler(Object.assign({ title: PREFIX + name }, specs[name])));
		return fn();
	} finally {
		names.forEach((name) => $tw.wiki.deleteTiddler(PREFIX + name));
	}
}

function output(args) {
	const result = findDefinition(Object.assign({ filter: SCOPE }, args));
	assert.equal(result.isError, undefined, JSON.stringify(result));
	return result.content[0].text;
}

// --- Wikitext definitions ---

test("find_definition: a global procedure is listed and marked global", () => {
	withTiddlers({ global: { tags: ["$:/tags/Global"], text: "\\procedure fd.g(x) <<x>>\n" } }, () => {
		const text = output({ name: "fd.g" });
		assert.ok(text.startsWith(PREFIX + "global\n"), text);
		assert.ok(text.includes(" [procedure, global]: \\procedure fd.g(x) <<x>>"), text);
		assert.match(text, /1 definition in 1 tiddler$/);
	});
});

test("find_definition: a nested definition is listed, never as global", () => {
	withTiddlers({ nested: { tags: ["$:/tags/Global"], text: "\\procedure fd.outer()\n\t\\procedure fd.inner() x\n\t<<fd.inner>>\n\\end\n" } }, () => {
		const text = output({ name: "fd.inner" });
		assert.ok(text.includes(" [procedure]: \t\\procedure fd.inner() x"), text);
		assert.ok(!text.includes("global"), text);
	});
});

test("find_definition: only the imported definition is global, not a nested namesake", () => {
	const text = "\\procedure fd.dup() top\n\\procedure fd.holder()\n\t\\procedure fd.dup() nested\n\t<<fd.dup>>\n\\end\n";
	withTiddlers({ dup: { tags: ["$:/tags/Global"], text: text } }, () => {
		const out = output({ name: "fd.dup" });
		assert.ok(out.includes(" [procedure, global]: \\procedure fd.dup() top"), out);
		assert.ok(out.includes(" [procedure]: \t\\procedure fd.dup() nested"), out);
	});
});

test("find_definition: each line carries the anchor edit_tiddler takes", () => {
	withTiddlers({ anchor: { text: "\\procedure fd.a() x\n" } }, () => {
		const text = output({ name: "fd.a" });
		assert.ok(text.includes("  " + hashline.formatLineTag(1, "\\procedure fd.a() x") + " [procedure]: "), text);
	});
});

test("find_definition: a core macro names no plugin, since core is always there", () => {
	const text = output({ name: "list-links", filter: "[[$:/core/macros/list]]" });
	assert.ok(text.startsWith("$:/core/macros/list\n"), text);
	assert.match(text, /\[macro, global\]: \\define list-links\(/);
});

// --- The running JavaScript ---

test("find_definition: a JavaScript widget is found by its $ name, at its constructor", () => {
	// Which file holds <$set> depends on the core version, so it is not named here.
	const text = output({ name: "$set" });
	assert.match(text, /^\$:\/core\/modules\/widgets\/\S+\.js\n/);
	assert.match(text, /\[JavaScript widget\]: var \w+Widget = function/);
});

test("find_definition: a filter operator and a run prefix are found at their export", () => {
	assert.match(output({ name: "compare" }), /\[filter operator\]: exports\.compare = function/);
	assert.match(output({ name: ":else" }), /\[run prefix\]: exports\.else = function/);
});

test("find_definition: a JavaScript macro is found at its run function", () => {
	assert.match(output({ name: "now" }), /\[JavaScript macro\]: exports\.run = function/);
});

// --- Nothing, and the contract ---

test("find_definition: nothing defined says so", () => {
	assert.equal(output({ name: "fd.nobody" }), "(no definition)");
});

test("find_definition: a missing name is an error", () => {
	const result = findDefinition({});
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /missing required argument 'name'/);
});

test("find_definition: advertised as a read tool, so readonly mode offers it", () => {
	const handlers = loadHandler($tw, HANDLERS_TITLE);
	const tool = handlers.getToolDefinitions(true).find((d) => d.name === "find_definition");
	assert.ok(tool, "find_definition must be in the readonly tools/list");
	assert.deepEqual(tool.inputSchema.required, ["name"]);
});
