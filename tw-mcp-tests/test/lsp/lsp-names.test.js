"use strict";

/*
Pins hints for calls whose name nothing defines (lsp-names.js): a Hint on the
name, unless the wiki finds a definition or a binding at the call, or anything
in the wiki defines or sets the name, or a shadow tiddler calls it.

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
const URI = "file:///wiki/tiddlers/lsp_nm.tid";
const HINT = 4;
const OTHER = "$:/temp/tw-mcp-tests/names/other";
const FAKE_PLUGIN = "$:/temp/tw-mcp-tests/names/plugin";

let $tw;
let features;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

function hints(body) {
	return features.diagnostics(URI, "title: lsp_nm\n\n" + body + "\n").filter((d) => d.severity === HINT);
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
