param(
    [Alias('p')][ValidateRange(1, 65535)][int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$qtRoot = if ($env:QT_ROOT) { $env:QT_ROOT } else { 'C:\Qt\6.11.2\msvc2022_64' }
$env:Path = "$qtRoot\bin;$env:Path"
$env:JUSTLIGHTS_PORT = $Port
$executable = "$root\build-msvc\Release\JustLights.exe"

if (-not (Test-Path $executable)) {
    & "$PSScriptRoot\build-backend.ps1"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$backend = Start-Process -FilePath $executable -ArgumentList @('--no-ui', '--port', $Port) -PassThru
try {
    npm --prefix "$root\ui" run dev
} finally {
    if (-not $backend.HasExited) { Stop-Process -Id $backend.Id }
}
