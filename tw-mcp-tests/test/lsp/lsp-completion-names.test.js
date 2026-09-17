"use strict";

/*
Pins completion of names: where TiddlyWiki expects a call's name, a widget, a
parameter not yet given, a variable or function in a filter, or an operator.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.completions("file:///x.tid", "title: x\n\n\\procedure p(a) z\n<<p ", {line: 3, character: 4});
  // -> {isIncomplete: true, items: [{label: "a:", kind: 10, ...}]}
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const URI = "file:///wiki/tiddlers/lsp_cp.tid";
const FUNCTION = 3;
const CLASS = 7;
const FIELD = 5;
const PROPERTY = 10;
const REFERENCE = 18;
const OPERATOR = 24;
const TAGGED = "$:/temp/tw-mcp-tests/completion-names/tagged";
const OPERATOR_MODULE = "$:/temp/tw-mcp-tests/completion-names/operator.js";
const WIDGET_MODULE = "$:/temp/tw-mcp-tests/completion-names/widget.js";
const TITLES = ["lsp.cp Title One", "lsp.cp Title Two"];
const GET_MODULE = "$:/core/modules/filters/get.js";

// Definitions every test document starts with.
const PRELUDE = [
	"\\procedure lsp.cp.p(a, b:\"B\") <<a>>",
	"\\widget $lsp.cp.w(x, y) <$slot $name=\"ts-raw\"/>",
	"\\function lsp.cp.f() [[z]]",
	""
].join("\n");

let $tw;
let features;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

// Completion at the @@ in body, written after PRELUDE.
function complete(body) {
	const text = "title: lsp_cp\n\n" + PRELUDE + body.replace("@@", ""),
		at = ("title: lsp_cp\n\n" + PRELUDE + body).indexOf("@@"),
		lines = text.slice(0, at).split("\n");
	return features.completions(URI, text, { line: lines.length - 1, character: lines[lines.length - 1].length });
}

function labels(body) {
	return complete(body).items.map((item) => item.label);
}

// --- Call names ---

test("inside a definition, what binds here comes first, then this tiddler, then globals", () => {
	const found = labels("\\procedure lsp.cp.outer(tag, sort)\n<$let v=\"1\">\n<<@@\n</$let>\n\\end");
	assert.deepEqual(found.slice(0, 3), ["v", "tag", "sort"]);
	assert.ok(found.indexOf("lsp.cp.p") < found.indexOf("list-links"), found.join(", "));
	assert.ok(found.includes("currentTiddler"), "core variables are offered too");
	assert.ok(!found.includes("$lsp.cp.w"), "a widget is not called with <<");
});

test("a name being typed narrows the list, and every item claims the typed text", () => {
	const result = complete("<<lsp.cp.@@");
	assert.deepEqual(result.items.map((item) => item.label), ["lsp.cp.p", "lsp.cp.f"]);
	assert.equal(result.isIncomplete, true);
	result.items.forEach((item) => {
		assert.equal(item.filterText, "lsp.cp.");
		assert.equal(item.textEdit.range.end.character - item.textEdit.range.start.character, "lsp.cp.".length);
	});
	assert.equal(result.items[0].kind, FUNCTION);
});

test("typing on a body's last line still offers its parameters", () => {
	assert.equal(labels("\\procedure lsp.cp.q(tag)\n<<@@\n\\end")[0], "tag");
});

test("a definition brought in by \\import is offered, named by where it comes from", () => {
	const title = "$:/temp/tw-mcp-tests/completion-names/importable";
	$tw.wiki.addTiddler({ title: title, text: "\\procedure lsp.cp.imported() x\n" });
	try {
		const item = complete("\\import [[" + title + "]]\n\n<<lsp.cp.imp@@").items.find((i) => i.label === "lsp.cp.imported");
		assert.ok(item, "expected the imported procedure");
		assert.equal(item.documentation, "imported from " + title);
	} finally {
		$tw.wiki.deleteTiddler(title);
	}
});

test("a nested definition is offered inside its parent only", () => {
	const nested = "\\procedure lsp.cp.o()\n\\procedure lsp.cp.inner() x\n<<lsp.cp.i@@\n\\end";
	assert.ok(labels(nested).includes("lsp.cp.inner"));
	assert.ok(!labels(nested.replace("@@", "") + "\n<<lsp.cp.i@@").includes("lsp.cp.inner"));
});

test("a name given as $variable is completed like a call", () => {
	assert.deepEqual(labels("<$transclude $variable=\"lsp.cp.@@"), ["lsp.cp.p", "lsp.cp.f"]);
});

// --- Code ---

test("a call written in inline code opens nothing for the text after it", () => {
	// The LSP Completion Example documents its entries in a table, as code.
	const found = labels("|`<<lsp.cp` |`lsp.cp.p`, defined above |\n|`<$li` |every widget |\n\n<<lsp.cp@@");
	assert.ok(found.includes("lsp.cp.p"), found.join(", "));
});

test("a call inside a code fence opens nothing either", () => {
	const found = labels("```\n<<lsp.cp.p a:\"1\"\n```\n<<lsp.cp@@");
	assert.ok(found.includes("lsp.cp.p"), found.join(", "));
});

test("a backtick without a partner is plain text", () => {
	const found = labels("It costs 5` or so\n<<lsp.cp@@");
	assert.ok(found.includes("lsp.cp.p"), found.join(", "));
});

test("inside inline code a call is text, so no names are offered", () => {
	assert.deepEqual(complete("Type `<<lsp.cp@@` here").items, []);
});

// --- Parameters ---

test("a call is offered the parameters it has not been given", () => {
	assert.deepEqual(labels("<<lsp.cp.p @@"), ["a:", "b:"]);
	assert.deepEqual(labels("<<lsp.cp.p a:\"1\" @@"), ["b:"]);
	assert.equal(complete("<<lsp.cp.p @@").items[0].kind, PROPERTY);
});

test("a positional argument counts as given, by the procedure's rule", () => {
	assert.deepEqual(labels("<<lsp.cp.p \"1\" @@"), ["b:"]);
});

test("a parameter name being typed narrows the list, and is not taken as given", () => {
	assert.deepEqual(labels("<<lsp.cp.p a@@"), ["a:"]);
});

test("a widget-form call is offered attributes, over several lines too", () => {
	assert.deepEqual(labels("<$transclude $variable=\"lsp.cp.p\" a=\"1\" @@"), ["b="]);
	assert.deepEqual(labels("<$macrocall $name=\"lsp.cp.p\"\n\ta=\"1\"\n\t@@"), ["b="]);
});

test("a custom widget is offered its parameters", () => {
	assert.deepEqual(labels("<$lsp.cp.w x=\"1\" @@"), ["y="]);
});

// --- Widgets ---

test("a widget's tag offers registered widgets and custom ones in reach", () => {
	assert.ok(labels("<$li@@").includes("list"));
	const custom = complete("<$lsp.@@").items.find((item) => item.label === "lsp.cp.w");
	assert.ok(custom, "expected the \\widget definition");
	assert.equal(custom.kind, CLASS);
});

// --- Filters ---

test("a variable operand offers variables and functions, not widgets", () => {
	const found = labels("<$list filter=\"[<lsp.@@");
	assert.ok(found.includes("lsp.cp.p") && found.includes("lsp.cp.f"), found.join(", "));
	assert.ok(!found.includes("$lsp.cp.w"));
});

test("function[ offers functions only", () => {
	const result = complete("<$list filter=\"[function[@@");
	assert.ok(result.items.some((item) => item.label === "lsp.cp.f"));
	assert.ok(result.items.every((item) => item.detail.startsWith("function ")), result.items.map((i) => i.detail).join(", "));
});

test("an operator name is offered where a step starts", () => {
	const first = complete("<$list filter=\"[ta@@").items.find((item) => item.label === "tag");
	assert.ok(first, "expected tag");
	assert.equal(first.kind, OPERATOR);
	assert.ok(labels("<$list filter=\"[tag[x]so@@").includes("sort"));
	assert.ok(labels("<$list filter=\"[lsp.@@").includes("lsp.cp.f"), "a dotted function runs as an operator");
});

test("a filter continued on a later line is completed like one on a single line", () => {
	withTagged(() => {
		[
			'<$list filter="""[all[current]]\n\t[tag[lsp@@',
			'<$list\n\tfilter="[all[current]]\n\t[tag[lsp@@',
			'<$set name="x" value={{{ [all[current]]\n\t[tag[lsp@@',
			"{{{ [all[current]]\n\t[tag[lsp@@",
			"<%if [all[current]]\n\t[tag[lsp@@",
			"\\function lsp.cp.multi()\n[all[current]]\n[tag[lsp@@"
		].forEach((typed) => {
			assert.ok(labels(typed).includes("lsp cp Alpha"), typed);
		});
		assert.ok(labels('<$list filter="""[all[current]]\n\t[ta@@').includes("tag"), "an operator name too");
	});
});

test("a filter that has ended does not reach the lines after it", () => {
	withTagged(() => {
		['<$list filter="""[all[current]]"""/>\n[tag[lsp@@', "{{{ [all[current]] }}}\n[tag[lsp@@", "<%if [all[current]] %>\n[tag[lsp@@", "\\function lsp.cp.multi()\n[all[current]]\n\\end\n[tag[lsp@@"].forEach((typed) => {
			assert.deepEqual(labels(typed), [], typed);
		});
	});
});

test("an operator module edited since boot is judged by the code that runs", () => {
	withTagged(() => {
		$tw.wiki.addTiddler({ title: GET_MODULE, type: "application/javascript", "module-type": "filteroperator", text: "exports.get = function(source, operator) {\n\treturn [];\n};\n" });
		try {
			assert.ok(labels('<$list filter="[get[lsp-cp@@').includes("lsp-cp-colour"));
		} finally {
			$tw.wiki.deleteTiddler(GET_MODULE);
		}
	});
});

test("a literal operand offers nothing", () => {
	assert.deepEqual(labels("<$list filter=\"[prefix[lsp.@@"), []);
});

// Test scaffolding: a tiddler tagged and fielded for the tag and field tests, present for the duration of fn.
function withTagged(fn) {
	$tw.wiki.addTiddler({ title: TAGGED, tags: "[[lsp cp Alpha]] lsp.cp.beta", "lsp-cp-colour": "red" });
	try {
		fn();
	} finally {
		$tw.wiki.deleteTiddler(TAGGED);
	}
}

test("tag[ offers the tags the wiki uses, with how many tiddlers carry each", () => {
	withTagged(() => {
		const items = complete("<$list filter=\"[tag[lsp@@").items;
		assert.deepEqual(items.map((item) => item.label), ["lsp cp Alpha", "lsp.cp.beta"]);
		assert.deepEqual([items[0].kind, items[0].detail], [REFERENCE, "tag of 1 tiddler"]);
		assert.ok(labels("<$list filter=\"[!tag[lsp.cp.@@").includes("lsp.cp.beta"), "a negated step too");
		assert.ok(labels("{{{ [tag[lsp cp @@").includes("lsp cp Alpha"), "a space starts the next word");
	});
});

test("a system tag is offered once $ is typed, and not before", () => {
	assert.ok(labels("<$list filter=\"[tag[$:/tags/Mac@@").includes("$:/tags/Macro"));
	assert.ok(labels("<$list filter=\"[tag[@@").every((label) => !label.startsWith("$:/")));
});

test("an operand naming a field offers the fields the wiki uses", () => {
	withTagged(() => {
		["has", "get", "each", "sort", "nsort", "listed"].forEach((operator) => {
			const item = complete("<$list filter=\"[" + operator + "[lsp-cp@@").items.find((i) => i.label === "lsp-cp-colour");
			assert.ok(item, operator + "[ should offer lsp-cp-colour");
			assert.deepEqual([item.kind, item.detail], [FIELD, "field of 1 tiddler"]);
		});
		assert.ok(labels("<$list filter=\"[has[ti@@").includes("title"));
	});
});

// Test scaffolding: a filter operator module with this code, registered for the duration of fn.
function withOperator(code, fn) {
	$tw.wiki.addTiddler({ title: OPERATOR_MODULE, type: "application/javascript", "module-type": "filteroperator", text: code });
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

test("a plugin's operator is judged by its code too: an operand it reads as a field offers fields", () => {
	const byField = 'exports.lspcpbyfield = function(source, operator, options) {\n\tvar fieldName = operator.operand || "title";\n\treturn [];\n};\n',
		byValue = 'exports.lspcpbyvalue = function(source, operator, options) {\n\tvar wanted = operator.operand;\n\treturn [];\n};\n';
	withTagged(() => {
		withOperator(byField, () => {
			assert.ok(labels("<$list filter=\"[lspcpbyfield[lsp-cp@@").includes("lsp-cp-colour"));
		});
		withOperator(byValue, () => {
			assert.deepEqual(labels("<$list filter=\"[lspcpbyvalue[lsp-cp@@"), []);
		});
	});
});

test("a suffix naming a field offers fields, has:index does not", () => {
	withTagged(() => {
		assert.ok(labels("<$list filter=\"[field:lsp-cp@@").includes("lsp-cp-colour"));
		assert.ok(labels("<$list filter=\"[!regexp:lsp-cp@@").includes("lsp-cp-colour"));
		assert.deepEqual(labels("<$list filter=\"[has:index[lsp-cp@@"), []);
	});
});

// --- Title attributes ---

// Test scaffolding: tiddlers for the title attribute tests, present for the duration of fn.
function withTitles(fn) {
	TITLES.forEach((title) => $tw.wiki.addTiddler({ title: title, text: "x" }));
	try {
		fn();
	} finally {
		TITLES.forEach((title) => $tw.wiki.deleteTiddler(title));
	}
}

test("an attribute a widget's code uses as a title offers titles", () => {
	withTitles(() => {
		['<$link to="lsp.cp T@@', '<$transclude $tiddler="lsp.cp T@@', '<$list filter="[tag[x]]" template="lsp.cp T@@', '<$edit-text tiddler="lsp.cp T@@', '<$action-setfield $tiddler="lsp.cp T@@'].forEach((typed) => {
			assert.deepEqual(labels(typed), TITLES, typed);
		});
		assert.deepEqual(complete('<$link to="lsp.cp T@@').items[0].kind, REFERENCE);
		assert.deepEqual(labels("<$tiddler tiddler=lsp.cp@@"), TITLES, "an unquoted value too");
	});
});

test("an attribute that is no title offers nothing, and neither does an empty title", () => {
	withTitles(() => {
		assert.deepEqual(labels('<$link tooltip="lsp.cp@@'), []);
		assert.deepEqual(complete('<$link to="@@'), { isIncomplete: true, items: [] });
	});
});

// Test scaffolding: a widget module with this code, registered as name for the duration of fn.
function withWidget(name, code, fn) {
	$tw.wiki.addTiddler({ title: WIDGET_MODULE, type: "application/javascript", "module-type": "widget", text: code });
	$tw.modules.define(WIDGET_MODULE, "widget", code);
	$tw.rootWidget.widgetClasses[name] = $tw.modules.execute(WIDGET_MODULE)[name];
	$tw.wiki.clearGlobalCache();
	try {
		fn();
	} finally {
		delete $tw.rootWidget.widgetClasses[name];
		delete $tw.modules.titles[WIDGET_MODULE];
		delete $tw.modules.types.widget[WIDGET_MODULE];
		$tw.wiki.deleteTiddler(WIDGET_MODULE);
	}
}

test("a plugin's widget is judged by its code too: an attribute it reads a tiddler with offers titles", () => {
	const code = [
		'var Widget = require("$:/core/modules/widgets/widget.js").widget;',
		"function LspCpWidget(parseTreeNode, options) { this.initialise(parseTreeNode, options); }",
		"LspCpWidget.prototype = new Widget();",
		"LspCpWidget.prototype.execute = function() {",
		'\tthis.target = this.getAttribute("target");',
		'\tthis.note = this.getAttribute("note");',
		"\tthis.shown = this.wiki.getTiddlerText(this.target);",
		"};",
		"exports.lspcpwidget = LspCpWidget;"
	].join("\n");
	withTitles(() => {
		withWidget("lspcpwidget", code, () => {
			assert.deepEqual(labels('<$lspcpwidget target="lsp.cp@@'), TITLES);
			assert.deepEqual(labels('<$lspcpwidget note="lsp.cp@@'), []);
		});
	});
});

test("an <%if%> condition is a filter too", () => {
	assert.ok(labels("<%if [<lsp.@@").includes("lsp.cp.f"));
});

// --- Nothing ---

test("[< in prose, or a cursor after a closed call, offers nothing", () => {
	assert.deepEqual(complete("Some [<@@"), { isIncomplete: false, items: [] });
	assert.deepEqual(complete("<<lsp.cp.p>> @@"), { isIncomplete: false, items: [] });
});
