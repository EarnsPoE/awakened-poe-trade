<#
.SYNOPSIS
  Puts an "APT Dev (clean start)" shortcut on the desktop that runs
  scripts/dev-clean-start.ps1 for this checkout.
#>
$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Script   = Join-Path $RepoRoot 'scripts\dev-clean-start.ps1'
$Icon     = Join-Path $RepoRoot 'main\build\icons\icon.ico'
$Desktop  = [Environment]::GetFolderPath('Desktop')
$LinkPath = Join-Path $Desktop 'APT Dev (clean start).lnk'

$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($LinkPath)
$link.TargetPath       = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$link.Arguments        = "-NoProfile -ExecutionPolicy Bypass -File `"$Script`""
$link.WorkingDirectory = $RepoRoot
$link.Description      = 'Stop the installed and dev overlays, then start the local dev build cleanly'
if (Test-Path $Icon) { $link.IconLocation = "$Icon,0" }
$link.Save()

Write-Host "Created $LinkPath"
