param([int]$Port = 8007, [switch]$NoBrowser)
# Startet den lokalen Dev-Server und öffnet das Spiel im Browser.
Set-Location $PSScriptRoot
if (-not $NoBrowser) { Start-Process "http://localhost:$Port" }
python "$PSScriptRoot\dev\serve.py" $Port
