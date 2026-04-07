# TW MCP Server -- Connecting AI Assistants to TiddlyWiki

## What is it?

**TW MCP** is a plugin that turns any TiddlyWiki into an AI-accessible knowledge base. It implements the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP), letting AI assistants like Claude, Gemini, and others read, search, render, and edit your wiki content through a standardised interface.

One command is all it takes:

```bash
tiddlywiki ./mywiki --mcp
```

Your wiki is now an MCP server. Any MCP-compatible AI client can connect to it.

## Why?

TiddlyWiki is great for organising knowledge. AI assistants are great at working with knowledge. MCP is the bridge that lets them talk to each other -- without custom integrations, without APIs, without exporting and importing.

Your wiki stays on your machine. The AI reads and writes tiddlers directly. No cloud sync, no third-party services.

## What can the AI do?

### Read tools (always available)

| Tool | Keywords | What it does |
|------|----------|-------------|
| `get_tiddler` | show, read, get | Fetch tiddler metadata or full content |
| `list_tiddlers` | list, browse, tagged with | Browse titles with namespace summaries |
| `run_filter` | find, search, how many | Execute TiddlyWiki filter expressions |
| `render_tiddler` | render, display, preview | Render a tiddler to plain text or HTML |
| `render_text` | render wikitext, test, try | Render arbitrary wikitext with full macro context |
| `get_wiki_info` | wiki info, plugins, settings | Wiki metadata, plugins, tiddler counts, settings |
| `inspect_tree` | widget tree, structure | Analyse rendered widget tree structure |
| `inspect_pos` | where from, source, trace | Render with source position tracking |
| `inspect_scope` | variables, scope, params | Inspect variable scope at a position |
| `inspect_tw` | inspect $tw, internal | Navigate TiddlyWiki's internal `$tw` object |
| `reload_tiddlers` | reload, refresh, sync | Refresh in-memory store from disk |

### Write tools (disabled in readonly mode)

| Tool | Keywords | What it does |
|------|----------|-------------|
| `put_tiddler` | create, new tiddler, write | Create or update a tiddler |
| `edit_tiddler` | edit, change, update, fix | Edit specific lines using hash-validated references (token-efficient) |
| `delete_tiddler` | delete, remove | Delete a tiddler |
| `upload_file` | upload, attach, add image | Upload binary files (images, PDFs) |
| `save_wiki_folder` | export, save as folder | Export wiki as folder structure |
| `build_wiki` | build, export HTML | Render wiki as single HTML file |

The keywords help you word prompts so the AI picks the right tool. For example, "show me GettingStarted" triggers a read, while "fix the intro in GettingStarted" triggers a hashline read + edit.

## Key features

### Token-efficiency is a goal

MCP tool results are pre-formatted as plain text. Tiddler queries return metadata by default; full text only when requested. Large result sets are grouped by namespace with counts.

### HashLine Edits -- the default

When you read a tiddler with `detailed=true`, every line comes back with a short content hash (e.g. `1#AB:line text`). The AI uses these anchors with `edit_tiddler` to send only the changed lines -- no need to resend the full tiddler. If the tiddler was modified since the AI last read it, the hashes won't match and the edit is rejected -- automatic conflict detection, zero extra cost on the happy path.

Hashline is the default format. Plain text without hashes is available via `format='tid'` when needed.

### Readonly by default

The server starts in readonly mode -- all write tools are disabled. Safe for exploration, analysis, and Q&A. To enable writes, use `--mcp rw`.

### Proxy mode for multi-client access

Multiple AI clients can connect to the same wiki simultaneously. The first process becomes the primary server; subsequent processes automatically detect it and relay through a named pipe. No conflicting wiki stores, no stale data.

When you also want a browser, start with `--mcp rw listen` -- the HTTP server and MCP server share the same `$tw.wiki` store. Browser edits and AI tool calls see each other instantly.

### Safety built in

- Overwrite protection: existing tiddlers aren't overwritten unless explicitly requested
- System tiddler exclusion: `$:/` tiddlers filtered by default
- Path restrictions: file operations limited to `tiddlers/`, `files/`, `output/`
- Pipe authentication: 256-bit random token for IPC transport

## Getting started

### Requirements

- Node.js (v24+)
- TiddlyWiki (`npm install -g tiddlywiki`)
- `TIDDLYWIKI_PLUGIN_PATH` environment variable pointing to the directory containing the `wikilabs/` plugins folder

### Start the server

```bash
tiddlywiki ./mywiki --mcp
```

Or with an HTTP server for browser access:

```bash
tiddlywiki ./mywiki --mcp rw listen port=8080
```

### Connect Claude Code

Add a `.mcp.json` file to your wiki directory:

```json
{
  "mcpServers": {
    "tiddlywiki": {
      "type": "stdio",
      "command": "tiddlywiki",
      "args": [".", "--mcp", "label=claude"]
    }
  }
}
```

Start Claude Code from that directory. Done.

### Connect Gemini CLI

```bash
gemini mcp add --scope project tiddlywiki-mcp tiddlywiki ./mywiki --mcp
```

## Demo: what it looks like

Here's a real conversation. The AI reads a tiddler, detects it needs updating, and edits just the relevant lines:

```
User: Update the GettingStarted tiddler to mention the new hashline feature

AI: Let me read the current content...
    [calls get_tiddler(title="GettingStarted", detailed=true)]
    
    I can see the tools section with hash anchors. I'll add a note after line 42.
    [calls edit_tiddler(title="GettingStarted", edits=[
      {op: "append_at", pos: "42#KV", lines: [
        "",
        "!!! HashLine edits",
        "",
        "Text is returned with hash anchors by default.",
        "Use `edit_tiddler` to modify specific lines without",
        "resending the full tiddler."
      ]}
    ])]
    
    Done -- added the section after line 42.
```

Only the new lines were sent. If someone had edited GettingStarted between the read and write, the hash mismatch would have caught it.

## Current status

- **Version:** 0.5.0 (experimental)
- **Requires:** TiddlyWiki >= 5.4.0
- **License:** CC-BY-NC-SA 4.0 (BSD-3 pending)

## What's next?

- Browser-compatible hashline library (using TW's built-in SJCL crypto) for potential devtools integration
- Docker MCP workflow 
- Wider client testing (VS Code, ...)

Feedback, bug reports, and ideas welcome. Try it out and let me know what you think!
