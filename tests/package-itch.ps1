param(
  [string]$ZipPath = (Join-Path $PSScriptRoot '..\chicken-life-itch-flat.zip')
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem

$resolvedZip = Resolve-Path $ZipPath
$zip = [System.IO.Compression.ZipFile]::OpenRead($resolvedZip)

try {
  $entries = @($zip.Entries | ForEach-Object { $_.FullName })
} finally {
  $zip.Dispose()
}

$windowsPaths = @($entries | Where-Object { $_.Contains('\') })
if ($windowsPaths.Count -gt 0) {
  throw "ZIP entries must use web paths with forward slashes: $($windowsPaths -join ', ')"
}

$requiredEntries = @(
  'index.html',
  'game.js',
  'audio/bgm-day.mp3',
  'audio/bgm-night.mp3',
  'audio/sfx-peck.mp3'
)

foreach ($entry in $requiredEntries) {
  if ($entries -notcontains $entry) {
    throw "Required itch file is missing from ZIP: $entry"
  }
}

Write-Host "itch package paths are valid: $resolvedZip"
