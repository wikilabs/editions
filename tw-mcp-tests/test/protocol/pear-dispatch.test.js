"use strict";

/*
Pins the protocol contract served by PEAR MODE (`--mcp pear=<accountDir>`),
which answers from a running Facets app rather than this process's wiki.

mcp-pear.js was migrated to MCP 2026-07-28 with no coverage at all, because its
dispatcher was a closure inside the entry point and reaching it meant dialling a
running app over its agent pipe (bead tw-mcp-server-i1k). createPearSession is
that dispatcher with the pipe client handed in, so a fake bridge stands in for
the app and these tests never touch a socket.

What the fake bridge stands for: the app's side of the NDJSON frame exchange
({v:1,id,cmd,args} -> {id,ok,result|error}) plus the scope the handshake
settled on. Everything else here is the server's own behaviour.

To replicate by hand, boot the test edition and build a session:

  const pear = $tw.modules.execute("$:/core/modules/commands/inspect/mcp/mcp-pear.js");
  const out = [];
  const s = pear.createPearSession({
    pearDir: "C:/nowhere",
    send: (line) => out.push(JSON.parse(line)),
    makeBridge: () => ({
      ready: (cb) => cb(null),
      call: (cmd, args, cb) => cb(null, {ok: true, result: {text: "hi from the app"}}),
      effectiveRw: () => false,
      readDiscovery: () => ({name: "demo", mode: "ro", pipe: "\\\\.\\pipe\\x"})
    })
  });
  s.dispatch(JSON.stringify({jsonrpc:"2.0",id:1,method:"server/discover"}));
  console.log(out);
*/

const { test, before, beforeEach } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const PEAR_TITLE = "$:/core/modules/commands/inspect/mcp/mcp-pear.js";

const PROTOCOL = "2026-07-28";
const LEGACY_PROTOCOL = "2025-11-25";
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";
const META_SUBSCRIPTION_ID = "io.modelcontextprotocol/subscriptionId";
const UNSUPPORTED_VERSION = -32022;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const PARSE_ERROR = -32700;

let createPearSession;
let sent;      // every line the session wrote, parsed
let bridge;    // the fake app
let session;

before(async () => {
	const $tw = await bootTw();
	createPearSession = loadHandler($tw, PEAR_TITLE).createPearSession;
});

// A fake Facets app: answers frames from a table, and its scope can flip the
// way a real handshake's can (the app comes up, an agent gets approved).
function fakeBridge(options) {
	const opts = options || {};
	const state = {
		rw: !!opts.rw,
		calls: [],
		readyErr: opts.readyErr || null,
		answer: opts.answer || { ok: true, result: { text: "from the app" } },
		onHandshake: null
	};
	state.bridge = {
		ready(cb) { cb(state.readyErr); },
		call(cmd, args, cb) {
			state.calls.push({ cmd, args });
			if(state.readyErr) return cb(state.readyErr);
			cb(null, state.answer);
		},
		effectiveRw() { return state.rw; },
		readDiscovery() { return opts.discovery === undefined ? { name: "demo", mode: state.rw ? "rw" : "ro", pipe: "\\\\.\\pipe\\demo" } : opts.discovery; }
	};
	// What the real bridge does after a handshake settles in a new scope.
	state.handshakeInto = function(rw) {
		state.rw = rw;
		if(state.onHandshake) state.onHandshake();
	};
	return state;
}

function build(options) {
	bridge = fakeBridge(options);
	sent = [];
	session = createPearSession({
		pearDir: "C:/nowhere",
		send: (line) => sent.push(JSON.parse(line)),
		makeBridge: (onHandshake) => { bridge.onHandshake = onHandshake; return bridge.bridge; }
	});
	return session;
}

// Send one message; return the reply that carries its id, or null.
function ask(message) {
	const before = sent.length;
	session.dispatch(JSON.stringify(message));
	const produced = sent.slice(before);
	return produced.find((m) => m.id === message.id && (m.result !== undefined || m.error !== undefined)) || null;
}

