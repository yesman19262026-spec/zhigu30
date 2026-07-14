$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$dist = [IO.Path]::GetFullPath((Join-Path $root "dist"))
if (-not $dist.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw "Build path is outside the project directory." }

if (Test-Path -LiteralPath $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
[IO.Directory]::CreateDirectory($dist) | Out-Null
[IO.Directory]::CreateDirectory((Join-Path $dist "assets")) | Out-Null
[IO.Directory]::CreateDirectory((Join-Path $dist "data")) | Out-Null

foreach ($name in @("index.html", "styles.css", "market-config.js", "manifest.webmanifest", "sw.js")) {
  [IO.File]::Copy((Join-Path $root $name), (Join-Path $dist $name), $true)
}
[IO.File]::Copy((Join-Path $root "assets\icon.svg"), (Join-Path $dist "assets\icon.svg"), $true)
[IO.File]::Copy((Join-Path $root "data\market-snapshot.json"), (Join-Path $dist "data\market-snapshot.json"), $true)
[IO.File]::Copy((Join-Path $root "data\live-market.json"), (Join-Path $dist "data\live-market.json"), $true)

$utf8 = [Text.UTF8Encoding]::new($false)
$courses = [IO.File]::ReadAllText((Join-Path $root "data\courses.js"), $utf8)
$app = [IO.File]::ReadAllText((Join-Path $root "app.js"), $utf8)
[IO.File]::WriteAllText((Join-Path $dist "app.js"), "$courses`n`n$app", $utf8)
Write-Host "Local build complete: $dist"
