<#
.SYNOPSIS
  Clean start of the local Awakened PoE Trade dev build (renderer + main).

.DESCRIPTION
  1. Closes the installed Awakened PoE Trade and any running dev overlay,
     since they compete for the same global hotkeys and dev ports. It asks
     first, then asks each Electron app to quit the way its own Quit action
     does, and force-kills only one that does not exit in time. The Vite and
     esbuild watchers are then stopped.
  2. Runs `npm ci` in renderer/ and main/ only when package-lock.json changed
     since the last install done by this script (or node_modules is missing).
  3. Clears Vite's dependency cache and the old main/dist bundle.
  4. Regenerates the *.index.bin data indexes, so a broken ndjson file fails
     here with a readable error instead of inside Vite.
  5. Starts the renderer in its own window and waits until it serves the
     fork's override JSON files as real JSON (Vite answers unknown public/
     paths with index.html, which would make the overlay load bad data).
  6. Starts main in its own window and waits for Electron and its local
     server on 127.0.0.1:8584.

  Any failed step stops the script and keeps this window open with the error.

  Works with Windows PowerShell 5.1; no extra dependencies.

.PARAMETER ForceInstall
  Run `npm ci` in both packages even if the lockfiles did not change.

.PARAMETER Force
  Do not ask before closing running overlays.

.PARAMETER ListOnly
  Only list the processes a clean start would stop, then exit.
#>
[CmdletBinding()]
param(
  [switch] $ForceInstall,
  [switch] $Force,
  [switch] $ListOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3

$RepoRoot    = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RendererDir = Join-Path $RepoRoot 'renderer'
$MainDir     = Join-Path $RepoRoot 'main'

# Windows started by this script carry this tag in their command line, so the
# next run can find and close them.
$WindowTag   = 'APT-DEV-CLEAN-START'

$RendererUrl = 'http://localhost:5173'
$MainPort    = 8584
$RendererPort = 5173

$InstalledAppName = 'Awakened PoE Trade'   # process name of the installed app

$Host.UI.RawUI.WindowTitle = 'APT dev clean start'

# Keep a copy of the output, so a failure can be read after the window closes.
# Another run still showing its error holds the file, so fall back to a
# per-run name.
$LogFile = Join-Path $env:TEMP 'apt-dev-clean-start.log'
try { Start-Transcript -Path $LogFile -Force -ErrorAction Stop | Out-Null } catch {
  $LogFile = Join-Path $env:TEMP "apt-dev-clean-start-$PID.log"
  try { Start-Transcript -Path $LogFile -Force -ErrorAction Stop | Out-Null } catch { $LogFile = '(no log)' }
}

# ---------------------------------------------------------------- output ----

function Write-Step ([string] $Text) {
  Write-Host ''
  Write-Host "==> $Text" -ForegroundColor Cyan
}
function Write-Info ([string] $Text) { Write-Host "    $Text" }
function Write-Ok   ([string] $Text) { Write-Host "    OK  $Text" -ForegroundColor Green }

class StepFailure : System.Exception {
  StepFailure ([string] $Message) : base($Message) {}
}
function Fail ([string] $Message) { throw [StepFailure]::new($Message) }

# ------------------------------------------------------------- processes ----

function Get-ProcessTable {
  Get-CimInstance Win32_Process |
    Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine
}

function Stop-Tree ([int] $ProcessId, [string] $Label) {
  Write-Info "stopping $Label (PID $ProcessId)"
  # taskkill /T takes the whole tree (npm -> cmd -> node -> electron ...).
  # Its stderr is captured as text; with ErrorActionPreference=Stop, Windows
  # PowerShell would otherwise turn it into a terminating error.
  $ErrorActionPreference = 'Continue'
  $out = (& taskkill.exe /PID $ProcessId /T /F 2>&1 | Out-String).Trim()
  $ErrorActionPreference = 'Stop'
  if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
    Fail "Could not stop $Label (PID $ProcessId): $out`nIf it runs as administrator, close it by hand or run this script elevated."
  }
}

function Get-AncestorIds ([hashtable] $ById, [int] $ProcessId) {
  $ids = @()
  $seen = @{}
  $cur = $ById[$ProcessId]
  while ($null -ne $cur -and -not $seen.ContainsKey([int]$cur.ProcessId)) {
    $seen[[int]$cur.ProcessId] = $true
    $ids += [int]$cur.ProcessId
    $cur = $ById[[int]$cur.ParentProcessId]
  }
  return $ids
}

