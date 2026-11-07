"use strict";

/*
Pins how a binding names the widget that sets it. An <%if%> block's clauses are
$list widgets nobody wrote, so `condition` is set "by <%if%>", in every clause.
Cores from 5.5.0-prerelease give the <%elseif%> clause a source range of its own,
which exposed that clause as a plain <$list>.

To replicate by hand, boot the test edition and call the module:

  const scope = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-scope.js");
  const source = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-source.js");
  const text = "<%if [[x]!is[tiddler]] %>a<%elseif [[x]is[tiddler]] %>b<%else%>c<%endif%>";
  scope.bindingsAt(text.indexOf("c<"), source.parseWithBodies(text), text);
  // every { name: "condition", ... } has by: "<%if%>"
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const IF_ELSEIF = "<%if [[x]!is[tiddler]] %>a<%elseif [[x]is[tiddler]] %>b<%else%>c<%endif%>";

let scope;
let source;

before(async () => {
	const $tw = await bootTw();
	scope = loadHandler($tw, "$:/core/modules/commands/inspect/lsp/lsp-scope.js");
	source = loadHandler($tw, "$:/core/modules/commands/inspect/lsp/lsp-source.js");
});

for(const clause of ["a<", "b<", "c<"]) {
	test("condition inside the clause before " + clause + " is set by <%if%>", () => {
		const offset = IF_ELSEIF.indexOf(clause);
		const bound = scope.bindingsAt(offset, source.parseWithBodies(IF_ELSEIF), IF_ELSEIF).filter((b) => b.name === "condition");
		assert.ok(bound.length > 0, "no binding of condition");
		for(const b of bound) {
			assert.strictEqual(b.by, "<%if%>");
		}
	});
}

test("resolve names <%if%> for condition in the else clause", () => {
	const offset = IF_ELSEIF.indexOf("c<");
	const binding = scope.resolve("condition", offset, source.parseWithBodies(IF_ELSEIF), IF_ELSEIF);
	assert.strictEqual(binding.by, "<%if%>");
});
