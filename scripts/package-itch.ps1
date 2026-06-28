$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$dist = Join-Path $root 'dist'
$out = Join-Path $root 'dist-itch'
$zipPath = Join-Path $root 'chicken-life-itch.zip'
$flatZipPath = Join-Path $root 'chicken-life-itch-flat.zip'

function New-WebZip {
  param(
    [string]$SourceDirectory,
    [string]$DestinationPath
  )

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem

  if (Test-Path $DestinationPath) {
    Remove-Item -LiteralPath $DestinationPath -Force
  }

  $sourcePrefix = [System.IO.Path]::GetFullPath($SourceDirectory).TrimEnd('\') + '\'
  $fileStream = [System.IO.File]::Open(
    $DestinationPath,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::Write
  )
  $archive = [System.IO.Compression.ZipArchive]::new(
    $fileStream,
    [System.IO.Compression.ZipArchiveMode]::Create,
    $false
  )

  try {
    foreach ($file in Get-ChildItem -LiteralPath $SourceDirectory -File -Recurse) {
      $entryName = $file.FullName.Substring($sourcePrefix.Length).Replace('\', '/')
      $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
      $entryStream = $entry.Open()
      $inputStream = [System.IO.File]::OpenRead($file.FullName)
      try {
        $inputStream.CopyTo($entryStream)
      } finally {
        $inputStream.Dispose()
        $entryStream.Dispose()
      }
    }
  } finally {
    $archive.Dispose()
    $fileStream.Dispose()
  }
}

if (-not (Test-Path (Join-Path $dist 'index.html'))) {
  throw 'dist/index.html was not found. Run npm run build first.'
}

if (Test-Path $out) {
  Remove-Item -LiteralPath $out -Recurse -Force
}

New-Item -ItemType Directory -Path $out | Out-Null
Copy-Item -Path (Join-Path $dist 'audio') -Destination (Join-Path $out 'audio') -Recurse -Force

$html = Get-Content -Path (Join-Path $dist 'index.html') -Raw -Encoding UTF8
$scriptMatch = [regex]::Match($html, '<script[^>]+src="\./assets/([^"]+\.js)"[^>]*></script>')
$styleMatch = [regex]::Match($html, '<link[^>]+href="\./assets/([^"]+\.css)"[^>]*>')

if (-not $scriptMatch.Success -or -not $styleMatch.Success) {
  throw 'Could not find built JS/CSS references in dist/index.html.'
}

$css = Get-Content -Path (Join-Path $dist ('assets\' + $styleMatch.Groups[1].Value)) -Raw -Encoding UTF8
$css = $css.Replace('</style', '<\/style')

Copy-Item -Path (Join-Path $dist ('assets\' + $scriptMatch.Groups[1].Value)) -Destination (Join-Path $out 'game.js') -Force

$html = [regex]::Replace(
  $html,
  '<script[^>]+src="\./assets/[^"]+\.js"[^>]*></script>',
  '<script defer src="./game.js"></script>'
)
$html = [regex]::Replace(
  $html,
  '<link[^>]+href="\./assets/[^"]+\.css"[^>]*>',
  "<style>`n$css`n</style>"
)

Set-Content -Path (Join-Path $out 'index.html') -Value $html -Encoding UTF8

New-WebZip -SourceDirectory $out -DestinationPath $zipPath
Copy-Item -Path $zipPath -Destination $flatZipPath -Force

Write-Host "Created $zipPath"
Write-Host "Created $flatZipPath"
