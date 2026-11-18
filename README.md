# ![Awakener's Orb](https://web.poecdn.com/image/Art/2DItems/Currency/TransferOrb.png) Awakened PoE Trade

## About this fork

A fork of [SnosMe/awakened-poe-trade](https://github.com/SnosMe/awakened-poe-trade) that supports new items and mods
sooner after a patch, adds open-affix and corruption-implicit price-check filters, a PoEDB modifiers hotkey and a few
crash fixes. See [FORK_CHANGES.md](./FORK_CHANGES.md) for the list.

### Install and run (Windows)

There is no installer for the fork; it runs from source. Install [Node.js](https://nodejs.org/) (LTS) and
[Git](https://git-scm.com/download/win), then in PowerShell:

```powershell
git clone https://github.com/EarnsPoE/awakened-poe-trade.git
cd awakened-poe-trade
powershell -ExecutionPolicy Bypass -File scripts\install-dev-shortcut.ps1
```

Start it with the **APT Dev (clean start)** shortcut on your desktop and keep the two console windows it opens.
It closes the installed Awakened PoE Trade first and uses the same settings. To update: `git pull`, then start it
again. Step-by-step guide and troubleshooting: [HOW_TO_INSTALL.md](./HOW_TO_INSTALL.md).

All credit for the app goes to Alexander Drozdov and the upstream contributors. Like upstream, the fork is
distributed under the [MIT License](./LICENSE). For the official release, issues and support, use upstream.

[![](https://user-images.githubusercontent.com/4292308/153364874-dde23599-278c-4350-8d86-dadbc4b978b3.svg)](https://somsubhra.github.io/github-release-stats/?username=SnosMe&repository=awakened-poe-trade)
[![](https://user-images.githubusercontent.com/4292308/153364769-e4fe1e82-1bbc-46ac-8a3c-f5a98a5667cc.svg)](https://patreon.com/awakened_poe_trade)
[![](https://user-images.githubusercontent.com/4292308/153364565-7a545d26-e617-4a33-a919-ff90d8feda3d.svg)](https://github.com/SnosMe/awakened-poe-trade/issues/22)


➡ [Download upstream for Windows & Linux](https://snosme.github.io/awakened-poe-trade/download) (the official release, without the fork's changes) ⬅

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
