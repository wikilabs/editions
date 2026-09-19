"use strict";

/*
Import into a server-shaped folder, where the filesystem plugin's syncer saves
changed tiddlers. By hand: `tiddlywiki ./w --init server`, add tw-mcp-core and
tw-mcp to its tiddlywiki.info, start `tiddlywiki ./w --mcp rw sse`, call
import_html_wiki(path), and watch ./w/tiddlers; restart the server before
extract_html_wiki and call import_html_wiki again.
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { bootTw, loadHandler, TW_BOOT_PATH } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/html-import.js";
const STAGING_TITLES = ["Import — Proposed Folder Structure", "$:/config/FileSystemPaths", "$:/DefaultTiddlers"];
const SOURCE_TIDDLERS = [
	{ title: "Alpha", text: "a", tags: "Journal" },
	{ title: "$:/DefaultTiddlers", text: "[[Alpha]]" }
];

let $tw, handlers, wikiPath, htmlPath, filesBefore, filesAfterStaging, changed = new Set();

// Files below tiddlers/, relative to it.
function listTiddlerFiles() {
	const root = path.join(wikiPath, "tiddlers");
	const out = [];
	const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
		const full = path.join(dir, entry.name);
		if(entry.isDirectory()) {
			walk(full);
		} else {
			out.push(path.relative(root, full));
		}
	});
	walk(root);
	return out.sort();
}

// Longer than the syncer's 1 s throttle, so anything it was going to save is on disk.
const waitForSyncer = () => new Promise((resolve) => setTimeout(resolve, 2500));

before(async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-mcp-import-syncer-"));
	process.on("exit", () => {
		// Best-effort teardown: a folder left in the temp directory harms nothing.
		try {
			fs.rmSync(dir, { recursive: true, force: true });
		} catch(err) {}
	});
	wikiPath = path.join(dir, "wiki");
	fs.mkdirSync(path.join(wikiPath, "tiddlers"), { recursive: true });
	fs.writeFileSync(path.join(wikiPath, "tiddlywiki.info"), JSON.stringify({
		plugins: ["tiddlywiki/filesystem", "wikilabs/tw-mcp-core", "wikilabs/tw-mcp"]
	}));
	// What `--init server` leaves in tiddlers/.
	fs.writeFileSync(path.join(wikiPath, "tiddlers", "$__StoryList.tid"), "title: $:/StoryList\nlist: \n\n");
	htmlPath = path.join(dir, "source.html");
	fs.writeFileSync(htmlPath, `<!doctype html><html><body>
<script class="tiddlywiki-tiddler-store" type="application/json">${JSON.stringify(SOURCE_TIDDLERS)}</script>
</body></html>`);
	$tw = await bootTw({ wikiPath });
	assert.ok($tw.syncer, "the filesystem plugin should give this wiki a syncer");
	handlers = loadHandler($tw, HANDLER_TITLE);
	$tw.wiki.addEventListener("change", (changes) => Object.keys(changes).forEach((title) => changed.add(title)));
	filesBefore = listTiddlerFiles();
	const result = handlers.import_html_wiki({ path: htmlPath });
	assert.ok(!result.isError, result.content[0].text);
	await waitForSyncer();
	filesAfterStaging = listTiddlerFiles();
});

test("staging an import writes no tiddler file", () => {
	assert.deepStrictEqual(filesAfterStaging, filesBefore);
});

test("staging still announces its helper tiddlers, so SSE pushes them to the browser", () => {
	for(const title of STAGING_TITLES) {
		assert.ok(changed.has(title), title + " raised no change event");
	}
});

test("after a restart between staging and extraction, the import can run again", () => {
	// A browser edit of the proposed rules in step 3 is saved to disk, like any browser edit.
	$tw.wiki.addTiddler({ title: "$:/config/FileSystemPaths", text: "[is[system]removeprefix[$:/]addprefix[_system/]]" });
	return waitForSyncer().then(() => {
		const script = `
			const $tw = require(process.argv[1]).TiddlyWiki();
			$tw.boot.argv = [process.argv[2]];
			$tw.boot.boot(() => {
				$tw.modules.execute("$:/core/modules/commands/inspect/handlers/shared.js").init({ readonlyMode: false, checkPathAllowed: () => null });
				const r = $tw.modules.execute("${HANDLER_TITLE}").import_html_wiki({ path: process.argv[3] });
				process.stdout.write(JSON.stringify({ isError: !!r.isError, text: r.content[0].text }));
				process.exit(0);
			});`;
		const child = spawnSync(process.execPath, ["-e", script, TW_BOOT_PATH, wikiPath, htmlPath], { encoding: "utf8", timeout: 30000 });
		const answer = JSON.parse(child.stdout.slice(child.stdout.lastIndexOf('{"isError"')));
		assert.equal(answer.isError, false, answer.text);
	});
});

test("extract writes the single-file wiki's own $:/DefaultTiddlers", async () => {
	const result = handlers.extract_html_wiki({});
	assert.ok(!result.isError, result.content[0].text);
	await waitForSyncer();
	const file = $tw.boot.files["$:/DefaultTiddlers"];
	assert.ok(file, "$:/DefaultTiddlers has no file");
	assert.match(fs.readFileSync(file.filepath, "utf8"), /\[\[Alpha\]\]/);
});

test("import refuses a wiki that already has content tiddlers", () => {
	const result = handlers.import_html_wiki({ path: htmlPath });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /already holds 1 content tiddler\./);
});
