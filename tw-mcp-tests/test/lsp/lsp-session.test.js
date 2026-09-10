"use strict";

/*
Pins the LSP lifecycle served by lsp-lib.js.

LSP is stateful where MCP is not: a connection must be initialized before it
answers anything, it mirrors the buffers the client opens, and it stops
answering after shutdown. Those rules are the reason --lsp is its own command
rather than a mode of --mcp, so they are worth pinning outright.

These tests drive createSession directly, which is the whole message path minus
the Content-Length framing. To replicate by hand, boot the test edition and
build a session whose send() just logs:

  const lib = $tw.modules.execute("$:/core/modules/commands/inspect/lsp/lsp-lib.js");
  const s = lib.createSession((m) => console.log(JSON.stringify(m)), {});
  s.dispatch({jsonrpc:"2.0", id:1, method:"initialize", params:{}});
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const LIB_TITLE = "$:/core/modules/commands/inspect/lsp/lsp-lib.js";
const URI = "file:///wiki/tiddlers/probe.tid";

const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const SERVER_NOT_INITIALIZED = -32002;
const SYNC_FULL = 1;

let createSession;

before(async () => {
	const $tw = await bootTw();
	createSession = loadHandler($tw, LIB_TITLE).createSession;
});

// Diagnostics are debounced, so the session takes its timer from the caller.
// Running it immediately keeps every test that is not about debouncing free of
// sleeps and of timing flake.
const IMMEDIATE = {
	schedule: (fn) => { fn(); return 0; },
	cancel: () => {}
};

// A queue the test drains by hand, for the tests that ARE about debouncing.
function manualTimer() {
	const queue = [];
	return {
		schedule: (fn) => queue.push(fn) - 1,
		cancel: (handle) => { queue[handle] = null; },
		pending: () => queue.filter(Boolean).length,
		run: () => {
			const due = queue.slice();
			queue.length = 0;
			due.forEach((fn) => fn && fn());
		}
	};
}

// A session plus the messages it has sent. Each test gets its own, because a
// connection's state is exactly what is under test here.
function newSession(options) {
	const sent = [];
	const session = createSession((message) => sent.push(message), Object.assign({}, IMMEDIATE, options || {}));
	return {
		sent: sent,
		request: (id, method, params) => {
			session.dispatch({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
			return sent[sent.length - 1];
		},
		notify: (method, params) => {
			session.dispatch({ jsonrpc: "2.0", method: method, params: params || {} });
		},
		documents: session.documents,
		dispose: () => session.dispose()
	};
}

function initialized(options) {
	const s = newSession(options);
	s.request(1, "initialize", {});
	s.notify("initialized", {});
	s.sent.length = 0;
	return s;
}

// The last publishDiagnostics for a uri, or null if none was sent.
function lastDiagnostics(session, uri) {
	for(let i = session.sent.length - 1; i >= 0; i--) {
		const m = session.sent[i];
		if(m.method === "textDocument/publishDiagnostics" && m.params.uri === uri) {
			return m.params;
		}
	}
	return null;
}

function tid(body) {
	return "title: probe\n\n" + body;
}

// --- Lifecycle ---

test("a request before initialize is refused", () => {
	const s = newSession();
	const reply = s.request(1, "textDocument/completion", {
		textDocument: { uri: URI },
		position: { line: 0, character: 0 }
	});
	assert.equal(reply.error.code, SERVER_NOT_INITIALIZED);
});

test("a notification before initialize is ignored rather than answered", () => {
	const s = newSession();
	s.notify("textDocument/didOpen", { textDocument: { uri: URI, text: "x" } });
	assert.deepEqual(s.sent, []);
});

test("initialize advertises full sync and the completion trigger characters", () => {
	const s = newSession();
	const reply = s.request(1, "initialize", { clientInfo: { name: "probe", version: "1" } });
	const caps = reply.result.capabilities;
	assert.equal(caps.textDocumentSync.openClose, true);
	assert.equal(caps.textDocumentSync.change, SYNC_FULL);
	assert.deepEqual(caps.completionProvider.triggerCharacters, ["[", "{", "<", "$", "\"", "=", " "]);
	// An unadvertised capability is never requested, so a feature can be fully
	// implemented and fully tested and still be dead in the editor.
	assert.equal(caps.hoverProvider, true);
	assert.equal(caps.definitionProvider, true);
	assert.equal(caps.referencesProvider, true);
	assert.equal(reply.result.serverInfo.name, "tiddlywiki-lsp");
	assert.ok(reply.result.serverInfo.version, "serverInfo must carry a version");
});

test("references are answered for an open document, and null for one never opened", () => {
	const s = initialized();
	s.notify("textDocument/didOpen", {
		textDocument: { uri: URI, version: 1, text: tid("\\procedure lsp.refs.session() x\n\n<<lsp.refs.session>>") }
	});
	const reply = s.request(2, "textDocument/references", {
		textDocument: { uri: URI },
		position: { line: 4, character: 4 },
		context: { includeDeclaration: true }
	});
	// The definition on line 2 and the call on line 4.
	assert.deepEqual(reply.result.map((l) => l.range.start.line), [2, 4]);
	const unopened = s.request(3, "textDocument/references", {
		textDocument: { uri: "file:///wiki/tiddlers/never-opened.tid" },
		position: { line: 0, character: 0 },
		context: { includeDeclaration: true }
	});
	assert.equal(unopened.result, null);
});

test("shutdown answers null and then refuses further requests", () => {
	const s = initialized();
	const bye = s.request(2, "shutdown", {});
	assert.equal(bye.result, null);
	assert.equal(bye.error, undefined);
	const after = s.request(3, "textDocument/completion", {
		textDocument: { uri: URI },
		position: { line: 0, character: 0 }
	});
	assert.equal(after.error.code, INVALID_REQUEST);
});

test("exit reports whether shutdown came first, so a caller can pick its code", () => {
	let clean = null;
	const s = initialized({ onExit: (cleanShutdown) => { clean = cleanShutdown; } });
	s.notify("exit", {});
	assert.equal(clean, false, "exit without shutdown is not a clean close");

	let cleanAfterShutdown = null;
	const t = initialized({ onExit: (cleanShutdown) => { cleanAfterShutdown = cleanShutdown; } });
	t.request(2, "shutdown", {});
	t.notify("exit", {});
	assert.equal(cleanAfterShutdown, true);
});

test("an unknown request is a method-not-found, an unknown notification is silence", () => {
	const s = initialized();
	assert.equal(s.request(2, "textDocument/nonesuch", {}).error.code, METHOD_NOT_FOUND);
	s.sent.length = 0;
	s.notify("textDocument/nonesuch", {});
	assert.deepEqual(s.sent, []);
});

// --- Document sync ---

test("didOpen mirrors the buffer and publishes its diagnostics", () => {
	const s = initialized();
	s.notify("textDocument/didOpen", {
		textDocument: { uri: URI, version: 1, text: tid("See [[lsp_no_such_tiddler]].\n") }
	});
	const published = lastDiagnostics(s, URI);
	assert.ok(published, "didOpen must publish diagnostics");
	assert.equal(published.version, 1);
	assert.equal(published.diagnostics.length, 1);
	assert.equal(s.documents[URI], tid("See [[lsp_no_such_tiddler]].\n"));
});

test("didChange replaces the buffer, and the diagnostics follow it", () => {
	const s = initialized();
	s.notify("textDocument/didOpen", {
		textDocument: { uri: URI, version: 1, text: tid("See [[lsp_no_such_tiddler]].\n") }
	});
	s.notify("textDocument/didChange", {
		textDocument: { uri: URI, version: 2 },
		contentChanges: [{ text: tid("See [[lsp_link_target]].\n") }]
	});
	const published = lastDiagnostics(s, URI);
	assert.equal(published.version, 2);
	assert.deepEqual(published.diagnostics, [], "the broken link was fixed, so the warning must go");
});

test("a burst of edits produces one diagnostics pass, for the last of them", () => {
	// Every keystroke is a didChange. Recomputing on each one would reparse the
	// document per character and squiggle a link the reader is halfway through
	// writing, so only a pause in typing publishes.
	const timer = manualTimer();
	const s = initialized({ schedule: timer.schedule, cancel: timer.cancel });
	s.notify("textDocument/didOpen", {
		textDocument: { uri: URI, version: 1, text: tid("clean") }
	});
	s.sent.length = 0;
	s.notify("textDocument/didChange", {
		textDocument: { uri: URI, version: 2 },
		contentChanges: [{ text: tid("See [[lsp_no_such_tiddler]].") }]
	});
	s.notify("textDocument/didChange", {
		textDocument: { uri: URI, version: 3 },
		contentChanges: [{ text: tid("See [[lsp_link_target]].") }]
	});
	assert.deepEqual(s.sent, [], "nothing may be published while typing continues");
	assert.equal(timer.pending(), 1, "the earlier pass must be cancelled, not queued");

	timer.run();
	const published = lastDiagnostics(s, URI);
	assert.equal(published.version, 3, "the pass must report the newest version");
	assert.deepEqual(published.diagnostics, [], "and the newest text, whose link resolves");
});

test("a closed document cancels the diagnostics pass still waiting for it", () => {
	const timer = manualTimer();
	const s = initialized({ schedule: timer.schedule, cancel: timer.cancel });
	s.notify("textDocument/didOpen", { textDocument: { uri: URI, version: 1, text: tid("x") } });
	s.notify("textDocument/didChange", {
		textDocument: { uri: URI, version: 2 },
		contentChanges: [{ text: tid("See [[lsp_no_such_tiddler]].") }]
	});
	s.notify("textDocument/didClose", { textDocument: { uri: URI } });
	assert.equal(timer.pending(), 0, "a pass for a closed document must not survive it");
});

test("a dropped connection cancels every pass it left waiting", () => {
	// Each pending pass holds a send() into a socket that is gone.
	const timer = manualTimer();
	const s = initialized({ schedule: timer.schedule, cancel: timer.cancel });
	s.notify("textDocument/didOpen", { textDocument: { uri: URI, version: 1, text: tid("x") } });
	s.notify("textDocument/didChange", {
		textDocument: { uri: URI, version: 2 },
		contentChanges: [{ text: tid("y") }]
	});
	assert.equal(timer.pending(), 1);
	s.dispose();
	assert.equal(timer.pending(), 0);
});

test("didClose drops the buffer and clears the squiggles", () => {
	const s = initialized();
	s.notify("textDocument/didOpen", {
		textDocument: { uri: URI, version: 1, text: tid("See [[lsp_no_such_tiddler]].\n") }
	});
	s.sent.length = 0;
	s.notify("textDocument/didClose", { textDocument: { uri: URI } });
	assert.deepEqual(lastDiagnostics(s, URI).diagnostics, []);
	assert.equal(s.documents[URI], undefined);
});

// --- Completion ---

test("completion answers from the mirrored buffer", () => {
	const s = initialized();
	s.notify("textDocument/didOpen", {
		textDocument: { uri: URI, version: 1, text: tid("See [[lsp_link") }
	});
	const reply = s.request(2, "textDocument/completion", {
		textDocument: { uri: URI },
		position: { line: 2, character: 14 }
	});
	const labels = reply.result.items.map((i) => i.label);
	assert.ok(labels.includes("lsp_link_target"), "expected the fixture title in " + labels.join(", "));
});

// --- Hover ---

test("hover answers from the mirrored buffer", () => {
	const s = initialized();
	s.notify("textDocument/didOpen", {
		textDocument: { uri: URI, version: 1, text: tid("{{{ [[lsp_link_target]] }}}") }
	});
	const reply = s.request(2, "textDocument/hover", {
		textDocument: { uri: URI },
		position: { line: 2, character: 10 }
	});
	assert.equal(reply.error, undefined);
	assert.equal(reply.result.contents.kind, "markdown");
	assert.ok(reply.result.contents.value.includes("lsp_link_target"), reply.result.contents.value);
});

test("hover away from a filter is null, which is a valid answer", () => {
	const s = initialized();
	s.notify("textDocument/didOpen", {
		textDocument: { uri: URI, version: 1, text: tid("just prose") }
	});
	const reply = s.request(2, "textDocument/hover", {
		textDocument: { uri: URI },
		position: { line: 2, character: 4 }
	});
	assert.equal(reply.error, undefined);
	assert.equal(reply.result, null);
});

test("definition answers a file URI from the mirrored buffer", () => {
	const s = initialized();
	s.notify("textDocument/didOpen", {
		textDocument: { uri: URI, version: 1, text: tid("See [[lsp_link_target]].") }
	});
	const reply = s.request(2, "textDocument/definition", {
		textDocument: { uri: URI },
		position: { line: 2, character: 10 }
	});
	assert.equal(reply.error, undefined);
	assert.ok(reply.result.uri.endsWith("lsp_link_target.tid"), reply.result.uri);
});

// --- Failure containment ---

test("a handler that throws answers an error instead of taking the process down", () => {
	// This server shares a process with --mcp and the browser, so one bad
	// request must not reach process level. A request naming no textDocument
	// stands in for any input a handler did not anticipate.
	const s = initialized();
	const reply = s.request(2, "textDocument/hover", {});
	assert.ok(reply.error, "expected an error response, got " + JSON.stringify(reply.result));
	assert.equal(reply.error.code, -32603);
});

test("the connection still answers after a handler has thrown", () => {
	const s = initialized();
	s.request(2, "textDocument/hover", {});
	const after = s.request(3, "textDocument/completion", {
		textDocument: { uri: "file:///never-opened.tid" },
		position: { line: 0, character: 0 }
	});
	assert.equal(after.error, undefined, "the session must survive a failed request");
	assert.deepEqual(after.result, { isIncomplete: false, items: [] });
});

test("completion in a document the client never opened is empty, not an error", () => {
	const s = initialized();
	const reply = s.request(2, "textDocument/completion", {
		textDocument: { uri: "file:///wiki/tiddlers/never-opened.tid" },
		position: { line: 0, character: 0 }
	});
	assert.equal(reply.error, undefined);
	assert.deepEqual(reply.result, { isIncomplete: false, items: [] });
});
