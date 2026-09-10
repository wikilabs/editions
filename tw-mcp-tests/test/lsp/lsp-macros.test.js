"use strict";

/*
Pins hovering a macro or procedure call.

Both halves come from the parser, not from pattern matching: a call is a
transclude node carrying $variable with each argument's own range and a
positional flag, and a definition is a set node flagged as a macro, procedure
or function definition, carrying the declared parameter names and defaults.
That pairing is what lets a positional argument be reported by the name it
actually binds to, which is the thing a reader cannot work out by eye.

To replicate by hand, boot the test edition and call the module:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.hover("file:///x.tid", "title: X\n\n<<list-links [tag[LSP]]>>", {line: 2, character: 5});
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const MACROS_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-macros.js";
const URI = "file:///wiki/tiddlers/probe.tid";
const TAG = "lsp_macro_tag";

let $tw;
let features;
let macros;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	macros = loadHandler($tw, MACROS_TITLE);
});

function tid(body) {
	return "title: probe\n\n" + body;
}

function hoverAt(body, character) {
	const result = features.hover(URI, tid(body), { line: 2, character: character });
	return result === null ? null : result.contents.value;
}

function withTagged(fn) {
	$tw.wiki.addTiddler({ title: "lsp_macro_one", text: "a", tags: [TAG] });
	$tw.wiki.addTiddler({ title: "lsp_macro_two", text: "b", tags: [TAG] });
	try {
		fn();
	} finally {
		$tw.wiki.deleteTiddler("lsp_macro_one");
		$tw.wiki.deleteTiddler("lsp_macro_two");
	}
}

// Hover inside the line holding `needle`, for a body that opens with pragmas.
function hoverOn(body, needle, into) {
	const text = tid(body);
	const lines = text.split("\n");
	const line = lines.findIndex((l) => l.includes(needle));
	return features.hover(URI, text, { line: line, character: lines[line].indexOf(needle) + into });
}

// --- Inside definition bodies, which TiddlyWiki keeps as plain text ---

const DEFINITIONS = [
	"\\function lsp.who() [[World]]",
	"\\procedure lsp.hello() Hello, <<lsp.who>>!",
	"\\widget $lsp.greeting() <strong><<lsp.hello>></strong>",
	"",
	"<$lsp.greeting/>"
].join("\n");

test("a call inside a \\procedure body is hovered", () => {
	const result = hoverOn(DEFINITIONS, "Hello, <<lsp.who>>", 10);
	assert.ok(result, "expected a hover");
	assert.ok(result.contents.value.includes("**function** `lsp.who`, defined in this tiddler"), result.contents.value);
});

test("a call inside a \\widget body is hovered", () => {
	const result = hoverOn(DEFINITIONS, "<strong><<lsp.hello>>", 11);
	assert.ok(result, "expected a hover");
	assert.ok(result.contents.value.includes("**procedure** `lsp.hello`, defined in this tiddler"), result.contents.value);
});

test("the hover over a call in a body ranges over the call, in document positions", () => {
	const lines = tid(DEFINITIONS).split("\n");
	const line = lines.findIndex((l) => l.startsWith("\\procedure"));
	const column = lines[line].indexOf("<<lsp.who>>");
	const result = hoverOn(DEFINITIONS, "Hello, <<lsp.who>>", 10);
	assert.deepEqual(result.range, {
		start: { line: line, character: column },
		end: { line: line, character: column + "<<lsp.who>>".length }
	});
});

test("a call in a multi-line body is hovered on its own line", () => {
	const body = "\\function lsp.who() [[World]]\n\\procedure lsp.hello()\nHello, <<lsp.who>>!\n\\end\n\nx";
	const result = hoverOn(body, "Hello, <<lsp.who>>", 10);
	assert.ok(result && result.contents.value.includes("`lsp.who`"), JSON.stringify(result));
});

test("a filter inside a \\procedure body is hovered", () => {
	const result = hoverOn("\\procedure lsp.list() {{{ [[lsp_link_target]] }}}\n\nx", "[[lsp_link_target]]", 3);
	assert.ok(result && result.contents.value.includes("1 tiddler"), JSON.stringify(result));
});

test("a widget inside a \\widget body is hovered, without claiming a render", () => {
	const result = hoverOn('\\widget $lsp.box() <$let a="1">z</$let>\n\nx', '<$let a="1">', 3);
	assert.ok(result, "expected a hover");
	assert.ok(result.contents.value.includes("$:/core/modules/widgets/let.js"), result.contents.value);
	// A body is not rendered where it is defined, so there is no output to show.
	assert.ok(!result.contents.value.includes("Renders as"), result.contents.value);
});

// --- Widget forms of a call ---

const WHO = "\\function lsp.who() [[World]]\n\n";

test("a $macrocall is found as a call, its $ attributes not taken for arguments", () => {
	const sites = macros.callSites($tw.wiki.parseText("text/vnd.tiddlywiki", '<$macrocall $name="lsp.who" $type="text/plain" a="1"/>').tree);
	assert.equal(sites.length, 1);
	assert.equal(sites[0].name, "lsp.who");
	assert.equal(sites[0].tag, "$macrocall");
	assert.deepEqual(sites[0].args, [{ name: "a", value: "1", positional: false }]);
});

test("a name computed at render time is no call", () => {
	const sites = macros.callSites($tw.wiki.parseText("text/vnd.tiddlywiki", "<$transclude $variable=<<dyn>>/>").tree);
	assert.deepEqual(sites, []);
});

test("hovering a $transclude describes the widget and the call it makes", () => {
	const result = hoverOn(WHO + '<$transclude $variable="lsp.who"/>', "<$transclude", 3);
	const text = result.contents.value;
	assert.ok(text.includes("$:/core/modules/widgets/transclude.js"), text);
	assert.ok(text.includes("**function** `lsp.who`, defined in this tiddler"), text);
});

test("hovering a $macrocall describes the widget and the call it makes", () => {
	const result = hoverOn(WHO + '<$macrocall $name="lsp.who"/>', "<$macrocall", 3);
	const text = result.contents.value;
	assert.ok(text.includes("$:/core/modules/widgets/macrocall.js"), text);
	assert.ok(text.includes("**function** `lsp.who`, defined in this tiddler"), text);
});

test("the widget comes first, then the call, and the render stays last", () => {
	const text = hoverOn(WHO + '<$transclude $variable="lsp.who"/>', "<$transclude", 3).contents.value;
	const widget = text.indexOf("**widget**");
	const call = text.indexOf("**function**");
	const render = text.indexOf("Renders as");
	assert.ok(widget >= 0 && call > widget && render > call, text);
});

// --- Recognising the call ---

test("a macro call is found with its arguments", () => {
	const tree = $tw.wiki.parseText("text/vnd.tiddlywiki", "A <<list-links [tag[X]]>> B").tree;
	const sites = macros.callSites(tree);
	assert.equal(sites.length, 1);
	assert.equal(sites[0].name, "list-links");
	assert.deepEqual(sites[0].args, [{ name: null, value: "[tag[X]]", positional: true }]);
});

test("a named argument is distinguished from a positional one", () => {
	const tree = $tw.wiki.parseText("text/vnd.tiddlywiki", '<<list-links filter:"[tag[X]]" type:"ol">>').tree;
	const args = macros.callSites(tree)[0].args;
	assert.deepEqual(
		args.map((a) => [a.name, a.value, a.positional]),
		[["filter", "[tag[X]]", false], ["type", "ol", false]]
	);
});

// --- Finding the definition ---

test("a core macro resolves to the tiddler that declares it", () => {
	const definition = macros.findDefinition("list-links", "");
	assert.ok(definition, "list-links must be found");
	assert.equal(definition.title, "$:/core/macros/list");
	assert.equal(definition.kind, "macro", "list-links is declared with \\define in this TiddlyWiki");
	assert.equal(definition.params[0].name, "filter");
});

test("a definition in the document itself shadows a global of the same name", () => {
	// The wiki resolves a local pragma first, and so must this.
	const local = macros.findDefinition("list-links", "\\procedure list-links(mine) local\n\\end\n");
	assert.equal(local.title, null, "a local definition belongs to no other tiddler");
	assert.deepEqual(local.params, [{ name: "mine" }]);
});

test("a name nothing defines resolves to nothing", () => {
	assert.equal(macros.findDefinition("lsp_no_such_macro_at_all", ""), null);
});

// --- Binding arguments to parameters ---

test("a positional argument is bound to the parameter it fills", () => {
	const params = [{ name: "filter" }, { name: "type", default: "ul" }];
	const bound = macros.bindArguments(params, [{ name: null, value: "[tag[X]]", positional: true }]);
	assert.deepEqual(bound, [
		{ name: "filter", value: "[tag[X]]", origin: "positional" },
		{ name: "type", value: "ul", origin: "default" }
	]);
});

test("a named argument wins over position, whatever order it was written in", () => {
	const params = [{ name: "filter" }, { name: "type", default: "ul" }];
	const bound = macros.bindArguments(params, [
		{ name: "type", value: "ol", positional: false },
		{ name: null, value: "[tag[X]]", positional: true }
	]);
	assert.deepEqual(bound, [
		{ name: "filter", value: "[tag[X]]", origin: "positional" },
		{ name: "type", value: "ol", origin: "named" }
	]);
});

test("an argument the definition never declared is still reported", () => {
	// A misspelled parameter name is exactly the mistake this should reveal,
	// and silently dropping it would hide it.
	const bound = macros.bindArguments([{ name: "filter" }], [
		{ name: "fliter", value: "[tag[X]]", positional: false }
	]);
	assert.ok(bound.some((b) => b.name === "fliter" && b.origin === "undeclared"), JSON.stringify(bound));
});

// --- What the hover says ---

test("hovering a call names the kind, the definition and the bound parameters", () => {
	const text = hoverAt("<<list-links [tag[" + TAG + "]]>>", 5);
	assert.ok(text.includes("macro"), text);
	assert.ok(text.includes("list-links"), text);
	assert.ok(text.includes("$:/core/macros/list"), text);
	assert.ok(text.includes("filter"), text);
	assert.ok(text.includes("positional"), text);
});

test("the parameter table is markdown, separator row and all", () => {
	// Hover contents are declared as markdown. A wikitext table (|a |b |) has no
	// separator row, and markdown renders the whole thing as one paragraph, so
	// the table silently stops being a table.
	const text = hoverAt("<<list-links [tag[" + TAG + "]]>>", 5);
	const lines = text.split("\n");
	const header = lines.findIndex((l) => l.startsWith("| Parameter "));
	assert.ok(header >= 0, "expected a markdown header row: " + text);
	assert.match(lines[header + 1], /^\|\s*---\s*\|/, "the row after the header must be the separator");
	assert.match(lines[header + 2], /^\| filter \| `\[tag\[/, "and then a data row: " + lines[header + 2]);
});

test("a pipe in a value is escaped, or it would end the column", () => {
	const bound = [{ name: "filter", value: "[tag[a]] |[tag[b]]", origin: "positional" }];
	assert.deepEqual(macros.bindArguments([{ name: "filter" }], [
		{ name: null, value: "[tag[a]] |[tag[b]]", positional: true }
	]), bound);
	const text = hoverAt('<<list-links filter:"[tag[a]] |[tag[b]]">>', 5);
	const row = text.split("\n").find((l) => l.startsWith("| filter "));
	assert.ok(row, "expected a filter row: " + text);
	assert.ok(row.includes("\\|"), "the pipe must be escaped: " + row);
	assert.equal(row.split(/(?<!\\)\|/).length - 1, 4, "the row must still have four column edges: " + row);
});

test("a filter argument is evaluated, which is the point of the hover", () => {
	withTagged(() => {
		const text = hoverAt("<<list-links [tag[" + TAG + "]]>>", 5);
		assert.ok(text.includes("2 tiddlers"), text);
		assert.ok(text.includes("lsp_macro_one"), text);
	});
});

test("a call wins over the filter argument nested inside it", () => {
	withTagged(() => {
		// The cursor sits in the filter, but the call is the useful answer and
		// it reports the filter too, so nothing is lost.
		const text = hoverAt('<<list-links filter:"[tag[' + TAG + ']]">>', 30);
		assert.ok(text.includes("list-links"), "expected the call, not the bare filter: " + text);
		assert.ok(text.includes("2 tiddlers"), text);
	});
});

test("an undefined macro says so rather than reporting nothing", () => {
	const text = hoverAt("<<lsp_no_such_macro_at_all>>", 5);
	assert.ok(text.includes("Not defined"), text);
});

test("a filter attribute of an ordinary widget is still just a filter", () => {
	withTagged(() => {
		const text = hoverAt('<$list filter="[tag[' + TAG + ']]">x</$list>', 20);
		assert.ok(text.includes("2 tiddlers"), text);
		assert.ok(!text.includes("**macro**"), "a widget is not a call: " + text);
	});
});
