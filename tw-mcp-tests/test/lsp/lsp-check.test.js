"use strict";

/*
Pins "List undefined calls and widgets" (lsp-check.js and the
tiddlywiki/undefinedCalls request): every .tid file the wiki saves to is read
from disk, or from its live text while open in the editor, and its undefined
calls are reported as information, which the Problems panel lists, instead of a
hint, which it leaves out. A missing link target is left to open files.

By hand, in a booted test edition:

  const f = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-features.js");
  const listed = f.listUndefinedCalls({});
  f.summarizeUndefinedCalls(listed);
  // -> {files: <.tid files in $tw.boot.files>, undefinedCalls: <n>}
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { bootTw, loadHandler } = require("../setup");

const FEATURES_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-features.js";
const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const TITLE = "$:/temp/tw-mcp-tests/check/probe";
const WARNING = 2;
const INFORMATION = 3;
const HINT = 4;
const TEXT = "title: " + TITLE + "\n\nSee [[lsp.ck missing]] and <<lsp.ck-typo>>.\n";
// The same tiddler as edited in the editor, unsaved: two undefined calls where the file has one.
const LIVE_TEXT = "title: " + TITLE + "\n\n<<lsp.ck-live>> <<lsp.ck-live2>>\n";

let $tw;
let features;
let lib;

before(async () => {
	$tw = await bootTw();
	features = loadHandler($tw, FEATURES_TITLE);
	lib = loadHandler($tw, LIB_TITLE);
});

// Test scaffolding: a .tid in a throwaway folder, filed in $tw.boot.files as the wiki's own.
function withFile(fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-lsp-check-")),
		filepath = path.join(dir, "probe.tid");
	fs.writeFileSync(filepath, TEXT);
	$tw.boot.files[TITLE] = { filepath: filepath, type: "application/x-tiddler", hasMetaFile: false };
	try {
		fn(features.pathToUri(filepath), filepath);
	} finally {
		delete $tw.boot.files[TITLE];
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

function brief(diagnostics) {
	return diagnostics.map((d) => ({ severity: d.severity, message: d.message }));
}

test("every .tid file is read from disk for undefined calls, reported as information, missing links left to open files", () => {
	withFile((uri) => {
		const listed = features.listUndefinedCalls({}),
			entry = listed.find((e) => e.uri === uri);
		assert.deepEqual(brief(entry.diagnostics), [
			{ severity: INFORMATION, message: "`lsp.ck-typo` is not defined or set anywhere in this wiki" }
		]);
		assert.equal(new Set(listed.map((e) => e.uri)).size, listed.length, "each file once");
		assert.deepEqual(brief(features.diagnostics(uri, TEXT)).map((d) => d.severity), [WARNING, HINT], "an open document keeps the hint");
	});
});

test("a file open in the editor is listed from its live text and marked open, under either spelling of its URI", () => {
	withFile((uri, filepath) => {
		const vscodeSpelling = "file:///" + filepath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (m, drive) => drive.toLowerCase() + "%3A"),
			listed = features.listUndefinedCalls({ [vscodeSpelling]: LIVE_TEXT });
		assert.equal(listed.some((e) => e.uri === uri), false, "not read from disk as well");
		const entry = listed.find((e) => e.uri === vscodeSpelling);
		assert.equal(entry.open, true);
		assert.deepEqual(brief(entry.diagnostics).map((d) => d.message), [
			"`lsp.ck-live` is not defined or set anywhere in this wiki",
			"`lsp.ck-live2` is not defined or set anywhere in this wiki"
		]);
	});
});

test("an open file the wiki does not save to is not listed", () => {
	assert.equal(features.listUndefinedCalls({ "file:///elsewhere/lsp_ck.tid": LIVE_TEXT }).some((e) => e.open), false);
});

test("the summary counts files and undefined calls", () => {
	withFile(() => {
		const listed = features.listUndefinedCalls({});
		assert.deepEqual(features.summarizeUndefinedCalls(listed), {
			files: listed.length,
			undefinedCalls: [].concat(...listed.map((e) => e.diagnostics)).length
		});
	});
});

test("tiddlywiki/undefinedCalls publishes every file read and answers the summary", () => {
	withFile((uri) => {
		const sent = [],
			session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} });
		session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
		session.dispatch({ jsonrpc: "2.0", id: 2, method: "tiddlywiki/undefinedCalls", params: {} });
		const published = sent.filter((m) => m.method === "textDocument/publishDiagnostics"),
			answer = sent.find((m) => m.id === 2).result;
		assert.equal(published.length, answer.files);
		assert.deepEqual(brief(published.find((m) => m.params.uri === uri).params.diagnostics).map((d) => d.severity), [INFORMATION]);
	});
});

// A session whose timers run at once: what it published for uri, last and how often, and its answer to request id.
function openSession() {
	const sent = [],
		session = lib.createSession((message) => sent.push(message), { schedule: (fn) => { fn(); return 0; }, cancel: () => {} }),
		publishedFor = (uri) => sent.filter((m) => m.method === "textDocument/publishDiagnostics" && m.params.uri === uri);
	session.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
	return {
		send: (method, params, id) => session.dispatch(Object.assign({ jsonrpc: "2.0", method: method, params: params }, id === undefined ? {} : { id: id })),
		last: (uri) => publishedFor(uri).pop().params.diagnostics.map((d) => d.severity),
		published: (uri) => publishedFor(uri).length,
		answer: (id) => sent.find((m) => m.id === id).result
	};
}

test("the summary counts a file open in the editor from its live text, which is published once", () => {
	withFile((uri) => {
		const s = openSession();
		s.send("tiddlywiki/undefinedCalls", {}, 2);
		const closed = s.answer(2);
		s.send("textDocument/didOpen", { textDocument: { uri: uri, text: LIVE_TEXT, version: 1 } });
		const before = s.published(uri);
		s.send("tiddlywiki/undefinedCalls", {}, 3);
		assert.deepEqual(s.answer(3), { files: closed.files, undefinedCalls: closed.undefinedCalls + 1 }, "the file's one call on disk counts as its two live ones");
		assert.equal(s.published(uri), before + 1);
		assert.deepEqual(s.last(uri), [INFORMATION, INFORMATION]);
	});
});

test("once listed, an open file keeps its undefined calls listed, and closing it puts the listed ones back", () => {
	withFile((uri) => {
		const s = openSession();
		s.send("textDocument/didOpen", { textDocument: { uri: uri, text: TEXT, version: 1 } });
		assert.deepEqual(s.last(uri), [WARNING, HINT], "before listing: a hint, which the panel leaves out");
		s.send("textDocument/didClose", { textDocument: { uri: uri } });
		assert.deepEqual(s.last(uri), [], "before listing: closing clears");
		s.send("textDocument/didOpen", { textDocument: { uri: uri, text: TEXT, version: 2 } });
		s.send("tiddlywiki/undefinedCalls", {}, 2);
		assert.deepEqual(s.last(uri), [WARNING, INFORMATION], "the open file is listed from its live text");
		s.send("textDocument/didChange", { textDocument: { uri: uri, version: 3 }, contentChanges: [{ text: TEXT + "\n" }] });
		assert.deepEqual(s.last(uri), [WARNING, INFORMATION]);
		s.send("textDocument/didClose", { textDocument: { uri: uri } });
		assert.deepEqual(s.last(uri), [INFORMATION], "closed again: the listed ones, from disk");
	});
});

test("once listed, closing a file the wiki does not save to still clears it", () => {
	const uri = "file:///elsewhere/lsp_ck.tid",
		s = openSession();
	s.send("tiddlywiki/undefinedCalls", {}, 2);
	s.send("textDocument/didOpen", { textDocument: { uri: uri, text: "title: lsp_ck\n\n<<lsp.ck-typo>>\n", version: 1 } });
	assert.deepEqual(s.last(uri), [INFORMATION]);
	s.send("textDocument/didClose", { textDocument: { uri: uri } });
	assert.deepEqual(s.last(uri), []);
});

test("a quick fix attaches to the information entry the editor shows", () => {
	const body = "title: x\n\n<$lisst/>\n",
		hint = features.diagnostics("file:///x.tid", body).find((d) => d.severity === HINT),
		shown = Object.assign({}, hint, { severity: INFORMATION }),
		actions = features.codeActions("file:///x.tid", body, hint.range, { diagnostics: [shown] });
	assert.deepEqual(actions.map((a) => a.title), ["Change to $list"]);
	assert.deepEqual(actions[0].diagnostics, [shown]);
});
