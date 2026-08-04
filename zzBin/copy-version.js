// used by npm run - package.json
// Can be done by "web-ext" CLI from moz too
"use strict";

var fs = require('fs')

// take package.json version info and transfere it to the manifest.json
// so in the command line we can use "npm version patch" ...

var fManifest = './assets/manifest.json',
	fPackage = "./package.json"

var readJson = function(file) {
		return JSON.parse(fs.readFileSync(file, 'utf8'));
	}

var pkg = readJson(fPackage);
var manifest = readJson(fManifest);

manifest.version = pkg.version;

fs.writeFileSync(fManifest, JSON.stringify(manifest, null, 2) + '\n');
