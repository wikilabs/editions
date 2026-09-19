"use strict";

/*
Import a single-file wiki into an empty folder, then extract it. By hand: start
`tiddlywiki <empty folder> --mcp rw` with tw-mcp-core and tw-mcp in its
tiddlywiki.info, call import_html_wiki(path) then extract_html_wiki(), and list
the folder's tiddlers/ directory.
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/html-import.js";

// What the single-file wiki holds; its $:/DefaultTiddlers is replaced in the store while the import is staged.
const SOURCE_TIDDLERS = [
	{ title: "Alpha", text: "a", tags: "Journal" },
	{ title: "Beta", text: "b" },
	{ title: "$:/SiteTitle", text: "Imported" },
	{ title: "$:/DefaultTiddlers", text: "[[Alpha]]" }
];

let $tw, written = [], importResult, extractResult;

before(async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-mcp-import-"));
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
	$tw = await bootTw({ wikiPath });
	const handlers = loadHandler($tw, HANDLER_TITLE);
	const before = Object.keys($tw.boot.files);
	importResult = handlers.import_html_wiki({ path: htmlPath });
	extractResult = handlers.extract_html_wiki({});
	written = Object.keys($tw.boot.files).filter((title) => !before.includes(title)).sort();
});

test("import_html_wiki then extract_html_wiki both succeed", () => {
	assert.ok(!importResult.isError, importResult.content[0].text);
	assert.ok(!extractResult.isError, extractResult.content[0].text);
});

test("extract_html_wiki writes every tiddler of the single-file wiki, plus the folder rules", () => {
	for(const title of SOURCE_TIDDLERS.map((t) => t.title).concat("$:/config/FileSystemPaths")) {
		assert.ok(written.includes(title), title + " has no file; written: " + written.join(", "));
	}
});

test("extract_html_wiki writes nothing the single-file wiki did not contain", () => {
	// The running wiki's $:/core, the staging helpers and store state stay out (bead tw-mcp-server-klx).
	const expected = SOURCE_TIDDLERS.map((t) => t.title).concat("$:/config/FileSystemPaths").sort();
	assert.deepStrictEqual(written, expected);
});

test("extract_html_wiki writes the single-file wiki's own $:/DefaultTiddlers, not the staging one", () => {
	const file = $tw.boot.files["$:/DefaultTiddlers"];
	assert.ok(file, "$:/DefaultTiddlers has no file");
	const text = fs.readFileSync(file.filepath, "utf8");
	assert.match(text, /\[\[Alpha\]\]/);
	assert.doesNotMatch(text, /Proposed Folder Structure/);
});
