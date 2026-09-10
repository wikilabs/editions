"use strict";

/*
Pins find references: Shift+F12 on a call lists every call of that name across
the wiki's .tid files, each a range around the name.

Each test writes its own .tid files into a throwaway folder and registers them in
$tw.boot.files, the map TiddlyWiki saves through and references read from.
Nothing is added to the wiki, so the syncer never sees them.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  f.references("file:///x.tid", "title: x\n\n<<list-links>>", {line: 2, character: 4}, {includeDeclaration: false}, {});
  // -> [{uri, range}, ...], one per call of list-links in the wiki's .tid files
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const NAME = "lsp.refs.probe";

// One file per group of call forms, so each test can count them per file.
const FORMS = {
	lsp_refs_a: [
		"\\procedure lsp.refs.probe() hello",
		"",
		"<<lsp.refs.probe>>",
		'<$macrocall $name="lsp.refs.probe"/>'
	].join("\n"),
	lsp_refs_b: [
		'<$transclude $variable="lsp.refs.probe"/>',
		"<$wikify name=w text=<<lsp.refs.probe>>>x</$wikify>",
		"{{{ [<lsp.refs.probe>] }}}",
		'<$list filter="[function[lsp.refs.probe]]"/>'
	].join("\n"),
	lsp_refs_c: "\\procedure lsp.refs.inner() <<lsp.refs.probe>>\n\nbody"
};
const CALLS_PER_FILE = { lsp_refs_a: 2, lsp_refs_b: 4, lsp_refs_c: 1 };

let $tw;
let features;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
});

// Test scaffolding: each {title: body} becomes a .tid in a throwaway folder,
// registered in $tw.boot.files. A body given as {type, body} gets a type field.
function withFiles(files, fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-refs-"));
	const docs = {};
	try {
		for(const title of Object.keys(files)) {
			const spec = typeof files[title] === "string" ? { body: files[title] } : files[title];
			const filepath = path.join(dir, title + ".tid");
			const text = "title: " + title + "\n" + (spec.type ? "type: " + spec.type + "\n" : "") + "\n" + spec.body;
			fs.writeFileSync(filepath, text);
			$tw.boot.files[title] = { filepath: filepath, type: "application/x-tiddler", hasMetaFile: false };
			docs[title] = { filepath: filepath, uri: features.pathToUri(filepath), text: text };
		}
		return fn(docs);
	} finally {
		for(const title of Object.keys(files)) {
			delete $tw.boot.files[title];
		}
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

// The protocol position of `needle` in text, moved `into` characters inside it.
function positionOf(text, needle, into) {
	const at = text.indexOf(needle);
	assert.ok(at >= 0, "fixture must contain " + needle);
	const lines = text.slice(0, at).split("\n");
	return { line: lines.length - 1, character: lines[lines.length - 1].length + (into || 0) };
}

// References asked from `doc` with the cursor inside `needle`. `open` holds the
// editor's buffers by uri; the asking document is always one of them.
function referencesFrom(doc, needle, into, includeDeclaration, open) {
	const buffers = Object.assign({ [doc.uri]: doc.text }, open || {});
	const text = buffers[doc.uri];
	return features.references(doc.uri, text, positionOf(text, needle, into), { includeDeclaration: includeDeclaration }, buffers);
}

// Locations grouped by sandbox title, each checked to cover exactly NAME in
// the text the location names: an open buffer when given, else the file.
function byTitle(locations, docs, open) {
	const counts = {};
	for(const location of locations) {
		const title = Object.keys(docs).find((t) => features.sameFileKey(docs[t].uri) === features.sameFileKey(location.uri));
		if(!title) {
			continue;
		}
		const text = (open && open[location.uri]) || fs.readFileSync(docs[title].filepath, "utf8");
		const line = text.split("\n")[location.range.start.line];
		assert.equal(line.slice(location.range.start.character, location.range.end.character), NAME,
			"location must cover the name: " + JSON.stringify(location));
		counts[title] = (counts[title] || 0) + 1;
	}
	return counts;
}

// --- Finding every form ---

test("every call form in every file is referenced, each range covering the name", () => {
	withFiles(FORMS, (docs) => {
		const locations = referencesFrom(docs.lsp_refs_a, "<<lsp.refs.probe>>", 4, false);
		assert.deepEqual(byTitle(locations, docs), CALLS_PER_FILE);
	});
});

test("includeDeclaration adds the definition, and only it", () => {
	withFiles(FORMS, (docs) => {
		const without = referencesFrom(docs.lsp_refs_a, "<<lsp.refs.probe>>", 4, false);
		const withDecl = referencesFrom(docs.lsp_refs_a, "<<lsp.refs.probe>>", 4, true);
		assert.equal(withDecl.length, without.length + 1);
		const added = withDecl.find((l) => !without.some((w) => w.uri === l.uri && w.range.start.line === l.range.start.line && w.range.start.character === l.range.start.character));
		// Line 0 is the title field, line 1 the blank separator.
		assert.equal(added.range.start.line, 2, "the definition is the \\procedure line");
		byTitle([added], docs);
	});
});

test("the cursor may sit on any form of the call, or on the definition", () => {
	withFiles(FORMS, (docs) => {
		const cursors = [
			[docs.lsp_refs_a, '$name="lsp.refs.probe"', 8],
			[docs.lsp_refs_a, "\\procedure lsp.refs.probe", 12],
			[docs.lsp_refs_b, '$variable="lsp.refs.probe"', 12],
			[docs.lsp_refs_b, "text=<<lsp.refs.probe>>", 8],
			[docs.lsp_refs_b, "[<lsp.refs.probe>]", 3],
			[docs.lsp_refs_b, "[function[lsp.refs.probe]]", 11],
			[docs.lsp_refs_c, "<<lsp.refs.probe>>", 2]
		];
		for(const [doc, needle, into] of cursors) {
			assert.deepEqual(byTitle(referencesFrom(doc, needle, into, false), docs), CALLS_PER_FILE, "cursor in " + needle);
		}
	});
});

test("the cursor just after the name still counts", () => {
	withFiles(FORMS, (docs) => {
		const locations = referencesFrom(docs.lsp_refs_a, "lsp.refs.probe>>", NAME.length, false);
		assert.deepEqual(byTitle(locations, docs), CALLS_PER_FILE);
	});
});

test("a cursor on no call, or in the field header, finds nothing", () => {
	withFiles(FORMS, (docs) => {
		assert.equal(referencesFrom(docs.lsp_refs_a, "hello", 2, true), null);
		assert.equal(referencesFrom(docs.lsp_refs_a, "title:", 2, true), null);
	});
});

// --- Which text is read ---

test("an open buffer is read instead of its file, so unsaved edits count", () => {
	withFiles(FORMS, (docs) => {
		const edited = "title: lsp_refs_b\n\n<<lsp.refs.probe>>\n";
		const open = { [docs.lsp_refs_b.uri]: edited };
		const counts = byTitle(referencesFrom(docs.lsp_refs_a, "<<lsp.refs.probe>>", 4, false, open), docs, open);
		assert.equal(counts.lsp_refs_b, 1);
	});
});

test("a file open under the editor's spelling of its uri is not counted twice", () => {
	withFiles(FORMS, (docs) => {
		// VS Code sends a lowercase drive letter with its colon escaped.
		const editorUri = docs.lsp_refs_b.uri.replace(/^file:\/\/\/([A-Za-z]):/, (m, d) => "file:///" + d.toLowerCase() + "%3A");
		const open = { [editorUri]: docs.lsp_refs_b.text };
		const locations = referencesFrom(docs.lsp_refs_a, "<<lsp.refs.probe>>", 4, false, open);
		assert.deepEqual(byTitle(locations, docs, open), CALLS_PER_FILE);
		assert.ok(locations.filter((l) => features.sameFileKey(l.uri) === features.sameFileKey(editorUri)).every((l) => l.uri === editorUri),
			"an open file is reported under the uri the editor knows it by");
	});
});

test("both spellings of a Windows file uri compare equal", () => {
	assert.equal(features.sameFileKey("file:///e%3A/git/wiki/A%20B.tid"), features.sameFileKey("file:///E:/git/wiki/A%20B.tid"));
	assert.notEqual(features.sameFileKey("file:///e:/git/a.tid"), features.sameFileKey("file:///e:/git/b.tid"));
});

test("a file changed on disk is read again", () => {
	withFiles(FORMS, (docs) => {
		assert.equal(byTitle(referencesFrom(docs.lsp_refs_a, "<<lsp.refs.probe>>", 4, false), docs).lsp_refs_b, 4);
		const filepath = docs.lsp_refs_b.filepath;
		fs.writeFileSync(filepath, "title: lsp_refs_b\n\n<<lsp.refs.probe>>\n");
		// Move the mtime on explicitly, since a rewrite within the same clock tick
		// could otherwise leave it unchanged.
		const later = new Date(Date.now() + 10000);
		fs.utimesSync(filepath, later, later);
		assert.equal(byTitle(referencesFrom(docs.lsp_refs_a, "<<lsp.refs.probe>>", 4, false), docs).lsp_refs_b, 1);
	});
});

test("a .tid whose type is not wikitext is not searched", () => {
	withFiles(Object.assign({ lsp_refs_js: { type: "application/javascript", body: "<<lsp.refs.probe>>" } }, FORMS), (docs) => {
		const counts = byTitle(referencesFrom(docs.lsp_refs_a, "<<lsp.refs.probe>>", 4, false), docs);
		assert.equal(counts.lsp_refs_js, undefined);
		assert.deepEqual(counts, CALLS_PER_FILE);
	});
});

test("every location names a file on disk, so a shadow tiddler is never listed", () => {
	// $:/language/Snippets/ListByTag calls list-links but has no file to open.
	withFiles({ lsp_refs_d: "<<list-links>>" }, (docs) => {
		const locations = referencesFrom(docs.lsp_refs_d, "<<list-links>>", 4, false);
		const onDisk = new Set(Object.values($tw.boot.files).filter((e) => e.filepath).map((e) => features.sameFileKey(features.pathToUri(e.filepath))));
		assert.ok(locations.length >= 1);
		for(const location of locations) {
			assert.ok(onDisk.has(features.sameFileKey(location.uri)), "not a file: " + location.uri);
		}
	});
});