function Find-DevRoots {
  # Returns the top-most process of every dev tree that belongs to this repo.
  $table = @(Get-ProcessTable)
  $byId = @{}
  foreach ($p in $table) { $byId[[int]$p.ProcessId] = $p }
  # Never touch this script or the shell that started it.
  $protected = Get-AncestorIds $byId $PID

  # A process that is part of a dev run: Vite and Electron loaded from this
  # repo, the `node build/script.mjs` watcher, the npm and cmd wrappers that
  # start them, and windows opened by an earlier run of this script.
  $isDev = {
    param($p)
    $cmd = [string]$p.CommandLine
    $exe = [string]$p.ExecutablePath
    switch ($p.Name) {
      'electron.exe' { return ($exe -like "$RepoRoot\*") }
      'node.exe' {
        return ($cmd -like "*$RepoRoot\*" -or
                $cmd -match 'build/script\.mjs' -or
                $cmd -match 'npm-cli\.js"?\s+run\s+dev')
      }
      'cmd.exe' {
        return ($cmd -like "*$WindowTag*" -or
                $cmd -match '/c\s+vite' -or
                $cmd -match '/c\s+node build/script\.mjs')
      }
    }
    return $false
  }

  $marked = @{}
  foreach ($p in $table) {
    if ($protected -contains [int]$p.ProcessId) { continue }
    if (& $isDev $p) { $marked[[int]$p.ProcessId] = $p }
  }
  # `npm run dev` is only ours if it has a dev child (another project's dev
  # server must survive).
  foreach ($id in @($marked.Keys)) {
    $p = $marked[$id]
    if ($p.Name -eq 'node.exe' -and [string]$p.CommandLine -match 'npm-cli\.js') {
      $hasDevChild = $table | Where-Object { [int]$_.ParentProcessId -eq $id -and $marked.ContainsKey([int]$_.ProcessId) }
      if (-not $hasDevChild) { $marked.Remove($id) }
    }
  }
  # Roots are marked processes with no marked ancestor (Windows sometimes
  # hides a wrapper's command line, so look past the direct parent);
  # taskkill /T on a root takes the rest of its tree.
  return @($marked.Values | Where-Object {
    $above = @(Get-AncestorIds $byId ([int]$_.ProcessId) | Select-Object -Skip 1)
    -not ($above | Where-Object { $marked.ContainsKey($_) })
  })
}

function Get-PortOwner ([int] $Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($conn) { return Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue }
  return $null
}

function Get-OverlayApps {
  # The main Electron process of each running overlay (installed and dev).
  # Electron's helper processes are children of it, so the top one is the app.
  $table = @(Get-ProcessTable)
  $byId = @{}
  foreach ($p in $table) { $byId[[int]$p.ProcessId] = $p }

  $apps = @()
  foreach ($p in $table) {
    $parent = $byId[[int]$p.ParentProcessId]
    $exe = [string]$p.ExecutablePath
    if ($p.Name -eq "$InstalledAppName.exe" -and -not ($parent -and $parent.Name -eq $p.Name)) {
      $port = Get-NetTCPConnection -OwningProcess $p.ProcessId -State Listen -ErrorAction SilentlyContinue |
        Where-Object LocalAddress -eq '127.0.0.1' | Select-Object -First 1 -ExpandProperty LocalPort
      $apps += [pscustomobject]@{ Id = [int]$p.ProcessId; Label = 'installed Awakened PoE Trade'; Port = $port }
    } elseif ($p.Name -eq 'electron.exe' -and $exe -like "$RepoRoot\*" -and -not ($parent -and $parent.Name -eq 'electron.exe')) {
      $apps += [pscustomobject]@{ Id = [int]$p.ProcessId; Label = 'dev overlay (Electron)'; Port = $MainPort }
    }
  }
  return $apps
}

function Send-QuitRequest ([int] $Port) {
  # Same request the overlay's own Quit action sends: main calls app.quit(),
  # so Electron shuts down normally instead of being killed.
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $cts = New-Object System.Threading.CancellationTokenSource 3000
  try {
    $ws.ConnectAsync([Uri]"ws://127.0.0.1:$Port/events", $cts.Token).Wait()
    $json = '{"name":"CLIENT->MAIN::user-action","payload":{"action":"quit"}}'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $segment = New-Object 'System.ArraySegment[byte]' -ArgumentList (, $bytes)
    $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()
    try {
      $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, '', $cts.Token).Wait()
    } catch { }  # the app may already be gone
    return $true
  } catch {
    return $false
  } finally {
    $ws.Dispose()
    $cts.Dispose()
  }
}

