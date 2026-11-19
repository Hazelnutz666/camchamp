param([int]$Port = 8765, [string]$Game = '', [string]$Screenshot = '')
# Headless smoke test: starts the dev server, runs index.html?smoke in Chrome/Edge, prints the JSON report.
#   .\dev\smoke.ps1                                   all modes
#   .\dev\smoke.ps1 -Game fruit-slasher -Screenshot C:\temp\fs.png   one mode, PNG of the last frame
# Camera paths can't be tested headless here: Chrome's fake media device never resolves getUserMedia on this machine.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome/Edge not found' }

$server = Start-Process python -ArgumentList "`"$root\dev\serve.py`"", $Port -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Milliseconds 800
  $profileDir = Join-Path $env:TEMP "webcamspiel-smoke-$(Get-Random)"
  $url = "http://localhost:$Port/index.html?smoke=$Game"
  $dom = & $browser --headless=new --disable-gpu --no-first-run --window-size=1280,720 `
    --user-data-dir="$profileDir" --virtual-time-budget=60000 --dump-dom $url 2>$null | Out-String
  if ($dom -match '<pre id="smoke-result">(.*?)</pre>') {
    $json = [System.Net.WebUtility]::HtmlDecode($Matches[1]) | ConvertFrom-Json
    # Headless Chrome doesn't composite canvas frames for --screenshot, so the page exports the canvas itself.
    if ($json.image) {
      if ($Screenshot) {
        [IO.File]::WriteAllBytes($Screenshot, [Convert]::FromBase64String(($json.image -split ',', 2)[1]))
        "screenshot: $Screenshot"
      }
      $json.PSObject.Properties.Remove('image')
    }
    $json | ConvertTo-Json -Depth 6
    if ($json.errors.Count -gt 0) { exit 1 }
  } else {
    Write-Error 'No smoke result found (page crashed or timed out).'
  }
} finally {
  Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
  Remove-Item $profileDir -Recurse -Force -ErrorAction SilentlyContinue
}
