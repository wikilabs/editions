"use strict";

/*
Pins the protocol contract served by mcp-lib.js, in BOTH eras.

MCP 2026-07-28 is stateless: there is no initialize handshake, so every request
declares its own protocol version in _meta and every result carries resultType
plus the server's identity.

The handshake era is served alongside it because a DUAL-era client falls back
to initialize when server/discover does not answer inside its own probe window,
and a slow wiki boot is enough to trigger that. Which era a message belongs to
is a pure function of the message, so serving two costs no per-connection state.

These tests drive dispatchMessage directly, which is the whole request path
minus the transport. To replicate by hand, boot the test edition and call the
same function:

  const lib = $tw.modules.execute("$:/core/modules/commands/inspect/mcp-lib.js");
  lib.dispatchMessage(JSON.stringify({jsonrpc:"2.0",id:1,method:"server/discover"}),
    (out) => console.log(out));
*/

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const LIB_TITLE = "$:/core/modules/commands/inspect/mcp-lib.js";

const PROTOCOL = "2026-07-28";
const LEGACY_PROTOCOL = "2025-11-25";
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";
const UNSUPPORTED_VERSION = -32022;
const METHOD_NOT_FOUND = -32601;

let dispatchMessage;

before(async () => {
	const $tw = await bootTw();
	dispatchMessage = loadHandler($tw, LIB_TITLE).dispatchMessage;
});

// Send one message and return the parsed reply, or null when the server
// answered nothing (which is correct for a notification).
function dispatch(message) {
	let captured = null;
	dispatchMessage(JSON.stringify(message), (out) => { captured = out; });
	return captured === null ? null : JSON.parse(captured);
}

// Any request other than server/discover must declare its protocol version.
function versioned(method, params) {
	const p = params || {};
	p._meta = p._meta || {};
	p._meta[META_VERSION] = PROTOCOL;
	return { jsonrpc: "2.0", id: 1, method: method, params: p };
}

test("server/discover advertises the supported version, capabilities and identity", () => {
	const reply = dispatch({ jsonrpc: "2.0", id: "d1", method: "server/discover" });
	assert.equal(reply.id, "d1");
	assert.ok(reply.result, "expected a result, got " + JSON.stringify(reply.error));
	assert.ok(reply.result.supportedVersions.includes(PROTOCOL));
	assert.ok(reply.result.capabilities.tools, "tools capability must be advertised");
	assert.equal(reply.result.resultType, "complete");
	const info = reply.result._meta[META_SERVER_INFO];
	assert.equal(info.name, "tiddlywiki-mcp");
	assert.ok(info.version, "serverInfo must carry a version");
});

test("server/discover answers without _meta, so it can serve as the era probe", () => {
	// A dual-era client sends this first to find out what the server speaks. It
	// cannot know the version yet, so this one method must not be version gated.
	const reply = dispatch({ jsonrpc: "2.0", id: 2, method: "server/discover" });
	assert.ok(reply.result, "server/discover must not require a declared version");
});

test("server/discover advertises the handshake-era versions too", () => {
	// A dual-era client reads this to decide it need not fall back at all.
	const reply = dispatch({ jsonrpc: "2.0", id: "d2", method: "server/discover" });
	assert.ok(reply.result.supportedVersions.includes(LEGACY_PROTOCOL));
});

test("initialize completes a handshake instead of being refused", () => {
	// The reason this is served: a dual-era client that gets no server/discover
	// answer inside its probe window falls back here, and a slow wiki boot is
	// enough to cause that. Refusing the fallback strands the connection.
	const reply = dispatch({
		jsonrpc: "2.0",
		id: 3,
		method: "initialize",
		params: { protocolVersion: LEGACY_PROTOCOL, clientInfo: { name: "legacy-probe", version: "1.0" } }
	});
	assert.ok(reply.result, "expected a handshake result, got " + JSON.stringify(reply.error));
	assert.equal(reply.result.protocolVersion, LEGACY_PROTOCOL, "a version we speak must be echoed back");
	assert.ok(reply.result.capabilities.tools, "tools capability must be advertised");
	assert.equal(reply.result.serverInfo.name, "tiddlywiki-mcp");
	assert.ok(reply.result.instructions, "the handshake result carries the guidance");
});

test("initialize offers a version it speaks when asked for one it does not", () => {
	// The handshake spec: echo the requested version, or name another supported
	// one and let the client decide whether to continue.
	const reply = dispatch({
		jsonrpc: "2.0",
		id: "i2",
		method: "initialize",
		params: { protocolVersion: "1900-01-01" }
	});
	assert.ok(reply.result, "expected a result, got " + JSON.stringify(reply.error));
	assert.notEqual(reply.result.protocolVersion, "1900-01-01");
	assert.ok(reply.result.protocolVersion, "must name a version it does speak");
});

