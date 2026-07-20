# Start Chrome with remote debugging so the scraper can reuse YOUR working session.
# Usage:
#   1. Close ALL Chrome windows (check tray)
#   2. .\scripts\start-chrome-debug.ps1
#   3. Open https://www.fragrantica.com/ and a perfume page — confirm they load
#   4. npx tsx scripts/scrape-fragrantica.ts --popular --delay 4000 --merge --cdp 9222

$ErrorActionPreference = "Stop"
$port = if ($args[0]) { $args[0] } else { "9222" }

$chrome = @(
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  Write-Error "Chrome not found. Install Google Chrome or pass the full path."
}

$running = Get-Process chrome -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "Chrome is still running. Close every Chrome window (including tray), then re-run this script."
  Write-Host "Or kill it with: Stop-Process -Name chrome -Force"
  exit 1
}

Write-Host "Starting Chrome with --remote-debugging-port=$port"
Write-Host "Leave this Chrome open. Then run the scraper with --cdp $port"
Start-Process -FilePath $chrome -ArgumentList @(
  "--remote-debugging-port=$port",
  "--restore-last-session",
  "https://www.fragrantica.com/"
)
