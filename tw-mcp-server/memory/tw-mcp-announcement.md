# TW MCP -- Connecting AI Assistants to TiddlyWiki

## What is it?

**TW MCP** is a plugin that turns any TiddlyWiki into an AI-accessible knowledge base. It implements the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP), letting AI assistants like Claude, Gemini, and others read, search, render, and edit your wiki through a standardised interface. It requires a command-line MCP client and basic Node.js familiarity -- aimed at developers for now.

One command is all it takes:

```bash
tiddlywiki ./mywiki --mcp
```

Your wiki is now an MCP server. Any MCP-compatible AI client can connect to it.

## Why?

TiddlyWiki is great for organising knowledge. AI assistants are great at working with knowledge. MCP is the bridge -- no custom integrations, no exporting and importing.

Your wiki stays on your machine. The AI works with tiddlers directly. No cloud sync, no third-party services.

## What can the AI do?

### Read & explore

- **Get tiddlers** -- fetch metadata or full content
- **List & search** -- browse by tag, run filter expressions, search across your wiki
- **Render** -- render tiddlers, fields, or arbitrary wikitext to plain text or HTML, including through the ViewTemplate cascade (so the AI sees what the browser shows)
- **Inspect** -- analyse widget trees, trace source positions, inspect variable scopes, and navigate TiddlyWiki's internal `$tw` object
- **Wiki info** -- plugins, themes, tiddler counts, settings at a glance

### Write (opt-in)

- **Create, edit, delete tiddlers** -- the AI can modify your wiki when you allow it
- **Upload files** -- images, PDFs, and other binary files
- **Save as folder** -- export the wiki as a node.js folder structure, ready for version control or deployment
- **Build HTML** -- render the entire wiki as a single HTML file the AI can produce on demand

Writing is disabled by default. You explicitly enable it with `--mcp rw`.

## Key features

### Efficient editing

When the AI reads a tiddler, each line comes back with a short content hash. To make changes, it sends only the modified lines -- not the entire tiddler. If someone else edited the tiddler in the meantime, the hashes won't match and the edit is safely rejected. Conflict detection with no overhead.

### Readonly by default

The server starts in readonly mode. Safe for exploration, analysis, and Q&A. Enable writes only when you need them.

### Multiple clients at once

Several AI clients can connect to the same wiki simultaneously. The first process becomes the primary server; others relay through it automatically. No conflicts, no stale data.

Want a browser too? Start with `--mcp rw listen` -- the HTTP server and MCP server share the same wiki store. Browser edits and AI tool calls see each other instantly.

### Safety built in

- Existing tiddlers aren't overwritten unless explicitly requested
- System tiddlers (`$:/`) are excluded by default
- File operations are restricted to safe directories
- IPC transport uses token-based authentication

## Getting started

### Quick start

```bash
tiddlywiki ./mywiki --mcp
```

Or with browser access:

```bash
tiddlywiki ./mywiki --mcp rw listen port=8080
```

Got a single-file wiki? Import it into a prepared wiki folder:

```bash
tiddlywiki ./mywiki --mcp file=path/to/wiki.html
```

The AI analyzes the tiddler structure and proposes a directory layout before writing anything to disk.

For full setup instructions (plugin installation, client configuration, environment setup), see the [Installation Guide](https://wikilabs.github.io/editions/tw-mcp/#MCP%20Installation).

## Demo

A real conversation -- the AI reads a tiddler and edits just the lines that need changing:

```
User: Fix the intro in GettingStarted

AI: Let me read the current content...
    [reads tiddler with hash anchors]
    
    I see the issue. I'll update lines 3-5.
    [sends only the changed lines with hash references]
    
    Done -- updated the intro.
```

Only the changed lines are sent. The rest of the tiddler is untouched.

## Current status

- **Version:** 0.6.1 (experimental)
- **Requires:** TiddlyWiki >= 5.4.0
- **License:** CC-BY-NC-SA 4.0 (BSD-3 pending)

Feedback, bug reports, and ideas welcome. Try it out and let me know what you think!
