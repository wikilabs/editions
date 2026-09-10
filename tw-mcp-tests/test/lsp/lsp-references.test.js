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
// registered in $tw.boot.files. A body given as {type, fields, body} gets those
// header fields too.
function withFiles(files, fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-refs-"));
	const docs = {};
	try {
		for(const title of Object.keys(files)) {
			const spec = typeof files[title] === "string" ? { body: files[title] } : files[title];
			const filepath = path.join(dir, title + ".tid");
			const header = Object.entries(spec.fields || {}).map(([name, value]) => name + ": " + value + "\n").join("");
			const text = "title: " + title + "\n" + (spec.type ? "type: " + spec.type + "\n" : "") + header + "\n" + spec.body;
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

test("a call in a .tid header field is a reference too", () => {
	withFiles({ lsp_refs_a: FORMS.lsp_refs_a, lsp_refs_field: { fields: { caption: "<<" + NAME + ">>" }, body: "body" } }, (docs) => {
		const field = docs.lsp_refs_field;
		const found = referencesFrom(docs.lsp_refs_a, "<<" + NAME + ">>", 3, false).filter((location) => location.uri === field.uri);
		assert.equal(found.length, 1, JSON.stringify(found));
		const range = found[0].range;
		assert.equal(range.start.line, 1, "the caption is the second header line");
		assert.equal(field.text.split("\n")[1].slice(range.start.character, range.end.character), NAME);
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

// --- Parameters and variables stay in their scope ---

const SCOPED_URI = "file:///wiki/tiddlers/lsp_refs_scoped.tid";
const SCOPED = [
	"title: lsp_refs_scoped",
	"",
	"\\procedure lsp.a(tag)",
	"<<tag>> <<tag>>",
	"<$let tag=\"x\"><<tag>></$let>",
	"\\end",
	"\\procedure lsp.b(tag)",
	"<<tag>>",
	"\\end"
].join("\n");

// References from a line and column of SCOPED, as "line:character" of each hit.
function scopedHits(line, character, includeDeclaration) {
	const found = features.references(SCOPED_URI, SCOPED, { line: line, character: character },
		{ includeDeclaration: includeDeclaration }, { [SCOPED_URI]: SCOPED });
	return found.map((l) => l.range.start.line + ":" + l.range.start.character);
}

test("references to a parameter stay inside its own procedure", () => {
	assert.deepEqual(scopedHits(3, 3, false), ["3:2", "3:10"]);
});

test("the parameter's declaration is included when asked for", () => {
	assert.deepEqual(scopedHits(3, 3, true), ["2:17", "3:2", "3:10"]);
});

test("an inner binding of the same name is its own, with its own declaration", () => {
	assert.deepEqual(scopedHits(4, 16, true), ["4:6", "4:16"]);
});

test("the same parameter name in another procedure is a different parameter", () => {
	assert.deepEqual(scopedHits(7, 3, false), ["7:2"]);
});

test("a tiddler that gains a file is searched as that file, not also as its view", () => {
	// $:/temp/ titles are not synced, so the wiki copy never reaches the disk.
	const title = "$:/temp/tw-mcp-tests/refs/gains-a-file",
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-refs-gains-")),
		filepath = path.join(dir, "gains.tid"),
		asker = "file:///wiki/tiddlers/lsp_refs_asker.tid",
		text = "title: lsp_refs_asker\n\n<<" + NAME + ">>",
		view = features.virtualUri(title),
		file = features.pathToUri(filepath),
		listed = () => features.references(asker, text, positionOf(text, NAME, 1), { includeDeclaration: false }, { [asker]: text }).map((l) => l.uri);
	$tw.wiki.addTiddler({ title: title, text: "<<" + NAME + ">>" });
	fs.writeFileSync(filepath, "title: " + title + "\n\n<<" + NAME + ">>");
	try {
		assert.ok(listed().includes(view), "without a file, the tiddler is searched as its view");
		// Filed without a change to the wiki, as a save can do.
		$tw.boot.files[title] = { filepath: filepath, type: "application/x-tiddler", hasMetaFile: false };
		const after = listed();
		assert.ok(after.includes(file), "the file is searched");
		assert.ok(!after.includes(view), "the view is not searched as well");
	} finally {
		delete $tw.boot.files[title];
		$tw.wiki.deleteTiddler(title);
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("every location is a file on disk, or the read-only view of a tiddler without one", () => {
	// $:/language/Snippets/ListByTag calls list-links but has no file, so its view is listed.
	withFiles({ lsp_refs_d: "<<list-links>>" }, (docs) => {
		const locations = referencesFrom(docs.lsp_refs_d, "<<list-links>>", 4, false);
		const onDisk = new Set(Object.values($tw.boot.files).filter((e) => e.filepath).map((e) => features.sameFileKey(features.pathToUri(e.filepath))));
		assert.ok(locations.some((location) => location.uri === features.virtualUri("$:/language/Snippets/ListByTag")), "the shadow must be listed as its view");
		for(const location of locations) {
			assert.ok(onDisk.has(features.sameFileKey(location.uri)) || features.isVirtualUri(location.uri), "neither a file nor a view: " + location.uri);
		}
	});
});
