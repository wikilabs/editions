// Diagnostic probe — not a test. Run manually:
//   node test/_probe.js
"use strict";

const { bootTw, loadHandler } = require("./setup");

(async () => {
	const $tw = await bootTw();

	console.log("=".repeat(60));
	console.log("#2: parseText behaviour for unknown MIME types");
	console.log("=".repeat(60));
	const types = [
		"application/x-no-such-parser",
		"application/x-bogus",
		"x-totally-fake",
		"video/mp4",
		"image/png",
		"text/plain"
	];
	for(const t of types) {
		const parser = $tw.wiki.parseText(t, "sample text", { parseAsInline: false });
		console.log("  type=" + t.padEnd(35) + " => parser=" + (parser ? parser.constructor.name : "null"));
	}

	console.log("\n" + "=".repeat(60));
	console.log("#6: list_tiddlers count-summary branch — total visible?");
	console.log("=".repeat(60));
	const listTiddlers = loadHandler($tw, "$:/core/modules/commands/inspect/handlers/query/list_tiddlers.js").list_tiddlers;
	const big = listTiddlers({ plugin: "$:/core" });
	console.log(big.content[0].text.split("\n").slice(0, 6).join("\n"));
	console.log("...");
	console.log(big.content[0].text.split("\n").slice(-3).join("\n"));
	const total = big.content[0].text;
	const hasGrandTotal = /\b\d{3,}\s+(tiddler|result|total)/i.test(total);
	console.log("  Grand total visible to user? " + hasGrandTotal);

	console.log("\n" + "=".repeat(60));
	console.log("#7: list_tiddlers plugin filter — actual tiddler names visible?");
	console.log("=".repeat(60));
	const pluginList = listTiddlers({ plugin: "$:/plugins/wikilabs/tw-mcp" });
	console.log(pluginList.content[0].text);
	console.log("  Contains specific subtiddler titles (handlers/, commands/)? " +
		/handlers|commands/.test(pluginList.content[0].text));

	console.log("\n" + "=".repeat(60));
	console.log("#8: list_tiddlers includeSystem — uncollapsed titles?");
	console.log("=".repeat(60));
	const sys = listTiddlers({ includeSystem: true });
	console.log(sys.content[0].text);
	console.log("  Contains '$:/plugins/wikilabs/tw-mcp' directly? " +
		(sys.content[0].text.indexOf("$:/plugins/wikilabs/tw-mcp") !== -1));

	console.log("\n" + "=".repeat(60));
	console.log("inspect_pos: how does it report a transcluded tiddler?");
	console.log("=".repeat(60));
	const inspectPos = loadHandler($tw, "$:/core/modules/commands/inspect/handlers/inspect/inspect_pos.js").inspect_pos;
	for(const probe of [
		"{{||inspect_pos_macro}}",
		"<$transclude $tiddler=\"inspect_pos_macro\"/>",
		"<$tiddler tiddler=\"inspect_pos_macro\"><$transclude/></$tiddler>"
	]) {
		const r = inspectPos({ text: probe, context: "Host" });
		console.log("  text=" + JSON.stringify(probe));
		console.log("    " + r.content[0].text.split("\n")[0]);
	}

	console.log("\n" + "=".repeat(60));
	console.log("inspect_scope: what's at char 100 in inspect_scope_vars?");
	console.log("=".repeat(60));
	const fullText = $tw.wiki.getTiddlerText("inspect_scope_vars", "");
	console.log("  full text length: " + fullText.length);
	console.log("  char 100 context: ..." + JSON.stringify(fullText.slice(95, 130)) + "...");
	const inspectScope = loadHandler($tw, "$:/core/modules/commands/inspect/handlers/inspect/inspect_scope.js").inspect_scope;
	for(const cp of [60, 100, 130, 150]) {
		const r = inspectScope({ tiddler: "inspect_scope_vars", charPos: cp, filter: "outer|inner|greet" });
		console.log("  charPos=" + cp + ":");
		console.log("    " + r.content[0].text.split("\n").slice(0, 6).join("\n    "));
	}

	console.log("\n" + "=".repeat(60));
	console.log("inspect_scope: how is the fixture's \\procedure classified?");
	console.log("=".repeat(60));
	const r = inspectScope({ tiddler: "inspect_scope_vars", charPos: 200, filter: "greet" });
	console.log(r.content[0].text);
})();
