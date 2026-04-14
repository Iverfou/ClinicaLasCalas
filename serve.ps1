param([int]$Port = 8080)
if ($env:PORT) { $Port = [int]$env:PORT }

$root = $PSScriptRoot

$mime = @{
  '.html'  = 'text/html; charset=utf-8'
  '.css'   = 'text/css'
  '.js'    = 'application/javascript; charset=utf-8'
  '.json'  = 'application/json'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.jpeg'  = 'image/jpeg'
  '.gif'   = 'image/gif'
  '.svg'   = 'image/svg+xml'
  '.ico'   = 'image/x-icon'
  '.woff'  = 'font/woff'
  '.woff2' = 'font/woff2'
  '.webp'  = 'image/webp'
  '.txt'   = 'text/plain'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "Server running at http://localhost:$Port"
[Console]::Out.Flush()

while ($true) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response

  try {
    $urlPath = $req.Url.LocalPath
    if ($urlPath -eq '/' -or $urlPath -eq '') { $urlPath = '/index.html' }
    if ($urlPath.EndsWith('/')) { $urlPath += 'index.html' }
    $urlPath = $urlPath -replace '\.\.', ''

    $filePath = Join-Path $root ($urlPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar))

    if (Test-Path $filePath -PathType Leaf) {
      $ext   = [System.IO.Path]::GetExtension($filePath).ToLower()
      $ct    = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)

      $res.StatusCode      = 200
      $res.ContentType     = $ct
      $res.ContentLength64 = $bytes.LongLength
      $res.Headers.Set('Cache-Control', 'no-store')
      $res.Headers.Set('Access-Control-Allow-Origin', '*')
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $body  = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
      $res.StatusCode      = 404
      $res.ContentType     = 'text/plain'
      $res.ContentLength64 = $body.Length
      $res.OutputStream.Write($body, 0, $body.Length)
    }
  } catch {
    # swallow errors to keep server alive
  } finally {
    $res.OutputStream.Close()
  }
}
