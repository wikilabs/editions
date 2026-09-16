"use strict";

/*
Pins how a wiki the editor started (--lsp pipe=) follows its folders: a tiddler
file another process writes, changes or deletes is read in, and files that are
not the wiki's are left alone. That process has its own copy of the wiki, so this
is how MCP and browser edits saved by a dev server reach the editor.

Every title here is under $:/temp/, which the wiki does not sync to disk.

By hand: start `tiddlywiki ./wiki --lsp pipe=<name>` (see lsp-pipe.test.js), then
write ./wiki/tiddlers/New.tid from another shell:

  # [tw-lsp] Reloaded from disk: New
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");

const PREFIX = "$:/temp/tw-mcp-tests/watch/";
const TITLE = PREFIX + "probe";
const META_TITLE = PREFIX + "meta-probe";

let $tw, watch;

before(async () => {
	$tw = await bootTw();
	watch = loadHandler($tw, "$:/core/modules/commands/inspect/lsp/lsp-watch.js");
});

// Test scaffolding: a throwaway folder stands in for the wiki's tiddlers folder.
async function withTiddlersFolder(fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-watch-")),
		saved = $tw.boot.wikiTiddlersPath;
	$tw.boot.wikiTiddlersPath = dir;
	try {
		await fn(dir);
	} finally {
		$tw.boot.wikiTiddlersPath = saved;
		for(const title of Object.keys($tw.boot.files).concat($tw.wiki.allTitles())) {
			if(title.startsWith(PREFIX)) {
				delete $tw.boot.files[title];
				$tw.wiki.deleteTiddler(title);
			}
		}
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

function writeTid(filepath, title, text) {
	fs.writeFileSync(filepath, "title: " + title + "\n\n" + text);
}

test("a tiddler file written into the tiddlers folder becomes a tiddler", async () => {
	await withTiddlersFolder((dir) => {
		const file = path.join(dir, "probe.tid");
		writeTid(file, TITLE, "first");
		assert.deepEqual(watch.fileChanged(file), [TITLE]);
		assert.strictEqual($tw.wiki.getTiddlerText(TITLE), "first");
	});
});

test("a changed file replaces its tiddler's text", async () => {
	await withTiddlersFolder((dir) => {
		const file = path.join(dir, "probe.tid");
		writeTid(file, TITLE, "first");
		watch.fileChanged(file);
		writeTid(file, TITLE, "second");
		assert.deepEqual(watch.fileChanged(file), [TITLE]);
		assert.strictEqual($tw.wiki.getTiddlerText(TITLE), "second");
	});
});

test("a deleted file takes its tiddler with it, unfiled first", async () => {
	await withTiddlersFolder((dir) => {
		const file = path.join(dir, "probe.tid");
		writeTid(file, TITLE, "first");
		watch.fileChanged(file);
		fs.unlinkSync(file);
		assert.deepEqual(watch.fileChanged(file), [TITLE]);
		assert.strictEqual($tw.wiki.tiddlerExists(TITLE), false);
		assert.strictEqual($tw.boot.files[TITLE], undefined);
	});
});

test("a .meta change reloads the file it describes", async () => {
	await withTiddlersFolder((dir) => {
		const file = path.join(dir, "probe.txt");
		fs.writeFileSync(file, "body");
		fs.writeFileSync(file + ".meta", "title: " + META_TITLE + "\ntags: one\n");
		assert.deepEqual(watch.fileChanged(file + ".meta"), [META_TITLE]);
		fs.writeFileSync(file + ".meta", "title: " + META_TITLE + "\ntags: two\n");
		watch.fileChanged(file + ".meta");
		assert.deepEqual($tw.wiki.getTiddler(META_TITLE).fields.tags, ["two"]);
		assert.strictEqual($tw.wiki.getTiddlerText(META_TITLE), "body");
	});
});

test("a file outside the wiki's folders is not read in", async () => {
	const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-elsewhere-"));
	await withTiddlersFolder(() => {
		const file = path.join(elsewhere, "probe.tid");
		writeTid(file, TITLE, "outside");
		assert.strictEqual(watch.fileChanged(file), null);
		assert.strictEqual($tw.wiki.tiddlerExists(TITLE), false);
	});
	fs.rmSync(elsewhere, { recursive: true, force: true });
});

test("names the wiki's boot skips are skipped here too", async () => {
	await withTiddlersFolder((dir) => {
		const swap = path.join(dir, ".probe.swp");
		writeTid(swap, TITLE, "swap");
		assert.strictEqual(watch.fileChanged(swap), null);
		fs.mkdirSync(path.join(dir, ".git"));
		const inGit = path.join(dir, ".git", "probe.tid");
		writeTid(inGit, TITLE, "git");
		assert.strictEqual(watch.fileChanged(inGit), null);
		const spec = path.join(dir, "tiddlywiki.files");
		fs.writeFileSync(spec, "{\"tiddlers\": []}");
		assert.strictEqual(watch.fileChanged(spec), null);
		assert.strictEqual($tw.wiki.tiddlerExists(TITLE), false);
	});
});

test("each folder holding the wiki's files is watched once, at its outermost", () => {
	const roots = watch.watchRoots("/w/tiddlers", ["/w/tiddlers/a/x.tid", "/w/tiddlers/y.tid", "/other/z.tid", "/other/deeper/z2.tid"]);
	assert.deepEqual(roots, [path.resolve("/w/tiddlers"), path.resolve("/other")]);
});

test("a file only read, not written, since the wiki loaded it is not read in again", async () => {
	await withTiddlersFolder(async (dir) => {
		const file = path.join(dir, "probe.tid"),
			loadedAt = new Date(Date.now() - 60000);
		writeTid(file, TITLE, "on disk");
		fs.utimesSync(file, loadedAt, loadedAt);
		watch.fileChanged(file);
		const watcher = watch.startWatching({});
		try {
			// Marks the wiki's copy, so a reload would show.
			$tw.wiki.addTiddler({ title: TITLE, text: "in the wiki" });
			// A read moves only the access time, which Windows also reports as a change.
			fs.utimesSync(file, new Date(), loadedAt);
			await new Promise((resolve) => setTimeout(resolve, 400));
			assert.strictEqual($tw.wiki.getTiddlerText(TITLE), "in the wiki");
			writeTid(file, TITLE, "written");
			const deadline = Date.now() + 5000;
			while($tw.wiki.getTiddlerText(TITLE) !== "written" && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 25));
			}
			assert.strictEqual($tw.wiki.getTiddlerText(TITLE), "written");
		} finally {
			watcher.close();
		}
	});
});

test("a file written while watching is read in without being told", async () => {
	await withTiddlersFolder(async (dir) => {
		const watcher = watch.startWatching({});
		try {
			assert.ok(watcher.roots.includes(path.resolve(dir)), JSON.stringify(watcher.roots));
			writeTid(path.join(dir, "probe.tid"), TITLE, "watched");
			const deadline = Date.now() + 5000;
			while($tw.wiki.getTiddlerText(TITLE) !== "watched" && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 25));
			}
			assert.strictEqual($tw.wiki.getTiddlerText(TITLE), "watched");
		} finally {
			watcher.close();
		}
	});
});
