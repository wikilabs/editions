"use strict";

/*
Test scaffolding shared by the tests of the "LSP ... - (Example)" tiddlers,
which check each Example's claims inside the Example's own text (bead
tw-mcp-server-17e.7).
*/

const fs = require("node:fs");
const path = require("node:path");

// The docs wiki's own tiddlers, in the tw-mcp edition beside this one.
const DOCS_PATH = path.resolve(__dirname, "..", "..", "..", "tw-mcp", "tiddlers");
const EXAMPLES_PATH = path.join(DOCS_PATH, "LSP", "Examples");

// An Example as the editor opens it: its file, that file's URI and its text.
function readExample(features, title) {
	const filepath = path.join(EXAMPLES_PATH, title + ".tid");
	return {
		path: filepath,
		uri: features.pathToUri(filepath),
		text: fs.readFileSync(filepath, "utf8").replace(/\r\n/g, "\n")
	};
}

// The LSP position of the nth occurrence of snippet (from 1), moved offset characters into it.
function positionOf(text, snippet, options) {
	const nth = (options && options.nth) || 1,
		offset = (options && options.offset) || 0;
	let at = -1;
	for(let found = 0; found < nth; found++) {
		at = text.indexOf(snippet, at + 1);
		if(at === -1) {
			throw new Error("Found " + found + " of " + JSON.stringify(snippet) + ", wanted occurrence " + nth);
		}
	}
	return positionAtEnd(text.slice(0, at + offset));
}

// The text with entry typed on a new last line, and the cursor right after it.
function typeAtEnd(text, entry) {
	const typed = (text.endsWith("\n") ? text : text + "\n") + entry;
	return { text: typed, position: positionAtEnd(typed) };
}

function positionAtEnd(text) {
	const lines = text.split("\n");
	return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

// Loads and files the docs wiki's tiddlers, so titles such as LSP Server exist; the
// returned function puts back the tiddlers and files they replaced.
function loadDocs($tw) {
	const replaced = new Map();
	$tw.loadTiddlersFromPath(DOCS_PATH).forEach((file) => {
		file.tiddlers.forEach((fields) => {
			if(!replaced.has(fields.title)) {
				replaced.set(fields.title, {
					tiddler: $tw.wiki.tiddlerExists(fields.title) ? $tw.wiki.getTiddler(fields.title) : undefined,
					filed: $tw.boot.files[fields.title]
				});
			}
			$tw.boot.files[fields.title] = { filepath: file.filepath, type: file.type, hasMetaFile: file.hasMetaFile };
			$tw.wiki.addTiddler(new $tw.Tiddler(fields));
		});
	});
	return function unloadDocs() {
		replaced.forEach((was, title) => {
			if(was.filed) {
				$tw.boot.files[title] = was.filed;
			} else {
				delete $tw.boot.files[title];
			}
			if(was.tiddler) {
				$tw.wiki.addTiddler(was.tiddler);
			} else {
				$tw.wiki.deleteTiddler(title);
			}
		});
	};
}

module.exports = { DOCS_PATH, EXAMPLES_PATH, readExample, positionOf, typeAtEnd, loadDocs };
