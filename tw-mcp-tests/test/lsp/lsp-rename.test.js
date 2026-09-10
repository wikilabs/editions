"use strict";

/*
Pins rename: a definition with every call that reaches it, across files for a
global; a parameter with its declaration, uses, $param$ substitutions and named
arguments; and each refusal with its reason.

To replicate by hand, boot the test edition and ask:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const text = "title: x\n\n\\procedure p() z\n<<p>>";
  f.rename("file:///x.tid", text, {line: 3, character: 2}, "q", {}, {});
  // -> {changes: {"file:///x.tid": [{range: <p on line 2>, newText: "q"}, {range: <p on line 3>, newText: "q"}]}}
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const URI = "file:///wiki/tiddlers/lsp_rn.tid";

const TEXT = [
	"title: lsp_rn",
	"",
	"\\procedure lsp.rn.p(tag, sort) <<tag>>",
	"\\procedure lsp.rn.outer(lsp.rn.p) <<lsp.rn.p>>",
	"\\define lsp.rn.m(tag) $tag$ <<tag>>",
	"\\widget $lsp.rn.w(x) <$slot $name=\"ts-raw\"/>",
	"\\function lsp.rn.f() [[z]]",
	"",
	"<<lsp.rn.p tag:\"x\">> <<lsp.rn.p>>",
	"<$let tag=\"v\"><<tag>></$let>",
	"<<currentTiddler>> <<now>> <<list-links>> <<lsp.rn.m>>"
].join("\n");

const DEFS = "$:/temp/tw-mcp-tests/rename/defs";
const USER = "$:/temp/tw-mcp-tests/rename/user";
const NOFILE = "$:/temp/tw-mcp-tests/rename/nofile";
const OTHER = "$:/temp/tw-mcp-tests/rename/other";

let $tw;
let features;
let lib;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

// The position of the nth needle in text, into characters inside it.
function at(text, needle, into, nth) {
	let index = -1;
	for(let i = 0; i <= (nth || 0); i++) {
		index = text.indexOf(needle, index + 1);
	}
	assert.ok(index >= 0, "fixture must contain " + needle);
	const lines = text.slice(0, index).split("\n");
	return { line: lines.length - 1, character: lines[lines.length - 1].length + (into || 0) };
}

function prepare(needle, into, nth) {
	return features.prepareRename(URI, TEXT, at(TEXT, needle, into, nth), {});
}

function rename(needle, into, nth, newName, options) {
	return features.rename(URI, TEXT, at(TEXT, needle, into, nth), newName, options || {}, {});
}

// Each edit of a plain answer as "line:character", sorted.
function edited(result) {
	assert.ok(!result.error, result.error);
	return (result.changes[URI] || []).map((edit) => edit.range.start.line + ":" + edit.range.start.character).sort();
}

// --- What is renamed ---

test("prepare names what would be renamed, and where", () => {
	const prepared = prepare("<<lsp.rn.p tag", 2);
	assert.equal(prepared.placeholder, "lsp.rn.p");
	assert.deepEqual(prepared.range, { start: { line: 8, character: 2 }, end: { line: 8, character: 10 } });
	assert.ok(prepare("title").error.startsWith("Nothing to rename here"));
});

test("a definition is renamed with the calls that reach it, not a parameter of the same name", () => {
	assert.deepEqual(edited(rename("<<lsp.rn.p tag", 2, 0, "lsp.rn.q")), ["2:11", "8:2", "8:23"]);
});

test("a parameter is renamed at its declaration, its uses and the named arguments of calls", () => {
	const result = rename("<<tag>>", 2, 0, "label", { annotations: true }),
		edits = result.documentChanges[0].edits;
	assert.deepEqual(edits.map((edit) => edit.range.start.line + ":" + edit.range.start.character).sort(), ["2:20", "2:33", "8:11"]);
	assert.ok(edits.every((edit) => edit.annotationId), "every parameter edit opens the preview");
	assert.equal(Object.values(result.changeAnnotations)[0].needsConfirmation, true);
});

test("a parameter can be renamed from its declaration", () => {
	assert.deepEqual(edited(rename("sort)", 0, 0, "order")), ["2:25"]);
});

test("a \\define's $param$ substitution is renamed with the parameter", () => {
	assert.deepEqual(edited(rename("m(tag)", 2, 0, "label")), ["4:17", "4:23", "4:30"]);
});

// --- What is refused ---

test("names TiddlyWiki sets, code defines, a widget binds or no file holds are refused", () => {
	assert.ok(prepare("currentTiddler").error.includes("set by TiddlyWiki itself"));
	assert.ok(prepare("<<now", 2).error.includes("JavaScript macro"));
	assert.ok(prepare("<<tag>></$let>", 2).error.includes("widget's variable"));
	assert.ok(prepare("list-links").error.includes("without a file of its own"));
	assert.ok(prepare("$lsp.rn.w").error.includes("\\widget"));
});

test("a global defined in a tiddler without a file is refused, even with no call in one", () => {
	const title = "$:/temp/tw-mcp-tests/rename/viewdefs",
		text = "title: lsp_rn\n\n<<lsp.rn.v>>";
	$tw.wiki.addTiddler({ title: title, tags: "$:/tags/Global", text: "\\procedure lsp.rn.v() x" });
	try {
		const prepared = features.prepareRename(URI, text, at(text, "lsp.rn.v"), {});
		assert.ok(prepared.error && prepared.error.includes("is defined in `" + title + "`"), JSON.stringify(prepared));
	} finally {
		$tw.wiki.deleteTiddler(title);
	}
});

test("a new name that is no name, or already means something, is refused", () => {
	assert.ok(rename("<<lsp.rn.p tag", 2, 0, "a b").error.includes("not a name"));
	assert.ok(rename("<<lsp.rn.p tag", 2, 0, "lsp.rn.m").error.includes("already defined beside"));
	assert.ok(rename("<<lsp.rn.p tag", 2, 0, "currentTiddler").error.includes("set by TiddlyWiki itself"));
	assert.ok(rename("<<tag>>", 2, 0, "sort").error.includes("already a parameter"));
	assert.ok(rename("lsp.rn.f", 0, 0, "lsprnf").error.includes("needs a dot"));
	// list-links is a global, so a call of lsp.rn.p would reach it instead.
	assert.ok(rename("<<lsp.rn.p tag", 2, 0, "list-links").error.includes("already means something"));
});

test("a parameter is not renamed to a name its body already calls", () => {
	const text = "title: lsp_rn\n\n\\procedure lsp.rn.u(a) <<a>> <<b>>";
	assert.ok(features.rename(URI, text, at(text, "(a)", 1), "b", {}, {}).error.includes("already used inside"));
});

// --- Across files ---

// Test scaffolding: DEFS holds a global procedure, USER calls it, OTHER calls a
// local namesake; all are .tid files filed in $tw.boot.files, and DEFS is in the
// wiki so TiddlyWiki resolves it.
function withGlobal(fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-rename-")),
		defs = { title: DEFS, path: path.join(dir, "defs.tid"), text: "title: " + DEFS + "\ntags: $:/tags/Global\n\n\\procedure lsp.rn.g(a) x" },
		user = { title: USER, path: path.join(dir, "user.tid"), text: "title: " + USER + "\n\n<<lsp.rn.g a:\"1\">>" },
		other = { title: OTHER, path: path.join(dir, "other.tid"), text: "title: " + OTHER + "\n\n\\procedure lsp.rn.g() mine\n<<lsp.rn.g>>" };
	[defs, user, other].forEach((doc) => {
		fs.writeFileSync(doc.path, doc.text);
		doc.uri = features.pathToUri(doc.path);
		$tw.boot.files[doc.title] = { filepath: doc.path, type: "application/x-tiddler", hasMetaFile: false };
	});
	$tw.wiki.addTiddler({ title: DEFS, tags: "$:/tags/Global", text: "\\procedure lsp.rn.g(a) x" });
	try {
		fn(defs, user, other);
	} finally {
		[DEFS, USER, OTHER, NOFILE].forEach((title) => {
			delete $tw.boot.files[title];
			$tw.wiki.deleteTiddler(title);
		});
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

function changesFor(result, uri) {
	return result.documentChanges.filter((change) => features.sameFileKey(change.textDocument.uri) === features.sameFileKey(uri))[0];
}

test("a global is renamed in its file and at calls in other files, those opening the preview", () => {
	withGlobal((defs, user, other) => {
		const result = features.rename(user.uri, user.text, at(user.text, "lsp.rn.g", 1), "lsp.rn.h", { annotations: true }, { [user.uri]: user.text });
		assert.ok(!result.error, result.error);
		const inDefs = changesFor(result, defs.uri),
			inUser = changesFor(result, user.uri);
		assert.equal(inDefs.edits.length, 1);
		assert.equal(inDefs.edits[0].annotationId !== undefined, true, "an edit in another file opens the preview");
		assert.equal(inUser.edits.length, 1);
		assert.equal(inUser.edits[0].annotationId, undefined, "the asking file's own edit does not");
		assert.equal(changesFor(result, other.uri), undefined, "a call reaching a local namesake is left alone");
	});
});

test("a global is not renamed to another global's name", () => {
	withGlobal((defs, user) => {
		const result = features.rename(user.uri, user.text, at(user.text, "lsp.rn.g", 1), "list-links", {}, { [user.uri]: user.text });
		assert.ok(result.error && result.error.includes("already a global"), JSON.stringify(result));
	});
});

test("a global's parameter is renamed at named arguments in other files", () => {
	withGlobal((defs, user) => {
		const result = features.rename(defs.uri, defs.text, at(defs.text, "(a)", 1), "b", { annotations: true }, { [defs.uri]: defs.text }),
			inUser = changesFor(result, user.uri);
		assert.ok(inUser, JSON.stringify(result));
		assert.deepEqual(inUser.edits.map((edit) => edit.range.start), [at(user.text, "a:")]);
	});
});

test("a call in a tiddler without a file refuses the rename", () => {
	withGlobal((defs, user) => {
		$tw.wiki.addTiddler({ title: NOFILE, text: "<<lsp.rn.g>>" });
		const result = features.rename(user.uri, user.text, at(user.text, "lsp.rn.g", 1), "lsp.rn.h", {}, { [user.uri]: user.text });
		assert.ok(result.error && result.error.includes(NOFILE), JSON.stringify(result));
	});
});

// --- Protocol ---

test("the server advertises rename with prepare, refuses with a reason, and previews when it can", () => {
	const sent = [];
	const session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
	session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: { capabilities: { workspace: { workspaceEdit: { documentChanges: true, changeAnnotationSupport: {} } } } } });
	assert.deepEqual(sent[0].result.capabilities.renameProvider, { prepareProvider: true });
	session.dispatch({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: URI, text: TEXT, version: 1 } } });
	session.dispatch({ jsonrpc: "2.0", id: 2, method: "textDocument/prepareRename", params: { textDocument: { uri: URI }, position: at(TEXT, "<<now", 2) } });
	session.dispatch({ jsonrpc: "2.0", id: 3, method: "textDocument/rename", params: { textDocument: { uri: URI }, position: at(TEXT, "<<tag>>", 2), newName: "label" } });
	const refused = sent.find((message) => message.id === 2),
		renamed = sent.find((message) => message.id === 3);
	assert.equal(refused.error.code, -32803);
	assert.ok(refused.error.message.includes("JavaScript macro"));
	assert.ok(renamed.result.documentChanges, JSON.stringify(renamed));
});