// Everything the session wrote that is a notification (no id at top level).
function notifications() {
	return sent.filter((m) => m.method !== undefined);
}

function versioned(method, params, id) {
	const p = params || {};
	p._meta = p._meta || {};
	p._meta[META_VERSION] = PROTOCOL;
	return { jsonrpc: "2.0", id: id === undefined ? 1 : id, method, params: p };
}

beforeEach(() => { build(); });

// --- discovery and the version gate -----------------------------------------

test("server/discover advertises both eras and says the answers come from the app", () => {
	const reply = ask({ jsonrpc: "2.0", id: "d1", method: "server/discover" });
	assert.ok(reply.result, "expected a result, got " + JSON.stringify(reply.error));
	assert.ok(reply.result.supportedVersions.includes(PROTOCOL));
	assert.ok(reply.result.supportedVersions.includes(LEGACY_PROTOCOL),
		"a dual-era client reads this to decide it need not fall back");
	assert.equal(reply.result.capabilities.tools.listChanged, true);
	assert.match(reply.result.instructions, /PEAR MODE/, "the client must learn its wiki is not the source");
});

test("server/discover needs no declared version, so it can serve as the era probe", () => {
	const reply = ask({ jsonrpc: "2.0", id: 2, method: "server/discover" });
	assert.ok(reply.result);
});

test("a version we do not speak is refused, and the refusal names what we do speak", () => {
	const msg = { jsonrpc: "2.0", id: 3, method: "tools/list", params: { _meta: { [META_VERSION]: "1900-01-01" } } };
	const reply = ask(msg);
	assert.equal(reply.error.code, UNSUPPORTED_VERSION);
	assert.ok(reply.error.data.supported.includes(PROTOCOL));
	assert.equal(reply.error.data.requested, "1900-01-01");
});

test("an ABSENT version is a handshake-era client, not an unsupported one", () => {
	// The distinction the gate must keep: no version declared is how the older
	// era looks, so refusing it would strand every handshake-era client.
	const reply = ask({ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} });
	assert.ok(reply.result, "expected a served result, got " + JSON.stringify(reply.error));
});

// --- the handshake era ------------------------------------------------------

test("initialize echoes a handshake version we speak", () => {
	const reply = ask({ jsonrpc: "2.0", id: 5, method: "initialize", params: { protocolVersion: LEGACY_PROTOCOL } });
	assert.equal(reply.result.protocolVersion, LEGACY_PROTOCOL);
	assert.equal(reply.result.serverInfo.name, "tiddlywiki-mcp");
	assert.match(reply.result.instructions, /PEAR MODE/);
});

test("initialize names a version it speaks when asked for one it does not", () => {
	const reply = ask({ jsonrpc: "2.0", id: 6, method: "initialize", params: { protocolVersion: "1900-01-01" } });
	assert.ok(reply.result.protocolVersion, "the client decides whether to continue, so it must be told one");
	assert.notEqual(reply.result.protocolVersion, "1900-01-01");
});

test("initialize does not claim listChanged, which only the modern era can deliver", () => {
	// The notification rides an open subscriptions/listen. Claiming it here
	// would promise a handshake-era client something never sent.
	const reply = ask({ jsonrpc: "2.0", id: 7, method: "initialize", params: { protocolVersion: LEGACY_PROTOCOL } });
	assert.ok(reply.result.capabilities.tools);
	assert.equal(reply.result.capabilities.tools.listChanged, undefined);
});

test("ping is served in the handshake era and gone in the modern one", () => {
	// Removed in 2026-07-28, but a handshake-era client may use it for liveness.
	const legacy = ask({ jsonrpc: "2.0", id: 8, method: "ping", params: {} });
	assert.ok(legacy.result, "a handshake-era ping must be answered");
	const modern = ask(versioned("ping", {}, 9));
	assert.equal(modern.error.code, METHOD_NOT_FOUND);
});

// --- how a result is stamped ------------------------------------------------

