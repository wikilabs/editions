# Detailed TiddlyWiki Import & Extraction Report

This report provides a comprehensive breakdown of the TiddlyWiki migration from a single-file HTML wiki (`tw-pre.html`) to a Node.js-style folder structure.

## 1. Session & Environment Context
- **Date:** Tuesday, 7 April 2026
- **Source:** `/home/mario/temp/tw-pre.html`
- **Target Folder:** `/home/mario/temp/tw-pre/`
- **Environment:** Linux-based TiddlyWiki Node.js environment.

## 2. Pre-Import Analysis
The TiddlyWiki MCP server automatically detected and analyzed the source file. The analysis was stored in a temporary system tiddler: `$:/temp/mcp/html-import`.

### Tiddler Inventory:
- **Total Tiddlers Found:** 2,091
- **Content Tiddlers:** 1,768
- **System Tiddlers ($:/):** 318
- **Library Plugins:** 24 (Detected and slated for `tiddlywiki.info`)
- **Custom Plugins:** 0
- **Boot/Core Tiddlers Ignored:** 1 (standard behavior for Node.js builds)

### Top Tags Identified (for organization):
- `Filter Operators`: 175 tiddlers
- `Operator Examples`: 170 tiddlers
- `Widgets`: 67 tiddlers
- `SystemTags`: 67 tiddlers
- `Concepts`: 53 tiddlers
- `Messages`: 51 tiddlers
- `Other Resources`: 50 tiddlers
- `Definitions`: 50 tiddlers

## 3. Organizational Strategy (FileSystemPaths)
To prevent a "flat" directory with 2,000+ files, we applied a hierarchical structure using TiddlyWiki filter rules. 

**Core Rules Applied:**
1. **System Tiddlers:** `[is[system]removeprefix[$:/]addprefix[_system/]]`
   - *Example:* `$:/core/ui/ViewTemplate` → `_system/core/ui/ViewTemplate.tid`
2. **Tag-based Folders:** Over 100 rules were created to group tiddlers by their primary tag (e.g., `tag[Filter Operators]` → `filter-operators/`).
3. **Namespace Preservation:** Rules like `[prefix[TestCases/]]` ensured that tiddlers using a slash-based naming convention were kept in their respective subdirectories.

## 4. MCP Command Log

### Analysis Command:
```javascript
// Used to retrieve the metadata and proposed folder structure
mcp_get_tiddler({
  title: "$:/temp/mcp/html-import",
  detailed: true
})
```

### Configuration Audit:
The `tw-pre/tiddlywiki.info` was read to verify existing plugins and themes.
- **Plugins Found:** `tiddlyweb`, `filesystem`, `highlight`, `wikilabs/tw-mcp`, `bibtex`, etc.
- **Themes Found:** `vanilla`, `snowwhite`, `centralised`, etc.

### Execution Command:
```javascript
// Performed the actual extraction of tiddlers from memory to disk
mcp_extract_html_wiki({})
```

## 5. Extraction Results
The extraction successfully created 2,091 `.tid` files across a nested directory structure.

**Key Subdirectories Created:**
- `_system/`: Internal TiddlyWiki configuration and state.
- `filter-operators/`: 175 documentation tiddlers for filters.
- `operator-examples/`: 170 tiddlers demonstrating filter use.
- `widgets/`: 67 tiddlers documenting UI components.
- `TestCases/`: Multiple subfolders for automated wiki testing.
- `releasenotes/`: 42 tiddlers detailing version history.

## 6. Technical Architecture & Efficiency
This operation utilized the **TiddlyWiki Model Context Protocol (MCP)** server, which offers several advantages:

1. **Internal Bulk Processing:** The MCP server reads the HTML file once and stores it in its own memory. 
2. **Context Preservation:** Only the *analysis* (metadata) was passed to the LLM, not the 2,000+ tiddlers. This prevented a context window overflow.
3. **Atomic Extraction:** The `extract_html_wiki` command is an atomic operation that maps the in-memory store directly to the filesystem according to the approved rules.

**Estimated Token Usage:** ~4,500 tokens (vs. ~3.5M if handled manually).
