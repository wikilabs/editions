/*\
title: test-custom-markup-parser.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Tests for custom markup parser

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";
var title = "$:/config/custom-markup/pragma/PageTemplate";

// Create a wiki
var wiki = new $tw.Wiki();

//debugger;

wiki.addTiddler(new $tw.Tiddler({title: title, text: '\\importcustom [tag[$:/tags/Pragma]]\n'}));

var options = {parseAsInline:false};
var x = wiki.parseTiddler(title, options);

describe("Custom Markup Basics", function() {

	wiki.addTiddler(new $tw.Tiddler({title: "rAngle_1", text: '» My text comes here.'}));
	wiki.addTiddler(new $tw.Tiddler({title: "rAngle_2", text: '»» My text comes here.'}));
	wiki.addTiddler(new $tw.Tiddler({title: "rAngle_3", text: '»»» My text comes here.'}));

	it("test 'angle' ID for wltc-l1", function() {
		expect(wiki.parseTiddler("rAngle_1").tree).toEqual([
			{ "type": "element", "tag": "p",
			"attributes": {"class": { "type": "string",
					"value": "wltc-l1 wltc"
				}},"children": [{"type": "text","text": "My text comes here."}]
			}
		]);
	});

	it("test 'angle' ID for wltc-l2", function() {
		expect(wiki.parseTiddler("rAngle_2").tree).toEqual([
			{ "type": "element", "tag": "p",
			"attributes": {"class": { "type": "string",
					"value": "wltc-l2 wltc"
				}},"children": [{"type": "text","text": "My text comes here."}]
			}
		]);
	});

	it("test 'angle' ID for wltc-l3", function() {
		expect(wiki.parseTiddler("rAngle_3").tree).toEqual([
			{ "type": "element", "tag": "p",
			"attributes": {"class": { "type": "string",
					"value": "wltc-l3 wltc"
				}},"children": [{"type": "text","text": "My text comes here."}]
			}
		]);
	});

	// -------------------------------

	wiki.addTiddler(new $tw.Tiddler({title: "about_3", text: '≈≈≈ My text comes here.'}));
	wiki.addTiddler(new $tw.Tiddler({title: "about_4", text: '≈≈≈≈ My text comes here.'}));
	
	it("test 'about-about-about' ID for wltc-l3", function() {
		expect(wiki.parseTiddler("about_3").tree).toEqual([
			{ "type": "element", "tag": "p",
			"attributes": {"class": { "type": "string",
					"value": "wltc-l3 wltc"
				}},"children": [{"type": "text","text": "My text comes here."}]
			}
		]);
	});

	it("test 'about-about-about-about' ID for wltc-l4", function() {
		expect(wiki.parseTiddler("about_4").tree).toEqual([
			{ "type": "element", "tag": "p",
			"attributes": {"class": { "type": "string",
					"value": "wltc-l4 wltc"
				}},"children": [{"type": "text","text": "My text comes here."}]
			}
		]);
	});

	// -------------------------------

	wiki.addTiddler(new $tw.Tiddler({title: "cN-1", text: '´.className some text'}));
	wiki.addTiddler(new $tw.Tiddler({title: "cN-2", text: '°.className some text'}));
	wiki.addTiddler(new $tw.Tiddler({title: "cN-3", text: '›.className some text'}));
	var result = {
			"type": "element",
			"tag": "div",
			"attributes": {"class": {"type": "string","value": "className wltc-l1 wltc"}},
			"children": [{"type": "text","text": "some text"}
			]
		};

	it("parse TICK.className some text to DIV", function() {
		expect(wiki.parseTiddler("cN-1").tree).toEqual([result]);
	});
	it("parse DEGREE.className some text to DIV ", function() {
		expect(wiki.parseTiddler("cN-2").tree).toEqual([result]);
	});
	it("parse SINGLE.className some text to DIV", function() {
		expect(wiki.parseTiddler("cN-3").tree).toEqual([result]);
	});

	// -------------------------------

	wiki.addTiddler(new $tw.Tiddler({title: "cN-4", text: '».className some text'}));
	wiki.addTiddler(new $tw.Tiddler({title: "cN-5", text: '≈.className some text'}));
	var result_1 = {
		"type": "element",
		"tag": "p",
		"attributes": {"class": {"type": "string","value": "className wltc-l1 wltc"}},
		"children": [{"type": "text","text": "some text"}
		]
	};

	it("parse ANGLE.className some text to P", function() {
		expect(wiki.parseTiddler("cN-4").tree).toEqual([result_1]);
	});
	it("parse ABOUT.className some text to P", function() {
		expect(wiki.parseTiddler("cN-5").tree).toEqual([result_1]);
	});

	// -------------------------------

	wiki.addTiddler(new $tw.Tiddler({title: "twoClasses", text: '».c1.c2 My text comes here.'}));

	it("test ANGLE.c1.c2 for 2 classes", function() {
		expect(wiki.parseTiddler("twoClasses").tree).toEqual([
			{ "type": "element", "tag": "p",
			"attributes": {"class": { "type": "string",
					"value": "c1 c2 wltc-l1 wltc"
				}},"children": [{"type": "text","text": "My text comes here."}]
			}
		]);
	});

	// -------------------------------

	wiki.addTiddler(new $tw.Tiddler({title: "angleParagraph", text: '».c1.c2 My text comes here.\nSecond line\n\nNext paragraph'}));

	it("test ANGLE.c1.c2 for 2 classes", function() {
		expect(wiki.parseTiddler("angleParagraph").tree).toEqual([
			{
				"type": "element",
				"tag": "p",
				"attributes": { "class": {"type": "string", "value": "c1 c2 wltc-l1 wltc"}},
				"children": [{"type": "text", "text": "My text comes here.\nSecond line"}]
			},
			{
				"type": "element",
				"tag": "p",
				"children": [{"type": "text", "text": "Next paragraph"}]
			}
		]);
	});

	// -------------------------------

	wiki.addTiddler(new $tw.Tiddler({title: "tickParagraph", text: '´.c1.c2 My text comes here.\nSecond line\n\nNext paragraph'}));

	it("test TICK.c1.c2 for 2 classes", function() {
		expect(wiki.parseTiddler("tickParagraph").tree).toEqual([
			{
				"type": "element",
				"tag": "div",
				"attributes": {	"class": {"type": "string", "value": "c1 c2 wltc-l1 wltc" }},
				"children": [{"type": "text","text": "My text comes here."}]
			},
			{
				"type": "element",
				"tag": "p",
				"children": [{"type": "text","text": "Second line"}]
			},
			{
				"type": "element",
				"tag": "p",
				"children": [{"type": "text","text": "Next paragraph"}]
			}
		]);
	});

	// -------------------------------

	wiki.addTiddler(new $tw.Tiddler({title: "cAngleClasses", 
					text: '\\customize angle=myBox _classes=".indent.right-dedent.justify.cbox.cbox-primary"\n' + 
					'»myBox some text,\nNext line' 
				}));

	it("test \\customize ANGLE _classes \\n not active", function() {
		expect(wiki.parseTiddler("cAngleClasses").tree).toEqual([
			{
				"type": "element",
				"tag": "p",
				"attributes": {	"class": { "type": "string", "value": "indent right-dedent justify cbox cbox-primary wltc-l1 wltc"}},
				"children": [{"type": "text","text": "some text,\nNext line"}]
			}
		]);
	});

	wiki.addTiddler(new $tw.Tiddler({title: "cAngleClassesNL", 
					text: '\\customize angle=myBox _classes=".indent.right-dedent.justify.cbox.cbox-primary"\n' + 
					'»myBox some text,  \nNext line' 
				}));

	it("test \\customize ANGLE _classes \\n not active", function() {
		expect(wiki.parseTiddler("cAngleClassesNL").tree).toEqual([
			{
				"type": "element",
				"tag": "p",
				"attributes": {"class": {"type": "string","value": "indent right-dedent justify cbox cbox-primary wltc-l1 wltc"}},
				"children": [{"type": "text","text": "some text,"},
					{"type": "element",	"tag": "br","children": []},
					{"type": "text","text": "Next line"}]
			}
		]);
	});

	// -------------------------------

var tDetails = `
\\customize tick="d" _element="details" _classes=".notop.cbox.cbox-primary.hard-linebreaks" _endString="------" _mode=block open
\\customize tick="s" _element="summary" _classes=".margin-init"

´d ´s Details - Summay
---
line 1
line 2
------
`
	wiki.addTiddler(new $tw.Tiddler({title: "cDetails", text: tDetails }));

	it("test HTML DETAILS _element _classes _endString _mode open", function() {
		expect(wiki.parseTiddler("cDetails").tree).toEqual([
			{
				"type": "element", "tag": "details",
				"attributes": {
					"class": {"type": "string","value": "notop cbox cbox-primary hard-linebreaks wltc-l1"},
					"open": {"start": 111,"name": "open","type": "string","value": "true","end": 116}
				},
				"children": [
					{"type": "element",	"tag": "summary", "attributes": {"class": {	"type": "string","value": "margin-init wltc-l1 wltc"}},
						"children": [{"type": "text","text": "Details - Summay"}]
					},
					{"type": "element",	"tag": "hr"	},
					{"type": "element",	"tag": "p",
						"children": [{"type": "text","text": "line 1\nline 2\n"}]
					}
				]
			}
		]);
	});

});
// -------------------------------

describe("Import Custom", function() {

var tPragmaDetails = `
\\customize degree="d" _element="details" _classes=".notop.cbox.cbox-primary.hard-linebreaks" _endString="------" _mode=block open
\\customize degree="s" _element="summary" _classes=".margin-init"
`

var tDegreeImport = `
\\importcustom [[pragma-details]]

°d °s Details - Summay
---
line 1
line 2
------
`

// debugger;


	wiki.addTiddler(new $tw.Tiddler({title: "pragma-details", text: tPragmaDetails}));
	wiki.addTiddler(new $tw.Tiddler({title: "cDegreeImport", text: tDegreeImport}));

	xit("tests \\importcustom single file", function() {
		expect(wiki.parseTiddler("cDegreeImport").tree).toEqual([
			{
				"type": "element",
				"tag": "details",
				"attributes": {
					"class": {
						"type": "string",
						"value": "notop cbox cbox-primary hard-linebreaks wltc-l1"
					},
					"open": {
						"start": 113,
						"name": "open",
						"type": "string",
						"value": "true",
						"end": 118
					},
					"imported": true
				},
				"children": [
					{
						"type": "element",
						"tag": "summary",
						"attributes": {
							"class": {
								"type": "string",
								"value": "margin-init wltc-l1 wltc"
							},
							"imported": true
						},
						"children": [
							{
								"type": "text",
								"text": "Details - Summay"
							}
						]
					},
					{
						"type": "element",
						"tag": "hr"
					},
					{
						"type": "element",
						"tag": "p",
						"children": [
							{
								"type": "text",
								"text": "line 1\nline 2\n"
							}
						]
					}
				]
			}
		]);
	});


// -------------------------------

var tDegreeImport = `
\\customize degree="d" _element="details" _classes=".notop.cbox.cbox-primary.hard-linebreaks" _endString="------" _mode=block open
\\customize degree="s" _element="summary" _classes=".margin-init"

\\customize degree=XXX _use=d _debug=both

°XXX.cbox-warning °s Details - Summay
---
line 1
line 2
------
`

	wiki.addTiddler(new $tw.Tiddler({title: "cDegreeImport", text: tDegreeImport}));

	it("tests the _use param", function() {
		expect(wiki.parseTiddler("cDegreeImport").tree).toEqual([
			{	"type": "codeblock",
				"attributes": {"code": {"type": "string",
					"value": "\\customize degree='d' _element='details' _classes='.notop.cbox.cbox-primary.hard-linebreaks'" + 
					" _endString='------' _mode='block' open='{..}'"}}
			},
			{	"type": "codeblock","attributes": {"code": {"type": "string",
					"value": "°XXX.cbox-warning °s Details - Summay\n---\nline 1\nline 2\n------"}}
			},
			{	"type": "element",
				"tag": "details",
				"attributes": {	"class": {"type": "string","value": "notop cbox cbox-primary hard-linebreaks cbox-warning wltc-l1"},
					"open": {"start": 113,"name": "open","type": "string","value": "true","end": 118}
				},
				"children": [
					{	"type": "element",
						"tag": "summary",
						"attributes": {	"class": {"type": "string","value": "margin-init wltc-l1 wltc"}},
						"children": [
							{"type": "text","text": "Details - Summay"}
						]
					},
					{"type": "element","tag": "hr"},
					{"type": "element",
						"tag": "p",
						"children": [{"type": "text","text": "line 1\nline 2\n"}
						]
					}
				]
			}
		]);
	});



//	wiki.addTiddler(new $tw.Tiddler({title: "angleParagraph", text: '».c1.c2 My text comes here.\nSecond line\n\nNext paragraph'}));


	// it("should parse ´.className some text", function() {
	// 	expect(wiki.parseTiddler("1").tree).toEqual([

	// 	]);
	// });

	// it("should parse ´.className some text", function() {
	// 	expect(wiki.parseTiddler("1").tree).toEqual([

	// 	]);
	// });
	// it("should parse ´.className some text", function() {
	// 	expect(wiki.parseTiddler("1").tree).toEqual([

	// 	]);
	// });
	// it("should parse ´.className some text", function() {
	// 	expect(wiki.parseTiddler("1").tree).toEqual([

	// 	]);
	// });
	// it("should parse ´.className some text", function() {
	// 	expect(wiki.parseTiddler("1").tree).toEqual([

	// 	]);
	// });
	// it("should parse ´.className some text", function() {
	// 	expect(wiki.parseTiddler("1").tree).toEqual([

	// 	]);
	// });

	wiki.addTiddler(new $tw.Tiddler({title: "1", 
		text: '\\customize tick=vars _element="$vars" tid=a yyy={{!!test}} UID=<<qualify>> _endString="---" _mode=block\n´vars\n',
		tags: ["$:/tags/Pragma"]
	}));
	xit("should parse \\customize tick=vars", function() {
		expect(wiki.parseTiddler("1").tree).toEqual(
			[ { type: 'vars', tag: '$vars', attributes: { class: { type: 'string', value: 'wltc-l1' }, 
			tid: { start: 26, name: 'tid', type: 'string', value: 'a', end: 32 }, 
			yyy: { start: 32, name: 'yyy', type: 'indirect', textReference: '!!test', end: 47 },
			UID: { start: 47, name: 'UID', type: 'macro', value: { type: 'macrocall', start: 52, params: [  ], name: 'qualify', end: 63 }, end: 63 },
			src: { type: 'string', value: '' } }, children: [  ] }
			]
		);
	});

	// template
	// it("should parse ´.className some text", function() {
	// 	expect(wiki.parseTiddler("1").tree).toEqual([

	// 	]);
	// });
});

})();