test("a modern result carries resultType and the server's identity", () => {
	// There is no handshake in this era, so every result must say who answered.
	const reply = ask(versioned("tools/list", {}, 10));
	assert.equal(reply.result.resultType, "complete");
	assert.equal(reply.result._meta[META_SERVER_INFO].name, "tiddlywiki-mcp");
	assert.ok(reply.result._meta[META_SERVER_INFO].version);
});

test("a handshake-era result carries neither, having had them at initialize", () => {
	const reply = ask({ jsonrpc: "2.0", id: 11, method: "tools/list", params: {} });
	assert.equal(reply.result.resultType, undefined);
	assert.equal(reply.result._meta, undefined);
});

// --- the tool list ----------------------------------------------------------

test("a readonly scope advertises read tools only", () => {
	const reply = ask(versioned("tools/list", {}, 12));
	const names = reply.result.tools.map((t) => t.name);
	assert.ok(names.includes("get_tiddler"), "read tools must be offered");
	assert.ok(!names.includes("put_tiddler"), "a write tool must not be offered at ro scope");
});

test("an rw scope advertises the write tools too", () => {
	build({ rw: true });
	const reply = ask(versioned("tools/list", {}, 13));
	const names = reply.result.tools.map((t) => t.name);
	assert.ok(names.includes("put_tiddler"), "write tools appear exactly when they are callable");
	assert.ok(names.includes("get_tiddler"));
});

test("the cache hints are sent to a modern client only", () => {
	const modern = ask(versioned("tools/list", {}, 14));
	assert.equal(modern.result.cacheScope, "private", "the list depends on this client's own scope");
	assert.ok(modern.result.ttlMs > 0);
	const legacy = ask({ jsonrpc: "2.0", id: 15, method: "tools/list", params: {} });
	assert.equal(legacy.result.ttlMs, undefined, "the handshake era has no such field");
	assert.equal(legacy.result.cacheScope, undefined);
});

// --- calling a tool ---------------------------------------------------------

test("a known tool forwards to the app and its text passes through", () => {
	const reply = ask(versioned("tools/call", { name: "get_tiddler", arguments: { title: "HelloThere" } }, 16));
	assert.deepEqual(bridge.calls, [{ cmd: "get_tiddler", args: { title: "HelloThere" } }],
		"the tool must be forwarded verbatim, since the app runs the real handler");
	assert.equal(reply.result.content[0].text, "from the app");
});

test("a tool the app does not serve is refused here, not forwarded", () => {
	const reply = ask(versioned("tools/call", { name: "build_wiki", arguments: {} }, 17));
	assert.equal(reply.error.code, INVALID_PARAMS);
	assert.match(reply.error.message, /Unknown tool/);
	assert.equal(bridge.calls.length, 0, "an unserved tool must not reach the app");
});

test("an error from the app is reported as a tool error, not a transport failure", () => {
	build({ answer: { ok: false, error: "staging is locked" } });
	const reply = ask(versioned("tools/call", { name: "get_tiddler", arguments: {} }, 18));
	assert.equal(reply.result.isError, true);
	assert.match(reply.result.content[0].text, /staging is locked/);
});

test("an unreachable app is reported as a tool error the user can act on", () => {
	build({ readyErr: new Error("Facets app not reachable") });
	const reply = ask(versioned("tools/call", { name: "get_tiddler", arguments: {} }, 19));
	assert.equal(reply.result.isError, true);
	assert.match(reply.result.content[0].text, /not reachable/);
});

// --- subscriptions ----------------------------------------------------------

test("subscriptions/listen is acknowledged by a NOTIFICATION, not by its response", () => {
	// The request stays open: its response is what ends the subscription.
	const message = versioned("subscriptions/listen", { notifications: { toolsListChanged: true } }, "s1");
	const reply = ask(message);
	assert.equal(reply, null, "the response must be withheld until the subscription ends");
	const ack = notifications().find((n) => n.method === "notifications/subscriptions/acknowledged");
	assert.ok(ack, "the client must be told its subscription is live");
	assert.equal(ack.params.notifications.toolsListChanged, true);
	assert.equal(ack.params._meta[META_SUBSCRIPTION_ID], "s1", "every notification names the subscription that asked");
});

