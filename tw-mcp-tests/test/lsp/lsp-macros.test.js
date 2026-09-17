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
const IMPORTABLE = "$:/temp/tw-mcp-tests/lsp-macros-importable";

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
	// start is where the argument is written, the space before it included.
	assert.deepEqual(sites[0].args, [{ name: "a", value: "1", positional: false, start: 46 }]);
});

test("a name computed at render time is no call, but the variable holding it is", () => {
	const sites = macros.callSites($tw.wiki.parseText("text/vnd.tiddlywiki", "<$transclude $variable=<<dyn>>/>").tree);
	assert.deepEqual(sites.map((s) => s.name), ["dyn"]);
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

test("an argument that is not a literal is kept as written", () => {
	const tree = $tw.wiki.parseText("text/vnd.tiddlywiki", '<$macrocall $name="x" a=<<y>> b={{z}} c={{{ [[q]] }}} d=`t`/>').tree;
	assert.deepEqual(macros.callSites(tree)[0].args.map((a) => a.value), ["<<y>>", "{{z}}", "{{{ [[q]] }}}", "`t`"]);
});

test("a call given a <<var>> argument hovers rather than failing", () => {
	const result = hoverOn(WHO + '<$transclude $variable="list-links" filter=<<lsp.who>>/>', "<$transclude", 3);
	assert.ok(result && result.contents.value.includes("`<<lsp.who>>`"), JSON.stringify(result));
});

// --- What binds a name at the cursor ---

test("a <<var>> attribute value is hovered as its own call", () => {
	const text = hoverOn(WHO + "<$text text=<<lsp.who>>/>", "<<lsp.who>>", 3).contents.value;
	assert.ok(text.includes("**function** `lsp.who`, defined in this tiddler"), text);
	assert.ok(!text.includes("**widget**"), text);
});

test("a parameter is reported as one, even where a global macro shares its name", () => {
	// The core defines a tag macro; inside this procedure <<tag>> is the parameter.
	const text = hoverOn('\\procedure lsp.p(tag, sort:"x")\n<<tag>>\n\\end', "<<tag>>", 3).contents.value;
	assert.ok(text.includes("**parameter** `tag` of `lsp.p`, no default"), text);
});

test("a parameter's default is shown", () => {
	const text = hoverOn('\\procedure lsp.p(tag, sort:"x")\n<<sort>>\n\\end', "<<sort>>", 3).contents.value;
	assert.ok(text.includes("default `x`"), text);
});

test("a variable set by an enclosing widget names that widget and its line", () => {
	const text = hoverOn('\\procedure lsp.p()\n<$set name="lsp.v" value="1">\n<<lsp.v>>\n</$set>\n\\end', "<<lsp.v>>", 3).contents.value;
	// Lines count the .tid header: title, blank, then the body from line 3.
	assert.ok(text.includes("**variable** `lsp.v`, set by `<$set>` on line 4"), text);
});

test("an inner binding hides an outer one of the same name", () => {
	const text = hoverOn('\\procedure lsp.p(tag)\n<$let tag="inner"><<tag>></$let>\n\\end', "<<tag>>", 3).contents.value;
	assert.ok(text.includes("set by `<$let>`"), text);
});

test("a definition nested inside another's body is found", () => {
	const text = hoverOn("\\procedure lsp.outer()\n\t\\procedure lsp.inner() x\n\t<<lsp.inner>>\n\\end", "<<lsp.inner>>", 3).contents.value;
	assert.ok(text.includes("**procedure** `lsp.inner`, defined in this tiddler"), text);
});

test("<<condition>> inside an <%if%> is the variable the block sets", () => {
	const text = hoverOn("<%if [[lsp_link_target]] %><<condition>><%endif%>", "<<condition>>", 3).contents.value;
	assert.ok(text.includes("set by `<%if%>`"), text);
});

test("a core variable is named as one, with its value here", () => {
	const text = hoverAt("<<currentTiddler>>", 4);
	assert.ok(text.includes("**core variable** `currentTiddler`, here `probe`"), text);
});

test("inside a definition, a name nothing binds says only a caller can set it", () => {
	const text = hoverOn("\\procedure lsp.p()\n<<lsp.unset>>\n\\end", "<<lsp.unset>>", 3).contents.value;
	assert.ok(text.includes("**Not set here.**"), text);
});

// --- Recognising the call ---

test("a macro call is found with its arguments", () => {
	const tree = $tw.wiki.parseText("text/vnd.tiddlywiki", "A <<list-links [tag[X]]>> B").tree;
	const sites = macros.callSites(tree);
	assert.equal(sites.length, 1);
	assert.equal(sites[0].name, "list-links");
	assert.deepEqual(sites[0].args, [{ name: null, value: "[tag[X]]", positional: true, start: 14 }]);
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

const TWO_NESTED = [
	"\\procedure lsp.o1()",
	'\t\\procedure lsp.n(one:"1") x',
	"\t<<lsp.n>>",
	"\\end",
	"\\procedure lsp.o2()",
	'\t\\procedure lsp.n(two:"2") y',
	"\t<<lsp.n>>",
	"\\end"
].join("\n");

test("a nested definition resolves by where the call is written, innermost first", () => {
	const first = TWO_NESTED.indexOf("<<lsp.n>>") + 2;
	const second = TWO_NESTED.lastIndexOf("<<lsp.n>>") + 2;
	assert.deepEqual(macros.findDefinition("lsp.n", TWO_NESTED, first).params, [{ name: "one", default: "1" }]);
	assert.deepEqual(macros.findDefinition("lsp.n", TWO_NESTED, second).params, [{ name: "two", default: "2" }]);
});

test("a nested definition calling itself from its own body finds itself", () => {
	const text = "\\procedure lsp.outer()\n\t\\procedure lsp.rec(depth) <<lsp.rec>>\n\\end";
	const found = macros.findDefinition("lsp.rec", text, text.indexOf("<<lsp.rec>>") + 2);
	assert.ok(found, "expected the nested definition");
	assert.deepEqual(found.params, [{ name: "depth" }]);
});

test("a nested definition hides a top-level one of the same name inside its body only", () => {
	const text = "\\procedure lsp.o()\n\t\\procedure lsp.s(inner) x\n\t<<lsp.s>>\n\\end\n\\procedure lsp.s(top) y";
	assert.deepEqual(macros.findDefinition("lsp.s", text, text.indexOf("<<lsp.s>>") + 2).params, [{ name: "inner" }]);
	assert.deepEqual(macros.findDefinition("lsp.s", text, text.length - 1).params, [{ name: "top" }]);
});

test("a call's hover describes the nested definition around it", () => {
	const text = hoverOn(TWO_NESTED, "<<lsp.n>>", 3).contents.value;
	assert.ok(text.includes("| one |"), text);
	assert.ok(!text.includes("| two |"), text);
});

test("a global in a $:/tags/Global tiddler is found, not only in $:/tags/Macro", () => {
	// $:/temp/ titles are excluded from syncing, so nothing reaches the disk.
	const title = "$:/temp/tw-mcp-tests/lsp-macros-global";
	$tw.wiki.addTiddler({ title: title, tags: ["$:/tags/Global"], text: "\\procedure lsp.glob(p) x\n" });
	try {
		const found = macros.findDefinition("lsp.glob", "");
		assert.ok(found, "expected the $:/tags/Global definition");
		assert.equal(found.title, title);
		assert.equal(found.kind, "procedure");
	} finally {
		$tw.wiki.deleteTiddler(title);
	}
});

// Test scaffolding: a tiddler of definitions nobody imports globally, present for the duration of fn.
function withImportable(fn) {
	$tw.wiki.addTiddler({ title: IMPORTABLE, text: "\\procedure lsp.imp.p(a) x\n\\procedure lsp.imp.shared(imported) x\n" });
	try {
		fn();
	} finally {
		$tw.wiki.deleteTiddler(IMPORTABLE);
	}
}

test("a definition brought in by \\import is found, and names the tiddler it comes from", () => {
	withImportable(() => {
		const text = "\\import [[" + IMPORTABLE + "]]\n\nBody <<lsp.imp.p>>",
			found = macros.findDefinition("lsp.imp.p", text, text.indexOf("<<lsp.imp.p>>") + 2);
		assert.deepEqual([found.kind, found.title, found.params], ["procedure", IMPORTABLE, [{ name: "a" }]]);
	});
});

test("<$importvariables> brings a definition in for the calls inside it only", () => {
	withImportable(() => {
		const text = '<$importvariables filter="[[' + IMPORTABLE + ']]">\n<<lsp.imp.p>>\n</$importvariables>\n<<lsp.imp.p>>';
		assert.equal(macros.findDefinition("lsp.imp.p", text, text.indexOf("<<lsp.imp.p>>") + 2).title, IMPORTABLE);
		assert.equal(macros.findDefinition("lsp.imp.p", text, text.lastIndexOf("<<lsp.imp.p>>") + 2), null);
	});
});

test("a definition of the document itself comes before an imported one", () => {
	withImportable(() => {
		const text = "\\import [[" + IMPORTABLE + "]]\n\\procedure lsp.imp.shared(mine) x\n\n<<lsp.imp.shared>>",
			found = macros.findDefinition("lsp.imp.shared", text, text.indexOf("<<lsp.imp.shared>>") + 2);
		assert.deepEqual([found.title, found.params], [null, [{ name: "mine" }]]);
	});
});

// --- The call as TiddlyWiki runs it ---

test("a call's hover shows it as it runs: every parameter named, defaults written out, an unset one empty", () => {
	const value = hoverOn('\\procedure lsp.run.p(a, b:"B", c) x\n\n<<lsp.run.p "x">>', "<<lsp.run.p", 2).contents.value;
	assert.ok(value.includes('Runs as:\n\n```\n<<lsp.run.p a:"x" b:"B" c:"">>\n```'), value);
});

test("an argument no parameter takes is not part of the call as it runs", () => {
	const value = hoverOn('\\procedure lsp.run.p(a) x\n\n<<lsp.run.p "x" "y" zz:"1">>', "<<lsp.run.p", 2).contents.value;
	assert.ok(value.includes('\n<<lsp.run.p a:"x">>\n'), value);
});

test("each value is quoted with the first quoting it does not contain", () => {
	const call = `<<lsp.run.q a:'say "hi"' b:"""it's "x" y""" c:"plain">>`,
		value = hoverOn("\\procedure lsp.run.q(a, b, c) x\n\n" + call, "<<lsp.run.q", 2).contents.value;
	assert.ok(value.includes("\n" + call + "\n"), value);
});

test("a call that sets none of its parameters still runs with each of them empty", () => {
	const value = hoverOn("\\procedure lsp.run.p(a) x\n\n<<lsp.run.p>>", "<<lsp.run.p", 2).contents.value;
	assert.ok(value.includes('\n<<lsp.run.p a:"">>\n') && !value.includes("Takes no parameters"), value);
});

test("a call of a definition without parameters shows no call as it runs", () => {
	const value = hoverOn("\\procedure lsp.run.none() x\n\n<<lsp.run.none>>", "<<lsp.run.none", 2).contents.value;
	assert.ok(value.includes("Takes no parameters") && !value.includes("Runs as"), value);
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

// Core binds a positional argument two ways. With core alone,
// \procedure p(a:"A",b:"B") called as <<p a:"x" "y">> renders a=x b=B, and the
// same \define renders a=x b=y.
const AB = [{ name: "a", default: "A" }, { name: "b", default: "B" }];
const A_NAMED_THEN_Y = [{ name: "a", value: "x", positional: false }, { name: null, value: "y", positional: true }];

test("a procedure or custom widget gives parameter i the positional argument numbered i", () => {
	for(const kind of ["procedure", "widget"]) {
		assert.deepEqual(macros.bindArguments(AB, A_NAMED_THEN_Y, kind), [
			{ name: "a", value: "x", origin: "named" },
			{ name: "b", value: "B", origin: "default" },
			{ name: null, value: "y", origin: "ignored" }
		], kind);
	}
});

test("a macro or function gives each parameter the next positional argument not yet taken", () => {
	for(const kind of ["macro", "function"]) {
		assert.deepEqual(macros.bindArguments(AB, A_NAMED_THEN_Y, kind), [
			{ name: "a", value: "x", origin: "named" },
			{ name: "b", value: "y", origin: "positional" }
		], kind);
	}
});

test("a procedure call's hover shows the default where core ignores a positional argument", () => {
	const text = hoverOn('\\procedure lsp.pp(a:"A",b:"B") <<a>><<b>>\n\n<<lsp.pp a:"x" "y">>', "<<lsp.pp", 3).contents.value;
	assert.match(text, /\| b \| `B` \| default \|/, text);
	assert.match(text, /\|  \| `y` \| ignored \|/, text);
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

test("a name nothing defines or binds says only a caller can set it", () => {
	const text = hoverAt("<<lsp_no_such_macro_at_all>>", 5);
	assert.ok(text.includes("**Not set here.**"), text);
});

test("a filter attribute of an ordinary widget is still just a filter", () => {
	withTagged(() => {
		const text = hoverAt('<$list filter="[tag[' + TAG + ']]">x</$list>', 20);
		assert.ok(text.includes("2 tiddlers"), text);
		assert.ok(!text.includes("**macro**"), "a widget is not a call: " + text);
	});
});
