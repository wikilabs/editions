# 01 SimpleMap: a mind map of a tiddler structure

**Status: PROPOSED — 2026-10-29.** Rulings Q-1 to Q-13 below; Q-14 to Q-16 open; build waits for "implement".

Plugin `$:/plugins/wikilabs/simple-map` in `plugins/wikilabs/simple-map`, edition `editions/simple-map` with its dev
server `editions/simple-map-server`.

## Origin

The renderer is `mindmap.html` from the chat "jsmind library overview" (2026-03-01): no dependencies, jsMind's
`node_tree` data with `x`/`y` per node, the root at world `0,0` and every child relative to its parent, SVG edges, pan
by drag, zoom by wheel toward the cursor, drag a node (children follow), double-click or F2 edits, right-click menu,
Tab adds a child, Delete removes. SimpleMap keeps that renderer and builds the tree from tiddlers instead of a fixed
JSON.

## Usage

```
<$simple-map base="Projects" mode="tags" depth="3" layout="default" connector="spline" height="30em"/>
```

| Parameter | Values | Default |
|---|---|---|
| `base` | the root tiddler's title | current tiddler |
| `mode` | `tags`, `parent`, `links`, `aliases` | `tags` |
| `field` | the parent field of mode `parent` | `parent` |
| `depth` | levels below (or around) the base | `3` |
| `layout` | `default`, `top`, `left`, `right`, `bottom` | `default` |
| `connector` | `spline`, `rect` | `spline` |
| `height` | the map box's height | `30em` |

## Structure per mode

**Table 1: where children come from.** Every lookup uses an index that exists already; the plugin builds none.

| Mode | Children of a node | Index | Order |
|---|---|---|---|
| `tags` | `[<node>tagging[]]` | core TagIndexer | the tag tiddler's `list` |
| `parent` | `[<node>listed<field>]`, single title or title list | core cached listing | the node's `stream-list` when present (Streams), else as listed |
| `links` | right: `links[]` and `transcludes[]`; left: `backlinks[]` and `backtranscludes[]` | core BackIndexer (`link`, `transclude`) | text order |
| `aliases` | right: the tiddlers the node's alias links resolve to; left: `aliasbacklinks[]` | uni-link AliasIndexer, AliasBacklinkIndexer | text order |

- Mode `aliases` is offered only when uni-link is installed (Q-7 a).
- `links` and `aliases` are networks: outgoing on the right, incoming on the left, `depth` levels out (Q-6 a).
- A tiddler with several parents shows once under each (Q-5 b); a path stops at its first repeated title.

## Layout and positions

- **Layouts** (Q-3 a): `default` is the chat's free layout, children placed on both sides of the root; `top`,
	`left`, `right`, `bottom` are trees growing away from the root on that side. `connector` draws splines or
	rectangular elbows.
- **Automatic placement:** a node without a stored position is placed by the layout; a dragged node keeps its offset.
- **Storage** (Q-2 a, Q-13): one data tiddler per map, `$:/wikilabs/simple-map/<mode>/<base>`, JSON
	`{"<layout>": {"<path>": {"x": .., "y": ..}}}`. The path is the titles from the base, so the same tiddler can sit
	differently under each parent. Content tiddlers are never written for a position.

## Editing (Q-4 b)

**Table 2: the chat's edits on tiddlers.**

| Edit | `tags` | `parent` | `links` | `aliases` |
|---|---|---|---|---|
| label (double-click, F2) | writes `caption` when the tiddler has one, else `subtitle` (Q-12) | same | same | same |
| add child (Tab, menu) | new tiddler tagged with the node | new tiddler with `field` = the node; appended to the node's `stream-list` when it has one | new tiddler, `[[New]]` appended to the node's text (Q-11 a) | not offered |
| delete (Delete, menu) | removes the tag only (Q-10 a) | removes the node from the child's `field` and the parent's `stream-list` | Q-15 | not offered |
| open | menu item and Ctrl+click navigate to the tiddler | same | same | same |

- The label shows `caption`, else `subtitle`, else the title (Q-14 for Streams titles). A rename never happens.
- A new tiddler's title is "New Node", made unique by the wiki.

## Look (Q-8 a)

- Light first: every colour is a CSS variable `--wlsm-*` set from the current palette with `<<colour ..>>`, so a
	palette switch restyles the map. The chat's dark theme and its Google Fonts import are not used; the wiki's font is.
- The map sits in a box of `height`; pointer events serve mouse and touch (drag, pan, pinch zoom).
- Keys act only while the map has focus.

## Open

- **Q-14. Labels of Streams nodes.** Their titles are `$:/bullets/<uuid>` and they rarely have a caption.
	- a) (recommended) A system title without `caption` or `subtitle` shows the first line of its text, cut at 40
		characters.
	- b) The title as it is.
- **Q-15. Delete in mode `links`.**
	- a) (recommended) Not offered: a link lives in prose, and removing it from the text is not a structure edit.
	- b) Removes the `[[link]]` from the parent's text.
- **Q-16. The layout tiddler's title.**
	- a) (recommended) `$:/wikilabs/simple-map/<mode>/<base>`, overridable with a `layout-tiddler` parameter.
	- b) A field on the base tiddler naming it.

## Steps

1. The widget with the chat's renderer, mode `tags`, layout `default`, positions stored.
2. Mode `parent` with Streams order and edits.
3. Mode `links`, two-sided.
4. Mode `aliases` when uni-link is present.
5. Layouts `top`, `left`, `right`, `bottom`; connectors `spline`, `rect`.
6. The edition: readme, examples for each mode, the dev server.
