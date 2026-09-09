"use strict";

/*
Pins hovering a widget.

The half worth guarding is that an attribute is not always a literal. An
indirect reference, a macro call and a filtered value all read as opaque text,
and what they RESOLVE to at this position is the thing only a booted wiki can
say. The other half is a widget nobody registered: TiddlyWiki renders it as
nothing at all, so a misspelt name is otherwise completely silent.

To replicate by hand, boot the test edition and call the module:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.hover("file:///x.tid", 'title: X\n\n<$let a="1">y</$let>', {line: 2, character: 3});
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const URI = "file:///wiki/tiddlers/probe.tid";
const TAG = "lsp_widget_tag";

let $tw;
let features;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

function tid(body) {
	return "title: lsp_link_target\n\n" + body;
}

function hoverAt(body, character) {
	const result = features.hover(URI, tid(body), { line: 2, character: character });
	return result === null ? null : result.contents.value;
}

function parse(text) {
	return $tw.wiki.parseText("text/vnd.tiddlywiki", text).tree;
}

function withTagged(fn) {
	$tw.wiki.addTiddler({ title: "lsp_widget_one", text: "a", tags: [TAG] });
	$tw.wiki.addTiddler({ title: "lsp_widget_two", text: "b", tags: [TAG] });
	try {
		fn();
	} finally {
		$tw.wiki.deleteTiddler("lsp_widget_one");
		$tw.wiki.deleteTiddler("lsp_widget_two");
	}
}

// --- Finding widgets ---

test("a widget is found by its tag, with its attributes", () => {
	const sites = features.widgetSites(parse('<$let test="[tag[LSP]]" plain=abc>x</$let>'));
	assert.equal(sites.length, 1);
	assert.equal(sites[0].name, "let");
	assert.deepEqual(sites[0].attributes.map((a) => a.name), ["test", "plain"]);
});

test("a widget nobody registers is still found", () => {
	// It has to be, or the hover could not report the typo.
	const sites = features.widgetSites(parse('<$nosuchwidget a="1" />'));
	assert.equal(sites.length, 1);
	assert.equal(sites[0].name, "nosuchwidget");
});

test("ordinary HTML is not a widget", () => {
	assert.deepEqual(features.widgetSites(parse("<div class=\"x\">y</div>")), []);
});

// --- What an attribute is worth ---

test("a literal attribute is its own value", () => {
	const resolved = features.resolveAttribute({ type: "string", name: "a", value: "abc" }, null);
	assert.equal(resolved.kind, "string");
	assert.equal(resolved.value, "abc");
});

test("an indirect attribute is resolved against the wiki", () => {
	const attribute = parse('<$list filter={{lsp_link_target!!title}}>x</$list>')[0].children[0].attributes.filter;
	assert.equal(attribute.type, "indirect", "fixture assumption");
	const resolved = features.resolveAttribute(attribute, null);
	assert.equal(resolved.kind, "indirect");
	assert.equal(resolved.value, "lsp_link_target");
});

test("a macro attribute is resolved against the position's context", () => {
	const text = tid('<$transclude $tiddler=<<currentTiddler>> />');
	const result = features.hover(URI, text, { line: 2, character: 3 });
	assert.ok(result, "expected a hover");
	// currentTiddler here is the document's own title, so the written form and
	// the value must differ: that difference is the whole point.
	assert.ok(result.contents.value.includes("<<currentTiddler>>"), result.contents.value);
	assert.ok(result.contents.value.includes("lsp_link_target"), result.contents.value);
});

// --- What the hover says ---

test("hovering a widget names it and the module that defines it", () => {
	const text = hoverAt('<$let a="1">x</$let>', 3);
	assert.ok(text.includes("$let"), text);
	assert.ok(text.includes("$:/core/modules/widgets/let.js"), text);
});

test("an unregistered widget is called out, because it renders as nothing", () => {
	const text = hoverAt('<$nosuchwidget a="1" />', 3);
	assert.ok(text.includes("No widget named"), text);
	assert.ok(text.includes("render as nothing"), text);
});

test("a let reports the variables it binds", () => {
	const text = hoverAt('<$let alpha="1" beta="2">x</$let>', 3);
	assert.ok(text.includes("Binds"), text);
	assert.ok(text.includes("alpha"), text);
	assert.ok(text.includes("beta"), text);
});

test("a set reports the variable it names, not its attribute names", () => {
	const text = hoverAt('<$set name="chosen" value="1">x</$set>', 3);
	assert.ok(text.includes("chosen"), text);
});

test("a filter attribute is shown but not run", () => {
	// Point at the filter and it reports itself. Running it here as well says
	// the same thing twice and pushes the render out of sight.
	withTagged(() => {
		const text = hoverAt('<$let items="[tag[' + TAG + ']]">x</$let>', 3);
		assert.ok(text.includes("[tag[" + TAG + "]]"), "the filter must still be shown: " + text);
		assert.ok(!text.includes("2 tiddlers"), "but not evaluated: " + text);
		assert.ok(!text.includes("lsp_widget_one"), "and its matches not listed: " + text);
	});
});

// --- What it renders ---

test("a widget reports what it renders, body included", () => {
	withTagged(() => {
		const body = '<$list filter="[tag[' + TAG + ']]" join=", " variable="item"><$link to=<<item>>/></$list>';
		const text = hoverAt(body, 3);
		assert.ok(text.includes("Renders as"), text);
		// The body is a <$link> per item, so both titles must appear: that is
		// the body rendering, not just the widget's own output.
		assert.ok(text.includes("lsp_widget_one"), text);
		assert.ok(text.includes("lsp_widget_two"), text);
		// A DOM node's text already contains its descendants', so collecting
		// both levels would print every item twice.
		const render = text.slice(text.indexOf("Renders as"));
		assert.equal(
			render.split("lsp_widget_one").length - 1,
			1,
			"each item must appear once in the render: " + render
		);
	});
});

test("the render comes last, after the attribute table", () => {
	withTagged(() => {
		const body = '<$list filter="[tag[' + TAG + ']]"><$link to=<<currentTiddler>>/></$list>';
		const text = hoverAt(body, 3);
		const table = text.indexOf("| Attribute |");
		const render = text.indexOf("Renders as");
		assert.ok(table >= 0 && render >= 0, text);
		assert.ok(table < render, "the attribute table comes before the render");
	});
});

test("a widget that renders nothing says nothing about rendering", () => {
	// An empty section is worse than no section.
	const text = hoverAt('<$list filter="[tag[lsp_no_such_tag_at_all]]"><$link/></$list>', 3);
	assert.ok(!text.includes("Renders as"), text);
});

// --- Precedence ---

test("a filter attribute wins over the widget holding it", () => {
	withTagged(() => {
		// The narrower thing is the one being pointed at.
		const body = '<$list filter="[tag[' + TAG + ']]">x</$list>';
		const text = hoverAt(body, body.indexOf("[tag["));
		assert.ok(text.includes("2 tiddlers"), text);
		assert.ok(!text.includes("**widget**"), "expected the filter, not the widget: " + text);
	});
});

test("the widget wins where no attribute is under the cursor", () => {
	const body = '<$list filter="[tag[x]]">y</$list>';
	const text = hoverAt(body, 3);
	assert.ok(text.includes("**widget**"), text);
});
