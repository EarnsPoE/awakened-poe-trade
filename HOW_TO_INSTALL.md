# How to install the fork

This guide is for Windows. The fork has no installer or `.exe` download: you download its source code once and
start it with a desktop shortcut. The first start takes a few minutes; after that it starts in under a minute.

If you already use the regular Awakened PoE Trade, keep it installed. The fork uses the same settings, so your
hotkeys and preferences carry over, and you can switch back at any time.

## 1. Install Node.js and Git

You need both once.

1. **Node.js:** download the **LTS** version from <https://nodejs.org/> and run the installer with the default
   options.
2. **Git:** download it from <https://git-scm.com/download/win> and run the installer with the default options.

If you'd rather not install Git, you can download the code as a ZIP instead: on
<https://github.com/EarnsPoE/awakened-poe-trade> click **Code**, then **Download ZIP**, and extract it into a folder
such as `Documents\awakened-poe-trade`. Then skip the `git clone` line in step 2. Without Git, updating means
downloading a new ZIP (see "Updating").

## 2. Download the fork

1. Open the Start menu, type **PowerShell** and open **Windows PowerShell**.
2. Pick a folder for the fork. To put it in your Documents folder, type this and press Enter:

   ```powershell
   cd $HOME\Documents
   ```

3. Download it:

   ```powershell
   git clone https://github.com/EarnsPoE/awakened-poe-trade.git
   cd awakened-poe-trade
   ```

## 3. Create the desktop shortcut

In the same PowerShell window:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-dev-shortcut.ps1
```

This puts a shortcut named **APT Dev (clean start)** on your desktop. You only do this once. (`-ExecutionPolicy
Bypass` lets this one script run; Windows blocks downloaded scripts by default. It doesn't change any system
setting.)

You can close PowerShell now.

## 4. Start the fork

Double-click **APT Dev (clean start)** on your desktop. A window opens and:

1. Asks to close the regular Awakened PoE Trade if it is running. Type `y` and press Enter. (Both use the same
   hotkeys, so only one can run at a time.)
2. On the first start, downloads what the app needs. This takes a few minutes.
3. Opens two more windows, **APT renderer** and **APT main**. **Leave these two open** (you can minimize them):
   they are the overlay. Closing either one stops it.
4. Says "Ready" and closes itself after 10 seconds.

Use it in game exactly like the regular app: hover an item and press `Ctrl + D` to price check it, `Shift + Space`
for the overlay. Run Path of Exile in windowed or windowed fullscreen mode. What the fork adds is listed in
[FORK_CHANGES.md](./FORK_CHANGES.md).

## Stopping the fork and going back to the regular app

Close the **APT renderer** and **APT main** windows. Then start Awakened PoE Trade as usual. Settings you changed
in the fork are kept, because both use the same settings file.

## Updating

Open PowerShell in the fork's folder and run:

```powershell
cd $HOME\Documents\awakened-poe-trade
git pull
```

Then start the fork with the shortcut again. If the update needs new downloads, the shortcut gets them
automatically. If you used a ZIP, download and extract the new ZIP over the old folder.

## Troubleshooting

- **"node was not found" or "npm was not found":** Node.js isn't installed, or was installed after the window
  opened. Install it, then sign out of Windows and back in (or restart) and try again.
- **"Port ... is still in use":** something else, usually an old overlay window, is still running. Close any
  **APT renderer** / **APT main** windows and the regular app, then try again.
- **Hotkeys do nothing:** start the fork with the shortcut again; it starts everything from a clean state. Make
  sure the regular app isn't running too.
- **It stopped working after a while:** if the price-check window stops opening, the fork reloads it by itself
  within a few seconds. If that doesn't help, restart it with the shortcut.
- **Something failed:** the start window stays open with the error. A copy of its output is in
  `%TEMP%\apt-dev-clean-start.log`, and the overlay's own log is in
  `%APPDATA%\awakened-poe-trade\apt-data\overlay.log` (paste either path into File Explorer's address bar).

Questions about the app itself (hotkeys, settings, price-check window) are answered in upstream's
[FAQ](https://snosme.github.io/awakened-poe-trade/faq) and
[Quick Start](https://snosme.github.io/awakened-poe-trade/quick-start).