function Stop-Overlay ($App) {
  $graceful = $false
  if ($App.Port) {
    Write-Info "asking $($App.Label) (PID $($App.Id)) to quit"
    if (Send-QuitRequest $App.Port) {
      $deadline = (Get-Date).AddSeconds(15)
      while ((Get-Process -Id $App.Id -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 300
      }
      $graceful = -not (Get-Process -Id $App.Id -ErrorAction SilentlyContinue)
    }
  }
  if ($graceful) {
    Write-Ok "$($App.Label) quit"
  } else {
    Write-Host "    $($App.Label) did not quit on request; forcing it" -ForegroundColor Yellow
    Stop-Tree $App.Id $App.Label
  }
}

function Confirm-Restart ($Apps) {
  if ($Force) { return }
  Write-Host ''
  Write-Host 'These overlays are running and will be closed:' -ForegroundColor Yellow
  foreach ($a in $Apps) { Write-Host "    - $($a.Label) (PID $($a.Id))" -ForegroundColor Yellow }
  $answer = Read-Host 'Close them and restart? [y/N]'
  if ($answer -notmatch '^(y|yes)$') {
    Write-Host 'Cancelled; nothing was stopped.'
    exit 2
  }
}

function Stop-Everything {
  Write-Step 'Stopping installed app and running dev processes'

  $apps = @(Get-OverlayApps)
  if ($apps.Count) {
    Confirm-Restart $apps
    foreach ($a in $apps) { Stop-Overlay $a }
  } else {
    Write-Info 'no overlay is running'
  }

  # What is left are watchers and wrappers (Vite, esbuild, npm, cmd) with no
  # state of their own, so they are simply stopped.
  $roots = @(Find-DevRoots)
  foreach ($r in $roots) {
    if (Get-Process -Id $r.ProcessId -ErrorAction SilentlyContinue) {
      Stop-Tree $r.ProcessId "dev process '$($r.Name)'"
    }
  }
  if (-not $roots.Count) { Write-Info 'no dev renderer/main watchers running' }

  # Give Windows a moment to release ports and file locks, then make sure.
  foreach ($port in @($RendererPort, $MainPort)) {
    $deadline = (Get-Date).AddSeconds(10)
    while (($owner = Get-PortOwner $port) -and (Get-Date) -lt $deadline) {
      Start-Sleep -Milliseconds 300
    }
    if ($owner) {
      Fail "Port $port is still in use by $($owner.ProcessName) (PID $($owner.Id)). Close it and try again."
    }
  }
  Write-Ok "ports $RendererPort and $MainPort are free"
}

# ---------------------------------------------------------- dependencies ----

function Get-NpmCommand {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) { Fail 'npm was not found on PATH. Install Node.js and try again.' }
  return $npm.Source
}

function Invoke-Npm ([string] $Dir, [string[]] $NpmArgs) {
  $npm = Get-NpmCommand
  Push-Location $Dir
  try {
    & $npm @NpmArgs
    if ($LASTEXITCODE -ne 0) { Fail "npm $($NpmArgs -join ' ') failed in $Dir (exit code $LASTEXITCODE). See the output above." }
  } finally {
    Pop-Location
  }
}

function Sync-Dependencies ([string] $Dir, [string] $Label) {
  $lock  = Join-Path $Dir 'package-lock.json'
  $stamp = Join-Path $Dir 'node_modules\.apt-dev-lock.sha256'
  if (-not (Test-Path $lock)) { Fail "$Label has no package-lock.json at $lock" }

  $hash = (Get-FileHash $lock -Algorithm SHA256).Hash
  $previous = if (Test-Path $stamp) { (Get-Content $stamp -Raw).Trim() } else { $null }

  if (-not $ForceInstall -and $previous -eq $hash) {
    Write-Ok "$Label dependencies are up to date"
    return
  }
  $reason = if ($ForceInstall) { 'forced' } elseif ($null -eq $previous) { 'no install record yet' } else { 'package-lock.json changed' }
  Write-Info "$Label`: running npm ci ($reason)"
  Invoke-Npm $Dir @('ci')
  # npm ci wipes node_modules, so the stamp is written after it.
  Set-Content -Path $stamp -Value $hash -NoNewline
  Write-Ok "$Label dependencies installed"
}

# ----------------------------------------------------------------- build ----

function Clear-Caches {
  Write-Step 'Clearing stale caches and old builds'
  $paths = @(
    (Join-Path $RendererDir 'node_modules\.vite'),
    (Join-Path $RendererDir 'node_modules\.vite-temp'),
    (Join-Path $MainDir 'dist')
  )
  foreach ($p in $paths) {
    if (Test-Path $p) {
      Remove-Item $p -Recurse -Force
      Write-Info "removed $p"
    }
  }
  Write-Ok 'caches cleared'
}

function Build-DataIndexes {
  Write-Step 'Regenerating renderer data indexes'
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { Fail 'node was not found on PATH. Install Node.js and try again.' }
  Push-Location $RendererDir
  try {
    & $node.Source 'src/assets/make-index-files.mjs'
    if ($LASTEXITCODE -ne 0) { Fail 'Building the data indexes failed; a file under renderer/public/data is probably malformed. See the error above.' }
  } finally {
    Pop-Location
  }
  Write-Ok 'items/stats index files written'
}

# ----------------------------------------------------------------- start ----

