"use strict";

/*
Pins hints for calls whose name nothing defines (lsp-names.js): a Hint on the
name, unless the wiki finds a definition or a binding at the call, or anything
in the wiki defines or sets the name, or a shadow tiddler calls it; and the
quick fixes that replace such a name with a close one that exists.

By hand, in a booted test edition:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.diagnostics("file:///x.tid", "title: x\n\n<<lsp.nm-typo>>\n");
  // -> [{range: {start: {line: 2, character: 2}, end: {line: 2, character: 13}}, severity: 4,
  //      source: "tiddlywiki", message: "`lsp.nm-typo` is not defined or set anywhere in this wiki"}]
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const URI = "file:///wiki/tiddlers/lsp_nm.tid";
const HINT = 4;
const OTHER = "$:/temp/tw-mcp-tests/names/other";
const FAKE_PLUGIN = "$:/temp/tw-mcp-tests/names/plugin";

let $tw;
let features;
let lib;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

function doc(body) {
	return "title: lsp_nm\n\n" + body + "\n";
}

function hints(body) {
	return features.diagnostics(URI, doc(body)).filter((d) => d.severity === HINT);
}

// The quick fixes offered on the hint for name in body, as the editor asks for them.
function fixes(body, name) {
	const hint = hints(body).find((d) => d.message.startsWith("`" + name + "`"));
	return features.codeActions(URI, doc(body), hint.range, { diagnostics: [hint] });
}

// The range of the nth occurrence (from 0) of name on line 2 of doc(body).
function nameRange(body, name, nth) {
	let at = -1;
	for(let i = 0; i <= nth; i++) {
		at = body.indexOf(name, at + 1);
	}
	return { start: { line: 2, character: at }, end: { line: 2, character: at + name.length } };
}

// The names hinted in body, sorted.
function hinted(body) {
	return hints(body).map((d) => /`([^`]+)`/.exec(d.message)[1]).sort();
}

// Test scaffolding: a plugin whose shadow tiddlers exist for the duration of fn (see lsp-virtual.test.js).
function withPlugin(shipped, fn) {
	function refresh() {
		Object.keys(shipped).forEach((title) => $tw.wiki.clearCache(title));
		$tw.wiki.clearGlobalCache();
	}
	$tw.wiki.addTiddler({ title: FAKE_PLUGIN, type: "application/json", "plugin-type": "plugin", text: JSON.stringify({ tiddlers: shipped }) });
	$tw.wiki.readPluginInfo([FAKE_PLUGIN]);
	$tw.wiki.registerPluginTiddlers("plugin", [FAKE_PLUGIN]);
	$tw.wiki.unpackPluginTiddlers();
	refresh();
	try {
		fn();
	} finally {
		$tw.wiki.unregisterPluginTiddlers("plugin", [FAKE_PLUGIN]);
		$tw.wiki.deleteTiddler(FAKE_PLUGIN);
		$tw.wiki.readPluginInfo([FAKE_PLUGIN]);
		$tw.wiki.unpackPluginTiddlers();
		refresh();
	}
}

test("a call nothing defines gets a Hint on its name", () => {
	assert.deepEqual(hints("<<lsp.nm-typo>>").map((d) => ({ range: d.range, severity: d.severity, source: d.source, message: d.message })), [{
		range: { start: { line: 2, character: 2 }, end: { line: 2, character: 13 } },
		severity: HINT,
		source: "tiddlywiki",
		message: "`lsp.nm-typo` is not defined or set anywhere in this wiki"
	}]);
});

test("every form of call is checked: $transclude, $macrocall, a filter variable, function[] and a dotted operator", () => {
	const body = '<$transclude $variable="lsp.nm-a"/> <$macrocall $name="lsp.nm-b"/> <$list filter="[<lsp.nm-c>] [function[lsp.nm-d]] [lsp.nm-e[]]"/>';
	assert.deepEqual(hinted(body), ["lsp.nm-a", "lsp.nm-b", "lsp.nm-c", "lsp.nm-d", "lsp.nm-e"]);
});

test("a misspelt widget gets a Hint, a registered one does not", () => {
	assert.deepEqual(hints("<$lisst filter='[tag[x]]'/> <$list filter='[tag[x]]'/>").map((d) => d.message), [
		"`$lisst` is no widget, and no \\widget in this wiki defines it"
	]);
});

test("nothing is hinted that the wiki finds at the call, or sets itself", () => {
	const body = [
		"\\procedure lsp.nm.p(a) <<a>>",
		"\\define lsp.nm.m(x) <<__x__>>",
		"",
		"<<lsp.nm.p>> <<lsp.nm.m>> <<list-links>> <<now>> <<currentTiddler>> <<tv-wikilinks>>",
		"<$let lsp.nm.v='1'><<lsp.nm.v>></$let>",
		"<$list filter='[tag[x]]' counter='n'><<n>> <<n-first>> <<n-last>></$list>",
		"<$list filter='[<currentTiddler>] [<lsp.nm.p>]'/>"
	].join("\n");
	assert.deepEqual(hinted(body), []);
});

test("a name another tiddler defines or sets is not hinted, since a caller may bring it into reach", () => {
	const body = "<<lsp.nm.elsewhere>> <<lsp.nm.item>>";
	assert.deepEqual(hinted(body), ["lsp.nm.elsewhere", "lsp.nm.item"]);
	$tw.wiki.addTiddler({ title: OTHER, text: "\\procedure lsp.nm.elsewhere() x\n\n<$list filter='[tag[x]]' variable='lsp.nm.item'><<show>></$list>" });
	try {
		assert.deepEqual(hinted(body), []);
	} finally {
		$tw.wiki.deleteTiddler(OTHER);
	}
	assert.deepEqual(hinted(body), ["lsp.nm.elsewhere", "lsp.nm.item"], "hinted again once that tiddler is gone");
});

// --- Quick fixes ---

test("a misspelt widget is offered the closest widget, renamed in its closing tag too", () => {
	const body = "<$lisst filter='[tag[x]]'>x</$lisst>",
		actions = fixes(body, "$lisst");
	assert.deepEqual(actions.map((a) => ({ title: a.title, kind: a.kind, isPreferred: a.isPreferred })), [{ title: "Change to $list", kind: "quickfix", isPreferred: true }]);
	assert.deepEqual(actions[0].diagnostics, hints(body));
	assert.deepEqual(actions[0].edit.changes[URI], [
		{ range: nameRange(body, "$lisst", 0), newText: "$list" },
		{ range: nameRange(body, "$lisst", 1), newText: "$list" }
	]);
});

test("a misspelt call is offered the closest names first, then in the order they are in reach", () => {
	const body = "\\procedure lsp.nm.grxxt() x\n\\procedure lsp.nm.greet() y\n\n<<lsp.nm.gret>>";
	assert.deepEqual(features.codeActions(URI, doc(body), { start: { line: 5, character: 2 }, end: { line: 5, character: 2 } }, {}).map((a) => a.title), [
		"Change to lsp.nm.greet",
		"Change to lsp.nm.grxxt"
	]);
});

test("two neighbours swapped count as one slip, which is all a short name allows", () => {
	const body = "<$let qzyx='1'><<qzxy>> <<qzab>></$let>";
	assert.deepEqual(fixes(body, "qzxy").map((a) => a.title), ["Change to qzyx"]);
	assert.deepEqual(fixes(body, "qzab").map((a) => a.title), [], "two slips are too many for four characters");
});

test("a name nothing resembles gets no quick fix, and neither does a range without a hint", () => {
	assert.deepEqual(fixes("<<lsp.nm-zzzzqq>>", "lsp.nm-zzzzqq"), []);
	assert.deepEqual(features.codeActions(URI, doc("<$lisst/> text"), nameRange("<$lisst/> text", "text", 0), {}), []);
	assert.deepEqual(features.codeActions(URI, doc("<$lisst/>"), nameRange("<$lisst/>", "$lisst", 0), { only: ["refactor"] }), [], "a request for other kinds");
});

test("the server offers quick fixes, and answers a codeAction request with them", () => {
	const sent = [],
		session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
	session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
	assert.deepEqual(sent[0].result.capabilities.codeActionProvider, { codeActionKinds: ["quickfix"] });
	session.dispatch({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: URI, text: doc("<$lisst/>"), version: 1 } } });
	session.dispatch({ jsonrpc: "2.0", id: 2, method: "textDocument/codeAction", params: { textDocument: { uri: URI }, range: nameRange("<$lisst/>", "$lisst", 0), context: { diagnostics: [] } } });
	assert.deepEqual(sent.find((message) => message.id === 2).result.map((a) => a.title), ["Change to $list"]);
});

test("a name a shadow tiddler calls is set by JavaScript, but one only another real tiddler calls stays hinted", () => {
	$tw.wiki.addTiddler({ title: OTHER, text: "<<lsp.nm.real-call>>" });
	try {
		withPlugin({ [FAKE_PLUGIN + "/template"]: { title: FAKE_PLUGIN + "/template", text: "<<lsp.nm.set-by-js>>" } }, () => {
			assert.deepEqual(hinted("<<lsp.nm.set-by-js>> <<lsp.nm.real-call>>"), ["lsp.nm.real-call"]);
		});
	} finally {
		$tw.wiki.deleteTiddler(OTHER);
	}
});
