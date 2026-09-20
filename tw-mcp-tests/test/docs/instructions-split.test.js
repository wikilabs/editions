"use strict";

/*
The Instructions page renders its sections through two levels of `list` fields
(bead tw-mcp-server-2bn), so a section carrying the right tag is still invisible
until some group lists it. By hand, in the docs wiki:
	[tag[Instructions]count[]]                                 // 33
	[list[Instructions]count[]]                                // 3 groups
	[list[Instructions]] :map:flat[list<currentTiddler>] +[count[]]   // 30 sections
3 + 30 must equal 33. Note `:map` without the `flat` suffix returns only the
first result per input, which silently gives 3.
*/

const fs = require("node:fs");
const path = require("node:path");
const { test, before } = require("node:test");
const assert = require("node:assert");
const { bootTw } = require("../setup");

// The docs wiki's own tiddlers, in the tw-mcp edition beside this one.
const DOCS_PATH = path.resolve(__dirname, "..", "..", "..", "tw-mcp", "tiddlers");
const PAGE_PATH = path.join(DOCS_PATH, "Server", "Instructions.tid");
const SECTIONS_PATH = path.join(DOCS_PATH, "Server", "Instructions");

const KINDS = ["Read Tools", "Write Tools", "Helper"];

let tw, page, sections, groups;

// A .tid file's header fields; the body after the blank line is not needed here.
function readFields(filepath) {
	const fields = {};
	for(const line of fs.readFileSync(filepath, "utf8").replace(/\r\n/g, "\n").split("\n")) {
		if(line === "") break;
		const at = line.indexOf(": ");
		if(at > 0) fields[line.slice(0, at)] = line.slice(at + 2);
	}
	return fields;
}

function listOf(fields) {
	return tw.utils.parseStringArray(fields.list || "");
}

before(async () => {
	tw = await bootTw();
	page = readFields(PAGE_PATH);
	sections = fs.readdirSync(SECTIONS_PATH)
		.filter(name => name.endsWith(".tid"))
		.map(name => readFields(path.join(SECTIONS_PATH, name)));
	groups = listOf(page);
});

test("every tiddler tagged Instructions is reachable from a list field", () => {
	const reachable = new Set(groups);
	for(const section of sections) {
		if(groups.includes(section.title)) {
			for(const title of listOf(section)) reachable.add(title);
		}
	}
	const unlisted = sections.map(section => section.title).filter(title => !reachable.has(title));
	assert.deepEqual(unlisted, [], "tagged Instructions but listed by no group");
});

test("every listed title exists as a section", () => {
	const known = new Set(sections.map(section => section.title));
	const missing = [];
	for(const holder of [page].concat(sections)) {
		for(const title of listOf(holder)) {
			if(!known.has(title)) missing.push(title);
		}
	}
	assert.deepEqual(missing, []);
});

test("every section is tagged Instructions and captioned", () => {
	const wrong = sections.filter(section =>
		!tw.utils.parseStringArray(section.tags || "").includes("Instructions") || !section.caption
	).map(section => section.title);
	assert.deepEqual(wrong, []);
});

// The second tag is what tells a reader which mode a tool needs when the tiddler
// is opened on its own, away from its group (bead tw-mcp-server-1t4).
test("every tool section carries exactly one kind tag", () => {
	const wrong = sections.filter(section => {
		if(groups.includes(section.title)) return false;
		const tags = tw.utils.parseStringArray(section.tags || "");
		return KINDS.filter(kind => tags.includes(kind)).length !== 1;
	}).map(section => section.title);
	assert.deepEqual(wrong, []);
});
