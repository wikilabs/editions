"use strict";

/*
Pins go to definition on a call: ctrl-click on a macro, procedure, function or
widget call opens the definition the wiki would use there, and on a parameter
or a widget's variable, the place it is declared.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.definition("file:///x.tid", "title: x\n\n\\procedure p() hi\n\n<<p>>", {line: 4, character: 2});
  // -> {uri: "file:///x.tid", range: <the p of \procedure p()>}
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const MODULES_TITLE = "$:/core/modules/commands/inspect/modules.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const URI = "file:///wiki/tiddlers/probe.tid";

let $tw;
let features;
let modules;
let lib;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	modules = loadHandler($tw, MODULES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

function tid(body) {
	return "title: probe\n\n" + body;
}

// The protocol position of the nth occurrence of needle, into characters inside it.
function positionOf(text, needle, into, nth) {
	let at = -1;
	for(let i = 0; i <= (nth || 0); i++) {
		at = text.indexOf(needle, at + 1);
	}
	assert.ok(at >= 0, "fixture must contain " + needle);
	const lines = text.slice(0, at).split("\n");
	return { line: lines.length - 1, character: lines[lines.length - 1].length + into };
}

// The text a single-line range covers.
function covered(text, range) {
	assert.equal(range.start.line, range.end.line, "a name never spans lines");
	return text.split("\n")[range.start.line].slice(range.start.character, range.end.character);
}

function defineIn(body, needle, into, nth, options, open) {
	const text = tid(body);
	return { text: text, result: features.definition(URI, text, positionOf(text, needle, into, nth), options, open) };
}

// --- In this tiddler ---

test("a <<call>> goes to the \\procedure of this tiddler, at its name", () => {
	const { text, result } = defineIn("\\procedure lsp.p() hi\n\n<<lsp.p>>", "<<lsp.p>>", 3);
	assert.equal(result.uri, URI);
	assert.equal(covered(text, result.range), "lsp.p");
	assert.equal(result.range.start.line, 2, "the definition's line, not the call's");
});

test("every call form goes to the same definition", () => {
	const body = [
		"\\procedure lsp.p() hi",
		"\\function lsp.f() [[x]]",
		"",
		'<$macrocall $name="lsp.p"/>',
		'<$transclude $variable="lsp.p"/>',
		"<$text text=<<lsp.p>>/>",
		"{{{ [<lsp.f>] }}}",
		'<$list filter="[function[lsp.f]]"/>',
		"{{{ [lsp.f[]] }}}"
	].join("\n");
	const forms = [['$name="lsp.p"', 8, "lsp.p", 2], ['$variable="lsp.p"', 12, "lsp.p", 2], ["=<<lsp.p>>", 4, "lsp.p", 2],
		["[<lsp.f>]", 3, "lsp.f", 3], ["[function[lsp.f]]", 12, "lsp.f", 3], ["[lsp.f[]]", 2, "lsp.f", 3]];
	for(const [needle, into, name, line] of forms) {
		const { text, result } = defineIn(body, needle, into);
		assert.ok(result, "no definition for " + needle);
		assert.equal(covered(text, result.range), name, needle);
		assert.equal(result.range.start.line, line, needle);
	}
});

test("a nested definition wins inside the body that holds it", () => {
	const body = [
		"\\procedure lsp.o1()",
		'\t\\procedure lsp.n(one:"1") x',
		"\t<<lsp.n>>",
		"\\end",
		"\\procedure lsp.o2()",
		'\t\\procedure lsp.n(two:"2") y',
		"\t<<lsp.n>>",
		"\\end"
	].join("\n");
	const { result } = defineIn(body, "<<lsp.n>>", 3, 1);
	assert.equal(result.range.start.line, 7, "the second nested definition");
});

test("a cursor on a definition's own name goes nowhere", () => {
	assert.equal(defineIn("\\procedure lsp.p() hi\n\n<<lsp.p>>", "lsp.p()", 1).result, null);
});

// --- Parameters and variables ---

test("a parameter goes to its declaration in the parameter list", () => {
	const { text, result } = defineIn("\\procedure lsp.p(tag) <<tag>>", "<<tag>>", 3);
	assert.equal(covered(text, result.range), "tag");
	assert.ok(result.range.start.character < text.split("\n")[2].indexOf(")"), "inside the parentheses");
});

test("a variable a $let sets goes to the attribute naming it", () => {
	const { text, result } = defineIn('<$let lsp.v="x"><<lsp.v>></$let>', "<<lsp.v>>", 3);
	assert.equal(covered(text, result.range), "lsp.v");
	assert.equal(result.range.start.character, "<$let ".length);
});

test("the currentTiddler a <$list> sets goes to the <$list tag", () => {
	const { text, result } = defineIn('<$list filter="[[a]]"><<currentTiddler>></$list>', "<<currentTiddler>>", 3);
	assert.equal(covered(text, result.range), "<$list");
});

// --- Elsewhere ---

test("a global in a shadow opens its read-only view at the definition", () => {
	const { result } = defineIn("<<list-links [tag[x]]>>", "<<list-links", 4);
	assert.equal(result.uri, features.virtualUri("$:/core/macros/list"));
	assert.equal(covered(features.virtualText("$:/core/macros/list"), result.range), "list-links");
});

test("a global in a .tid file opens that file, read from disk, at the definition", () => {
	// The file is ahead of the wiki's copy, as after a save from the editor.
	const title = "$:/temp/tw-mcp-tests/definition-global";
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-def-"));
	const filepath = path.join(dir, "definition-global.tid");
	const fileText = "title: " + title + "\ntags: $:/tags/Global\n\n\\procedure lsp.added() y\n\\procedure lsp.fileglobal() x\n";
	fs.writeFileSync(filepath, fileText);
	$tw.wiki.addTiddler({ title: title, tags: ["$:/tags/Global"], text: "\\procedure lsp.fileglobal() x" });
	$tw.boot.files[title] = { filepath: filepath, type: "application/x-tiddler", hasMetaFile: false };
	try {
		const { result } = defineIn("<<lsp.fileglobal>>", "<<lsp.fileglobal>>", 3);
		assert.equal(result.uri, features.pathToUri(filepath));
		assert.equal(covered(fileText, result.range), "lsp.fileglobal");
	} finally {
		delete $tw.boot.files[title];
		$tw.wiki.deleteTiddler(title);
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("a JavaScript widget opens its module's view at the constructor", () => {
	const { result } = defineIn('<$list filter="[[a]]"/>', "<$list", 2);
	const module = modules.moduleOfWidget("list");
	assert.equal(result.uri, features.virtualUri(module));
	assert.match(covered(features.virtualText(module), result.range), /Widget$/);
});

test("a JavaScript macro opens its module's view at its run function", () => {
	const { result } = defineIn("<<now>>", "<<now>>", 3);
	const module = modules.moduleOfMacro("now");
	assert.equal(result.uri, features.virtualUri(module));
	assert.equal(covered(features.virtualText(module), result.range), "run");
});

// --- Where TiddlyWiki would find nothing ---

test("a name nothing binds or defines goes nowhere", () => {
	assert.equal(defineIn("<<lsp.nowhere.at.all>>", "<<lsp", 3).result, null);
});

test("a name defined only out of reach is offered where it is defined", () => {
	// Nested in another document's body: not visible here, but maybe meant.
	const other = "file:///wiki/tiddlers/lsp_definition_other.tid";
	const otherText = "title: lsp_definition_other\n\n\\procedure lsp.outer()\n\t\\procedure lsp.hidden() x\n\t<<lsp.hidden>>\n\\end";
	const { result } = defineIn("<<lsp.hidden>>", "<<lsp.hidden>>", 3, 0, undefined, { [other]: otherText });
	assert.equal(result.uri, other);
	assert.equal(covered(otherText, result.range), "lsp.hidden");
});

// --- What the client is sent ---

test("a client that reads LocationLinks gets the call, the name and the whole definition", () => {
	const { text, result } = defineIn("\\procedure lsp.p() hi\n\n<<lsp.p>>", "<<lsp.p>>", 3, 0, { linkSupport: true });
	assert.equal(result.length, 1);
	const link = result[0];
	assert.equal(link.targetUri, URI);
	assert.equal(covered(text, link.originSelectionRange), "lsp.p");
	assert.equal(link.originSelectionRange.start.line, 4, "the name that was clicked");
	assert.equal(covered(text, link.targetSelectionRange), "lsp.p");
	assert.equal(covered(text, link.targetRange), "\\procedure lsp.p() hi");
});

test("the session asks for LocationLinks only when the client declares it can read them", () => {
	const text = tid("\\procedure lsp.p() hi\n\n<<lsp.p>>");
	const definitionFrom = (capabilities) => {
		const sent = [];
		const session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
		session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: { capabilities: capabilities } });
		session.dispatch({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: URI, version: 1, text: text } } });
		session.dispatch({ jsonrpc: "2.0", id: 2, method: "textDocument/definition", params: { textDocument: { uri: URI }, position: positionOf(text, "<<lsp.p>>", 3) } });
		return sent.find((message) => message.id === 2).result;
	};
	const links = definitionFrom({ textDocument: { definition: { linkSupport: true } } });
	assert.ok(Array.isArray(links) && links[0].targetUri === URI, JSON.stringify(links));
	const location = definitionFrom({});
	assert.equal(location.uri, URI, JSON.stringify(location));
});
