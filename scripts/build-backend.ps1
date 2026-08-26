$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$qtRoot = if ($env:QT_ROOT) { $env:QT_ROOT } else { 'C:\Qt\6.11.2\msvc2022_64' }

cmake -S $root -B "$root\build-msvc" -G "Visual Studio 18 2026" -A x64 -DCMAKE_PREFIX_PATH="$qtRoot"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
cmake --build "$root\build-msvc" --config Release
exit $LASTEXITCODE
