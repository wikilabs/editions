"use strict";

/*
Pins the read-only views of tiddlers that have no file of their own: shadows,
modules, and tiddlers packed into .json or .multids files. The editor opens
them under the tiddlywiki: scheme and asks for their text with the
tiddlywiki/tiddler request.

To replicate by hand, boot the test edition:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.virtualUri("$:/core/macros/list");  // -> "tiddlywiki:/%24%3A%2Fcore%2Fmacros%2Flist.tid"
  f.virtualDocument(f.virtualUri("$:/core/macros/list"));  // -> "title: $:/core/macros/list\n...\n\n<text>"
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const SHADOW = "$:/core/macros/list";
const MODULE = "$:/core/modules/filters/compare.js";
const FILED = "lsp_link_target";
const FAKE_PLUGIN = "$:/temp/tw-mcp-tests/virtual-plugin";
const PLUGIN_SHADOW = "$:/temp/tw-mcp-tests/virtual-plugin/caller";
const NAME = "lsp.virtual.probe";

let $tw;
let features;
let lib;

// Its own edition copy: a test here overrides a core shadow with a real tiddler, which a syncer may save.
before(async () => {
	$tw = await bootTw({ ownFolder: true });
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

// The text a protocol range covers.
function textAt(text, range) {
	return text.split("\n")[range.start.line].slice(range.start.character, range.end.character);
}

// Test scaffolding: a plugin registered and unpacked for the duration of fn, the
// way core does at load. A $:/temp/ title is never synced to disk. Unpacking at
// run time fires no change events, so the caches and the tag index a boot would
// build fresh are reset by hand.
function withPlugin(shipped, fn) {
	function refresh() {
		Object.keys(shipped).forEach((title) => $tw.wiki.clearCache(title));
		$tw.wiki.clearGlobalCache();
		const tags = $tw.wiki.getIndexer("TagIndexer");
		if(tags) {
			tags.rebuild();
		}
	}
	$tw.wiki.addTiddler({ title: FAKE_PLUGIN, type: "application/json", "plugin-type": "plugin", "plugin-priority": "10", text: JSON.stringify({ tiddlers: shipped }) });
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

// References to NAME asked from an in-memory document that calls it.
function referencesToName() {
	const uri = "file:///wiki/tiddlers/lsp_virtual_asker.tid";
	const text = "title: lsp_virtual_asker\n\n<<" + NAME + ">>";
	return features.references(uri, text, { line: 2, character: 4 }, { includeDeclaration: false }, { [uri]: text });
}

// An initialized session and every message it sent.
function session() {
	const sent = [];
	const s = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
	s.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
	return { session: s, sent: sent };
}

// --- The URI ---

test("a wikitext view's URI is its whole title plus .tid", () => {
	const uri = features.virtualUri(SHADOW);
	assert.equal(uri, "tiddlywiki:/" + encodeURIComponent(SHADOW) + ".tid");
	assert.equal(features.titleOfVirtualUri(uri), SHADOW);
});

test("a module's view keeps the extension its title already ends in", () => {
	const uri = features.virtualUri(MODULE);
	assert.ok(uri.endsWith("compare.js"), uri);
	assert.equal(features.titleOfVirtualUri(uri), MODULE);
});

test("the title survives the editor re-encoding the URI", () => {
	// VS Code hands the URI above back as tiddlywiki:/%24%3A/core/macros/list.tid.
	assert.equal(features.titleOfVirtualUri("tiddlywiki:/%24%3A/core/macros/list.tid"), SHADOW);
});

test("a URI naming no tiddler has no title", () => {
	assert.equal(features.titleOfVirtualUri("tiddlywiki:/lsp_no_such_tiddler.tid"), null);
});

// --- The text ---

test("a wikitext view reads as a .tid: fields, a blank line, then the text", () => {
	const text = features.virtualText(SHADOW);
	assert.ok(text.startsWith("title: " + SHADOW + "\n"), text.slice(0, 80));
	assert.ok(text.endsWith("\n\n" + $tw.wiki.getTiddlerText(SHADOW)), "the text must follow the header whole");
});

test("a module's view is its code alone, so line N is code line N", () => {
	assert.equal(features.virtualText(MODULE), $tw.wiki.getTiddlerText(MODULE));
});

// --- Where the editor opens a title ---

test("a tiddler with a .tid file opens as that file", () => {
	assert.ok(features.documentUriOf(FILED).startsWith("file:///"), features.documentUriOf(FILED));
});

test("a shadow opens as its view, and a missing title nowhere", () => {
	assert.equal(features.documentUriOf(SHADOW), features.virtualUri(SHADOW));
	assert.equal(features.documentUriOf("lsp_no_such_tiddler"), null);
});

// --- The protocol ---

test("tiddlywiki/tiddler answers a view's text", () => {
	const { session: s, sent } = session();
	s.dispatch({ jsonrpc: "2.0", id: 2, method: "tiddlywiki/tiddler", params: { uri: features.virtualUri(SHADOW) } });
	const reply = sent.find((message) => message.id === 2);
	assert.equal(reply.result.text, features.virtualText(SHADOW));
});

test("tiddlywiki/tiddler for no tiddler is an invalid-params error", () => {
	const { session: s, sent } = session();
	s.dispatch({ jsonrpc: "2.0", id: 2, method: "tiddlywiki/tiddler", params: { uri: "tiddlywiki:/lsp_no_such_tiddler.tid" } });
	const reply = sent.find((message) => message.id === 2);
	assert.equal(reply.error.code, -32602);
});

test("a view gets no squiggles, where the same text as a file does", () => {
	const text = "title: lsp_virtual_links\n\nSee [[lsp_no_such_tiddler]].";
	const published = (uri) => {
		const { session: s, sent } = session();
		s.dispatch({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: uri, version: 1, text: text } } });
		return sent.find((message) => message.method === "textDocument/publishDiagnostics").params.diagnostics;
	};
	assert.equal(published("file:///wiki/tiddlers/lsp_virtual_links.tid").length, 1, "fixture assumption: the link is warned in a file");
	assert.deepEqual(published("tiddlywiki:/lsp_virtual_links.tid"), []);
});

// --- Find references reaches what has no file ---

test("find references lists a plugin shadow's call in its view", () => {
	withPlugin({ [PLUGIN_SHADOW]: { text: "A call: <<" + NAME + ">>" } }, () => {
		const view = referencesToName().find((location) => location.uri === features.virtualUri(PLUGIN_SHADOW));
		assert.ok(view, "expected the shadow's view among the locations");
		assert.equal(textAt(features.virtualText(PLUGIN_SHADOW), view.range), NAME);
	});
});

test("a shadow a real tiddler overrides is searched as that tiddler", () => {
	// Only the running text counts: the real tiddler holds no call.
	withPlugin({ [PLUGIN_SHADOW]: { text: "A call: <<" + NAME + ">>" } }, () => {
		$tw.wiki.addTiddler({ title: PLUGIN_SHADOW, text: "No call here." });
		try {
			assert.ok(!referencesToName().some((location) => location.uri === features.virtualUri(PLUGIN_SHADOW)));
		} finally {
			$tw.wiki.deleteTiddler(PLUGIN_SHADOW);
		}
	});
});

test("a view of JavaScript holds no calls, whatever its text says", () => {
	withPlugin({ [PLUGIN_SHADOW + ".js"]: { type: "application/javascript", text: "// <<" + NAME + ">>" } }, () => {
		assert.ok(!referencesToName().some((location) => location.uri.includes("caller.js")));
	});
});

test("an open view of JavaScript is not searched either", () => {
	// The tiddler itself mentions the name, so only its type keeps it out.
	const title = PLUGIN_SHADOW + ".js";
	withPlugin({ [title]: { type: "application/javascript", text: "// <<" + NAME + ">>" } }, () => {
		const jsView = features.virtualUri(title);
		const uri = "file:///wiki/tiddlers/lsp_virtual_asker.tid";
		const text = "title: lsp_virtual_asker\n\n<<" + NAME + ">>";
		const open = { [uri]: text, [jsView]: features.virtualText(title) };
		const locations = features.references(uri, text, { line: 2, character: 4 }, { includeDeclaration: false }, open);
		assert.ok(!locations.some((location) => location.uri === jsView), JSON.stringify(locations));
	});
});

test("a view open under the editor's spelling of its URI is listed once", () => {
	withPlugin({ [PLUGIN_SHADOW]: { text: "A call: <<" + NAME + ">>" } }, () => {
		// VS Code re-encodes a URI it opens: %2F comes back as /.
		const respelled = features.virtualUri(PLUGIN_SHADOW).replace(/%2F/g, "/");
		const uri = "file:///wiki/tiddlers/lsp_virtual_asker.tid";
		const text = "title: lsp_virtual_asker\n\n<<" + NAME + ">>";
		const open = { [uri]: text, [respelled]: features.virtualText(PLUGIN_SHADOW) };
		const locations = features.references(uri, text, { line: 2, character: 4 }, { includeDeclaration: false }, open);
		assert.equal(locations.filter((location) => location.uri.startsWith("tiddlywiki:")).length, 1, JSON.stringify(locations));
	});
});

// --- Hovers point at the view ---

test("a definition in a shadow links its read-only view from the hover", () => {
	const uri = "file:///wiki/tiddlers/lsp_virtual_hover.tid";
	const text = "title: lsp_virtual_hover\n\n<<list-links [tag[x]]>>";
	const value = features.hover(uri, text, { line: 2, character: 4 }).contents.value;
	assert.ok(value.includes("[open in editor](" + features.virtualUri("$:/core/macros/list") + ")"), value);
});

// --- Versions that do not run ---

// Test scaffolding: a tiddler of the user's over the shadow SHADOW for the duration of fn, same fields but text.
function withOverride(text, fn) {
	$tw.wiki.addTiddler(new $tw.Tiddler($tw.wiki.getTiddler(SHADOW), { text: text }));
	$tw.wiki.clearGlobalCache();
	try {
		fn();
	} finally {
		$tw.wiki.deleteTiddler(SHADOW);
		$tw.wiki.clearGlobalCache();
	}
}

test("a version that does not run opens as a view naming its plugin, with that plugin's text", () => {
	const coreText = $tw.wiki.getPluginInfo("$:/core").tiddlers[SHADOW].text;
	withPlugin({ [SHADOW]: { tags: "$:/tags/Macro", text: "replaced" } }, () => {
		const uri = features.virtualUri(SHADOW, "$:/core");
		assert.equal(uri, "tiddlywiki:/" + encodeURIComponent(SHADOW) + ".tid?source=" + encodeURIComponent("$:/core"));
		assert.equal(features.titleOfVirtualUri(uri), SHADOW);
		assert.ok(features.virtualDocument(uri).endsWith("\n\n" + coreText), "core's text");
		assert.ok(features.virtualDocument(features.virtualUri(SHADOW)).endsWith("\n\nreplaced"), "the view without a source is the running text");
		assert.equal(features.virtualDocument(features.virtualUri(SHADOW, "$:/temp/tw-mcp-tests/no-such-plugin")), null);
	});
});

test("a version that does not run is another version: no squiggles, no rename", () => {
	const uri = features.virtualUri(SHADOW, "$:/core");
	assert.equal(features.isOtherVersionUri(uri), true);
	assert.equal(features.isOtherVersionUri(features.virtualUri(SHADOW)), false);
	const { session: s, sent } = session();
	s.dispatch({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: uri, version: 1, text: features.virtualDocument(uri) } } });
	s.dispatch({ jsonrpc: "2.0", id: 2, method: "textDocument/prepareRename", params: { textDocument: { uri: uri }, position: { line: 0, character: 0 } } });
	assert.ok(sent.find((message) => message.id === 2).error, "rename is refused");
});

test("the hover links the running version first, then each version that does not run", () => {
	withOverride($tw.wiki.getTiddlerText(SHADOW), () => {
		const uri = "file:///wiki/tiddlers/lsp_virtual_hover.tid";
		const text = "title: lsp_virtual_hover\n\n<<list-links [tag[x]]>>";
		const value = features.hover(uri, text, { line: 2, character: 4 }).contents.value,
			running = value.indexOf("your tiddler"),
			hidden = value.indexOf("[$:/core](" + features.virtualUri(SHADOW, "$:/core") + ")");
		assert.ok(running > 0 && hidden > running, value);
	});
});

test("a definition a plugin supplies names that plugin in the hover", () => {
	withPlugin({ [PLUGIN_SHADOW]: { tags: "$:/tags/Global", text: "\\procedure lsp.virtual.plugged() x" } }, () => {
		const uri = "file:///wiki/tiddlers/lsp_virtual_hover.tid";
		const text = "title: lsp_virtual_hover\n\n<<lsp.virtual.plugged>>";
		const value = features.hover(uri, text, { line: 2, character: 4 }).contents.value;
		assert.ok(value.includes("defined in"), "fixture assumption: the plugin's global is found: " + value);
		assert.ok(value.includes("from " + FAKE_PLUGIN), value);
	});
});
