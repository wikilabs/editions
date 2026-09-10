"use strict";

/*
Pins modules.js in tw-mcp-core: which module defines the widget, filter
operator, run prefix or JavaScript macro that is running, where in its text,
and which plugin supplies a tiddler.

To replicate by hand, boot the test edition:

  const modules = $tw.modules.execute("$:/core/modules/commands/inspect/modules.js");
  modules.moduleOfWidget("set");                  // -> the module defining <$set>, e.g. "$:/core/modules/widgets/set.js"
  modules.provenance("$:/core/ui/PageTemplate");  // -> "" (core alone supplies it)
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const MODULES_TITLE = "$:/core/modules/commands/inspect/modules.js";
const FAKE_PLUGIN = "$:/temp/tw-mcp-tests/modules-plugin";
const PLUGIN_ONLY = "$:/temp/tw-mcp-tests/modules-plugin/only";
const CORE_SHADOW = "$:/core/ui/PageTemplate";

let $tw;
let modules;

before(async () => {
	$tw = await bootTw();
	modules = loadHandler($tw, MODULES_TITLE);
});

// The name a range covers in a module's text, and the whole line it sits on.
function covered(title, range) {
	assert.ok(range, "expected a range in " + title);
	const text = $tw.wiki.getTiddlerText(title);
	const lineStart = text.lastIndexOf("\n", range.start - 1) + 1;
	const lineEnd = text.indexOf("\n", range.start);
	return { name: text.slice(range.start, range.end), line: text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd) };
}

// Test scaffolding: a plugin registered and unpacked for the duration of fn, the
// way core does at load. A $:/temp/ title is never synced to disk.
function withPlugin(shipped, fn) {
	$tw.wiki.addTiddler({ title: FAKE_PLUGIN, type: "application/json", "plugin-type": "plugin", text: JSON.stringify({ tiddlers: shipped }) });
	$tw.wiki.readPluginInfo([FAKE_PLUGIN]);
	$tw.wiki.registerPluginTiddlers("plugin", [FAKE_PLUGIN]);
	$tw.wiki.unpackPluginTiddlers();
	try {
		fn();
	} finally {
		$tw.wiki.unregisterPluginTiddlers("plugin", [FAKE_PLUGIN]);
		$tw.wiki.deleteTiddler(FAKE_PLUGIN);
		$tw.wiki.readPluginInfo([FAKE_PLUGIN]);
		$tw.wiki.unpackPluginTiddlers();
	}
}

// --- Which module runs ---

test("a widget's module is the one exporting the class that runs", () => {
	// Which file holds <$set> depends on the core version, so it is not named here.
	const title = modules.moduleOfWidget("set");
	assert.ok(title && title.startsWith("$:/core/modules/widgets/"), String(title));
	assert.strictEqual($tw.modules.execute(title).set, $tw.rootWidget.widgetClasses.set);
});

test("a filter operator, a run prefix and a JavaScript macro are found the same way", () => {
	assert.equal(modules.moduleOfFilterOperator("compare"), "$:/core/modules/filters/compare.js");
	assert.equal(modules.moduleOfRunPrefix("else"), "$:/core/modules/filterrunprefixes/else.js");
	const macro = modules.moduleOfMacro("now");
	assert.ok(macro, "expected the module of the now macro");
	assert.equal($tw.modules.execute(macro).name, "now");
});

test("a module exporting a name that does not run is not taken for the one that does", () => {
	// Registered after core's, as a plugin's module would be, but never applied.
	const running = modules.moduleOfWidget("set");
	const title = "$:/temp/tw-mcp-tests/modules-idle-widget.js";
	assert.ok(running, "fixture assumption: <$set> has a module");
	$tw.modules.define(title, "widget", { set: function() {} });
	try {
		assert.equal(modules.moduleOfWidget("set"), running);
	} finally {
		delete $tw.modules.titles[title];
		delete $tw.modules.types.widget[title];
	}
});

test("a name nothing registers has no module", () => {
	assert.equal(modules.moduleOfWidget("lsp-no-such-widget"), null);
	assert.equal(modules.moduleOfFilterOperator("lsp-no-such-operator"), null);
	assert.equal(modules.moduleOfRunPrefix("lsp-no-such-prefix"), null);
	assert.equal(modules.moduleOfMacro("lsp-no-such-macro"), null);
});

// --- Where in the module ---

test("a widget is defined where its constructor is written, not at the export", () => {
	const title = modules.moduleOfWidget("set");
	const at = covered(title, modules.exportedAt(title, "set"));
	assert.match(at.name, /Widget$/, "the range must cover the constructor's name");
	assert.ok(at.line.startsWith("var " + at.name + " = function"), at.line);
});

test("an export that is a function in place is its own definition", () => {
	const title = "$:/core/modules/filters/compare.js";
	const at = covered(title, modules.exportedAt(title, "compare"));
	assert.equal(at.name, "compare");
	assert.match(at.line, /^exports\.compare = function/);
});

test("a name exported in brackets is found inside its quotes", () => {
	const title = "$:/core/modules/filters/unknown.js";
	const at = covered(title, modules.exportedAt(title, "[unknown]"));
	assert.equal(at.name, "[unknown]");
	assert.match(at.line, /^exports\["\[unknown\]"\] = function/);
});

test("a name the module does not export is not found by its prefix", () => {
	// The module exports set, and "se" must not match it.
	assert.equal(modules.exportedAt(modules.moduleOfWidget("set"), "se"), null);
});

// --- Who supplies a tiddler ---

test("a shadow core alone supplies says nothing: core is always present", () => {
	assert.equal($tw.wiki.getShadowSource(CORE_SHADOW), "$:/core", "fixture assumption");
	assert.equal(modules.provenance(CORE_SHADOW), "");
});

test("a shadow only a plugin ships names that plugin", () => {
	withPlugin({ [PLUGIN_ONLY]: { text: "x" } }, () => {
		assert.equal(modules.provenance(PLUGIN_ONLY), "from " + FAKE_PLUGIN);
	});
});

test("a plugin shadow that replaces core's says so", () => {
	withPlugin({ [CORE_SHADOW]: { text: "replaced" } }, () => {
		assert.equal($tw.wiki.getShadowSource(CORE_SHADOW), FAKE_PLUGIN, "fixture assumption: the plugin unpacks after core");
		assert.equal(modules.provenance(CORE_SHADOW), "from " + FAKE_PLUGIN + ", replacing $:/core");
	});
});

test("a tiddler of the user's over a plugin shadow is the user's, replacing the plugin's", () => {
	withPlugin({ [PLUGIN_ONLY]: { text: "x" } }, () => {
		$tw.wiki.addTiddler({ title: PLUGIN_ONLY, text: "mine" });
		try {
			assert.equal(modules.provenance(PLUGIN_ONLY), "your tiddler, replacing the shadow from " + FAKE_PLUGIN);
		} finally {
			$tw.wiki.deleteTiddler(PLUGIN_ONLY);
		}
	});
});

test("a tiddler that is no shadow says nothing", () => {
	assert.equal(modules.provenance("lsp_link_target"), "");
});