test("the acknowledgement reports only what is actually honoured", () => {
	// Echoing the request would silently promise notifications never sent.
	const message = versioned("subscriptions/listen", { notifications: { toolsListChanged: true, somethingElse: true } }, "s2");
	ask(message);
	const ack = notifications().find((n) => n.method === "notifications/subscriptions/acknowledged");
	assert.equal(ack.params.notifications.toolsListChanged, true);
	assert.equal(ack.params.notifications.somethingElse, undefined);
});

test("a scope change tells a subscribed client to re-fetch the tool list", () => {
	ask(versioned("subscriptions/listen", { notifications: { toolsListChanged: true } }, "s3"));
	ask(versioned("tools/list", {}, 20));	// what was advertised is now known
	bridge.handshakeInto(true);				// the app came up at rw
	const changed = notifications().filter((n) => n.method === "notifications/tools/list_changed");
	assert.equal(changed.length, 1, "the write set became callable, so the list must be re-fetched");
	assert.equal(changed[0].params._meta[META_SUBSCRIPTION_ID], "s3");
});

test("nothing is sent to a client that did not subscribe", () => {
	// This revision forbids an unsolicited notification.
	ask(versioned("tools/list", {}, 21));
	bridge.handshakeInto(true);
	assert.equal(notifications().length, 0);
});

test("a scope change before any tools/list notifies nobody", () => {
	// There is no advertised list to contradict yet.
	ask(versioned("subscriptions/listen", { notifications: { toolsListChanged: true } }, "s4"));
	bridge.handshakeInto(true);
	assert.equal(notifications().filter((n) => n.method === "notifications/tools/list_changed").length, 0);
});

test("a handshake that does not change the scope notifies nobody", () => {
	ask(versioned("subscriptions/listen", { notifications: { toolsListChanged: true } }, "s5"));
	ask(versioned("tools/list", {}, 22));
	bridge.handshakeInto(false);
	assert.equal(notifications().filter((n) => n.method === "notifications/tools/list_changed").length, 0);
});

test("cancelling the request that opened a subscription ends it", () => {
	// On stdio there is no stream to close, so this is how a client unsubscribes.
	ask(versioned("subscriptions/listen", { notifications: { toolsListChanged: true } }, "s6"));
	ask(versioned("tools/list", {}, 23));
	session.dispatch(JSON.stringify({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: "s6" } }));
	bridge.handshakeInto(true);
	assert.equal(notifications().filter((n) => n.method === "notifications/tools/list_changed").length, 0);
});

test("closing answers every open subscription, so a clean shutdown is not a dropped pipe", () => {
	ask(versioned("subscriptions/listen", { notifications: { toolsListChanged: true } }, "s7"));
	session.closeSubscriptions();
	const reply = sent.find((m) => m.id === "s7" && m.result !== undefined);
	assert.ok(reply, "the open request must finally get its response");
	assert.equal(reply.result._meta[META_SUBSCRIPTION_ID], "s7");
});

test("closing twice does not answer the same subscription again", () => {
	ask(versioned("subscriptions/listen", { notifications: { toolsListChanged: true } }, "s8"));
	session.closeSubscriptions();
	const after = sent.length;
	session.closeSubscriptions();
	assert.equal(sent.length, after);
});

// --- malformed input --------------------------------------------------------

test("an unparseable line is a parse error against no request", () => {
	session.dispatch("{not json");
	const reply = sent[sent.length - 1];
	assert.equal(reply.error.code, PARSE_ERROR);
	assert.equal(reply.id, null, "no id could be read, so none may be claimed");
});

test("a notification needs no reply", () => {
	session.dispatch(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }));
	assert.equal(sent.length, 0);
});

test("an unknown method is refused", () => {
	const reply = ask(versioned("resources/list", {}, 24));
	assert.equal(reply.error.code, METHOD_NOT_FOUND);
});
