# ![Awakener's Orb](https://web.poecdn.com/image/Art/2DItems/Currency/TransferOrb.png) Awakened PoE Trade

## About this fork

This is a fork of [SnosMe/awakened-poe-trade](https://github.com/SnosMe/awakened-poe-trade) that aims to recognize
new mods and items sooner after a game patch than upstream data updates do.

It differs from upstream in one way: upstream's generated game data (`renderer/public/data/<lang>/stats.ndjson`
and `items.ndjson`) is left untouched, and the fork's fixes live in separate, hand-maintained overrides files
(`renderer/public/data/stats-overrides.json` and `items-overrides.json`) that are layered on top at runtime.
Upstream data can therefore be re-synced as-is. See [DEVELOPING.md](./DEVELOPING.md#fork-data-overrides) for the
file formats.

Added so far: the reworded "+#% to Item Rarity" suffix, and the Viscera (Wickerman body parts) item class, with
[known gaps](./DEVELOPING.md#viscera-wickerman-body-parts).

All credit for the app goes to Alexander Drozdov and the upstream contributors. Like upstream, the fork is
distributed under the [MIT License](./LICENSE). For the official release, issues and support, use upstream.

[![](https://user-images.githubusercontent.com/4292308/153364874-dde23599-278c-4350-8d86-dadbc4b978b3.svg)](https://somsubhra.github.io/github-release-stats/?username=SnosMe&repository=awakened-poe-trade)
[![](https://user-images.githubusercontent.com/4292308/153364769-e4fe1e82-1bbc-46ac-8a3c-f5a98a5667cc.svg)](https://patreon.com/awakened_poe_trade)
[![](https://user-images.githubusercontent.com/4292308/153364565-7a545d26-e617-4a33-a919-ff90d8feda3d.svg)](https://github.com/SnosMe/awakened-poe-trade/issues/22)


➡ [Download for Windows & Linux](https://snosme.github.io/awakened-poe-trade/download) ⬅

## Tool showcase

| Gem | Rare | Unique | Currency |
|-----|------|--------|----------|
| ![](https://i.imgur.com/LTsH2DZ.png) | ![](https://i.imgur.com/2XL5Wl8.png) | ![](https://i.imgur.com/UTV6prE.png) | ![](https://i.imgur.com/dQ9Sns6.png) |

### Development

See [DEVELOPING.md](./DEVELOPING.md)

### Acknowledgments

- [libuiohook](https://github.com/kwhat/libuiohook)
- [RePoE](https://github.com/brather1ng/RePoE)
- [poeprices.info](https://www.poeprices.info/)
- [poe.ninja](https://poe.ninja/)

![](https://i.imgur.com/MATqhv7.png)
