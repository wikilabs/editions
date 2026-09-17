"use strict";

/*
Pins hover and go to definition on filter operators and run prefixes: a real
operator or prefix names the JavaScript that runs it, an operator quotes its
module header's description, a shorthand prefix names
the one it stands for, and a name no operator has is shown as the field test
TiddlyWiki silently makes instead.

To replicate by hand, boot the test edition and hover:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.hover("file:///x.tid", 'title: x\n\n<$list filter="[toc-link[no]]"/>', {line: 2, character: 17});
  // -> **Not a filter operator.** TiddlyWiki tests the field `toc-link` instead, ...
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const CALLS_TITLE = "$:/core/modules/commands/inspect/calls.js";
const MODULES_TITLE = "$:/core/modules/commands/inspect/modules.js";
const URI = "file:///wiki/tiddlers/lsp_ops.tid";

let $tw;
let features;
let calls;
let modules;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	calls = loadHandler($tw, CALLS_TITLE);
	modules = loadHandler($tw, MODULES_TITLE);
});

// The nth occurrence of needle in text, into characters inside it.
function positionOf(text, needle, into, nth) {
	let at = -1;
	for(let i = 0; i <= (nth || 0); i++) {
		at = text.indexOf(needle, at + 1);
	}
	assert.ok(at >= 0, "fixture must contain " + needle);
	const lines = text.slice(0, at).split("\n");
	return { line: lines.length - 1, character: lines[lines.length - 1].length + into };
}

function documentOf(body) {
	return "title: lsp_ops\n\n" + body;
}

// The hover on needle inside a filter attribute holding filter.
function hoverIn(filter, needle, into, nth) {
	const text = documentOf("<$list filter='" + filter + "'/>");
	return features.hover(URI, text, positionOf(text, needle, into || 0, nth));
}

function hoverText(filter, needle, into, nth) {
	const result = hoverIn(filter, needle, into, nth);
	return result === null ? null : result.contents.value;
}

// The text a single-line range covers.
function covered(text, range) {
	return text.split("\n")[range.start.line].slice(range.start.character, range.end.character);
}

// --- Operators ---

test("an operator names its module, its suffix and its page, then the filter follows", () => {
	const filter = "[tag[x]compare:number:gt[3]]",
		result = hoverIn(filter, "compare"),
		value = result.contents.value;
	assert.ok(value.startsWith("**filter operator** `compare`, suffix `number:gt`"), value);
	assert.ok(value.includes(modules.moduleOfFilterOperator("compare")), value);
	assert.ok(value.includes("https://tiddlywiki.com/#compare%20Operator"), value);
	assert.ok(value.includes("\n---\n\n```\n" + filter + "\n```"), value);
	assert.equal(covered(documentOf("<$list filter='" + filter + "'/>"), result.range), "compare");
	// The colon right after the name is the filter again.
	assert.ok(!hoverText(filter, "compare", 7).includes("**filter operator**"));
});

test("a negated operator says so", () => {
	const value = hoverText("[!is[system]]", "!is[", 1);
	assert.ok(value.startsWith("**filter operator** `is`, negated by `!`"), value);
});

test("a name also written in an earlier operand is the operator only where it is the operator", () => {
	assert.ok(!hoverText("[tag[sort]sort[]]", "sort", 0, 0).includes("**filter operator**"));
	assert.ok(hoverText("[tag[sort]sort[]]", "sort", 0, 1).startsWith("**filter operator** `sort`"));
});

// --- Module header descriptions ---

const OPERATOR_MODULE = "$:/plugins/lsp-test/filters/lspop.js";

// Test scaffolding: operator module code whose header holds these description lines, exporting each name.
function operatorModule(descriptionLines, names) {
	const header = ["/*\\", "title: " + OPERATOR_MODULE, "type: application/javascript", "module-type: filteroperator", ""];
	return header.concat(descriptionLines, ["", "\\*/", ""], names.map((name) => "exports." + name + " = function(source) { return []; };")).join("\n") + "\n";
}

// Test scaffolding: the module registered for the duration of fn; its tiddler may hold other text, as after an edit since boot.
function withOperator(code, fn, tiddlerText) {
	$tw.wiki.addTiddler({ title: OPERATOR_MODULE, type: "application/javascript", "module-type": "filteroperator", text: tiddlerText === undefined ? code : tiddlerText });
	$tw.modules.define(OPERATOR_MODULE, "filteroperator", code);
	$tw.Wiki.prototype.filterOperators = null;
	try {
		fn();
	} finally {
		delete $tw.modules.titles[OPERATOR_MODULE];
		delete $tw.modules.types.filteroperator[OPERATOR_MODULE];
		$tw.Wiki.prototype.filterOperators = null;
		$tw.wiki.deleteTiddler(OPERATOR_MODULE);
	}
}

test("an operator's hover quotes its module's header description after the module", () => {
	const value = hoverText("[addprefix[x]]", "addprefix");
	assert.ok(value.includes("\n\n> Filter operator for adding a prefix to each title in the list."), value);
	assert.ok(value.indexOf("Defined in") < value.indexOf("\n> ") && value.indexOf("\n> ") < value.indexOf("\n---\n"), value);
});

test("a plugin operator's description is quoted whole, paragraphs kept and < escaped", () => {
	withOperator(operatorModule(["Returns the <kind> it is given.", "Nothing else.", "", "A second paragraph."], ["lspopone"]), () => {
		const value = hoverText("[lspopone[x]]", "lspopone");
		assert.ok(value.includes("\n\n> Returns the \\<kind> it is given.\n> Nothing else.\n>\n> A second paragraph.\n"), value);
		assert.ok(!value.includes("shared by"), value);
	});
});

