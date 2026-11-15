# How this works

There are 2 main parts of the app:

1. renderer: this is the HTML/Javascript-based UI rendered within the Electron container. This runs Vue.js, a React-like Javascript framework for rendering front-end.
2. main: includes the main app (written in Electron). Handles keyboard shortcuts, brings up the UI and overlays.

Note that these 2 both depend on each other, and one cannot run without the other.

# How to develop

The most up-to-date instructions can always be derived from CI:

[.github/workflows/main.yml](https://github.com/SnosMe/awakened-poe-trade/blob/master/.github/workflows/main.yml)

Here's what that looks like as of 2026-08-01.

```shell
cd renderer
npm ci
npm run dev

# In a second shell
cd main
npm ci
npm run dev
```

# How to build

```shell
cd renderer
npm ci
npm run build

cd ../main
npm ci
npm run build
# We want to sign with a distribution certificate to ensure other users can
# install without errors
CSC_NAME="Certificate name in Keychain" npm run package
```

# Fork: data overrides

`renderer/public/data/<lang>/stats.ndjson` is generated upstream from game data, so it lags behind game patches.
The fork never edits it, which keeps it re-syncable from upstream as-is. Fork fixes go in the fork-owned
`renderer/public/data/stats-overrides.json` instead, which `buildStatOverrides` in
`renderer/src/assets/data/index.ts` layers on top of the upstream data at runtime.

## stats-overrides.json

The file is keyed by client language (`en`, `ru`, `ko`, `cmn-Hant`); a language with no entries can be left out.
`ref` is always the English stat text, in every language's list. Each entry is one of these kinds:

- **Alias matcher.** The game reworded a stat but its trade id is unchanged. Give the upstream `ref` and a matcher
  for the new text, which is added to that stat:
  `{ "ref": "#% increased Rarity of Items found", "matchers": [{ "string": "#% to Item Rarity" }] }`
- **New stat.** The stat is missing upstream entirely. Add a full object shaped like a `stats.ndjson` line, including
  `trade.ids`, with a `ref` that doesn't exist upstream.

Matcher strings are the item text with every number replaced by `#`, including a leading `+`/`-`
(`+12(11-14)% to Item Rarity` becomes `#% to Item Rarity`). Use `"negate": true` for the inverse ("reduced") wording.

## Confirming trade ids

Every id you add must exist on trade. Look it up in https://www.pathofexile.com/api/trade/data/stats (PoE1): find
the entry whose `text` is the stat with its numbers as `#`, and use its `id` (e.g. `explicit.stat_3917489142`). The
part after the dot is the stat hash, shared by that stat's `explicit.`, `implicit.`, ... variants. Open it once in a
browser rather than scripting it, since the trade API rate-limits.

# Fork: running the dev build

Start `npm run dev` in `renderer` first, then in `main`. The overlay only registers hotkeys once the renderer has
loaded its data and connected to main (127.0.0.1:8584), so a renderer that fails at startup looks like an app that
ignores every hotkey.

Vite reads the list of files in `renderer/public` once, when it starts. A file that appears there later (a branch
switch that adds one, a new overrides file) is served as `index.html`, and the renderer fails to parse it. **After
switching branches or adding a file under `renderer/public`, restart `npm run dev` in `renderer`, then in `main`.**
The generated `*.index.bin` files are the exception: they're written in the plugin's `config` hook, before Vite
looks at `public/`.

The dev build uses the same `%APPDATA%\awakened-poe-trade` folder as an installed Awakened PoE Trade. It reads the
installed app's settings but never saves changes to them (`ConfigStore` skips writes in dev). Close the installed app
first, since both would grab the same hotkeys.