function Start-DevWindow ([string] $Dir, [string] $Title) {
  # cmd /k keeps the window open if the process exits, so its error stays readable.
  $cmdLine = "/k title $Title [$WindowTag] && npm run dev"
  $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList $cmdLine -WorkingDirectory $Dir -PassThru
  Write-Info "started '$Title' window (PID $($proc.Id))"
  return $proc
}

function Test-ChildAlive ([int] $ParentId, [string] $ChildName) {
  $all = Get-ProcessTable
  $ids = @($ParentId)
  for ($i = 0; $i -lt $ids.Count; $i++) {
    $ids += @($all | Where-Object { [int]$_.ParentProcessId -eq $ids[$i] } | ForEach-Object { [int]$_.ProcessId })
  }
  return [bool]($all | Where-Object { $ids -contains [int]$_.ProcessId -and $_.Name -eq $ChildName })
}

function Get-Json ([string] $Url) {
  $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
  $type = [string]$res.Headers['Content-Type']
  if ($type -notlike 'application/json*') {
    throw "served as '$type' instead of JSON (Vite did not pick up the file)"
  }
  $null = $res.Content | ConvertFrom-Json
}

function Start-Renderer {
  Write-Step 'Starting renderer (Vite)'
  $win = Start-DevWindow $RendererDir 'APT renderer'

  $checks = @('data/items-overrides.json', 'data/stats-overrides.json')
  $deadline = (Get-Date).AddSeconds(120)
  $lastError = 'no response yet'
  while ((Get-Date) -lt $deadline) {
    if (-not (Test-ChildAlive $win.Id 'node.exe')) {
      if ($win.HasExited -or -not (Get-Process -Id $win.Id -ErrorAction SilentlyContinue)) {
        Fail 'The renderer window closed before Vite came up.'
      }
      # cmd is alive but Vite is gone: it crashed; the window shows why.
      Start-Sleep -Seconds 1
      if (-not (Test-ChildAlive $win.Id 'node.exe')) {
        Fail "Vite exited during startup. Check the 'APT renderer' window for the error."
      }
    }
    try {
      foreach ($path in $checks) {
        try { Get-Json "$RendererUrl/$path" }
        catch { throw "$path`: $($_.Exception.Message)" }
      }
      Write-Ok "renderer serves $($checks -join ', ') as JSON"
      return
    } catch {
      $lastError = $_.Exception.Message
      Start-Sleep -Milliseconds 750
    }
  }
  Fail "The renderer did not serve the override JSON within 120 s. Last error: $lastError"
}

function Start-Main {
  Write-Step 'Starting main (esbuild + Electron)'
  $win = Start-DevWindow $MainDir 'APT main'

  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline) {
    if (-not (Get-Process -Id $win.Id -ErrorAction SilentlyContinue)) {
      Fail 'The main window closed before Electron came up.'
    }
    $owner = Get-PortOwner $MainPort
    if ($owner -and $owner.ProcessName -eq 'electron') {
      Write-Ok "Electron is up and listening on 127.0.0.1:$MainPort"
      return
    }
    Start-Sleep -Milliseconds 750
  }
  if (-not (Test-ChildAlive $win.Id 'node.exe')) {
    Fail "The main build exited. Check the 'APT main' window for the error."
  }
  Fail "Electron did not open port $MainPort within 120 s. Check the 'APT main' window."
}

# ------------------------------------------------------------------ main ----

if ($ListOnly) {
  Get-OverlayApps | ForEach-Object { Write-Host "overlay        PID $($_.Id)  $($_.Label)  port $($_.Port)" }
  Find-DevRoots | ForEach-Object { Write-Host "dev tree root  PID $($_.ProcessId)  $($_.Name)  $($_.CommandLine)" }
  exit 0
}

$started = Get-Date
try {
  Write-Host "Awakened PoE Trade dev clean start ($RepoRoot)" -ForegroundColor White
  $branch = try { & git -C $RepoRoot rev-parse --abbrev-ref HEAD } catch { $null }
  if ($branch) { Write-Info "branch: $branch" }

  Stop-Everything

  Write-Step 'Checking dependencies'
  Sync-Dependencies $RendererDir 'renderer'
  Sync-Dependencies $MainDir 'main'

  Clear-Caches
  Build-DataIndexes
  Start-Renderer
  Start-Main

  $secs = [int]((Get-Date) - $started).TotalSeconds
  Write-Host ''
  Write-Host "Ready in $secs s. The overlay is running from the dev build." -ForegroundColor Green
  Write-Host "This window closes in 10 seconds. Log: $LogFile"
  Start-Sleep -Seconds 10
  exit 0
} catch {
  Write-Host ''
  Write-Host 'FAILED' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  if ($_.Exception -isnot [StepFailure]) {
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
  }
  Write-Host "Log: $LogFile"
  Write-Host ''
  Read-Host 'Press Enter to close'
  exit 1
}
