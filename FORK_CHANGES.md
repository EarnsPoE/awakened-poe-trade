# What this fork adds

Everything upstream [Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade) does, plus support for new
items sooner after a patch, sharper price-check filters and fixes for a few freezes. It includes upstream's 3.30
data. To install it, see [HOW_TO_INSTALL.md](./HOW_TO_INSTALL.md).

## Items upstream can't price check yet

- **Viscera (Wickerman body parts).** Price check by base, searched in the right slot (head, arm, body or leg),
  with filters for their implicits. English client only.
- **About 200 missing uniques.** League, legacy and race uniques and a few unique maps that trade lists but
  upstream doesn't know, so they no longer fail as "unknown item".
- **Maven's Invitations.** Ctrl+B opens the map check for them and rates their mods like a map.
- **Frayed Thread.** Price checks go to bulk exchange with your stack size.

## Better price-check filters

- **Open prefix / suffix.** Rares and magic items with a free affix slot get an "Open Prefixes" or "Open
  Suffixes" filter, so you can find items you can still craft on. Choose "Empty", "Crafted" (a bench mod you
  could remove) or either. Needs the advanced copy (Ctrl+Alt+C).
- **Corruption implicits searched on their own.** A corrupted "+14% to all Elemental Resistances" helmet is
  searched for that implicit instead of being folded into a resistance total that any helmet can match. Click a
  mod's implicit / explicit tag to search it as the other type.
- **Magic-only toggle.** Magic items get a Magic rarity chip, so rares stop mixing into the results.

## New hotkey

- **Alt + M opens PoEDB's modifier list** for the hovered item's class (for example all ring mods for a ring).
  Alt + D still opens the base item page. Change it under the item info settings.

## Fewer freezes

- **Mercenary Warrants with a 6-link skill** no longer freeze the price-check widget.
- **A stuck price-check widget recovers by itself.** If the overlay stops opening price checks, it reloads its
  window within seconds, keeping your settings and hotkeys. Errors are kept in
  `%APPDATA%\awakened-poe-trade\apt-data\overlay.log`.
- **Settings can't be corrupted by a crash.** They are saved safely with a backup copy (`config.json.bak`) that
  is used if the main file is ever damaged.

---

## For developers

The fork never edits upstream's generated game data (`renderer/public/data/<lang>/stats.ndjson` and
`items.ndjson`). Its data fixes live in `stats-overrides.json` and `items-overrides.json`, layered on top at
runtime, so upstream data can be re-synced as-is and dead overrides deleted. Formats, how to confirm trade ids and
how to prune after an upstream sync: [DEVELOPING.md](./DEVELOPING.md#fork-data-overrides).

Other developer-facing changes:

- `scripts/dev-clean-start.ps1` starts the dev build from a clean state; `scripts/install-dev-shortcut.ps1` adds a
  desktop shortcut for it. See [DEVELOPING.md](./DEVELOPING.md#fork-running-the-dev-build).
- The dev build saves settings (upstream's doesn't), atomically, in the config file the installed app uses.
- Data index files are generated before Vite starts, so a clean checkout no longer serves them as `index.html`.
- Data files are fetched with `cache: 'no-cache'`, so edited overrides are picked up on restart.
- Dev builds open Chromium remote debugging on `127.0.0.1:9222`.

The price-check and hotkey features and the index-file fix also exist as standalone branches on upstream
(`pr/mercenary-6link-crash`, `pr/magic-rarity-chip`, `pr/poedb-modifiers-hotkey`, `pr/open-affix-filters`,
`pr/corruption-implicit-filters`, `pr/dev-index-files`), without the overrides or fork docs. No pull request has
been opened upstream.

Full history: `git log $(git merge-base master upstream/master)..master`, with upstream added as
`git remote add upstream https://github.com/SnosMe/awakened-poe-trade`.

When a change lands on `master`, add it here in the same commit: user-facing changes under the headings above,
in a line or two, and anything internal under "For developers".
