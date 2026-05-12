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
		sys.content[0].text.indexOf("$:/plugins/wikilabs/tw-mcp") !== -1);
})();
