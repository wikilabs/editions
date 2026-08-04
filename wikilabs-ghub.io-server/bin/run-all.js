/*
Run one npm script across every wikilabs edition.

	node bin/run-all.js build          build each edition locally
	node bin/run-all.js stage          build each edition for publishing
	node bin/run-all.js build --dry-run   list what would run, run nothing

Options:
	--dry-run            report the work, execute none of it
	--concurrency <n>    parallel editions, default 8

An edition takes part when it has a package.json and no `skip-build` marker.

Uses only Node built-ins on purpose: this directory must not need a
node_modules of its own. The previous version pulled in
child-process-promise and @supercharge/promise-pool, which between them
dragged a Promise polyfill and a 2016 cross-spawn into a Node 24 toolchain.

Two things the old version got wrong and this one does not:

  - a failing edition left the exit code at 0, so a broken build could still
    reach `npm run deploy` reporting success
  - the `[tw] core=` line goes to stderr, and stderr was only shown when
    stdout was empty, so batch runs never revealed which TiddlyWiki core
    built which edition
*/

"use strict";

var fs = require("fs"),
	path = require("path"),
	exec = require("child_process").exec;

var EDITIONS = path.resolve(__dirname, "../.."),
	argv = process.argv.slice(2),
	script = argv.filter(function(a) { return a.indexOf("-") !== 0; })[0],
	dryRun = argv.indexOf("--dry-run") !== -1,
	concurrency = 8;

var flag = argv.indexOf("--concurrency");
if(flag !== -1 && argv[flag + 1]) {
	concurrency = parseInt(argv[flag + 1], 10) || 8;
}

if(!script) {
	console.error("usage: node bin/run-all.js <npm-script> [--dry-run] [--concurrency n]");
	process.exit(1);
}

// Work out which editions take part, and why the others do not
var participating = [], skipped = [];
fs.readdirSync(EDITIONS).forEach(function(name) {
	var dir = path.join(EDITIONS, name);
	if(!fs.statSync(dir).isDirectory()) {
		return;
	}
	if(!fs.existsSync(path.join(dir, "package.json"))) {
		return;
	}
	if(fs.existsSync(path.join(dir, "skip-build"))) {
		skipped.push(name);
		return;
	}
	participating.push(name);
});

console.log("npm run " + script + " in " + participating.length + " editions" +
	(skipped.length ? "   skip-build: " + skipped.join(", ") : "") +
	(dryRun ? "\n(dry run, nothing executed)" : ""));

if(dryRun) {
	participating.forEach(function(name) {
		console.log("   would run  " + name);
	});
	return;
}

var CORE = /^\[tw\] core=(\S+) (v\S+)/gm;

function coresIn(text) {
	var found = {}, match;
	CORE.lastIndex = 0;
	while((match = CORE.exec(text || "")) !== null) {
		found[match[1] + " " + match[2]] = true;
	}
	return Object.keys(found).join(", ") || "-";
}

function runOne(name) {
	return new Promise(function(resolve) {
		var started = Date.now();
		exec("npm run " + script, {
			cwd: path.join(EDITIONS, name),
			env: process.env,
			maxBuffer: 64 * 1024 * 1024
		}, function(error, stdout, stderr) {
			resolve({
				name: name,
				ok: !error,
				seconds: ((Date.now() - started) / 1000).toFixed(1),
				cores: coresIn(stderr),
				output: (stdout || "") + (stderr || "")
			});
		});
	});
}

// Plain worker pool: `concurrency` chasers pulling from one queue
function runAll() {
	var queue = participating.slice(),
		results = [];
	function next() {
		var name = queue.shift();
		if(!name) {
			return Promise.resolve();
		}
		return runOne(name).then(function(result) {
			results.push(result);
			console.log((result.ok ? "  ok   " : "  FAIL ") +
				result.name.padEnd(32) + result.seconds + "s   " + result.cores);
			return next();
		});
	}
	var chasers = [];
	for(var i = 0; i < Math.min(concurrency, queue.length); i++) {
		chasers.push(next());
	}
	return Promise.all(chasers).then(function() {
		return results;
	});
}

runAll().then(function(results) {
	var failed = results.filter(function(r) { return !r.ok; });
	console.log("\n" + results.length + " editions, " + failed.length + " failed" +
		(skipped.length ? ", " + skipped.length + " skipped" : ""));
	failed.forEach(function(r) {
		console.log("\n--- " + r.name + " ---\n" + r.output.trim());
	});
	// A broken edition must not report success to whatever called this
	if(failed.length) {
		process.exitCode = 1;
	}
});
