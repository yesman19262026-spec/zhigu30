param([int]$Port = 4173)

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\dist"))
$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Local preview: http://127.0.0.1:$Port"
Write-Host "Press Ctrl+C to stop."

$contentTypes = @{
  ".css" = "text/css; charset=utf-8"
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".webmanifest" = "application/manifest+json"
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    $candidate = if ($relative) { [IO.Path]::GetFullPath((Join-Path $root $relative)) } else { Join-Path $root "index.html" }
    if (-not $candidate.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      $candidate = Join-Path $root "index.html"
    }
    $extension = [IO.Path]::GetExtension($candidate)
    $context.Response.ContentType = if ($contentTypes.ContainsKey($extension)) { $contentTypes[$extension] } else { "application/octet-stream" }
    $context.Response.Headers["Cache-Control"] = "no-store"
    $bytes = [IO.File]::ReadAllBytes($candidate)
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
} finally {
  $listener.Close()
}
