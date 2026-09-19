"use strict";

/*
The folder names import_html_wiki proposes for frequent tags (bead
tw-mcp-server-g81). By hand: import a single-file wiki with three tiddlers
tagged `Higher Caloric Value (H.C.V.)` and three tagged `Übersicht`, then read
$:/config/FileSystemPaths.
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/html-import.js";

// Three tiddlers per tag: the import proposes a folder only for tags with at least three.
const SOURCE_TIDDLERS = [1, 2, 3].flatMap((n) => [
	{ title: "Energy " + n, tags: "[[Higher Caloric Value (H.C.V.)]]" },
	{ title: "Seite " + n, tags: "Übersicht" }
]);

let rules;

before(async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-mcp-import-folders-"));
	process.on("exit", () => {
		// Best-effort teardown: a folder left in the temp directory harms nothing.
		try {
			fs.rmSync(dir, { recursive: true, force: true });
		} catch(err) {}
	});
	const wikiPath = path.join(dir, "wiki");
	fs.mkdirSync(path.join(wikiPath, "tiddlers"), { recursive: true });
	fs.writeFileSync(path.join(wikiPath, "tiddlywiki.info"), JSON.stringify({
		plugins: ["wikilabs/tw-mcp-core", "wikilabs/tw-mcp"]
	}));
	const htmlPath = path.join(dir, "source.html");
	fs.writeFileSync(htmlPath, `<!doctype html><html><body>
<script class="tiddlywiki-tiddler-store" type="application/json">${JSON.stringify(SOURCE_TIDDLERS)}</script>
</body></html>`);
	const $tw = await bootTw({ wikiPath });
	const result = loadHandler($tw, HANDLER_TITLE).import_html_wiki({ path: htmlPath });
	assert.ok(!result.isError, result.content[0].text);
	rules = $tw.wiki.getTiddlerText("$:/config/FileSystemPaths");
});

test("a tag's run of mixed separators becomes one character in its folder name", () => {
	assert.match(rules, /\[tag\[Higher Caloric Value \(H\.C\.V\.\)\]addprefix\[higher-caloric-value-h_c_v\/\]\]/);
});

test("a tag's letters beyond ASCII stay in its folder name", () => {
	assert.match(rules, /\[tag\[Übersicht\]addprefix\[übersicht\/\]\]/);
});
