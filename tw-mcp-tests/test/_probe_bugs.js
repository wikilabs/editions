// Diagnostic probe for the remaining open bugs.
"use strict";

const { bootTw, loadHandler } = require("./setup");

(async () => {
	const $tw = await bootTw();

	console.log("=".repeat(60));
	console.log("coq: \\procedure variable info");
	console.log("=".repeat(60));
	// Render the fixture and walk the widget tree to find the greet variable info.
	const shared = $tw.modules.execute("$:/core/modules/commands/inspect/handlers/shared.js");
	const text = "\\procedure greet() Hello!\n\\end\n\n<<greet>>";
	const rendered = shared.parseAndRender(text, "text/vnd.tiddlywiki", "Probe");
	function walk(w) {
		if(w.variables && w.variables.greet) {
			console.log("  greet variable info on widget type=" + (w.parseTreeNode && w.parseTreeNode.type));
			console.log("   ", Object.keys(w.variables.greet).filter(k => typeof w.variables.greet[k] !== "object").map(k => k + "=" + JSON.stringify(w.variables.greet[k])).join("\n    "));
			return true;
		}
		if(w.children) for(const c of w.children) if(walk(c)) return true;
		return false;
	}
	walk(rendered.widgetNode);

	console.log("\n=== Comparison: a built-in procedure (copy-to-clipboard)");
	// Render anything inside the page-macros importvariables scope.
	const rendered2 = shared.parseAndRender("dummy", "text/vnd.tiddlywiki", "Probe");
	function walk2(w, name) {
		if(w.variables && w.variables[name]) {
			console.log("  " + name + " variable info on widget type=" + (w.parseTreeNode && w.parseTreeNode.type));
			console.log("   ", Object.keys(w.variables[name]).filter(k => typeof w.variables[name][k] !== "object").map(k => k + "=" + JSON.stringify(w.variables[name][k])).join("\n    "));
			return true;
		}
		if(w.children) for(const c of w.children) if(walk2(c, name)) return true;
		return false;
	}
	walk2(rendered2.widgetNode, "copy-to-clipboard");

	console.log("\n" + "=".repeat(60));
	console.log("9ek: TranscludeWidget attribute names on modern $tiddler");
	console.log("=".repeat(60));
	const probeText = "<$transclude $tiddler=\"inspect_pos_macro\"/>";
	const r3 = shared.parseAndRender(probeText, "text/vnd.tiddlywiki", "Host");
	function walkTrans(w) {
		if(w.parseTreeNode && w.parseTreeNode.type === "transclude") {
			console.log("  transclude widget fields (any name with title/tiddler/variable):");
			const keys = Object.keys(w).filter(k => /title|tiddler|variable/i.test(k));
			for(const k of keys) {
				try {
					console.log("    " + k + " = " + JSON.stringify(w[k]));
				} catch(e) {
					console.log("    " + k + " = [non-serialisable: " + typeof w[k] + "]");
				}
			}
			console.log("  attributes:", w.attributes ? Object.keys(w.attributes).join(", ") : "(none)");
			return true;
		}
		if(w.children) for(const c of w.children) if(walkTrans(c)) return true;
		return false;
	}
	walkTrans(r3.widgetNode);

	console.log("\n=== Add a tracer to the patched execute");
	// Monkey-patch BEFORE the handler runs so we observe what fires.
	const TranscludeWidget = $tw.modules.execute("$:/core/modules/widgets/transclude.js").transclude;
	const ElementWidget = $tw.modules.execute("$:/core/modules/widgets/element.js").element;
	// At transclude render: AFTER execute, inspect children + their parentWidget.
	const origTRender = TranscludeWidget.prototype.render;
	TranscludeWidget.prototype.render = function(parent, ns) {
		this.parentDomNode = parent;
		this.computeAttributes({asList: true});
		this.execute();
		if(this.transcludeTitle && !this.transcludeVariable) {
			console.log("  [trans render] title=" + this.transcludeTitle + " sourceContext=" + this.sourceContext + " children.length=" + this.children.length);
			for(var i = 0; i < this.children.length; i++) {
				var c = this.children[i];
				console.log("    child[" + i + "] type=" + (c.parseTreeNode && c.parseTreeNode.type) + " parentWidget===this: " + (c.parentWidget === this));
			}
		}
		return this.renderChildren(parent, ns);
	};
	// Hook the element widget render: when an element fires the hook,
	// log the parent chain's sourceContext values so we can see what
	// posGetSourceInfo actually walks through.
	const origElRender = ElementWidget.prototype.render;
	ElementWidget.prototype.render = function(parent, ns) {
		const out = origElRender.call(this, parent, ns);
		if(this.parseTreeNode && this.parseTreeNode.tag === "p") {
			console.log("  [P element] parent chain sourceContext walk:");
			let w = this, depth = 0;
			while(w && depth < 8) {
				const isTrans = w.constructor && w.constructor.name === "TranscludeWidget";
				console.log("    [" + depth + "] " + (w.parseTreeNode && w.parseTreeNode.type) + " transTitle=" + (w.transcludeTitle || "-") + " transVar=" + (w.transcludeVariable || "-") + " sourceContext=" + (w.sourceContext || "-"));
				w = w.parentWidget;
				depth++;
			}
		}
		return out;
	};
	const inspectPos = loadHandler($tw, "$:/core/modules/commands/inspect/handlers/inspect/inspect_pos.js").inspect_pos;
	const r4 = inspectPos({
		text: "<$transclude $tiddler=\"inspect_pos_macro\"/>",
		context: "Host"
	});
	console.log("  output:");
	console.log("  " + r4.content[0].text.split("\n").join("\n  "));

	console.log("\n=== Same probe with inline procedure call (works for v= attr)");
	const r5 = inspectPos({
		text: "\\procedure hi() Test!\n\\end\n\n<<hi>>",
		context: "Host"
	});
	console.log("  output:");
	console.log("  " + r5.content[0].text.split("\n").join("\n  "));
})();
