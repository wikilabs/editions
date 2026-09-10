"use strict";

/*
Pins calls.js in tw-mcp-core: where a macro, procedure, function or widget is
called or defined, found through TiddlyWiki's own parsers. It is protocol-
neutral, so these tests speak offsets into the text, not LSP positions.

Every call is checked to cover exactly its NAME, which is what an editor
highlights and what a reader clicks.

To replicate by hand, boot the test edition:

  const calls = $tw.modules.execute("$:/core/modules/commands/inspect/calls.js");
  calls.sitesIn('<$macrocall $name="x"/>').calls;
  // -> [{name:"x", form:"macrocall", start:19, end:20}, {name:"$macrocall", form:"widget", ...}]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const CALLS_TITLE = "$:/core/modules/commands/inspect/calls.js";
const NAME = "ref.m";

let $tw;
let calls;

before(async () => {
	$tw = await bootTw();
	calls = loadHandler($tw, CALLS_TITLE);
});

// The calls to one name, each asserted to cover exactly that name.
function callsTo(text, name) {
	const found = calls.sitesIn(text).calls.filter((site) => site.name === name);
	for(const site of found) {
		assert.equal(text.slice(site.start, site.end), name, "range must cover the name: " + JSON.stringify(site));
	}
	return found;
}

function formsOf(text, name) {
	return callsTo(text, name).map((site) => site.form);
}

// --- Every way to write a call ---

test("a <<name>> call", () => {
	assert.deepEqual(formsOf('<<ref.m "[tag[A]]">>', NAME), ["macro"]);
});

test("a $macrocall widget naming it", () => {
	assert.deepEqual(formsOf('<$macrocall $name="ref.m" filter="[tag[D]]"/>', NAME), ["macrocall"]);
});

test("a $transclude widget naming it as $variable", () => {
	assert.deepEqual(formsOf('<$transclude $variable="ref.m"/>', NAME), ["transclude"]);
});

test("a call written as an attribute value", () => {
	assert.deepEqual(formsOf("<$wikify name=w text=<<ref.m>>>x</$wikify>", NAME), ["macro"]);
});

test("a custom widget call is a reference to its \\widget definition", () => {
	const text = "\\widget $ref.w() x\n\n<$ref.w/>";
	assert.deepEqual(formsOf(text, "$ref.w"), ["widget"]);
	assert.deepEqual(calls.sitesIn(text).definitions.map((d) => d.kind), ["widget"]);
});

// --- Calls inside filters ---

test("a variable operand in a filtered transclusion", () => {
	assert.deepEqual(formsOf("{{{ [<ref.m>] }}}", NAME), ["filter"]);
});

test("a variable operand given parameters", () => {
	assert.deepEqual(formsOf('{{{ [<ref.m "x">] }}}', NAME), ["filter"]);
});

test("a multi-valued variable in a filtered attribute", () => {
	assert.deepEqual(formsOf("<$let x={{{ [(ref.m)] }}}>y</$let>", NAME), ["filter"]);
});

test("the function operator naming it", () => {
	assert.deepEqual(formsOf('<$list filter="[function[ref.m],[x]]"/>', NAME), ["filter"]);
});

test("a dotted function used as a filter operator", () => {
	assert.deepEqual(formsOf("{{{ [ref.m[a]] }}}", NAME), ["filter"]);
});

test("a filter passed to a macro as a named argument", () => {
	assert.deepEqual(formsOf('<<list-links filter:"[<ref.m>]">>', NAME), ["filter"]);
});

test("the name inside a literal operand is not a call, the later variable is", () => {
	const text = "{{{ [tag[<ref.m>]] [<ref.m>] }}}";
	const found = callsTo(text, NAME);
	assert.equal(found.length, 1);
	assert.equal(found[0].start, text.lastIndexOf(NAME));
});

test("a string attribute that is not a filter is not scanned", () => {
	assert.deepEqual(formsOf('<$text text="[<ref.m>]"/>', NAME), []);
});

test("a backtick filter attribute is scanned", () => {
	assert.deepEqual(formsOf("<$list filter=`[<ref.m>]`/>", NAME), ["filter"]);
});

test("a backtick filter holding a placeholder is not scanned", () => {
	// It is a filter only once $(x)$ is filled in, which needs a position.
	assert.deepEqual(formsOf("<$list filter=`[<ref.m>] [[$(x)$]]`/>", NAME), []);
	assert.deepEqual(formsOf("<$list filter=`[<ref.m>] [[${ [[x]] }$]]`/>", NAME), []);
});

test("a malformed filter yields no calls rather than an exception", () => {
	// The second run is unclosed, so parseFilter rejects the whole filter.
	assert.deepEqual(formsOf("{{{ [<ref.m>] [tag[x] }}}", NAME), []);
	assert.deepEqual(formsOf('<$list filter="[<ref.m>"/>', NAME), []);
});

// --- Calls inside definition bodies, which are not parsed with the tiddler ---

test("a call in a single-line \\procedure body", () => {
	const text = "\\procedure p() <<ref.m>>";
	assert.equal(callsTo(text, NAME).length, 1);
});

test("a call in a \\define body", () => {
	assert.equal(callsTo("\\define d() <<ref.m>>", NAME).length, 1);
});

test("a call in a multi-line body", () => {
	assert.equal(callsTo("\\procedure p()\n<<ref.m>>\n\\end\n\ntext", NAME).length, 1);
});

test("a call in a \\function body, which is a filter", () => {
	assert.deepEqual(formsOf("\\function f.x() [<ref.m>]", NAME), ["filter"]);
});

test("a body is found after the header even when the header holds the same text", () => {
	// The default value repeats the body. Searching backwards from the \end is
	// what places the call on the body line rather than inside the parameters.
	const text = '\\procedure q(a:"<<ref.m>>")\n<<ref.m>>\n\\end';
	const found = callsTo(text, NAME);
	assert.equal(found.length, 1);
	assert.ok(found[0].start > text.indexOf("\n"), "the call must be on the body line");
});

// --- Conditions of an <%if%> block ---

test("a call in an <%if%> condition is found, and in its <%elseif%>", () => {
	const text = "<%if [<ref.m>] %>a<%elseif [function[ref.m]] %>b<%else%>c<%endif%>";
	assert.deepEqual(formsOf(text, NAME), ["filter", "filter"]);
});

test("a nested <%if%> block's condition is found once", () => {
	assert.equal(callsTo("<%if [<a>] %><%if [<ref.m>] %>x<%endif%><%endif%>", NAME).length, 1);
});

test("an <%if%> block is not reported as a $list widget", () => {
	const names = calls.sitesIn("<%if [<a>] %>x<%endif%>").calls.map((c) => c.name);
	assert.ok(!names.includes("$list"), JSON.stringify(names));
});

test("each clause of an <%if%> block is located in the source", () => {
	const text = "<%if [<a>] %>x<% elseif  [<b>] %>y<%else%>z<%endif%>";
	const clauses = calls.conditionalClauses($tw.wiki.parseText("text/vnd.tiddlywiki", text).tree[0], text);
	assert.deepEqual(clauses.map((c) => [c.keyword, c.filter]), [["if", "[<a>]"], ["elseif", "[<b>]"], ["else", null]]);
	for(const clause of clauses.filter((c) => c.filter)) {
		assert.equal(text.slice(clause.start, clause.end), clause.filter);
	}
});

// --- Definitions ---

test("each kind of definition, with a range around its name", () => {
	const text = "\\define ref.d() x\n\\procedure ref.p() x\n\\function ref.f() [[x]]\n\\widget $ref.w() x\n";
	const found = calls.sitesIn(text).definitions;
	assert.deepEqual(found.map((d) => [d.name, d.kind]), [
		["ref.d", "macro"], ["ref.p", "procedure"], ["ref.f", "function"], ["$ref.w", "widget"]
	]);
	for(const d of found) {
		assert.equal(text.slice(d.start, d.end), d.name);
	}
});

test("a definition carries its parameters, its whole range and its body", () => {
	// A pragma's range ends at \end, or at the end of its line.
	const text = '\\procedure ref.p(a, b:"B")\n<<a>>\n\\end\n\\function ref.f() [[x]]\n';
	const [p, f] = calls.sitesIn(text).definitions;
	assert.deepEqual(p.params, [{ name: "a" }, { name: "b", default: "B" }]);
	assert.equal(text.slice(p.range.start, p.range.end), '\\procedure ref.p(a, b:"B")\n<<a>>\n\\end');
	assert.equal(text.slice(p.body.start, p.body.end), "<<a>>");
	assert.deepEqual(f.params, []);
	assert.equal(text.slice(f.range.start, f.range.end), "\\function ref.f() [[x]]");
	assert.equal(text.slice(f.body.start, f.body.end), "[[x]]");
});

test("a definition nested in another's body names that definition as its parent", () => {
	const text = "\\procedure ref.outer()\n\t\\procedure ref.inner() x\n\t<<ref.inner>>\n\\end ref.outer\n\\procedure ref.next() y\n";
	const defs = calls.sitesIn(text).definitions;
	const index = (name) => defs.findIndex((d) => d.name === name);
	assert.equal(defs[index("ref.inner")].parent, index("ref.outer"));
	assert.equal(defs[index("ref.outer")].parent, null);
	assert.equal(defs[index("ref.next")].parent, null);
});

test("a definition two bodies deep names the innermost as its parent", () => {
	const text = "\\procedure ref.a()\n\t\\procedure ref.b()\n\t\t\\procedure ref.c() x\n\t\t<<ref.c>>\n\t\\end ref.b\n\t<<ref.b>>\n\\end ref.a\n";
	const defs = calls.sitesIn(text).definitions;
	const index = (name) => defs.findIndex((d) => d.name === name);
	assert.equal(defs[index("ref.c")].parent, index("ref.b"));
	assert.equal(defs[index("ref.b")].parent, index("ref.a"));
});

// --- Global definitions, found the way the wiki imports them ---

// What TiddlyWiki itself renders for a call, with the globals imported the way
// the page template imports them.
function renderWithGlobals(call) {
	return $tw.wiki.renderText("text/plain", "text/vnd.tiddlywiki", "\\import [subfilter{$:/core/config/GlobalImportFilter}]\n" + call).trim();
}

// $:/temp/ titles are excluded from syncing, so nothing reaches the disk.
function withTiddlers(tiddlers, fn) {
	try {
		tiddlers.forEach((t) => $tw.wiki.addTiddler(t));
		fn();
	} finally {
		tiddlers.forEach((t) => $tw.wiki.deleteTiddler(t.title));
	}
}

test("a definition in a $:/tags/Global tiddler is global", () => {
	const title = "$:/temp/tw-mcp-tests/calls-global";
	withTiddlers([{ title: title, tags: ["$:/tags/Global"], text: '\\procedure ref.g(x:"X") <<x>>\n' }], () => {
		assert.equal(renderWithGlobals("<<ref.g>>"), "X", "fixture assumption: the wiki imports it");
		const found = calls.globalDefinition("ref.g");
		assert.ok(found, "expected a global definition");
		assert.equal(found.title, title);
		assert.deepEqual(found.definition.params, [{ name: "x", default: "X" }]);
	});
});

test("a definition nested in a global's body is not global", () => {
	const title = "$:/temp/tw-mcp-tests/calls-global-nested";
	withTiddlers([{ title: title, tags: ["$:/tags/Global"], text: "\\procedure ref.outer()\n\t\\procedure ref.hidden() x\n\t<<ref.hidden>>\n\\end\n" }], () => {
		assert.equal(renderWithGlobals("<<ref.hidden>>"), "", "fixture assumption: the wiki does not import it");
		assert.equal(calls.globalDefinition("ref.hidden"), null);
	});
});

test("an untagged tiddler's definitions are not global", () => {
	withTiddlers([{ title: "$:/temp/tw-mcp-tests/calls-untagged", text: "\\procedure ref.u() x\n" }], () => {
		assert.equal(calls.globalDefinition("ref.u"), null);
	});
});

test("of two globals sharing a name, the one the wiki renders wins", () => {
	withTiddlers([
		{ title: "$:/temp/tw-mcp-tests/calls-global-a", tags: ["$:/tags/Global"], text: "\\procedure ref.twice() a\n" },
		{ title: "$:/temp/tw-mcp-tests/calls-global-b", tags: ["$:/tags/Global"], text: "\\procedure ref.twice() b\n" }
	], () => {
		const rendered = renderWithGlobals("<<ref.twice>>");
		assert.ok(["a", "b"].includes(rendered), "fixture assumption: one of them renders, got " + rendered);
		assert.equal(calls.globalDefinition("ref.twice").title, "$:/temp/tw-mcp-tests/calls-global-" + rendered);
	});
});

// --- What cannot be referenced ---

test("a name computed at render time is not reported as a call", () => {
	const names = calls.sitesIn("<$transclude $variable=<<dyn>>/>").calls.map((c) => c.name).sort();
	// Only the widget itself and the variable that holds the name.
	assert.deepEqual(names, ["$transclude", "dyn"]);
});

test("a \\define placeholder is not reported as a call", () => {
	const names = calls.sitesIn("\\define d(m) <<$m$>>").calls.map((c) => c.name);
	assert.deepEqual(names, []);
});

// --- Tiddlers, through TiddlyWiki's own cache ---

test("a tiddler's sites are cached until that tiddler changes", () => {
	// A $:/temp/ title is excluded from syncing, so nothing reaches the disk.
	const title = "$:/temp/tw-mcp-tests/calls-probe";
	try {
		$tw.wiki.addTiddler({ title: title, text: "<<ref.m>>" });
		const first = calls.sitesOfTiddler(title);
		assert.equal(first.calls.filter((c) => c.name === NAME).length, 1);
		assert.strictEqual(calls.sitesOfTiddler(title), first, "an unchanged tiddler must come from the cache");
		$tw.wiki.addTiddler({ title: title, text: "<<ref.m>> <<ref.m>>" });
		assert.equal(calls.sitesOfTiddler(title).calls.filter((c) => c.name === NAME).length, 2);
	} finally {
		$tw.wiki.deleteTiddler(title);
	}
});

test("a tiddler that is not wikitext has no sites", () => {
	const title = "$:/temp/tw-mcp-tests/calls-js-probe";
	try {
		$tw.wiki.addTiddler({ title: title, type: "application/javascript", text: "<<ref.m>>" });
		assert.deepEqual(calls.sitesOfTiddler(title), { calls: [], definitions: [] });
	} finally {
		$tw.wiki.deleteTiddler(title);
	}
});

test("a shadow tiddler's calls are found too", () => {
	// The LSP cannot link a shadow, having no file to open, but the library
	// still reports it, so a tool answering from the wiki can.
	const title = "$:/language/Snippets/ListByTag";
	assert.ok($tw.wiki.isShadowTiddler(title), "fixture assumption");
	assert.ok(calls.sitesOfTiddler(title).calls.some((c) => c.name === "list-links"));
});
