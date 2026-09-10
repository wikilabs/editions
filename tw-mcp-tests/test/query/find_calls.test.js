"use strict";

/*
Pins the find_calls MCP tool: every call and definition of a name, grouped by
tiddler, each line carrying the hashline anchor edit_tiddler takes as `pos`.

Each test adds its own $:/temp/ tiddlers, which are never synced to disk, and
scopes the search to them.

To replicate by hand, call the tool from any MCP client against a running wiki:

  find_calls(name="list-links")
  find_calls(name="list-links", filter="[all[shadows+tiddlers]]")
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/query/find_calls.js";
const HANDLERS_TITLE = "$:/core/modules/commands/inspect/mcp-handlers.js";
const HASHLINE_TITLE = "$:/core/modules/commands/inspect/hashline.js";
const PREFIX = "$:/temp/tw-mcp-tests/find_calls/";
const SCOPE = "[prefix[" + PREFIX + "]]";

let $tw;
let findCalls;
let hashline;

before(async () => {
	$tw = await bootTw();
	findCalls = loadHandler($tw, HANDLER_TITLE).find_calls;
	hashline = loadHandler($tw, HASHLINE_TITLE);
});

// Test scaffolding: each {name: text} becomes $:/temp/tw-mcp-tests/find_calls/<name>.
function withTiddlers(texts, fn) {
	const titles = Object.keys(texts).map((name) => PREFIX + name);
	try {
		Object.keys(texts).forEach((name) => $tw.wiki.addTiddler({ title: PREFIX + name, text: texts[name] }));
		return fn();
	} finally {
		titles.forEach((title) => $tw.wiki.deleteTiddler(title));
	}
}

function output(args) {
	const result = findCalls(Object.assign({ filter: SCOPE }, args));
	assert.equal(result.isError, undefined, JSON.stringify(result));
	return result.content[0].text;
}

// The anchor edit_tiddler expects for line n of text.
function anchor(text, n) {
	return hashline.formatLineTag(n, text.split("\n")[n - 1]);
}

const PAGE = [
	"\\function lsp.who() [[World]]",
	"\\procedure lsp.hello() Hello, <<lsp.who>>!",
	"",
	"<<lsp.who>>",
	'<$macrocall $name="lsp.who"/>',
	'<$transclude $variable="lsp.who"/>',
	"<$text text=<<lsp.who>>/>",
	'<$list filter="[<lsp.who>] [function[lsp.who]]"/>'
].join("\n");

test("find_calls: every form, one line each, with anchor and form", () => {
	withTiddlers({ page: PAGE }, () => {
		const text = output({ name: "lsp.who" });
		assert.match(text, new RegExp("^" + PREFIX.replace(/[$/]/g, "\\$&") + "page$", "m"));
		assert.ok(text.includes("  " + anchor(PAGE, 1) + " [definition]: \\function lsp.who()"), text);
		assert.ok(text.includes("  " + anchor(PAGE, 2) + " [macro]: \\procedure lsp.hello()"), text);
		assert.ok(text.includes("  " + anchor(PAGE, 4) + " [macro]: <<lsp.who>>"), text);
		assert.ok(text.includes("  " + anchor(PAGE, 5) + " [macrocall]: "), text);
		assert.ok(text.includes("  " + anchor(PAGE, 6) + " [transclude]: "), text);
		assert.ok(text.includes("  " + anchor(PAGE, 7) + " [macro]: "), text);
		assert.ok(text.includes("  " + anchor(PAGE, 8) + " [filter]: "), text);
		// Line 8 holds two filter calls: one output line, both counted.
		assert.match(text, /7 calls, 1 definition in 1 tiddler$/);
	});
});

test("find_calls: include_definitions=false leaves the pragma out", () => {
	withTiddlers({ page: PAGE }, () => {
		const text = output({ name: "lsp.who", include_definitions: false });
		assert.ok(!text.includes("[definition]"), text);
		assert.match(text, /7 calls, 0 definitions in 1 tiddler$/);
	});
});

test("find_calls: several forms on one line are listed together", () => {
	withTiddlers({ mixed: "<<lsp.who>> {{{ [<lsp.who>] }}}" }, () => {
		const text = output({ name: "lsp.who" });
		assert.ok(text.includes("[macro, filter]: "), text);
		assert.match(text, /2 calls, 0 definitions in 1 tiddler$/);
	});
});

test("find_calls: a custom widget is found by its $ name", () => {
	withTiddlers({ widget: "\\widget $lsp.box() <b>x</b>\n\n<$lsp.box/>" }, () => {
		const text = output({ name: "$lsp.box" });
		assert.ok(text.includes("[definition]: \\widget $lsp.box()"), text);
		assert.ok(text.includes("[widget]: <$lsp.box/>"), text);
	});
});

test("find_calls: a shadow tiddler is searched when the scope includes it", () => {
	// The LSP cannot list a shadow, having no file to open; the tool can.
	const title = "$:/language/Snippets/ListByTag";
	assert.ok($tw.wiki.isShadowTiddler(title), "fixture assumption");
	const text = output({ name: "list-links", filter: "[[" + title + "]]" });
	assert.ok(text.startsWith(title + "\n"), text);
});

test("find_calls: max_total keeps whole tiddlers and says it truncated", () => {
	withTiddlers({ a: "<<lsp.who>>", b: "<<lsp.who>>" }, () => {
		const text = output({ name: "lsp.who", max_total: 1 });
		assert.match(text, /1 call, 0 definitions in 1 tiddler/);
		assert.ok(text.includes("(truncated at 1;"), text);
	});
});

test("find_calls: nothing found says so", () => {
	withTiddlers({ page: PAGE }, () => {
		assert.equal(output({ name: "lsp.nobody" }), "(no calls)");
	});
});

test("find_calls: a missing name is an error", () => {
	const result = findCalls({});
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /missing required argument 'name'/);
});

test("find_calls: advertised as a read tool, so readonly mode offers it", () => {
	const handlers = loadHandler($tw, HANDLERS_TITLE);
	const tool = handlers.getToolDefinitions(true).find((d) => d.name === "find_calls");
	assert.ok(tool, "find_calls must be in the readonly tools/list");
	assert.deepEqual(tool.inputSchema.required, ["name"]);
});
