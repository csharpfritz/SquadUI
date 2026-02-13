# Launch SquadUI in VS Code Extension Development Host
# Usage: .\launch-dev.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔧 Compiling extension..." -ForegroundColor Cyan
npm run compile

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Compilation failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Compilation successful" -ForegroundColor Green
Write-Host "🚀 Launching Extension Development Host..." -ForegroundColor Cyan

# Open the project in VS Code - user should press F5 to launch Extension Development Host
code "$PSScriptRoot"

Write-Host ""
Write-Host "📋 VS Code opened with SquadUI project" -ForegroundColor Yellow
Write-Host "👉 Press F5 to launch the Extension Development Host" -ForegroundColor Yellow
Write-Host "🌳 In the new window, look for SquadUI icon in the Activity Bar" -ForegroundColor Yellow
