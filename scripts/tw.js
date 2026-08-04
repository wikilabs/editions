#!/usr/bin/env node
/*
Boot a chosen TiddlyWiki core in-process, so wikilabs pages are always built
with a known version instead of whatever the global `tiddlywiki` command
happens to be linked to.

	node ../scripts/tw.js [--core <name|path>] <tiddlywiki arguments...>

Core selection, highest precedence first:

	1. TW_CORE environment variable   one-off override, a name or a path
	2. --core <name|path>             what the calling npm script asks for
	3. "default" in tw-cores.json

The override wins on purpose: when a release tag is broken you can publish
from another core without editing any script, eg

	$env:TW_CORE="dev"; npm run stage

The core is booted in this process rather than spawned as a child, which
keeps stdin, stdout and the working directory exactly as the caller had
them. Both matter: the dev server's tw-mcp shuts down the moment its stdin
closes, and every build target resolves its relative paths (--output,
--load) against the calling -server directory.
*/

"use strict";

var fs = require("fs"),
	path = require("path");

var configPath = path.join(__dirname, "tw-cores.json");
if(!fs.existsSync(configPath)) {
	console.error("tw.js: missing config " + configPath);
	process.exit(1);
}
var config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Take "--core <value>" for ourselves; everything else belongs to TiddlyWiki
var argv = process.argv.slice(2),
	requested = null,
	rest = [];
for(var i = 0; i < argv.length; i++) {
	if(argv[i] === "--core" && i + 1 < argv.length) {
		requested = argv[i + 1];
		i++;
	} else {
		rest.push(argv[i]);
	}
}

var selector = process.env.TW_CORE || requested || config.default;
if(!selector) {
	console.error("tw.js: no core given and no \"default\" in tw-cores.json");
	process.exit(1);
}

// A selector is either a name from the config or a path taken as written.
// Names and relative paths resolve against this script, so the answer does
// not depend on which -server directory invoked it.
var configured = config.cores && config.cores[selector],
	corePath = path.resolve(__dirname, configured || selector);

var bootPath = path.join(corePath, "boot", "boot.js");
if(!fs.existsSync(bootPath)) {
	console.error("tw.js: core \"" + selector + "\" has no boot.js at " + bootPath);
	if(!configured) {
		console.error("tw.js: known cores are " + Object.keys(config.cores || {}).join(", "));
	}
	process.exit(1);
}

// Record which core produced this run, so it shows up in every build log
var packagePath = path.join(corePath, "package.json"),
	version = "unknown";
if(fs.existsSync(packagePath)) {
	version = JSON.parse(fs.readFileSync(packagePath, "utf8")).version;
}
console.error("[tw] core=" + selector + " v" + version + " " + corePath);

var $tw = require(bootPath).TiddlyWiki();
$tw.boot.argv = rest;
$tw.boot.boot();