test("a module exporting several operators says its header is shared", () => {
	withOperator(operatorModule(["Operators for lsp tests."], ["lspopfirst", "lspopsecond"]), () => {
		["lspopfirst", "lspopsecond"].forEach((name) => {
			const value = hoverText("[" + name + "[x]]", name);
			assert.ok(value.includes("\n\nIts module's header, shared by 2 operators:\n\n> Operators for lsp tests.\n"), value);
		});
	});
});

test("a header with fields only, or no header, adds no description", () => {
	withOperator(operatorModule([], ["lspopbare"]), () => {
		assert.ok(!hoverText("[lspopbare[x]]", "lspopbare").includes("\n> "));
	});
	withOperator("exports.lspopbare = function(source) { return []; };\n", () => {
		const value = hoverText("[lspopbare[x]]", "lspopbare");
		assert.ok(value.startsWith("**filter operator** `lspopbare`"), value);
		assert.ok(!value.includes("\n> "), value);
	});
});

test("the description comes from the running module, not its tiddler edited since", () => {
	withOperator(operatorModule(["What runs."], ["lspopedited"]), () => {
		const value = hoverText("[lspopedited[x]]", "lspopedited");
		assert.ok(value.includes("\n> What runs.\n"), value);
		assert.ok(!value.includes("Edited later."), value);
	}, operatorModule(["Edited later."], ["lspopedited"]));
});

// --- Run prefixes ---

test("a shorthand prefix names the prefix it stands for, as core maps them", () => {
	[["+", "and"], ["-", "except"], ["~", "else"], ["=", "all"], ["=>", "let"]].forEach(([prefix, name]) => {
		const value = hoverText("[tag[x]] " + prefix + "[[y]]", " " + prefix + "[", 1);
		assert.ok(value.startsWith("**run prefix** `" + prefix + "`, short for `:" + name + "`"), prefix + ": " + value);
		assert.ok(value.includes(modules.moduleOfRunPrefix(name)), value);
	});
});

test("a named prefix explains itself and links its page", () => {
	const value = hoverText("[tag[x]] :else[[y]]", ":else", 1);
	assert.ok(value.startsWith("**run prefix** `:else`: runs only when the output so far is empty"), value);
	assert.ok(value.includes("https://tiddlywiki.com/#Else%20Filter%20Run%20Prefix"), value);
});

test("an unknown named prefix is called out", () => {
	assert.ok(hoverText("[tag[x]] :nosuch[[y]]", ":nosuch", 1).startsWith("**Unknown run prefix** `:nosuch`"));
});

// --- Names no operator has ---

test("a name no operator has is the field test TiddlyWiki makes instead", () => {
	const value = hoverText("[toc-link[no]]", "toc-link");
	assert.ok(value.startsWith("**Not a filter operator.** TiddlyWiki tests the field `toc-link` instead, as `[field:toc-link[no]]`."), value);
});

test("with a suffix, the field tested is the suffix", () => {
	assert.ok(hoverText("[foo:bar[x]]", "foo").includes("tests the field `bar` instead, as `[field:bar[x]]`"));
});

test("a dotted name is the function it calls when one is visible", () => {
	const text = documentOf("\\function lsp.op.f() [[a]]\n\n<$list filter='[lsp.op.f[]]'/>"),
		value = features.hover(URI, text, positionOf(text, "lsp.op.f", 1, 1)).contents.value;
	assert.ok(value.startsWith("**function** `lsp.op.f`, called as a filter operator, defined in this tiddler"), value);
});

test("a dotted name with no definition in sight falls back to the field test too", () => {
	const value = hoverText("[lsp.op.none[]]", "lsp.op.none", 1);
	assert.ok(value.startsWith("**No definition of** `lsp.op.none` **is visible here.**"), value);
	assert.ok(value.includes("`[field:lsp.op.none[]]`"), value);
});

// --- Go to definition ---

test("go to definition on an operator opens its module at the export", () => {
	const text = documentOf("<$list filter='[compare:number:gt[3]]'/>"),
		module = modules.moduleOfFilterOperator("compare"),
		location = features.definition(URI, text, positionOf(text, "compare", 2), {}, {});
	assert.equal(location.uri, features.virtualUri(module));
	assert.equal(covered($tw.wiki.getTiddlerText(module), location.range), "compare");
});

test("go to definition on a shorthand prefix opens the prefix it stands for", () => {
	const text = documentOf("<$list filter='[tag[x]] +[sort[]]'/>"),
		module = modules.moduleOfRunPrefix("and"),
		location = features.definition(URI, text, positionOf(text, "+", 0), {}, {});
	assert.equal(location.uri, features.virtualUri(module));
	assert.equal(covered($tw.wiki.getTiddlerText(module), location.range), "and");
});

// --- calls.filterParts, the protocol-neutral half ---

test("filterParts locates every prefix and written operator name", () => {
	const filter = '[tag[a]] +[!is[system]] :sort:string[get[x]] "q r" [foo:bar[x],[y]]',
		parts = calls.filterParts(filter);
	assert.deepEqual(parts.prefixes.map((p) => [p.prefix, p.named, filter.slice(p.start, p.end)]), [["+", null, "+"], [":sort:string", "sort", ":sort:string"]]);
	assert.deepEqual(parts.operators.map((o) => [o.operator, o.suffix, o.negated, filter.slice(o.start, o.end)]),
		[["tag", null, false, "tag"], ["is", null, true, "is"], ["get", null, false, "get"], ["foo", "bar", false, "foo"]]);
	assert.equal(parts.operators[3].step, "foo:bar[x],[y]");
});

test("filterParts has nothing for an unwritten name, and null for a filter that does not parse", () => {
	assert.deepEqual(calls.filterParts("[[a]] b [:field[c]]"), { prefixes: [], operators: [] });
	assert.equal(calls.filterParts("[tag[a]"), null);
});
