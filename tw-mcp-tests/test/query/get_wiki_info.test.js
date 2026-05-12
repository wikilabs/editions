"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw, loadHandler } = require("../setup");

const HANDLER_TITLE = "$:/core/modules/commands/inspect/handlers/query/get_wiki_info.js";

let getWikiInfo;
let $tw;

before(async () => {
	$tw = await bootTw();
	getWikiInfo = loadHandler($tw, HANDLER_TITLE).get_wiki_info;
});

test("get_wiki_info: returns wiki metadata + version + plugin list", () => {
	const result = getWikiInfo({});
	assert.equal(result.isError, undefined);
	const text = result.content[0].text;
	assert.match(text, /TiddlyWiki v/);
	assert.match(text, /Tiddlers:/);
	assert.match(text, /Plugins:/);
	assert.match(text, /\$:\/plugins\/wikilabs\/tw-mcp/);
});

test("get_wiki_info: surfaces pending HTML import status", () => {
	// Seed the import-status tiddler so the get_wiki_info "pending" branch fires,
	// then remove it so other tests see a clean wiki.
	$tw.wiki.addTiddler({
		title: "$:/temp/mcp/html-import",
		status: "pending",
		"source-file": "/tmp/probe.html",
		"content-count": "42"
	});
	try {
		const result = getWikiInfo({});
		assert.equal(result.isError, undefined);
		assert.match(result.content[0].text, /HTML Import: PENDING/);
		assert.match(result.content[0].text, /42 tiddlers/);
	} finally {
		$tw.wiki.deleteTiddler("$:/temp/mcp/html-import");
	}
});

test("get_wiki_info: surfaces $tw.mcp role/PID when present", () => {
	$tw.mcp = { role: "primary", version: "test.0", pid: 99999, label: "test-label" };
	try {
		const result = getWikiInfo({});
		assert.match(result.content[0].text, /MCP: primary vtest\.0 \(PID 99999\) @test-label/);
	} finally {
		delete $tw.mcp;
	}
});

test("get_wiki_info: surfaces HTTP listen address when $tw.httpServer present", () => {
	$tw.httpServer = {
		nodeServer: { address: () => ({ address: "127.0.0.1", port: 9876 }) }
	};
	try {
		const result = getWikiInfo({});
		assert.match(result.content[0].text, /HTTP: 127\.0\.0\.1:9876/);
	} finally {
		delete $tw.httpServer;
	}
});

test("get_wiki_info: HTTP 'not listening' when nodeServer.address() returns null", () => {
	$tw.httpServer = { nodeServer: { address: () => null } };
	try {
		const result = getWikiInfo({});
		assert.match(result.content[0].text, /HTTP: not listening/);
	} finally {
		delete $tw.httpServer;
	}
});

test("get_wiki_info: surfaces extracted HTML import status", () => {
	$tw.wiki.addTiddler({
		title: "$:/temp/mcp/html-import",
		status: "extracted",
		"source-file": "/tmp/probe.html",
		"files-written": "7"
	});
	try {
		const result = getWikiInfo({});
		assert.match(result.content[0].text, /HTML Import: extracted 7 files/);
	} finally {
		$tw.wiki.deleteTiddler("$:/temp/mcp/html-import");
	}
});
