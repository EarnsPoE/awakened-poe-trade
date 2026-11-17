# Fork changes

Everything this fork changes compared with upstream
[SnosMe/awakened-poe-trade](https://github.com/SnosMe/awakened-poe-trade), grouped by feature.

- **Upstream base:** `3188208` "use x11 for dev mode too" (2026-09-25), the merge base of `master` and
  `origin/master`.
- **Fork tip described here:** `master` at `6b2c19e` (2026-11-16).
- **Size:** 21 commits plus 5 merges, 34 files, +2281 / -46 lines (`git diff --stat 3188208 master`).

Upstream's generated game data (`renderer/public/data/<lang>/stats.ndjson` and `items.ndjson`) is never edited.
Data fixes live in two fork-owned overrides files that are layered on top at runtime, so upstream data can be
re-synced as-is. When upstream ships an equivalent fix, the matching override goes dead and can be deleted.

Keep this file up to date: add an entry in the same commit, or merge, that lands a change on `master`. The
commands at the end regenerate the raw inventory to check against.

## Contents

1. [Data overrides layer](#1-data-overrides-layer)
2. [Reworded "+#% to Item Rarity" suffix](#2-reworded-to-item-rarity-suffix)
3. [Viscera item class](#3-viscera-item-class)
4. [Thread fragment items](#4-thread-fragment-items)
5. ["Supported by" and "Grants Level" mods on new trade ids](#5-supported-by-and-grants-level-mods-on-new-trade-ids)
6. [Magic rarity chip in the default price-check preset](#6-magic-rarity-chip-in-the-default-price-check-preset)
7. [PoEDB item class modifiers hotkey (Alt + M)](#7-poedb-item-class-modifiers-hotkey-alt--m)
8. [Mercenary Warrant 6-Link crash fix](#8-mercenary-warrant-6-link-crash-fix)
9. [Recovery from a wedged overlay UI, and a persistent log](#9-recovery-from-a-wedged-overlay-ui-and-a-persistent-log)
10. [Settings saved in the dev build, atomically with a backup](#10-settings-saved-in-the-dev-build-atomically-with-a-backup)
11. [Dev build: data index files generated before Vite starts](#11-dev-build-data-index-files-generated-before-vite-starts)
12. [Dev build: one-click clean start](#12-dev-build-one-click-clean-start)
13. [Documentation](#13-documentation)
14. [Overrides data at a glance](#14-overrides-data-at-a-glance)
15. [Not on master](#15-not-on-master)
16. [Known stale text](#16-known-stale-text)
17. [Every file changed](#17-every-file-changed)
18. [Regenerating this inventory](#18-regenerating-this-inventory)

---

## 1. Data overrides layer

**Commits:** `f9625bb` (stats layer), `f61cf82` (`addTradeIds`), `c77461c` (items layer), `4123ecb`
(`replaceTradeIds`)
**Files:** `renderer/src/assets/data/index.ts`, `renderer/public/data/stats-overrides.json`,
`renderer/public/data/items-overrides.json`

No user-facing behaviour on its own; it is what the data fixes below are built on.

- `stats-overrides.json` is keyed by client language and loaded at init. `buildStatOverrides()` applies it per
  language in `loadStats()`. `STAT_BY_REF_V2`, `STAT_BY_MATCH_STR_V2` and `STATS_ITERATOR` all go through the layer,
  so lookups by ref, by item text and by iteration agree. Upstream is tried first; overrides are consulted only on
  a miss, and returned as clones so callers can't mutate shared override data.
- Four entry kinds:
  - **Alias matcher** `{ ref, matchers }`: adds matchers for new wording to an upstream stat (trade id unchanged).
  - **New stat**: a full `stats.ndjson`-shaped object with `trade.ids` and a `ref` that doesn't exist upstream.
  - **`addTradeIds`** `{ ref, matchers: [], addTradeIds: { <type>: [ids] } }`: merges extra trade ids into an
    upstream stat (e.g. an existing stat that can now roll as an implicit on a new class). When a ref is ambiguous
    (local and global variants share it), the id goes only to the stat that already uses the same stat hash.
  - **`replaceTradeIds`**: replaces all of a stat's trade ids, for when trade dropped the old id and searching it
    fails with "Unknown stat provided".
- `ref` is English in every language, so entries that apply everywhere are repeated under `en`, `ru`, `ko` and
  `cmn-Hant`.
- `items-overrides.json` holds `items.ndjson`-shaped `BaseType` records per language. `loadItems()` wraps
  `ITEM_BY_TRANSLATED` and `ITEM_BY_REF` (upstream first, overrides on a miss, clones returned). Override records
  are appended after the upstream lines behind `ITEMS_ITERATOR`, so the byte offsets in upstream's index files stay
  valid.

Format and how to confirm trade ids: `DEVELOPING.md`, "Fork: data overrides".

## 2. Reworded "+#% to Item Rarity" suffix

**Commit:** `913e933` · **File:** `stats-overrides.json` (data only)

The game now prints the "of Raiding"-family suffix as `+X% to Item Rarity` instead of
`X% increased Rarity of Items found`, so upstream didn't recognise it and price checks dropped the mod. An English
alias matcher on the existing stat fixes it; the trade id (`explicit.stat_3917489142`) is unchanged.

**User-facing:** gloves, boots, rings and so on with this suffix get the rarity mod back as a price-check filter.

## 3. Viscera item class

**Commits:** `54339cf` (parser and trade), `9086734` (bases and stats), `be01034` (docs), `e59e411` (stricter
implicit detection), `5995097` (stat polarity), `2d5c76d` (missed wordings)
**Files:** `renderer/src/parser/Parser.ts`, `ParsedItem.ts`, `meta.ts`, `renderer/src/assets/data/interfaces.ts`,
`renderer/public/data/en/client_strings.js`, `renderer/public/data/en/app_i18n.json`,
`renderer/src/web/price-check/filters/{FilterName.vue,create-item-filters.ts,create-presets.ts,interfaces.ts}`,
`renderer/src/web/price-check/trade/pathofexile-trade.ts`, both overrides files

Viscera (Wickerman body parts) used to price check as "Unknown Item".

- **Parser:** the class is detected by its Wickerman help text (`VISCERA_HELP`), since there is no `Rarity:` line;
  rarity is set to Normal, as trade lists them. The `Lesser ` / `Greater ` tier prefix is stripped (trade only knows
  the plain base). The slot line (Head / Upper Limb / Torso / Lower Limb) is stored as `item.visceraSlot`.
- **Unmarked implicit in Ctrl+C text:** a section is taken as the implicit only if every line parses as a known stat
  (multi-line stats count as one) and there is at least one, so a `Note: ~price` section isn't mistaken for it.
  Ctrl+Alt+C text has the `{ Implicit Modifier }` header and goes through the normal modifier parser.
- **Trade:** `ItemCategory.Viscera` maps to the `viscera` category. A search filter can carry a more specific
  `tradeCategory`, so the relaxed search uses `viscera.head|arm|body|leg` from the slot, and `FilterName` shows that
  label (new `app_i18n` keys). Viscera are listed with the classes that skip rare-item presets.
- **Data:** 161 English bases from trade's `viscera` group (2026-11-15, Covens). 251 implicit trade ids upstream
  didn't have: 96 attached to existing stats with `addTradeIds` (all four languages), 135 new English stats, 20
  area/map-only ids skipped. Then 5 alias matchers for Viscera wording ("... Damage #% Faster", "Enemies within 3
  metres are Scorched", "Consume a Corpse within 5 metres"), Witch's Head's two-line stat, `value: 100` matchers for
  two number-less stats, and 3 more new stats (Petrification Statue, inverted Cold / Fire resistance).
- **Polarity review:** every new stat's `better` direction was checked against poedb's rolls; five are
  `better: -1` (Mana Reservation, Reservation, Physical Damage taken per Level, Fire Exposure, Taunted enemies'
  Action Speed).

**User-facing:** English clients can price check Viscera by base, with slot-specific category search and implicit
filters.
**Known gaps** (detailed in `DEVELOPING.md`): no icons, English client only (`VISCERA_*` strings are optional in
`TranslationDict`), no tier filter, a few implicit lines trade has no stat for, three bases poedb lists but trade
doesn't.

## 4. Thread fragment items

**Commit:** `071c719` · **Files:** `items-overrides.json`, `DEVELOPING.md` (data only)

Threads are new this league and were "unknown item". Added for `en`, `ru`, `ko` and `cmn-Hant`, with the bulk
exchange `tradeTag`, `exchangeable: true` and icons from each trade site's `/api/trade/data/static` (2026-11-15):

- the ten typed Threads (Expedition, Abyss, Breach, Ritual, Ultimatum, Legion, Blight, Bestiary, Betrayal,
  Incursion)
- Frayed Thread
- Maven's Chisel of Threads and Threaded Delirium Orb

**User-facing:** price checking any of them opens bulk exchange with the copied stack size as the stock filter, in
all four client languages. No parser change.

## 5. "Supported by" and "Grants Level" mods on new trade ids

**Commits:** `4123ecb` (`replaceTradeIds` kind), `028f4af` (data) · merged in `0bdf802`
**Files:** `renderer/src/assets/data/index.ts`, `stats-overrides.json`, `DEVELOPING.md`

Trade moved every "Socketed Gems are Supported by Level # ..." and "Grants Level # ..." / "Grants Summon ..." stat
to `effect_<hash>` ids and dropped most old `stat_` ids. The game wording changed too: supports end in " Support",
granted skills drop " Skill". Upstream recognises neither, including corrupted implicits on uniques.

- 277 new English stats, one per `effect_` id in trade's stats list (2026-11-16, Covens), worded like trade, with
  ids for every mod type trade lists.
- "Grants Level # Savage Barnacle" and "Grants Call of Steel" (text unchanged) get `replaceTradeIds` in every
  language. Petrification Statue gets its explicit id.
- Herald of Agony / Purity are scourge-only on trade and skipped. Other languages keep upstream wording and ids.

**User-facing:** e.g. a corrupted "Supported by Level 10 Increased Area of Effect Support" implicit is now a
searchable filter (`implicit.effect_3737592146`), and searches no longer fail on dropped ids.

## 6. Magic rarity chip in the default price-check preset

**Commit:** `5c568f4` · **File:** `renderer/src/web/price-check/filters/create-item-filters.ts`

The default "Pseudo" preset for an identified Magic item sent `rarity: nonunique` with no rarity control, so rares
were mixed into the results. `createFilters` now creates the off-by-default Magic chip for every preset of a Magic
item, not only exact/base-item presets.

**User-facing:** a Magic chip appears on Magic rings, amulets, weapons, armour and non-adorned jewels; turning it on
restricts results to Magic. Default query is still `nonunique`. Adorned-jewel Magic jewels (chip on), maps / heist /
logbooks / charts and flasks / tinctures / charms (no chip) are unchanged.

## 7. PoEDB item class modifiers hotkey (Alt + M)

**Commit:** `c508826` · merged in `13da4db`
**Files:** `renderer/src/web/item-check/poedb-mods.ts` (new), `hotkeyable-actions.ts`, `WidgetItemCheck.vue`,
`settings-item-check.vue`, `widget.ts`, `renderer/src/web/Config.ts`, `app_i18n.json` (`en`, `ru`, `ko`)

New item-check hotkey, default **Alt + M** (widget key `poedbModsKey`, action `open-poedb-mods`), that opens PoEDB's
modifier list for the hovered item's class, e.g. a Sapphire Ring opens `https://poedb.tw/us/Rings#ModifiersCalc`.
Alt + D still opens the base item page.

- Weapons, jewellery, quivers, trinkets, tinctures, contracts and blueprints use the class page (Rapiers/Foils go
  to `Thrusting_One_Hand_Swords`).
- Armour pages are split by attribute from the base's armour / evasion / energy shield (`Body_Armours_str_dex`, ...).
- Flasks go to Life / Mana / Utility Flasks; hybrid flasks to the `Hybrid_Flasks` overview (no modifier list there).
- Jewels, cluster jewels, ward armour and heist gear go to their base page, which carries its own modifier list.
- Existing configs get Alt + M only if no other setting already uses it (a hotkey bound twice disables both). No
  `configVersion` bump, to stay mergeable with upstream.

## 8. Mercenary Warrant 6-Link crash fix

**Commit:** `8864e9d` · merged in `03dc786`
**Files:** `renderer/src/web/price-check/filters/pseudo/mercenary.ts`, `filters/interfaces.ts`,
`trade/pathofexile-trade.ts`

Upstream bug. Expanding a Mercenary Warrant skill with five supports threw "Cannot read properties of undefined
(reading 'roll')" (and "reading 'type'" with the mods toggle on), which wedged the price-check widget. The 6-Link
filter passed support-gem families through `sources` as fake `StatSource`s. They now live in
`StatFilter.mercenaryFamilies` and `sources` is empty. The generated trade query is byte-identical.

**User-facing:** Mercenary Warrants with 6-link skills price check without freezing the widget.

## 9. Recovery from a wedged overlay UI, and a persistent log

**Commit:** `0eceddc`
**Files:** `renderer/src/web/background/wedge-recovery.ts` (new), `renderer/src/main.ts`, `main/src/main.ts`,
`main/src/RemoteLogger.ts`, `main/src/windowing/OverlayWindow.ts`

Price checks could silently stop opening until restart: once an error aborts a Vue 3.2 scheduler flush, every later
patch throws "Cannot read properties of null (reading 'emitsOptions')".

- The renderer watches for these errors (thrown in dev, `console.error` in prod), saves settings and reloads the
  page. The main process keeps running, so hotkeys and the game attachment survive. A second wedge within 30 s of a
  reload is only logged, to avoid a loop.
- Main copies the UI's console errors into its log (at most 20 a minute) and also reloads the UI if the renderer
  process dies (`render-process-gone`).
- The log is also written to `%APPDATA%\awakened-poe-trade\apt-data\overlay.log`, which survives restarts, with a
  start banner per launch, rotated to `overlay.log.1` above 2 MB.
- Dev builds only: Chromium remote debugging on `127.0.0.1:9222` to inspect a stuck UI without a restart.

**User-facing:** a wedged price-check widget recovers on its own within one reload; errors can be read afterwards in
`overlay.log`.

## 10. Settings saved in the dev build, atomically with a backup

**Commit:** `158bace` · merged in `fe20a2a` · **File:** `main/src/host-files/ConfigStore.ts`

Upstream skips settings saves in dev builds; the fork runs the dev build day to day, so edits were lost on restart
and on wedge-recovery reloads.

- Saves run in dev builds too, queued one at a time.
- Each save writes `config.json.writing`, fsyncs it, copies the previous good `config.json` to `config.json.bak`
  (via its own temp file and rename), then renames the new file over `config.json`. Renames retry briefly, for
  Windows antivirus / indexer locks.
- Load waits for any save in progress, and falls back to `config.json.bak` if `config.json` is missing or not valid
  JSON.

**User-facing:** settings persist in the dev build, and a crash mid-save can no longer corrupt `config.json`. Note
that the dev build and an installed Awakened PoE Trade share `%APPDATA%\awakened-poe-trade\apt-data\config.json`.

## 11. Dev build: data index files generated before Vite starts

**Commit:** `30da9f4` · **Files:** `renderer/src/assets/vite-plugin-make-indexes.ts`, `DEVELOPING.md`

On a clean checkout the gitignored `renderer/public/data/<lang>/*.index.bin` files were generated after Vite had
cached the `public/` listing, so they were served as `index.html` and the renderer died with
"byte length of Uint32Array should be a multiple of 4" before connecting to main (no hotkeys worked). The plugin now
also generates them in its `config` hook. Developer-facing only.

## 12. Dev build: one-click clean start

**Commit:** `c6fa594` · merged in `6b2c19e`
**Files:** `scripts/dev-clean-start.ps1`, `scripts/install-dev-shortcut.ps1` (both new)

`dev-clean-start.ps1` brings the dev build up from a known state:

- Asks, then closes the installed app and any running dev overlay with their own quit request; force-kills only one
  that doesn't exit within 15 s. Then stops Vite / esbuild / npm leftovers.
- Runs `npm ci` in `renderer/` or `main/` only when `package-lock.json` changed (hash stamp in `node_modules`).
- Clears Vite's dependency cache and `main/dist`, regenerates the data index files.
- Starts each half in its own window, waits until the renderer serves both overrides files as real JSON, then starts
  main and waits for `127.0.0.1:8584`.
- Readable errors, transcript at `%TEMP%\apt-dev-clean-start.log`. Flags: `-ListOnly`, `-Force`, `-ForceInstall`.

`install-dev-shortcut.ps1` puts an "APT Dev (clean start)" shortcut for the checkout on the desktop.

## 13. Documentation

**Commits:** `0ad889a`, `be01034`, plus doc updates in `f9625bb`, `30da9f4`, `e59e411`, `5995097`, `2d5c76d`,
`071c719`, `028f4af`

- `README.md`: "About this fork" section under the title (purpose, the overrides approach, link to upstream, credit
  and MIT License). `LICENSE` is unchanged.
- `DEVELOPING.md`: "Fork: data overrides" (file table, entry kinds, confirming trade ids, items format, Viscera,
  Threads, Supported by / Grants Level) and "Fork: running the dev build".
- `FORK_CHANGES.md`: this file.

## 14. Overrides data at a glance

Counts on `master` at `6b2c19e`.

| `stats-overrides.json` | Entries | Alias | `addTradeIds` | `replaceTradeIds` | New stats |
|---|---:|---:|---:|---:|---:|
| `en` | 518 | 6 | 95 | 2 | 415 |
| `ru`, `ko`, `cmn-Hant` (each) | 97 | 0 | 95 | 2 | 0 |

The 415 new English stats are 138 Viscera implicits and 277 `effect_` "Supported by" / "Grants" stats. The 6 aliases
are the Item Rarity suffix and 5 Viscera wordings. 95 `addTradeIds` entries carry the 96 Viscera implicit ids.

| `items-overrides.json` | Entries |
|---|---:|
| `en` | 174 (161 Viscera bases, 13 Thread items) |
| `ru`, `ko`, `cmn-Hant` (each) | 13 (Thread items) |

## 15. Not on master

- **Rare/unique-nearby attack speed mod:** in progress in another thread, not committed to `master` yet. Add it
  here when it lands.
- `backup/stat-overrides-20261115` and `backup/viscera-20261115`: pre-rewrite snapshots kept before the history was
  cleaned up on 2026-11-15. Their content is on `master` in rewritten form; they are not separate features.

All other local branches (`fork/*`, `feature/*`, `fix/*`) are fully merged into `master`.

## 16. Known stale text

None. `DEVELOPING.md` and the close prompt in `scripts/dev-clean-start.ps1` used to say the dev build never saves
settings; both were corrected after section 10 landed.

## 17. Every file changed

| File | +/- | Section |
|---|---|---|
| `DEVELOPING.md` | +142 | 13 |
| `README.md` | +17 | 13 |
| `main/src/RemoteLogger.ts` | +24 -1 | 9 |
| `main/src/host-files/ConfigStore.ts` | +59 -8 | 10 |
| `main/src/main.ts` | +6 | 9 |
| `main/src/windowing/OverlayWindow.ts` | +27 | 9 |
| `renderer/public/data/en/app_i18n.json` | +7 -1 | 3, 7 |
| `renderer/public/data/en/client_strings.js` | +6 | 3 |
| `renderer/public/data/items-overrides.json` | +223 (new) | 1, 3, 4 |
| `renderer/public/data/ko/app_i18n.json` | +1 | 7 |
| `renderer/public/data/ru/app_i18n.json` | +1 | 7 |
| `renderer/public/data/stats-overrides.json` | +819 (new) | 1, 2, 3, 5 |
| `renderer/src/assets/data/index.ts` | +145 -6 | 1, 5 |
| `renderer/src/assets/data/interfaces.ts` | +7 | 3 |
| `renderer/src/assets/vite-plugin-make-indexes.ts` | +5 | 11 |
| `renderer/src/main.ts` | +3 | 9 |
| `renderer/src/parser/ParsedItem.ts` | +2 | 3 |
| `renderer/src/parser/Parser.ts` | +47 | 3 |
| `renderer/src/parser/meta.ts` | +2 -1 | 3 |
| `renderer/src/web/Config.ts` | +15 | 7 |
| `renderer/src/web/background/wedge-recovery.ts` | +77 (new) | 9 |
| `renderer/src/web/item-check/WidgetItemCheck.vue` | +1 | 7 |
| `renderer/src/web/item-check/hotkeyable-actions.ts` | +8 -3 | 7 |
| `renderer/src/web/item-check/poedb-mods.ts` | +97 (new) | 7 |
| `renderer/src/web/item-check/settings-item-check.vue` | +4 | 7 |
| `renderer/src/web/item-check/widget.ts` | +1 | 7 |
| `renderer/src/web/price-check/filters/FilterName.vue` | +1 -1 | 3 |
| `renderer/src/web/price-check/filters/create-item-filters.ts` | +5 -1 | 3, 6 |
| `renderer/src/web/price-check/filters/create-presets.ts` | +2 -1 | 3 |
| `renderer/src/web/price-check/filters/interfaces.ts` | +5 | 3, 8 |
| `renderer/src/web/price-check/filters/pseudo/mercenary.ts` | +6 -18 | 8 |
| `renderer/src/web/price-check/trade/pathofexile-trade.ts` | +5 -5 | 3, 8 |
| `scripts/dev-clean-start.ps1` | +488 (new) | 12 |
| `scripts/install-dev-shortcut.ps1` | +23 (new) | 12 |


## 18. Regenerating this inventory

```sh
base=$(git merge-base master origin/master)   # origin = upstream SnosMe/awakened-poe-trade
git log --reverse --no-merges --format='%h %ad %s' --date=short "$base"..master
git diff --stat "$base" master
git branch --no-merged master
```

If `origin` is renamed to `upstream` when the fork is published, use `upstream/master` instead.
