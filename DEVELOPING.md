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

`renderer/public/data/<lang>/stats.ndjson` and `items.ndjson` are generated upstream from game data, so they lag
behind game patches. The fork never edits them, which keeps them re-syncable from upstream as-is. Fork fixes go in
two fork-owned files instead, which `renderer/src/assets/data/index.ts` layers on top of the upstream data at
runtime. In both, upstream data is looked up first and the overrides fill the gaps.

| File | Applied by | Holds |
|---|---|---|
| `renderer/public/data/stats-overrides.json` | `buildStatOverrides` | reworded, missing or under-tagged stats |
| `renderer/public/data/items-overrides.json` | `loadItems` | item bases missing upstream |

## stats-overrides.json

The file is keyed by client language (`en`, `ru`, `ko`, `cmn-Hant`); a language with no entries can be left out.
`ref` is always the English stat text, in every language's list. Each entry is one of these kinds:

- **Alias matcher.** The game reworded a stat but its trade id is unchanged. Give the upstream `ref` and a matcher
  for the new text, which is added to that stat:
  `{ "ref": "#% increased Rarity of Items found", "matchers": [{ "string": "#% to Item Rarity" }] }`
- **Extra trade ids (`addTradeIds`).** Trade gained a new id for a stat that exists upstream (for example, the stat
  can now roll as an implicit on a new item class). Give the upstream `ref`, no matchers, and the ids by mod type:
  `{ "ref": "+# to maximum Fortification", "matchers": [], "addTradeIds": { "implicit": ["implicit.stat_335507772"] } }`
  If a stat group holds several stats with that `ref` (local and global variants), the id goes only to the one that
  already uses the same stat hash. Because `ref` is English everywhere, repeat the entry under every language.
- **Replaced trade ids (`replaceTradeIds`).** Trade dropped the stat's old id and searching with it fails
  ("Unknown stat provided"). Give the upstream `ref`, no matchers, and the full new ids by mod type; they replace
  all of the stat's ids. Repeat the entry under every language:
  `{ "ref": "Grants Call of Steel", "matchers": [], "replaceTradeIds": { "explicit": ["explicit.effect_3467858890"] } }`
- **New stat.** The stat is missing upstream entirely. Add a full object shaped like a `stats.ndjson` line, including
  `trade.ids`, with a `ref` that doesn't exist upstream.

Matcher strings are the item text with every number replaced by `#`, including a leading `+`/`-`
(`+12(11-14)% to Item Rarity` becomes `#% to Item Rarity`). Use `"negate": true` for the inverse ("reduced") wording.

## Confirming trade ids

Every id you add must exist on trade. Look it up in https://www.pathofexile.com/api/trade/data/stats (PoE1): find
the entry whose `text` is the stat with its numbers as `#`, and use its `id` (e.g. `explicit.stat_3917489142`). The
part after the dot is the stat hash, shared by that stat's `explicit.`, `implicit.`, ... variants. Open it once in a
browser rather than scripting it, since the trade API rate-limits.

## items-overrides.json

Keyed by client language like the stats file. Each entry is a record shaped like an `items.ndjson` line, where
`name` is the base's name in that client language and `refName` its English name:
`{ "name": "Flaming Goat Hoof", "refName": "Flaming Goat Hoof", "namespace": "ITEM", "icon": "", "craftable": { "category": "Viscera" } }`

Overrides are only consulted when upstream has no base by that name, so an entry goes dead (and can be deleted)
once upstream ships the base. Base names come from https://www.pathofexile.com/api/trade/data/items.

Items that trade sells through bulk exchange (currency, fragments, ...) also carry `tradeTag`, the entry's `id` in
https://www.pathofexile.com/api/trade/data/static, and `"exchangeable": true`. With a `tradeTag` the price check
goes to bulk exchange instead of a search by base type. The other languages' names come from the same endpoint on
that language's trade site (`ru.pathofexile.com`, `poe.kakaogames.com`, `pathofexile.tw`); the ids are shared.

## Viscera (Wickerman body parts)

Supported through both files plus parser changes:

- `items-overrides.json`: the 161 bases in trade's `viscera` group (checked 2026-11-15, Covens league).
- `stats-overrides.json`: 96 implicit trade ids attached to existing stats with `addTradeIds` (all languages),
  138 new English implicit stats, and English matchers on 5 existing stats where the Viscera text words them
  differently ("… Damage #% Faster", "Enemies within 3 metres are Scorched", "Consume a Corpse within 5 metres").
  Stats whose text has no number but whose trade value is 100 ("Eat a Soul when …", "Trigger Level 1 Lesser Raise
  Spiders on Kill") use a `value: 100` matcher. 20 area/map-only implicits ("Area contains…", "Map Crafting…",
  "Monster Level", "Contains a Forge…") are skipped.
