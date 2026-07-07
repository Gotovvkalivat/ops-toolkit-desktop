$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir '..')
$extensionRoot = Resolve-Path (Join-Path $root '..\ops-toolkit-extension-repo')
$src = Join-Path $extensionRoot 'src'

function Reset-Copy($from, $to) {
  if (Test-Path -LiteralPath $to) {
    Remove-Item -LiteralPath $to -Recurse -Force
  }
  Copy-Item -LiteralPath $from -Destination $to -Recurse -Force
}

Reset-Copy (Join-Path $src 'app') (Join-Path $root 'public\calculator')
Reset-Copy (Join-Path $src 'order-app') (Join-Path $root 'public\orders')
Copy-Item -LiteralPath (Join-Path $src 'app\vendor') -Destination (Join-Path $root 'public\orders\vendor') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $src 'extension\background.js') -Destination (Join-Path $root 'server\background-runtime-source.js') -Force
Copy-Item -LiteralPath (Join-Path $root 'desktop-assets\bridge.js') -Destination (Join-Path $root 'public\calculator\bridge.js') -Force
Copy-Item -LiteralPath (Join-Path $root 'desktop-assets\bridge.js') -Destination (Join-Path $root 'public\orders\bridge.js') -Force

Write-Host "Desktop UI synchronized from $extensionRoot"
