# Wait for the Afnan scrape to finish, then scrape the rest of popular houses.
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = "D:\Code\this-or-that-fragrance-games" }
Set-Location $Root

$AfnanList = Join-Path $Root "scripts\fragrantica-cache\designers\afnan.json"
$PerfumeDir = Join-Path $Root "scripts\fragrantica-cache\perfumes"
$Log = Join-Path $Root "scripts\fragrantica-cache\continue-popular.log"

function Write-Log([string]$msg) {
  $line = "$(Get-Date -Format o)  $msg"
  Add-Content -Path $Log -Value $line
  Write-Host $line
}

function AfnanCacheComplete {
  if (-not (Test-Path $AfnanList)) { return $false }
  $list = Get-Content $AfnanList -Raw | ConvertFrom-Json
  if (-not $list -or $list.Count -eq 0) { return $false }
  foreach ($item in $list) {
    $id = $item.fragranticaId
    if (-not $id) { return $false }
    $p = Join-Path $PerfumeDir "$id.json"
    if (-not (Test-Path $p)) { return $false }
  }
  return $true
}

function AfnanProcessRunning {
  $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and
      $_.CommandLine -match "scrape-fragrantica\.ts" -and
      $_.CommandLine -match "Afnan"
    }
  return [bool]$procs
}

Write-Log "Watcher started. Waiting for Afnan to finish…"

while ($true) {
  $cacheDone = AfnanCacheComplete
  $running = AfnanProcessRunning
  $count = @(Get-ChildItem $PerfumeDir -Filter "*.json" -ErrorAction SilentlyContinue).Count
  Write-Log "perfume-cache=$count  afnan-cache-complete=$cacheDone  afnan-process=$running"

  if ($cacheDone -and -not $running) { break }
  Start-Sleep -Seconds 45
}

Write-Log "Afnan done. Cooling down 90s before --popular…"
Start-Sleep -Seconds 90

Write-Log "Starting: npx tsx scripts/scrape-fragrantica.ts --popular --delay 3000 --merge"
# Append UTF-8 (not UTF-16) so the log stays readable
& npx tsx scripts/scrape-fragrantica.ts --popular --delay 3000 --merge *>&1 |
  ForEach-Object {
    $line = "$_"
    Add-Content -Path $Log -Value $line -Encoding utf8
    Write-Host $line
  }
Write-Log "Popular scrape exited with code $LASTEXITCODE"
exit $LASTEXITCODE