- Parser (`renderer/src/parser/Parser.ts`): the class is detected by its Wickerman help text; the "Lesser "/"Greater "
  tier prefix is stripped, since trade only knows the plain base; the slot line (Head / Upper Limb / Torso /
  Lower Limb) selects the trade sub-category `viscera.head|arm|body|leg`.

Known gaps:

- **No icons.** The trade items endpoint has no images, so `icon` is empty.
- **English clients only.** Base names and the `VISCERA_*` client strings exist only for `en`; other languages
  don't recognize Viscera (which is why those keys are optional in `TranslationDict`).
- **No `Rarity:` line** in the item text. The parser assumes Normal, which is how trade lists them.
- **Unmarked implicit with Ctrl+C.** The parser takes a section as the implicit only if every one of its lines
  parses as a known stat, so a `Note: ~price` section isn't mistaken for it. A Viscera whose implicit has a line
  trade can't search (see below) therefore gets no implicit filters from Ctrl+C text. Ctrl+Alt+C text has the
  `{ Implicit Modifier }` header and is parsed normally, with unknown lines listed as such.
- **Stat polarity.** The new stats' `better`/`negate`/`inverted` values were derived from the wording
  ("increased"/"reduced"/"more", "taken", ...) and then reviewed by hand against the rolls on
  https://poedb.tw/us/Viscera. Stats where a higher number is worse for the player (more reservation, more
  physical damage taken per level, a larger Fire Exposure penalty given as a negative number, faster Taunted
  enemies) are marked `better: -1`.
- **Implicit lines trade can't search.** Trade has no stat for these, so they stay unknown (checked against
  poedb and trade's stats list on 2026-11-15): "Kill Undead Enemies that have 15% or lower Life when Hit by your
  Skills" (Noble's Head), "Melee Critical Strikes Poison the Enemy" (Inquisitor's Head), "Your chance to cause
  monsters to Flee on Hit is also chance to Terrify Monsters on Hit" (Scarecrow's Pitchfork), "#% increased Action
  Speed while Ignited" (Primate Foot), "Damaging Ailments inflicted by Minions deal damage #% Faster" (Infected
  Leg), "Grants Level 1 Lesser Raise Spiders" and "Grants Level 20 Summon Void Spawn".
- **Bases poedb lists but trade doesn't:** Hallowed Descry, Severed Scythe-hand, Spiked Carapace. They are left
  out until trade knows them.
- **No tier filter.** Trade groups Lesser and Greater under one base, so tier can't be searched on.
- Not yet confirmed with a live price check in the overlay.

## Threads (Map Fragments)

The Thread items poedb lists (https://poedb.tw/us/Threads#ThreadItem) are stackable and have no modifiers of their
own, so they only need bases in `items-overrides.json`, in all four languages, each with its bulk exchange
`tradeTag` and icon (checked 2026-11-15 against each trade site's `data/static`):

- The ten typed Threads (Expedition, Abyss, Breach, Ritual, Ultimatum, Legion, Blight, Bestiary, Betrayal,
  Incursion; item class Map Fragments, trade group "Fragments, Threads & Mapping").
- Frayed Thread (Stackable Currency), which opens into a random Thread.
- Two other new Thread-related items trade sells in bulk: Maven's Chisel of Threads and Threaded Delirium Orb.

A Thread price check goes to bulk exchange like other fragments, with the copied stack size as the stock filter.
No parser change was needed. Not yet confirmed with a live price check in the overlay.

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

## Granted skills and supports ("Supported by", "Grants Level")

Trade moved every "Socketed Gems are Supported by Level # …" and "Grants Level # …" / "Grants Summon …" stat to
new `effect_<hash>` ids (one hash per gem, shared by explicit, implicit and enchant), and dropped most of the old
`stat_<hash>` ids that upstream `stats.ndjson` still uses. The game text changed with it: supports now end in
" Support" ("… Supported by Level 10 Increased Area of Effect Support") and granted skills no longer end in
" Skill". Upstream doesn't recognize either wording, which includes the corrupted implicits on uniques.

`stats-overrides.json` adds one English stat per `effect_` id in trade's stats list (checked 2026-11-16, Covens
league), worded exactly like trade's text, with the ids for every mod type trade lists. Two stats whose text
didn't change ("Grants Level # Savage Barnacle", "Grants Call of Steel") get `replaceTradeIds` in every language.
"Grants Level # Herald of Agony" and "… Herald of Purity" exist on trade only as scourge mods, which APT doesn't
search, so they're skipped. Other languages keep the upstream wording and ids, since the translated texts aren't
known.
