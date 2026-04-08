Hi foks, 
I want to introduce my take on a TW MCP server, that I personally use to develop new TW code and especially **TW wikitext**. I use this server in conjunction with TW devtools [1], which has detailed info about internals and variables "in context".

**Works with TW >= v5.4.0**

<big>Plugin: https://wikilabs.github.io/editions/tw-mcp</big>

## What is it?

**TW MCP** is a plugin that turns any TiddlyWiki into an AI-accessible knowledge base. It uses the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) -- an open standard that lets AI assistants talk to external tools. Once enabled, assistants like Claude, Gemini, and others can read, search, render, and edit your wiki directly. No copy-pasting, no exporting.

> **Who is this for?** You'll need Node.js and an MCP-compatible AI client -- desktop apps like [Claude Desktop](https://claude.ai/download) work, as do CLI tools like [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [Gemini CLI](https://github.com/google-gemini/gemini-cli). If you're comfortable running `tiddlywiki` from a terminal, you're good.

After [plugin installation](https://wikilabs.github.io/editions/tw-mcp/#MCP%20Installation), one command is all it takes:

```bash
tiddlywiki ./mywiki --mcp
```

Your wiki is now an MCP server. Any MCP-compatible AI client can connect to it.

## What can the AI do with this MCP server?

### Read & explore

- **Get tiddlers** -- fetch metadata or full content
- **List & search** -- browse by tag, run filter expressions, search across your wiki
- **Render** -- render tiddlers, fields, or arbitrary wikitext to plain text or HTML, including through the ViewTemplate cascade (so the AI sees what the browser shows)
- **Inspect** -- analyse widget trees, trace source positions, inspect variable scopes, and navigate TiddlyWiki's internal `$tw` object
- **Wiki info** -- plugins, themes, tiddler counts, settings at a glance

### Write (opt-in)

Writing is disabled by default. You explicitly enable it with `--mcp rw`.

- **Create, edit, delete tiddlers** -- the AI can modify your wiki when you allow it
- **Upload files** -- images, PDFs, and other binary files can be uploaded with an "external" command 'tw-upload', that does not use any tokens
- **Save as folder** -- export the wiki as a node.js folder structure, ready for version control or deployment. Directly executed by the mcp-server. Minimal tokens needed
- **Build HTML** -- render the entire wiki as a single HTML file the mcp-server can produce on demand

## Key features

### Token-aware by design

AI assistants charge by the token, so the server is careful about how much data it sends:

- **Metadata first** -- when you ask "show me the tiddler GettingStarted", the AI gets field names, tags, and dates -- but not the full text. Only when you say "show me the full contents" or "I want to edit it" does it fetch the body.
- **Small edits, small cost** -- changing a line in a long tiddler sends only that line, not the whole tiddler.
- **Large results stay manageable** -- browsing deep internal structures or running broad filters automatically caps the output size, so you don't burn tokens on data you didn't ask for.

Built-in conflict detection means two editors (human and AI, or two AI clients) can't silently overwrite each other.

### Readonly by default

The server starts in readonly mode. Safe for exploration, analysis, and Q&A. Enable writes only when you need them.

### Multiple clients at once

Several AI clients can connect to the same wiki simultaneously. The first process becomes the primary server; others relay through it automatically. No conflicts, no stale data.

Want to see changes in the browser too? Start with `--mcp rw listen` -- the HTTP server and MCP server share the same wiki store. Browser edits and AI edits see each other instantly.

### Safety built in

- Existing tiddlers aren't overwritten unless explicitly requested
- System tiddlers (`$:/`) are excluded by default
- File operations are restricted to safe directories
- Internal communication between tools is authenticated

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

The mcp-server analyzes the tiddler structure and proposes a directory layout before writing anything to disk.

For full setup instructions (plugin installation, client configuration, environment setup), see the [Installation Guide](https://wikilabs.github.io/editions/tw-mcp/#MCP%20Installation).

## Demo

A real conversation -- you ask in plain language, the AI does the rest:

```
User: Fix the typo in the intro of GettingStarted

AI: Let me read the current content...

    1#VW: !! Introduction
    2#MV: 
    3#TR: ''Works with TW >= v5.4.0''
    4#SW: 
    5#TY: The ''TW MCP'' plugin adds a ... standarsied interface.

    I see "standarsied" on line 5. I'll fix that.
    [sends only line 5 with the corrected spelling]
    
    Done -- fixed "standardised" in GettingStarted.
```

The AI reads your tiddler, identifies the problem, and sends only the changed line. The `1#VW:` prefixes are content hashes -- if someone else edited the tiddler since the AI read it, the hashes won't match and the edit is safely rejected. No silent overwrites.

## Current status

- **Version:** 0.6.1 (experimental)
- **Requires:** TiddlyWiki >= 5.4.0
- **License:** CC-BY-NC-SA 4.0 (BSD-3 pending)
- **Full documentation:** [wikilabs.github.io/editions/tw-mcp](https://wikilabs.github.io/editions/tw-mcp/)

Feedback, bug reports, and ideas welcome. Try it out and let me know what you think!

[1] [TW devtools plugin](https://wikilabs.github.io/editions/devtools/)