test("a handshake result carries neither resultType nor the _meta identity", () => {
	// Both are 2026-07-28 requirements with no counterpart in the handshake era,
	// where the identity is already in serverInfo. Sending them would be noise.
	const reply = dispatch({ jsonrpc: "2.0", id: "i3", method: "initialize", params: {} });
	assert.equal(reply.result.resultType, undefined);
	assert.equal(reply.result._meta, undefined);
});

test("a request that declares no protocol version is served as handshake-era", () => {
	// A handshake-era client has nowhere to put a per-request version, so an
	// ABSENT one identifies it rather than being an error.
	const reply = dispatch({ jsonrpc: "2.0", id: 4, method: "tools/list" });
	assert.ok(reply.result, "expected a result, got " + JSON.stringify(reply.error));
	assert.ok(Array.isArray(reply.result.tools));
	assert.ok(reply.result.tools.length > 0, "expected at least one tool");
});

test("a handshake-era tools/list omits the 2026-07-28-only fields", () => {
	// ttlMs, cacheScope and resultType do not exist in that revision's schema.
	const reply = dispatch({ jsonrpc: "2.0", id: 5, method: "tools/list" });
	assert.equal(reply.result.ttlMs, undefined);
	assert.equal(reply.result.cacheScope, undefined);
	assert.equal(reply.result.resultType, undefined);
});

test("a request declaring an unsupported version is rejected and echoes it", () => {
	// Still an error: a version we do not speak is not the same as no version.
	const msg = versioned("tools/list");
	msg.params._meta[META_VERSION] = "1900-01-01";
	const reply = dispatch(msg);
	assert.equal(reply.error.code, UNSUPPORTED_VERSION);
	assert.equal(reply.error.data.requested, "1900-01-01");
	assert.ok(reply.error.data.supported.includes(PROTOCOL));
});

test("tools/list returns the cache hints required on list results", () => {
	// Omitting these made a strict client reject the response and retry on
	// doubling backoff until it gave up. cacheScope is private because the list
	// varies per wiki and per readonly mode.
	const reply = dispatch(versioned("tools/list"));
	assert.ok(reply.result, "expected a result, got " + JSON.stringify(reply.error));
	assert.ok(Array.isArray(reply.result.tools));
	assert.ok(reply.result.tools.length > 0, "expected at least one tool");
	assert.equal(typeof reply.result.ttlMs, "number");
	assert.equal(reply.result.cacheScope, "private");
	assert.equal(reply.result.resultType, "complete");
});

test("every result carries resultType and the server identity", () => {
	// Both are stamped centrally in jsonrpcResponse so no call site can omit
	// them. tools/list stands in for "any ordinary result" here.
	const reply = dispatch(versioned("tools/list"));
	assert.equal(reply.result.resultType, "complete");
	assert.equal(reply.result._meta[META_SERVER_INFO].name, "tiddlywiki-mcp");
});

test("tools/list is ordered by name, so clients can cache the response", () => {
	// The revision asks servers to return a deterministic order to improve LLM
	// prompt cache hits. mcp-handlers sorts explicitly rather than relying on
	// Object.keys, so a reload_mcp_modules re-exec cannot reshuffle the list.
	const names = dispatch(versioned("tools/list")).result.tools.map((t) => t.name);
	assert.deepEqual(names, names.slice().sort());
});

test("ping is gone for a 2026-07-28 client, since the revision removed it", () => {
	const reply = dispatch(versioned("ping"));
	assert.equal(reply.error.code, METHOD_NOT_FOUND);
});

test("ping still answers a handshake-era client, which may use it as a liveness check", () => {
	// One method, two contracts: served where the revision has it, absent where
	// it does not, rather than resurrected for everyone.
	const reply = dispatch({ jsonrpc: "2.0", id: "p1", method: "ping" });
	assert.ok(reply.result, "expected a result, got " + JSON.stringify(reply.error));
	assert.equal(reply.result.resultType, undefined);
});

test("an unknown method is a method-not-found error, not a version error", () => {
	const reply = dispatch(versioned("nonsense/method"));
	assert.equal(reply.error.code, METHOD_NOT_FOUND);
});

test("a notification draws no reply", () => {
	// No id means no response is allowed, even for a method we do not know.
	const reply = dispatch({ jsonrpc: "2.0", method: "notifications/cancelled", params: {} });
	assert.equal(reply, null);
});
