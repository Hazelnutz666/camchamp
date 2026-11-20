param([int]$Port = 8007, [switch]$NoBrowser, [switch]$Https)
# Startet den lokalen Dev-Server und öffnet das Spiel im Browser.
# -Https: Server im LAN per HTTPS erreichbar (Handy/Tablet mit Kamera), selbstsigniertes Zertifikat.
Set-Location $PSScriptRoot
$scheme = if ($Https) { 'https' } else { 'http' }
if (-not $NoBrowser) { Start-Process "${scheme}://localhost:$Port" }
if ($Https) { python "$PSScriptRoot\dev\serve.py" $Port --https }
else { python "$PSScriptRoot\dev\serve.py" $Port }
